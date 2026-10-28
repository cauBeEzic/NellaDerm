import { useNetInfo } from '@react-native-community/netinfo';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { useProfiles } from '@/contexts/profile-context';
import {
  draftForEditing,
  emptyCheckInState,
  saveCheckInDraft,
  setDraftSymptomSeverity,
  toggleDraftSymptom,
  toggleDraftValue,
  withDraftUpdate,
  type CheckInArea,
  type CheckInComparison,
  type CheckInFactor,
  type CheckInEntry,
  type CheckInPhoto,
  type CheckInState,
  type CheckInSymptom,
  type RoutineFollowThrough,
  type SymptomSeverity,
  upsertCheckInHistory,
} from '@/lib/check-in';
import { CheckInCommitError, commitCheckInChange } from '@/lib/check-in-commit';
import { deleteCheckInPhoto } from '@/lib/check-in-media';
import { loadCheckInRecords, saveCheckInHistory, saveCheckInState } from '@/lib/check-in-storage';
import { localDayKey } from '@/lib/today';

export class CheckInAccountRequiredError extends Error {
  constructor() {
    super('Sign in to save a check-in.');
    this.name = 'CheckInAccountRequiredError';
  }
}

export class CheckInUnavailableError extends Error {
  constructor() {
    super('Check-in data is unavailable. Reload it before saving.');
    this.name = 'CheckInUnavailableError';
  }
}

type CheckInContextValue = {
  state: CheckInState;
  history: CheckInEntry[];
  canWrite: boolean;
  loading: boolean;
  offline: boolean;
  restoredDraftPending: boolean;
  error?: string;
  retry: () => void;
  acknowledgeRestoredDraft: () => void;
  beginDraft: (comparison?: CheckInComparison) => Promise<void>;
  beginEdit: () => Promise<void>;
  discardDraft: () => Promise<void>;
  setComparison: (comparison: CheckInComparison) => Promise<void>;
  toggleSymptom: (symptom: CheckInSymptom) => Promise<void>;
  setSymptomSeverity: (symptom: CheckInSymptom, severity: SymptomSeverity) => Promise<void>;
  toggleArea: (area: CheckInArea) => Promise<void>;
  toggleFactor: (factor: CheckInFactor) => Promise<void>;
  setRoutine: (routine: RoutineFollowThrough) => Promise<void>;
  setNotes: (notes: string) => Promise<void>;
  setPhoto: (photo: CheckInPhoto) => Promise<void>;
  removePhoto: () => Promise<void>;
  deleteSavedPhoto: (dayKey: string) => Promise<void>;
  saveEntry: () => Promise<{ firstSavedCheckIn: boolean }>;
};

const CheckInContext = createContext<CheckInContextValue | null>(null);

export function CheckInProvider({ children }: PropsWithChildren) {
  const { loading: authLoading, user } = useAuth();
  const { loading: careLoading, profile } = useCare();
  const { error: profileError, loading: profileLoading, retry: retryProfiles } = useProfiles();
  const network = useNetInfo();
  const [state, setState] = useState<CheckInState>(emptyCheckInState);
  const [history, setHistory] = useState<CheckInEntry[]>([]);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [restoredDraftPending, setRestoredDraftPending] = useState(false);
  const [error, setError] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [dayKey, setDayKey] = useState(localDayKey);
  const stateRef = useRef<CheckInState>(emptyCheckInState());
  const historyRef = useRef<CheckInEntry[]>([]);
  const readyRef = useRef(false);
  const ownerRef = useRef<string | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const publish = useCallback((next: CheckInState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const publishHistory = useCallback((next: CheckInEntry[]) => {
    historyRef.current = next;
    setHistory(next);
  }, []);

  useEffect(() => {
    const refreshDay = () => {
      const next = localDayKey();
      setDayKey((current) => current === next ? current : next);
    };
    const interval = setInterval(refreshDay, 60_000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') refreshDay();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (authLoading || careLoading || profileLoading || profileError) return;
    let active = true;
    void (async () => {
      if (!user || profile.isDemo) {
        if (active) {
          publish(emptyCheckInState());
          publishHistory([]);
          setLoadedOwner(null);
          setReady(false);
          readyRef.current = false;
          ownerRef.current = null;
          setError(undefined);
          setRestoredDraftPending(false);
          setLoading(false);
        }
        return;
      }

      const owner = `${user.userId}:${profile.id}:${dayKey}`;
      if (active) {
        setLoading(true);
        publish(emptyCheckInState());
        publishHistory([]);
        setReady(false);
        readyRef.current = false;
        ownerRef.current = null;
        setError(undefined);
        setRestoredDraftPending(false);
      }
      try {
        const { state: stored, history: reconciledHistory } = await loadCheckInRecords(user.userId, profile.id, dayKey);
        if (active) {
          publish(stored);
          publishHistory(reconciledHistory);
          setLoadedOwner(owner);
          setReady(true);
          readyRef.current = true;
          ownerRef.current = owner;
          setRestoredDraftPending(Boolean(stored.draft));
        }
      } catch {
        if (active) {
          publish(emptyCheckInState());
          publishHistory([]);
          setLoadedOwner(owner);
          setReady(false);
          readyRef.current = false;
          ownerRef.current = null;
          setRestoredDraftPending(false);
          setError('Your check-in data could not be opened on this device. Reload before making changes.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      readyRef.current = false;
      ownerRef.current = null;
    };
  }, [authLoading, careLoading, dayKey, loadAttempt, profile.id, profile.isDemo, profileError, profileLoading, publish, publishHistory, user]);

  const mutate = useCallback((transform: (current: CheckInState) => CheckInState) => {
    if (profileLoading || profileError) throw new CheckInUnavailableError();
    if (!user || profile.isDemo) throw new CheckInAccountRequiredError();
    const actualDay = localDayKey();
    if (actualDay !== dayKey) {
      setDayKey(actualDay);
      throw new CheckInUnavailableError();
    }
    const expectedOwner = `${user.userId}:${profile.id}:${dayKey}`;
    const result = queueRef.current.then(async () => {
      if (!readyRef.current || ownerRef.current !== expectedOwner) throw new CheckInUnavailableError();
      const previousState = stateRef.current;
      const previousHistory = historyRef.current;
      const next = transform(previousState);
      const entryChanged = Boolean(next.entry && next.entry !== previousState.entry);
      const nextHistory = entryChanged && next.entry ? upsertCheckInHistory(previousHistory, next.entry) : previousHistory;
      try {
        await commitCheckInChange({
          previousState, previousHistory, nextState: next, nextHistory,
          writeState: (value) => saveCheckInState(user.userId, profile.id, value, dayKey),
          writeHistory: entryChanged ? (value) => saveCheckInHistory(user.userId, profile.id, value) : undefined,
          deletePhoto: deleteCheckInPhoto,
        });
      } catch (error) {
        if (ownerRef.current === expectedOwner) {
          readyRef.current = false;
          setReady(false);
          setError(error instanceof CheckInCommitError && error.reason === 'delete'
            ? 'A local photo could not be deleted. Reload before trying again.'
            : 'Your check-in change was not saved. Reload before trying again.');
        }
        throw new CheckInUnavailableError();
      }
      if (ownerRef.current !== expectedOwner) throw new CheckInUnavailableError();
      publish(next);
      if (entryChanged) publishHistory(nextHistory);
      setError(undefined);
    });
    queueRef.current = result.catch(() => undefined);
    return result;
  }, [dayKey, profile.id, profile.isDemo, profileError, profileLoading, publish, publishHistory, user]);

  const transitioning = authLoading || careLoading || profileLoading || Boolean(user && !profile.isDemo && loadedOwner !== `${user.userId}:${profile.id}:${dayKey}`);
  const visibleState = transitioning || profileError ? emptyCheckInState() : state;
  const visibleHistory = useMemo(() => transitioning || profileError ? [] : history, [history, profileError, transitioning]);

  const value = useMemo<CheckInContextValue>(() => ({
    state: visibleState,
    history: visibleHistory,
    canWrite: Boolean(user && !profile.isDemo && ready && !transitioning && !profileError),
    loading: !profileError && (loading || transitioning),
    offline: network.isConnected === false,
    restoredDraftPending: !transitioning && !profileError && restoredDraftPending,
    error: profileError ?? error,
    acknowledgeRestoredDraft() {
      setRestoredDraftPending(false);
    },
    retry() {
      if (profileError) {
        retryProfiles();
        return;
      }
      readyRef.current = false;
      setReady(false);
      setLoading(true);
      setError(undefined);
      setLoadAttempt((attempt) => attempt + 1);
    },
    async beginDraft(comparison) {
      await mutate((current) => {
        const base = draftForEditing(current);
        return { ...current, draft: comparison ? withDraftUpdate(base, { comparison }) : base };
      });
      setRestoredDraftPending(false);
    },
    async beginEdit() {
      await mutate((current) => ({ ...current, draft: draftForEditing(current) }));
      setRestoredDraftPending(false);
    },
    async discardDraft() {
      await mutate((current) => ({ entry: current.entry }));
      setRestoredDraftPending(false);
    },
    async setComparison(comparison) {
      await mutate((current) => {
        const draft = draftForEditing(current);
        return { ...current, draft: withDraftUpdate(draft, { comparison }) };
      });
    },
    async toggleSymptom(symptom) {
      await mutate((current) => current.draft ? { ...current, draft: toggleDraftSymptom(current.draft, symptom) } : current);
    },
    async setSymptomSeverity(symptom, severity) {
      await mutate((current) => current.draft ? { ...current, draft: setDraftSymptomSeverity(current.draft, symptom, severity) } : current);
    },
    async toggleArea(area) {
      await mutate((current) => current.draft ? { ...current, draft: withDraftUpdate(current.draft, { areas: toggleDraftValue(current.draft.areas, area) }) } : current);
    },
    async toggleFactor(factor) {
      await mutate((current) => current.draft ? { ...current, draft: withDraftUpdate(current.draft, { factors: toggleDraftValue(current.draft.factors, factor) }) } : current);
    },
    async setRoutine(routine) {
      await mutate((current) => current.draft ? { ...current, draft: withDraftUpdate(current.draft, { routine }) } : current);
    },
    async setNotes(notes) {
      await mutate((current) => current.draft ? { ...current, draft: withDraftUpdate(current.draft, { notes: notes.slice(0, 2000) }) } : current);
    },
    async setPhoto(photo) {
      await mutate((current) => current.draft ? { ...current, draft: withDraftUpdate(current.draft, { photo }) } : current);
    },
    async removePhoto() {
      await mutate((current) => current.draft ? { ...current, draft: withDraftUpdate(current.draft, { photo: undefined }) } : current);
    },
    async deleteSavedPhoto(targetDayKey) {
      if (profileLoading || profileError) throw new CheckInUnavailableError();
      const currentEntry = stateRef.current.entry;
      if (currentEntry?.dayKey === targetDayKey && currentEntry.photo) {
        const removedUri = currentEntry.photo.localUri;
        await mutate((current) => {
          if (!current.entry?.photo || current.entry.dayKey !== targetDayKey) return current;
          const now = new Date().toISOString();
          const draft = current.draft?.photo?.localUri === removedUri ? { ...current.draft, photo: undefined, updatedAt: now } : current.draft;
          return { draft, entry: { ...current.entry, photo: undefined, updatedAt: now, savedAt: now } };
        });
        return;
      }
      if (!user || profile.isDemo) throw new CheckInAccountRequiredError();
      const expectedOwner = `${user.userId}:${profile.id}:${dayKey}`;
      const result = queueRef.current.then(async () => {
        if (!readyRef.current || ownerRef.current !== expectedOwner) throw new CheckInUnavailableError();
        const previousState = stateRef.current;
        const previousHistory = historyRef.current;
        const target = previousHistory.find((entry) => entry.dayKey === targetDayKey);
        if (!target?.photo) return;
        const nextHistory = previousHistory.map((entry) => entry.dayKey === targetDayKey ? { ...entry, photo: undefined } : entry);
        try {
          await commitCheckInChange({
            previousState, previousHistory, nextState: previousState, nextHistory,
            writeHistory: (value) => saveCheckInHistory(user.userId, profile.id, value),
            deletePhoto: deleteCheckInPhoto,
          });
        } catch (error) {
          if (ownerRef.current === expectedOwner) {
            readyRef.current = false;
            setReady(false);
            setError(error instanceof CheckInCommitError && error.reason === 'delete'
              ? 'The local photo could not be deleted. Reload before trying again.'
              : 'The photo was not deleted. Reload before trying again.');
          }
          throw new CheckInUnavailableError();
        }
        if (ownerRef.current !== expectedOwner) throw new CheckInUnavailableError();
        publishHistory(nextHistory);
        setError(undefined);
      });
      queueRef.current = result.catch(() => undefined);
      await result;
    },
    async saveEntry() {
      let firstSavedCheckIn = false;
      await mutate((current) => {
        if (!current.draft?.comparison) return current;
        firstSavedCheckIn = !current.entry && historyRef.current.length === 0;
        return { entry: saveCheckInDraft(current.draft) };
      });
      setRestoredDraftPending(false);
      return { firstSavedCheckIn };
    },
  }), [dayKey, error, loading, mutate, network.isConnected, profile.id, profile.isDemo, profileError, profileLoading, publishHistory, ready, restoredDraftPending, retryProfiles, transitioning, user, visibleHistory, visibleState]);

  return <CheckInContext.Provider value={value}>{children}</CheckInContext.Provider>;
}

export function useCheckIn() {
  const value = useContext(CheckInContext);
  if (!value) throw new Error('useCheckIn must be used inside CheckInProvider');
  return value;
}
