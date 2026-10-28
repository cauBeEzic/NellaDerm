export type PurchaseOption = 'one-time' | 'subscription';
export type SubscriptionInterval = 4 | 6 | 8;
export type CheckoutOutcome = 'succeeded' | 'failed' | 'cancelled';
export type OrderStatus = 'preparing' | 'shipped' | 'delivered';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export type CatalogueProduct = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  size: string;
  currency: 'CAD';
  unitAmount: number;
  available: boolean;
  version: number;
  subscriptionIntervals: SubscriptionInterval[];
};

export type CartLine = {
  productId: string;
  quantity: number;
  purchaseOption: PurchaseOption;
  intervalWeeks?: SubscriptionInterval;
  catalogueVersion: number;
};

export type OrderLine = CartLine & {
  name: string;
  unitAmount: number;
};

export type CommerceOrder = {
  id: string;
  createdAt: string;
  status: OrderStatus;
  lines: OrderLine[];
  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: 'CAD';
  estimatedArrival: string;
  demoOnly: true;
};

export type CommerceSubscription = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  intervalWeeks: SubscriptionInterval;
  unitAmount: number;
  currency: 'CAD';
  status: SubscriptionStatus;
  nextDeliveryAt: string;
  updatedAt: string;
  physicalShipmentOnly: true;
};

export type CheckoutReceipt = {
  checkoutId: string;
  outcome: CheckoutOutcome;
  completedAt: string;
  orderId?: string;
};

export type CommerceState = {
  cart: CartLine[];
  orders: CommerceOrder[];
  subscriptions: CommerceSubscription[];
  checkoutReceipts: CheckoutReceipt[];
};

export const demoCatalogue: CatalogueProduct[] = [
  {
    id: 'nella-calm-barrier-cream',
    name: 'NellaCalm Barrier Cream',
    shortName: 'NellaCalm',
    description: 'Daily moisturizer for dry, sensitive skin.',
    size: '50 mL · illustrative size',
    currency: 'CAD',
    unitAmount: 2400,
    available: true,
    version: 1,
    subscriptionIntervals: [4, 6, 8],
  },
  {
    id: 'nella-calm-travel-size',
    name: 'NellaCalm Travel Size',
    shortName: 'NellaCalm Travel',
    description: 'Travel-size moisturizer.',
    size: 'Illustrative size',
    currency: 'CAD',
    unitAmount: 1200,
    available: false,
    version: 1,
    subscriptionIntervals: [],
  },
];

export const emptyCommerceState: CommerceState = {
  cart: [],
  orders: [],
  subscriptions: [],
  checkoutReceipts: [],
};

export function catalogueProduct(productId: string) {
  return demoCatalogue.find((product) => product.id === productId);
}

export function formatCad(amount: number) {
  return `$${(amount / 100).toFixed(amount % 100 ? 2 : 0)} CAD`;
}

export function addOrReplaceCartLine(lines: CartLine[], next: Omit<CartLine, 'catalogueVersion'>) {
  const product = catalogueProduct(next.productId);
  if (!product?.available) throw new Error('ProductUnavailable');
  if (!Number.isInteger(next.quantity) || next.quantity < 1 || next.quantity > 9) throw new Error('InvalidQuantity');
  if (next.purchaseOption === 'subscription' && (!next.intervalWeeks || !product.subscriptionIntervals.includes(next.intervalWeeks))) throw new Error('InvalidSubscriptionInterval');
  const line: CartLine = {
    ...next,
    intervalWeeks: next.purchaseOption === 'subscription' ? next.intervalWeeks : undefined,
    catalogueVersion: product.version,
  };
  return [...lines.filter((item) => item.productId !== line.productId), line];
}

export function calculateCart(lines: CartLine[]) {
  const normalized = lines.map((line) => {
    const product = catalogueProduct(line.productId);
    if (!product?.available || line.catalogueVersion !== product.version) throw new Error('CatalogueChanged');
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 9) throw new Error('InvalidQuantity');
    if (line.purchaseOption === 'subscription' && (!line.intervalWeeks || !product.subscriptionIntervals.includes(line.intervalWeeks))) throw new Error('InvalidSubscriptionInterval');
    return { line, product, lineAmount: product.unitAmount * line.quantity };
  });
  const subtotalAmount = normalized.reduce((total, item) => total + item.lineAmount, 0);
  const shippingAmount = subtotalAmount ? 500 : 0;
  const taxAmount = Math.round(subtotalAmount * 0.12);
  return {
    lines: normalized,
    subtotalAmount,
    shippingAmount,
    taxAmount,
    totalAmount: subtotalAmount + shippingAmount + taxAmount,
    currency: 'CAD' as const,
  };
}

export function checkoutCanStart(userId: string | undefined, lines: CartLine[]) {
  return Boolean(userId && lines.length);
}

export function checkoutRecoveryReceipt(receipts: CheckoutReceipt[], checkoutId: string | string[] | undefined) {
  if (typeof checkoutId !== 'string') return undefined;
  return receipts.find((receipt) => receipt.checkoutId === checkoutId && receipt.outcome !== 'succeeded');
}

export function checkoutRecoveryReference(receipt: CheckoutReceipt) {
  const suffix = receipt.checkoutId.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase();
  return suffix ? `DRAFT-${suffix}` : undefined;
}

function addWeeks(isoDate: string, weeks: number) {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + (weeks * 7));
  return date.toISOString();
}

export function applyCheckoutOutcome(
  state: CommerceState,
  input: { checkoutId: string; outcome: CheckoutOutcome; completedAt: string; orderId: string; subscriptionId: string },
): CommerceState {
  if (state.checkoutReceipts.some((receipt) => receipt.checkoutId === input.checkoutId)) return state;
  if (input.outcome !== 'succeeded') {
    return {
      ...state,
      checkoutReceipts: [...state.checkoutReceipts, { checkoutId: input.checkoutId, outcome: input.outcome, completedAt: input.completedAt }],
    };
  }

  const summary = calculateCart(state.cart);
  if (!summary.lines.length) throw new Error('EmptyCart');
  const orderLines: OrderLine[] = summary.lines.map(({ line, product }) => ({ ...line, name: product.name, unitAmount: product.unitAmount }));
  const order: CommerceOrder = {
    id: input.orderId,
    createdAt: input.completedAt,
    status: 'preparing',
    lines: orderLines,
    subtotalAmount: summary.subtotalAmount,
    shippingAmount: summary.shippingAmount,
    taxAmount: summary.taxAmount,
    totalAmount: summary.totalAmount,
    currency: 'CAD',
    estimatedArrival: addWeeks(input.completedAt, 1),
    demoOnly: true,
  };
  const subscriptions = orderLines
    .filter((line): line is OrderLine & { intervalWeeks: SubscriptionInterval } => line.purchaseOption === 'subscription' && Boolean(line.intervalWeeks))
    .map<CommerceSubscription>((line, index) => ({
      id: `${input.subscriptionId}-${index + 1}`,
      productId: line.productId,
      productName: line.name,
      quantity: line.quantity,
      intervalWeeks: line.intervalWeeks,
      unitAmount: Math.round(line.unitAmount * 0.9),
      currency: 'CAD',
      status: 'active',
      nextDeliveryAt: addWeeks(input.completedAt, line.intervalWeeks),
      updatedAt: input.completedAt,
      physicalShipmentOnly: true,
    }));
  return {
    cart: [],
    orders: [order, ...state.orders],
    subscriptions: [...subscriptions, ...state.subscriptions],
    checkoutReceipts: [...state.checkoutReceipts, { checkoutId: input.checkoutId, outcome: input.outcome, completedAt: input.completedAt, orderId: order.id }],
  };
}

export function cartFromOrder(order: CommerceOrder) {
  return order.lines.reduce<CartLine[]>((lines, line) => addOrReplaceCartLine(lines, {
    productId: line.productId,
    quantity: line.quantity,
    purchaseOption: 'one-time',
  }), []);
}
