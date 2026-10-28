import { describe, expect, it, vi } from 'vitest';

import { addOrReplaceCartLine, applyCheckoutOutcome, emptyCommerceState } from './commerce';
import { parseCommerceState } from './commerce-storage';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

describe('commerce storage parsing', () => {
  it('round-trips valid account-owned state', () => {
    const cart = addOrReplaceCartLine([], { productId: 'nella-calm-barrier-cream', quantity: 1, purchaseOption: 'one-time' });
    const state = applyCheckoutOutcome({ ...emptyCommerceState, cart }, { checkoutId: 'co-1', outcome: 'succeeded', completedAt: '2026-10-12T00:00:00.000Z', orderId: 'ord-1', subscriptionId: 'sub-1' });
    expect(parseCommerceState(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  it('fails closed on unknown products, malformed amounts, and duplicate checkout receipts', () => {
    expect(() => parseCommerceState({ cart: [{ productId: 'unknown', quantity: 1, purchaseOption: 'one-time', catalogueVersion: 1 }], orders: [], subscriptions: [], checkoutReceipts: [] })).toThrow();
    expect(() => parseCommerceState({ cart: [], orders: [{ id: 'ord-1' }], subscriptions: [], checkoutReceipts: [] })).toThrow();
    const duplicate = { checkoutId: 'co-1', outcome: 'failed', completedAt: '2026-10-12T00:00:00.000Z' };
    expect(() => parseCommerceState({ cart: [], orders: [], subscriptions: [], checkoutReceipts: [duplicate, duplicate] })).toThrow('Duplicate commerce record');
    expect(() => parseCommerceState({ cart: [], orders: [], subscriptions: [], checkoutReceipts: [{ ...duplicate, completedAt: 'not-a-date' }] })).toThrow('Invalid checkout receipt');
  });
});
