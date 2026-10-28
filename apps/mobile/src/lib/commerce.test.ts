import { describe, expect, it } from 'vitest';

import { addOrReplaceCartLine, applyCheckoutOutcome, calculateCart, cartFromOrder, checkoutCanStart, checkoutRecoveryReceipt, checkoutRecoveryReference, emptyCommerceState } from './commerce';

function cart(option: 'one-time' | 'subscription' = 'one-time') {
  return addOrReplaceCartLine([], { productId: 'nella-calm-barrier-cream', quantity: 1, purchaseOption: option, intervalWeeks: option === 'subscription' ? 6 : undefined });
}

describe('commerce domain', () => {
  it('derives price, shipping, tax, and total from the catalogue rather than client input', () => {
    expect(calculateCart(cart())).toMatchObject({ subtotalAmount: 2400, shippingAmount: 500, taxAmount: 288, totalAmount: 3188, currency: 'CAD' });
  });

  it('rejects stale catalogue versions and unavailable products', () => {
    expect(() => calculateCart([{ ...cart()[0], catalogueVersion: 999 }])).toThrow('CatalogueChanged');
    expect(() => addOrReplaceCartLine([], { productId: 'nella-calm-travel-size', quantity: 1, purchaseOption: 'one-time' })).toThrow('ProductUnavailable');
  });

  it('requires an account and a non-empty cart before checkout', () => {
    expect(checkoutCanStart(undefined, cart())).toBe(false);
    expect(checkoutCanStart('account-1', [])).toBe(false);
    expect(checkoutCanStart('account-1', cart())).toBe(true);
  });

  it.each(['failed', 'cancelled'] as const)('preserves the cart after a %s checkout', (outcome) => {
    const state = applyCheckoutOutcome({ ...emptyCommerceState, cart: cart() }, { checkoutId: `co-${outcome}`, outcome, completedAt: '2026-10-12T00:00:00.000Z', orderId: 'ord-unused', subscriptionId: 'sub-unused' });
    expect(state.cart).toHaveLength(1);
    expect(state.orders).toHaveLength(0);
    expect(state.checkoutReceipts[0].outcome).toBe(outcome);
  });

  it('requires a matching failed receipt before rendering checkout recovery claims', () => {
    const failed = { checkoutId: 'checkout-abcd-1234', outcome: 'failed' as const, completedAt: '2026-10-12T00:00:00.000Z' };
    const succeeded = { ...failed, checkoutId: 'checkout-success', outcome: 'succeeded' as const };
    expect(checkoutRecoveryReceipt([failed, succeeded], failed.checkoutId)).toBe(failed);
    expect(checkoutRecoveryReceipt([failed, succeeded], succeeded.checkoutId)).toBeUndefined();
    expect(checkoutRecoveryReceipt([failed], ['checkout-abcd-1234'])).toBeUndefined();
    expect(checkoutRecoveryReference(failed)).toBe('DRAFT-ABCD1234');
  });

  it('creates one demo order only once after success and clears the cart', () => {
    const input = { checkoutId: 'co-1', outcome: 'succeeded' as const, completedAt: '2026-10-12T00:00:00.000Z', orderId: 'ord-1', subscriptionId: 'sub-1' };
    const first = applyCheckoutOutcome({ ...emptyCommerceState, cart: cart() }, input);
    const duplicate = applyCheckoutOutcome(first, input);
    expect(first.cart).toHaveLength(0);
    expect(first.orders).toHaveLength(1);
    expect(duplicate.orders).toHaveLength(1);
    expect(first.orders[0]).toMatchObject({ id: 'ord-1', demoOnly: true, totalAmount: 3188 });
  });

  it('models subscriptions only as recurring physical shipments', () => {
    const state = applyCheckoutOutcome({ ...emptyCommerceState, cart: cart('subscription') }, { checkoutId: 'co-sub', outcome: 'succeeded', completedAt: '2026-10-12T00:00:00.000Z', orderId: 'ord-sub', subscriptionId: 'sub' });
    expect(state.subscriptions[0]).toMatchObject({ intervalWeeks: 6, unitAmount: 2160, physicalShipmentOnly: true, status: 'active' });
    expect(state.subscriptions[0]).not.toHaveProperty('entitlement');
  });

  it('builds a server-repriced one-time cart when buying an order again', () => {
    const state = applyCheckoutOutcome({ ...emptyCommerceState, cart: cart('subscription') }, { checkoutId: 'co-reorder', outcome: 'succeeded', completedAt: '2026-10-12T00:00:00.000Z', orderId: 'ord-reorder', subscriptionId: 'sub-reorder' });
    expect(cartFromOrder(state.orders[0])).toEqual([{ productId: 'nella-calm-barrier-cream', quantity: 1, purchaseOption: 'one-time', intervalWeeks: undefined, catalogueVersion: 1 }]);
  });
});
