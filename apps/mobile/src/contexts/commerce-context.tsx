import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/contexts/auth-context';
import {
  addOrReplaceCartLine,
  applyCheckoutOutcome,
  cartFromOrder,
  emptyCommerceState,
  type CheckoutOutcome,
  type CommerceState,
  type PurchaseOption,
  type SubscriptionInterval,
} from '@/lib/commerce';
import { loadCommerceState, saveCommerceState } from '@/lib/commerce-storage';

type AddCartInput = {
  productId: string;
  quantity?: number;
  purchaseOption?: PurchaseOption;
  intervalWeeks?: SubscriptionInterval;
};

type CommerceContextValue = {
  state: CommerceState;
  loading: boolean;
  busy: boolean;
  error?: string;
  checkoutStatus?: 'pending' | CheckoutOutcome;
  addToCart: (input: AddCartInput) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  completeDemoCheckout: (outcome?: CheckoutOutcome) => Promise<{ checkoutId: string; outcome: CheckoutOutcome; orderId?: string }>;
  buyAgain: (orderId: string) => Promise<void>;
  updateSubscription: (subscriptionId: string, update: { intervalWeeks?: SubscriptionInterval; nextDeliveryAt?: string; status?: 'active' | 'paused' | 'cancelled' }) => Promise<void>;
  retry: () => void;
};

const CommerceContext = createContext<CommerceContextValue | null>(null);

function mergeCarts(account: CommerceState, guestCart: CommerceState['cart']): CommerceState {
  if (!guestCart.length) return account;
  const cart = guestCart.reduce((lines, line) => addOrReplaceCartLine(lines, line), account.cart);
  return { ...account, cart };
}

function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CommerceProvider({ children }: PropsWithChildren) {
  const { loading: authLoading, user } = useAuth();
  const [state, setState] = useState<CommerceState>({ ...emptyCommerceState });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [checkoutStatus, setCheckoutStatus] = useState<CommerceContextValue['checkoutStatus']>();
  const [retryAttempt, setRetryAttempt] = useState(0);
  const scope = useMemo(() => ({ user, authLoading, retryAttempt }), [authLoading, retryAttempt, user]);
  const scopeRef = useRef(scope);
  const [loadedScope, setLoadedScope] = useState<typeof scope | null>(null);
  useLayoutEffect(() => { scopeRef.current = scope; }, [scope]);
  const isCurrent = useCallback(() => scopeRef.current === scope && !authLoading, [authLoading, scope]);
  const stateRef = useRef(state);
  const ownerRef = useRef<string>('guest');
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const checkoutInFlightRef = useRef<typeof scope | null>(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    const nextOwner = user?.userId ?? 'guest';
    const previousOwner = ownerRef.current;
    const guestCart = previousOwner === 'guest' ? stateRef.current.cart : [];
    ownerRef.current = nextOwner;
    const expectedUserId = user?.userId;
    queueRef.current = queueRef.current.catch(() => undefined).then(async () => {
      if (!active || !isCurrent() || ownerRef.current !== nextOwner) return;
      setLoading(true);
      setBusy(false);
      setError(undefined);
      setCheckoutStatus(undefined);
      setState({ ...emptyCommerceState });
      stateRef.current = { ...emptyCommerceState };
      if (!expectedUserId) {
        setLoadedScope(scope);
        setLoading(false);
        return;
      }
      try {
        const loaded = await loadCommerceState(expectedUserId);
        const next = mergeCarts(loaded, guestCart);
        if (guestCart.length) await saveCommerceState(expectedUserId, next);
        if (active && isCurrent() && ownerRef.current === expectedUserId) {
          stateRef.current = next;
          setState(next);
          setError(undefined);
        }
      } catch {
        if (active && isCurrent() && ownerRef.current === expectedUserId) setError('Commerce data could not be opened safely. Reload before changing your cart or orders.');
      } finally {
        if (active && isCurrent() && ownerRef.current === expectedUserId) {
          setLoadedScope(scope);
          setLoading(false);
        }
      }
    });
    return () => { active = false; };
  }, [authLoading, isCurrent, scope, user]);

  const commit = useCallback(async (transform: (current: CommerceState) => CommerceState) => {
    const expectedOwner = user?.userId ?? 'guest';
    const assertOwner = () => {
      if (!isCurrent() || ownerRef.current !== expectedOwner) throw new Error('CommerceUnavailable');
    };
    assertOwner();
    if (loading || error || loadedScope !== scope) throw new Error('CommerceUnavailable');
    const next = transform(stateRef.current);
    stateRef.current = next;
    setState(next);
    if (expectedOwner !== 'guest') {
      const write = queueRef.current.catch(() => undefined).then(async () => {
        assertOwner();
        await saveCommerceState(expectedOwner, next);
        assertOwner();
      });
      queueRef.current = write.catch(() => undefined);
      try {
        await write;
      } catch (cause) {
        if (isCurrent() && ownerRef.current === expectedOwner) setError('The latest commerce change could not be saved safely. Reload before making another change.');
        throw cause;
      }
    }
  }, [error, isCurrent, loadedScope, loading, scope, user?.userId]);

  const transitioning = authLoading || loadedScope !== scope;

  const value = useMemo<CommerceContextValue>(() => ({
    state: transitioning ? emptyCommerceState : state,
    loading: loading || transitioning,
    busy: !transitioning && busy,
    error: transitioning ? undefined : error,
    checkoutStatus: transitioning ? undefined : checkoutStatus,
    async addToCart(input) {
      await commit((current) => ({
        ...current,
        cart: addOrReplaceCartLine(current.cart, {
          productId: input.productId,
          quantity: input.quantity ?? 1,
          purchaseOption: input.purchaseOption ?? 'one-time',
          intervalWeeks: input.intervalWeeks,
        }),
      }));
    },
    async removeFromCart(productId) {
      await commit((current) => ({ ...current, cart: current.cart.filter((line) => line.productId !== productId) }));
    },
    async clearCart() {
      await commit((current) => ({ ...current, cart: [] }));
    },
    async completeDemoCheckout(outcome = 'succeeded') {
      if (!isCurrent() || transitioning || loading || error) throw new Error('CommerceUnavailable');
      if (!user) throw new Error('AccountRequired');
      if (!stateRef.current.cart.length) throw new Error('EmptyCart');
      if (checkoutInFlightRef.current === scope) throw new Error('CheckoutInProgress');
      checkoutInFlightRef.current = scope;
      setBusy(true);
      setCheckoutStatus('pending');
      const checkoutId = createId('checkout');
      const orderId = createId('NL');
      try {
        await new Promise((resolve) => setTimeout(resolve, 650));
        if (!isCurrent()) throw new Error('CommerceUnavailable');
        await commit((current) => applyCheckoutOutcome(current, {
          checkoutId,
          outcome,
          completedAt: new Date().toISOString(),
          orderId,
          subscriptionId: createId('sub'),
        }));
        if (isCurrent()) setCheckoutStatus(outcome);
        return { checkoutId, outcome, orderId: outcome === 'succeeded' ? orderId : undefined };
      } finally {
        if (checkoutInFlightRef.current === scope) checkoutInFlightRef.current = null;
        if (isCurrent()) setBusy(false);
      }
    },
    async buyAgain(orderId) {
      await commit((current) => {
        const order = current.orders.find((item) => item.id === orderId);
        if (!order) throw new Error('OrderUnavailable');
        return { ...current, cart: cartFromOrder(order) };
      });
    },
    async updateSubscription(subscriptionId, update) {
      await commit((current) => ({
        ...current,
        subscriptions: current.subscriptions.map((subscription) => subscription.id === subscriptionId ? {
          ...subscription,
          intervalWeeks: update.intervalWeeks ?? subscription.intervalWeeks,
          nextDeliveryAt: update.nextDeliveryAt ?? subscription.nextDeliveryAt,
          status: update.status ?? subscription.status,
          updatedAt: new Date().toISOString(),
        } : subscription),
      }));
    },
    retry() {
      if (!isCurrent()) return;
      setError(undefined);
      setRetryAttempt((attempt) => attempt + 1);
    },
  }), [busy, checkoutStatus, commit, error, isCurrent, loading, scope, state, transitioning, user]);

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const value = useContext(CommerceContext);
  if (!value) throw new Error('useCommerce must be used inside CommerceProvider');
  return value;
}
