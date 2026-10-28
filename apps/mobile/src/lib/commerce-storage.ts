import * as SecureStore from 'expo-secure-store';

import { catalogueProduct, emptyCommerceState, type CartLine, type CheckoutReceipt, type CommerceOrder, type CommerceState, type CommerceSubscription } from './commerce';

const commerceKey = (userId: string) => `myeczema.commerce.${userId}`;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseCartLine(value: unknown): CartLine {
  if (!isObject(value) || typeof value.productId !== 'string' || !catalogueProduct(value.productId)) throw new Error('Invalid commerce cart line.');
  if (!Number.isInteger(value.quantity) || (value.quantity as number) < 1 || (value.quantity as number) > 9) throw new Error('Invalid commerce quantity.');
  if (value.purchaseOption !== 'one-time' && value.purchaseOption !== 'subscription') throw new Error('Invalid purchase option.');
  if (!Number.isInteger(value.catalogueVersion) || (value.catalogueVersion as number) < 1) throw new Error('Invalid catalogue version.');
  if (value.purchaseOption === 'subscription' && ![4, 6, 8].includes(value.intervalWeeks as number)) throw new Error('Invalid subscription interval.');
  return {
    productId: value.productId,
    quantity: value.quantity as number,
    purchaseOption: value.purchaseOption,
    intervalWeeks: value.purchaseOption === 'subscription' ? value.intervalWeeks as 4 | 6 | 8 : undefined,
    catalogueVersion: value.catalogueVersion as number,
  };
}

function parseOrder(value: unknown): CommerceOrder {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.createdAt !== 'string' || !['preparing', 'shipped', 'delivered'].includes(value.status as string)) throw new Error('Invalid order.');
  if (!Array.isArray(value.lines) || !value.lines.length) throw new Error('Invalid order lines.');
  const lines = value.lines.map((line) => {
    const parsed = parseCartLine(line);
    if (!isObject(line) || typeof line.name !== 'string' || !Number.isInteger(line.unitAmount)) throw new Error('Invalid order line snapshot.');
    return { ...parsed, name: line.name, unitAmount: line.unitAmount as number };
  });
  if (![value.subtotalAmount, value.shippingAmount, value.taxAmount, value.totalAmount].every(Number.isInteger) || value.currency !== 'CAD' || typeof value.estimatedArrival !== 'string' || value.demoOnly !== true) throw new Error('Invalid order totals.');
  return { id: value.id, createdAt: value.createdAt, status: value.status as CommerceOrder['status'], lines, subtotalAmount: value.subtotalAmount as number, shippingAmount: value.shippingAmount as number, taxAmount: value.taxAmount as number, totalAmount: value.totalAmount as number, currency: 'CAD', estimatedArrival: value.estimatedArrival, demoOnly: true };
}

function parseSubscription(value: unknown): CommerceSubscription {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.productId !== 'string' || !catalogueProduct(value.productId) || typeof value.productName !== 'string') throw new Error('Invalid subscription.');
  if (!Number.isInteger(value.quantity) || ![4, 6, 8].includes(value.intervalWeeks as number) || !Number.isInteger(value.unitAmount) || value.currency !== 'CAD') throw new Error('Invalid subscription values.');
  if (!['active', 'paused', 'cancelled'].includes(value.status as string) || typeof value.nextDeliveryAt !== 'string' || typeof value.updatedAt !== 'string' || value.physicalShipmentOnly !== true) throw new Error('Invalid subscription state.');
  return { id: value.id, productId: value.productId, productName: value.productName, quantity: value.quantity as number, intervalWeeks: value.intervalWeeks as 4 | 6 | 8, unitAmount: value.unitAmount as number, currency: 'CAD', status: value.status as CommerceSubscription['status'], nextDeliveryAt: value.nextDeliveryAt, updatedAt: value.updatedAt, physicalShipmentOnly: true };
}

function parseReceipt(value: unknown): CheckoutReceipt {
  if (!isObject(value) || typeof value.checkoutId !== 'string' || !value.checkoutId.trim() || !['succeeded', 'failed', 'cancelled'].includes(value.outcome as string) || typeof value.completedAt !== 'string' || Number.isNaN(new Date(value.completedAt).getTime())) throw new Error('Invalid checkout receipt.');
  if (value.orderId !== undefined && typeof value.orderId !== 'string') throw new Error('Invalid checkout order reference.');
  return { checkoutId: value.checkoutId, outcome: value.outcome as CheckoutReceipt['outcome'], completedAt: value.completedAt, orderId: value.orderId as string | undefined };
}

export function parseCommerceState(value: unknown): CommerceState {
  if (!isObject(value) || !Array.isArray(value.cart) || !Array.isArray(value.orders) || !Array.isArray(value.subscriptions) || !Array.isArray(value.checkoutReceipts)) throw new Error('Invalid commerce state.');
  const state = { cart: value.cart.map(parseCartLine), orders: value.orders.map(parseOrder), subscriptions: value.subscriptions.map(parseSubscription), checkoutReceipts: value.checkoutReceipts.map(parseReceipt) };
  if (new Set(state.orders.map((order) => order.id)).size !== state.orders.length || new Set(state.subscriptions.map((subscription) => subscription.id)).size !== state.subscriptions.length || new Set(state.checkoutReceipts.map((receipt) => receipt.checkoutId)).size !== state.checkoutReceipts.length) throw new Error('Duplicate commerce record.');
  return state;
}

export async function loadCommerceState(userId: string) {
  const stored = await SecureStore.getItemAsync(commerceKey(userId));
  return stored ? parseCommerceState(JSON.parse(stored) as unknown) : { ...emptyCommerceState };
}

export async function saveCommerceState(userId: string, state: CommerceState) {
  await SecureStore.setItemAsync(commerceKey(userId), JSON.stringify(parseCommerceState(state)));
}

export const commerceStorageKeys = { commerceKey };
