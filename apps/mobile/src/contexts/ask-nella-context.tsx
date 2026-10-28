import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { useProfiles } from '@/contexts/profile-context';
import {
  appendAskNellaQuestion,
  completeAskNellaQuestion,
  createAskNellaGuidance,
  failAskNellaQuestion,
  newAskNellaSession,
  normalizeAskNellaQuestion,
  type AskNellaAttachment,
  type AskNellaGuidance,
  type AskNellaSession,
} from '@/lib/ask-nella';
import { loadAskNellaSessions, saveAskNellaSessions } from '@/lib/ask-nella-storage';

type AskNellaContextValue = {
  disclosureAccepted: boolean;
  draft: string;
  attachments: AskNellaAttachment[];
  sessions: AskNellaSession[];
  activeSession?: AskNellaSession;
  loading: boolean;
  sending: boolean;
  error?: string;
  acceptGuestDisclosure: () => void;
  setDraft: (value: string) => void;
  addDemoAttachment: (kind: AskNellaAttachment['kind']) => void;
  removeAttachment: (id: string) => void;
  clearQuestion: () => void;
  submitQuestion: (retryClientMessageId?: string) => Promise<AskNellaGuidance>;
  openSession: (sessionId: string) => void;
  startFollowUp: () => void;
  markSavedToRecord: () => Promise<void>;
  endGuestSession: () => void;
  retryLoad: () => void;
};

const AskNellaContext = createContext<AskNellaContextValue | null>(null);

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function sortSessions(sessions: AskNellaSession[]) {
  return [...sessions].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function AskNellaProvider({ children }: PropsWithChildren) {
  const { loading: authLoading, user } = useAuth();
  const { activeProfile, loading: profileLoading } = useProfiles();
  const [disclosureAccepted, setDisclosureAccepted] = useState(false);
  const [draft, setDraftState] = useState('');
  const [attachments, setAttachments] = useState<AskNellaAttachment[]>([]);
  const [sessions, setSessions] = useState<AskNellaSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadedOwner, setLoadedOwner] = useState<string>();
  const ownerRef = useRef<string | undefined>(undefined);
  const sessionsRef = useRef<AskNellaSession[]>([]);

  const owner = user ? `${user.userId}:${activeProfile.id}` : 'guest';
  // Identity also changes for reloads and A→B→A transitions, even with the same profile ID.
  const scope = useMemo(() => ({ owner, user, authLoading, profileLoading, loadAttempt }), [owner, user, authLoading, profileLoading, loadAttempt]);
  const scopeRef = useRef(scope);
  const inFlightRef = useRef<typeof scope | null>(null);
  useLayoutEffect(() => { scopeRef.current = scope; }, [scope]);
  const isCurrent = useCallback(() => scopeRef.current === scope && !authLoading && !profileLoading, [authLoading, profileLoading, scope]);

  const publishSessions = useCallback((next: AskNellaSession[]) => {
    const sorted = sortSessions(next);
    sessionsRef.current = sorted;
    setSessions(sorted);
  }, []);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    let active = true;
    void (async () => {
      setLoading(true);
      setLoadedOwner(undefined);
      setError(undefined);
      setDraftState('');
      setAttachments([]);
      setActiveSessionId(undefined);
      setSending(false);

      if (!user) {
        publishSessions([]);
        setDisclosureAccepted(false);
        ownerRef.current = 'guest';
        setLoadedOwner('guest');
        setLoading(false);
        return;
      }

      ownerRef.current = undefined;
      try {
        const stored = await loadAskNellaSessions(user.userId, activeProfile.id);
        if (!active) return;
        publishSessions(stored);
        ownerRef.current = owner;
        setLoadedOwner(owner);
      } catch {
        if (!active) return;
        publishSessions([]);
        setError('Your Ask Nella history could not be opened on this device. Reload before asking or saving a question.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [activeProfile.id, authLoading, loadAttempt, owner, profileLoading, publishSessions, user]);

  const persist = useCallback(async (next: AskNellaSession[]) => {
    if (!isCurrent()) throw new Error('AskNellaProfileUnavailable');
    if (!user) return;
    if (ownerRef.current !== `${user.userId}:${activeProfile.id}`) throw new Error('AskNellaProfileUnavailable');
    await saveAskNellaSessions(user.userId, activeProfile.id, next);
    if (!isCurrent()) throw new Error('AskNellaProfileUnavailable');
  }, [activeProfile.id, isCurrent, user]);

  const replaceSession = useCallback((session: AskNellaSession) => {
    const without = sessionsRef.current.filter((item) => item.id !== session.id);
    const next = sortSessions([session, ...without]);
    publishSessions(next);
    setActiveSessionId(session.id);
    return next;
  }, [publishSessions]);

  const ready = !loading && !authLoading && !profileLoading && loadedOwner === owner;
  const visibleSessions = useMemo(() => ready ? sessions : [], [ready, sessions]);
  const activeSession = visibleSessions.find((session) => session.id === activeSessionId);

  const value = useMemo<AskNellaContextValue>(() => ({
    disclosureAccepted: ready && disclosureAccepted,
    draft: ready ? draft : '',
    attachments: ready ? attachments : [],
    sessions: visibleSessions,
    activeSession,
    loading: loading || authLoading || profileLoading || Boolean(user && loadedOwner !== owner),
    sending: ready && sending,
    error,
    acceptGuestDisclosure() {
      if (!isCurrent() || !ready) return;
      setDisclosureAccepted(true);
      setError(undefined);
    },
    setDraft(value) {
      if (!isCurrent() || !ready) return;
      setDraftState(normalizeAskNellaQuestion(value));
      if (error) setError(undefined);
    },
    addDemoAttachment(kind) {
      if (!isCurrent() || !ready) return;
      const attachment: AskNellaAttachment = kind === 'photo'
        ? { id: uniqueId('photo'), kind, label: 'Synthetic shampoo label · no image uploaded', synthetic: true }
        : { id: uniqueId('voice'), kind, label: 'Synthetic voice note · no audio uploaded', synthetic: true, durationSeconds: 12 };
      setAttachments((current) => current.some((item) => item.kind === kind) ? current : [...current, attachment]);
    },
    removeAttachment(id) {
      if (!isCurrent() || !ready) return;
      setAttachments((current) => current.filter((item) => item.id !== id));
    },
    clearQuestion() {
      if (!isCurrent() || !ready) return;
      setDraftState('');
      setAttachments([]);
      setError(undefined);
    },
    async submitQuestion(retryClientMessageId) {
      if (!isCurrent() || loading || loadedOwner !== owner) throw new Error('AskNellaProfileUnavailable');
      if (inFlightRef.current === scope) throw new Error('AskNellaQuestionInProgress');
      const question = normalizeAskNellaQuestion(draft);
      if (!question) throw new Error('QuestionRequired');
      if (!user && !disclosureAccepted) throw new Error('GuestDisclosureRequired');
      if (user && ownerRef.current !== owner) throw new Error('AskNellaProfileUnavailable');

      const clientMessageId = retryClientMessageId ?? uniqueId('client');
      const base = activeSession ?? newAskNellaSession(activeProfile.id, uniqueId('chat'));
      const pending = appendAskNellaQuestion(base, question, clientMessageId, attachments);
      inFlightRef.current = scope;
      let next = replaceSession(pending);
      setSending(true);
      setError(undefined);

      try {
        await persist(next);
        await new Promise((resolve) => setTimeout(resolve, 450));
        if (!isCurrent()) throw new Error('AskNellaProfileUnavailable');
        const guidance = createAskNellaGuidance(question, activeProfile, attachments);
        const complete = completeAskNellaQuestion(pending, clientMessageId, guidance);
        next = replaceSession(complete);
        await persist(next);
        return guidance;
      } catch (caught) {
        if (!isCurrent()) throw caught;
        const failed = failAskNellaQuestion(pending, clientMessageId);
        next = replaceSession(failed);
        try { await persist(next); } catch { /* Preserve the in-memory retry state. */ }
        if (isCurrent()) setError('Nella could not prepare guidance. Your question is still here; retry will not send it twice.');
        throw caught;
      } finally {
        if (inFlightRef.current === scope) inFlightRef.current = null;
        if (isCurrent()) setSending(false);
      }
    },
    openSession(sessionId) {
      if (!isCurrent() || !ready) return;
      const session = sessionsRef.current.find((item) => item.id === sessionId);
      if (!session) return;
      const latestQuestion = [...session.messages].reverse().find((message) => message.role === 'user');
      setActiveSessionId(session.id);
      setDraftState(latestQuestion?.content ?? '');
      setAttachments(session.attachments);
      setError(undefined);
    },
    startFollowUp() {
      if (!isCurrent() || !ready) return;
      setDraftState('');
      setAttachments([]);
      setError(undefined);
    },
    async markSavedToRecord() {
      if (!isCurrent() || !ready) throw new Error('AskNellaProfileUnavailable');
      if (!user || !activeSession) throw new Error('SignInRequired');
      const updated = { ...activeSession, savedToRecord: true, updatedAt: new Date().toISOString() };
      const next = replaceSession(updated);
      await persist(next);
    },
    endGuestSession() {
      if (!isCurrent() || !ready || user) return;
      publishSessions([]);
      setActiveSessionId(undefined);
      setDraftState('');
      setAttachments([]);
      setError(undefined);
      setDisclosureAccepted(false);
    },
    retryLoad() {
      if (!isCurrent()) return;
      setLoading(true);
      setError(undefined);
      setLoadAttempt((attempt) => attempt + 1);
    },
  }), [activeProfile, activeSession, attachments, authLoading, disclosureAccepted, draft, error, isCurrent, loadedOwner, loading, owner, persist, profileLoading, publishSessions, ready, replaceSession, scope, sending, user, visibleSessions]);

  return <AskNellaContext.Provider value={value}>{children}</AskNellaContext.Provider>;
}

export function useAskNella() {
  const value = useContext(AskNellaContext);
  if (!value) throw new Error('useAskNella must be used inside AskNellaProvider');
  return value;
}
