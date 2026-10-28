import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { useProfiles } from '@/contexts/profile-context';
import {
  activeRoutinePeriod,
  createDemoCareState,
  emptyCareState,
  findExistingCareProduct,
  initialCareProduct,
  insertCareProduct,
  isProductScheduledOnDay,
  setCareProductPackagingPhoto,
  setCareProductSupply,
  setCareRoutineSchedules,
  setNamedRoutineStatus,
  setProductRoutineStatus,
  toRoutineProducts,
  type CareProduct,
  type CareState,
  type ReminderKey,
  type RoutinePeriod,
  type RoutineScheduleEdit,
  type SupplyLevel,
} from '@/lib/care';
import { resolveCareProfile, type CareProfile } from '@/lib/care-profile';
import { loadCareState, saveCareState } from '@/lib/care-storage';
import { loadCompletedOnboarding } from '@/lib/onboarding-storage';
import { deletePackagingPhoto, reconcilePackagingPhotos, requirePackagingPhoto } from '@/lib/product-packaging-media';
import type { ProductPackagingPhoto } from '@/lib/product-packaging';
import { localDayKey, type RoutineProductStatus } from '@/lib/today';

export class CareAccountRequiredError extends Error {
  constructor() {
    super('Sign in to save Care changes.');
    this.name = 'CareAccountRequiredError';
  }
}

export class CareUnavailableError extends Error {
  constructor() {
    super('Care data is unavailable. Reload it before saving changes.');
    this.name = 'CareUnavailableError';
  }
}

type CareContextValue = {
  state: CareState;
  profile: CareProfile;
  now: Date;
  canWrite: boolean;
  loading: boolean;
  error?: string;
  readScope?: string;
  retry: () => void;
  addProduct: (product: CareProduct) => Promise<CareProduct>;
  setProductPackagingPhoto: (productId: string, expectedPhotoId: string | undefined, photo: ProductPackagingPhoto | undefined) => Promise<CareProduct>;
  setProductSupply: (productId: string, supply: SupplyLevel) => Promise<void>;
  saveRoutineSchedules: (edits: readonly RoutineScheduleEdit[], dayKey: string) => Promise<void>;
  toggleReminder: (key: ReminderKey) => Promise<void>;
  setQuietHours: (label: string) => Promise<void>;
  setProductStatus: (productId: string, status: Extract<RoutineProductStatus, 'used' | 'skipped'>, period?: RoutinePeriod) => Promise<void>;
  setRoutinePeriodStatus: (period: Extract<RoutinePeriod, 'morning' | 'evening'>, productIds: readonly string[], status: 'used' | 'due', dayKey: string) => Promise<void>;
};

const CareContext = createContext<CareContextValue | null>(null);

// Native writes can outlive a provider unmounted by private-file recovery.
// A replacement provider must drain the same process-wide barrier before reconciliation.
let careMutationQueue: Promise<void> = Promise.resolve();

function currentTimeLabel() {
  return new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' }).format(new Date());
}

export function CareProvider({ children }: PropsWithChildren) {
  const { loading: authLoading, user } = useAuth();
  const { activeProfile: profile, loading: profileLoading, error: profileError, retry: retryProfiles } = useProfiles();
  const [state, setState] = useState<CareState>(emptyCareState);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [careReady, setCareReady] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState<string>();
  const [now, setNow] = useState(() => new Date());
  const [readScopeNonce] = useState(randomUUID);
  const [readScope, setReadScope] = useState<string>();
  const nowRef = useRef(now);
  const stateRef = useRef<CareState>(emptyCareState);
  const readyRef = useRef(false);
  const ownerRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  const publishState = useCallback((next: CareState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  useEffect(() => {
    const refreshClock = () => {
      const next = new Date();
      nowRef.current = next;
      setNow(next);
      if (!user) publishState(createDemoCareState(next));
    };
    const interval = setInterval(refreshClock, 60_000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refreshClock();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [publishState, user]);

  useEffect(() => {
    generationRef.current += 1;
    readyRef.current = false;
    ownerRef.current = null;
    if (authLoading || profileLoading || profileError) return;
    let active = true;
    void (async () => {
      if (!user) {
        if (active) {
          publishState(createDemoCareState(nowRef.current));
          setLoadedOwner(null);
          setCareReady(false);
          setReadScope(`${readScopeNonce}:${generationRef.current}`);
          readyRef.current = false;
          ownerRef.current = null;
          setError(undefined);
          setLoading(false);
        }
        return;
      }

      if (active) {
        setLoading(true);
        publishState(emptyCareState);
        setCareReady(false);
        readyRef.current = false;
        ownerRef.current = null;
        setError(undefined);
      }
      let packagingCleanupFailed = false;
      try {
        // A reload must not sweep a file while an already-issued Care write may still commit it.
        await careMutationQueue;
        if (!active) return;
        const onboarding = await loadCompletedOnboarding(user.userId);
        if (!active) return;
        const seedProfile = resolveCareProfile(user.username, onboarding);
        let stored = await loadCareState(user.userId, profile.id);
        if (!active) return;
        if (profile.id === seedProfile.id && !stored.products.length && onboarding?.firstProduct.trim()) {
          stored = { ...stored, products: [initialCareProduct(onboarding.firstProduct.trim())] };
          await saveCareState(user.userId, profile.id, stored);
        }
        try { await reconcilePackagingPhotos(user.userId, profile.id, stored.products, () => active); }
        catch { packagingCleanupFailed = true; throw new Error('Packaging cleanup failed.'); }
        if (active) {
          publishState(stored);
          setCareReady(true);
          setReadScope(`${readScopeNonce}:${generationRef.current}`);
          readyRef.current = true;
          ownerRef.current = `${user.userId}:${profile.id}`;
        }
      } catch {
        if (active) {
          publishState(emptyCareState);
          setCareReady(false);
          readyRef.current = false;
          ownerRef.current = null;
          setError(packagingCleanupFailed
            ? 'Local packaging-photo cleanup could not finish. Reload Care to retry before saving changes.'
            : 'Care data could not be opened on this device. Try again before saving changes.');
        }
      } finally {
        if (active) {
          setLoadedOwner(`${user.userId}:${profile.id}`);
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
      generationRef.current += 1;
      readyRef.current = false;
      ownerRef.current = null;
    };
  }, [authLoading, loadAttempt, profile.id, profile.isDemo, profileError, profileLoading, publishState, readScopeNonce, user]);

  const renderedGeneration = generationRef.current;
  const mutate = useCallback((transform: (current: CareState) => CareState) => {
    if (!user || profile.isDemo) throw new CareAccountRequiredError();
    const expectedOwner = `${user.userId}:${profile.id}`;
    const expectedGeneration = renderedGeneration;
    const assertOwner = () => {
      if (!readyRef.current || ownerRef.current !== expectedOwner || generationRef.current !== expectedGeneration) {
        throw new CareUnavailableError();
      }
    };
    const result = careMutationQueue.then(async () => {
      assertOwner();
      const next = transform(stateRef.current);
      if (next === stateRef.current) return;
      try {
        await saveCareState(user.userId, profile.id, next);
      } catch {
        if (ownerRef.current === expectedOwner && generationRef.current === expectedGeneration) {
          readyRef.current = false;
          setCareReady(false);
          setError('Your Care change could not be confirmed. Reload Care before trying again.');
        }
        throw new CareUnavailableError();
      }
      assertOwner();
      publishState(next);
      setError(undefined);
    });
    careMutationQueue = result.catch(() => undefined);
    return result;
  }, [profile.id, profile.isDemo, publishState, renderedGeneration, user]);

  const expectedOwner = user && !profile.isDemo ? `${user.userId}:${profile.id}` : null;
  const transitioning = authLoading || profileLoading || loadedOwner !== expectedOwner;
  const visibleState = transitioning || profileError ? emptyCareState : state;
  const visibleProfile = profile;
  const readScopeReady = !loading && !transitioning && !profileError && !error && (!user || careReady);
  // Clear a published scope before gated children commit; an owner/loading round trip cannot revive it.
  if (readScope && !readScopeReady) setReadScope(undefined);

  const value = useMemo<CareContextValue>(() => ({
    state: visibleState,
    profile: visibleProfile,
    now,
    canWrite: Boolean(user && !visibleProfile.isDemo && careReady && !transitioning && !profileError),
    loading: !profileError && (loading || transitioning),
    error: profileError ?? (transitioning ? undefined : error),
    // Opaque process/load identity: old routes cannot silently resolve a new owner's records.
    readScope: readScopeReady ? readScope : undefined,
    retry() {
      generationRef.current += 1;
      setReadScope(undefined);
      readyRef.current = false;
      setCareReady(false);
      setLoading(true);
      setError(undefined);
      if (profileError) {
        retryProfiles();
        return;
      }
      setLoadAttempt((attempt) => attempt + 1);
    },
    async addProduct(product) {
      if (!user || visibleProfile.isDemo) throw new CareAccountRequiredError();
      const assertCurrent = () => {
        if (!readyRef.current || generationRef.current !== renderedGeneration || ownerRef.current !== `${user.userId}:${visibleProfile.id}`) throw new CareUnavailableError();
      };
      assertCurrent();
      if (product.packagingPhoto) await requirePackagingPhoto({ userId: user.userId, profileId: visibleProfile.id, productId: product.id }, product.packagingPhoto);
      assertCurrent();
      let saved: CareProduct | undefined;
      await mutate((current) => {
        const products = insertCareProduct(current.products, product);
        saved = findExistingCareProduct(products, product);
        return products === current.products ? current : { ...current, products };
      });
      if (!saved) throw new CareUnavailableError();
      return saved;
    },
    async setProductPackagingPhoto(productId, expectedPhotoId, photo) {
      if (!user || visibleProfile.isDemo) throw new CareAccountRequiredError();
      const owner = { userId: user.userId, profileId: visibleProfile.id, productId };
      const assertCurrent = () => {
        if (!readyRef.current || generationRef.current !== renderedGeneration || ownerRef.current !== `${user.userId}:${visibleProfile.id}`) throw new CareUnavailableError();
      };
      assertCurrent();
      if (photo) await requirePackagingPhoto(owner, photo);
      assertCurrent();
      let previous: ProductPackagingPhoto | undefined;
      let saved: CareProduct | undefined;
      await mutate((current) => {
        previous = current.products.find((product) => product.id === productId)?.packagingPhoto;
        const next = setCareProductPackagingPhoto(current, productId, expectedPhotoId, photo);
        saved = next.products.find((product) => product.id === productId);
        return next;
      });
      if (!saved) throw new CareUnavailableError();
      if (previous && previous.localUri !== photo?.localUri) {
        try { await deletePackagingPhoto(owner, previous); }
        catch {
          if (generationRef.current === renderedGeneration && ownerRef.current === `${user.userId}:${visibleProfile.id}`) {
            readyRef.current = false;
            setCareReady(false);
            setError('The packaging photo was saved, but its previous local copy could not be removed. Reload Care to retry cleanup before saving more changes.');
          }
        }
      }
      return saved;
    },
    async setProductSupply(productId, supply) {
      await mutate((current) => setCareProductSupply(current, productId, supply));
    },
    async saveRoutineSchedules(edits, dayKey) {
      await mutate((current) => {
        if (generationRef.current !== renderedGeneration || localDayKey() !== dayKey) throw new CareUnavailableError();
        return setCareRoutineSchedules(current, edits, dayKey);
      });
    },
    async toggleReminder(key) {
      await mutate((current) => ({ ...current, reminders: { ...current.reminders, [key]: !current.reminders[key] } }));
    },
    async setQuietHours(label) {
      await mutate((current) => ({ ...current, reminders: { ...current.reminders, quietHours: true, quietHoursLabel: label } }));
    },
    async setProductStatus(productId, requestedStatus, period = activeRoutinePeriod()) {
      await mutate((current) => {
        const product = current.products.find((item) => item.id === productId);
        if (!product) return current;
        if (!isProductScheduledOnDay(product, localDayKey(), period, true)) throw new CareUnavailableError();
        const currentStatus = toRoutineProducts([product], current.events, period)[0]?.status ?? 'due';
        const nextStatus = currentStatus === requestedStatus ? 'due' : requestedStatus;
        const events = setProductRoutineStatus(current.events, productId, period, nextStatus, currentTimeLabel());
        return { ...current, events };
      });
    },
    async setRoutinePeriodStatus(period, productIds, status, dayKey) {
      await mutate((current) => {
        if (localDayKey() !== dayKey) throw new CareUnavailableError();
        return setNamedRoutineStatus(current, period, productIds, status, currentTimeLabel());
      });
    },
  }), [careReady, error, loading, mutate, now, profileError, readScope, readScopeReady, renderedGeneration, retryProfiles, transitioning, user, visibleProfile, visibleState]);

  return <CareContext.Provider value={value}>{children}</CareContext.Provider>;
}

export function useCare() {
  const value = useContext(CareContext);
  if (!value) throw new Error('useCare must be used inside CareProvider');
  return value;
}
