import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { useProfiles } from '@/contexts/profile-context';
import { cancelAccountNotificationSchedules } from '@/lib/notification-account-cleanup';
import { cancelNotificationIds, desiredLocalReminderPlans, getNotificationPermissionState, requestNotificationPermission, scheduleLocalReminderPlans, schedulePrivateTestReminder } from '@/lib/notification-platform';
import { loadNotificationIndex, loadNotificationRecoveryIds, loadNotificationSchedule, saveNotificationIndex, saveNotificationRecoveryIds, saveNotificationSchedule } from '@/lib/notification-storage';
import { notificationDestination, parseNotificationRoute, type LocalNotificationPlan, type NotificationPermissionState, type NotificationRoute } from '@/lib/notifications';
import { localDayKey } from '@/lib/today';

type NotificationContextValue = {
  permission: NotificationPermissionState;
  plans: LocalNotificationPlan[];
  scheduledCount: number;
  syncing: boolean;
  error?: string;
  requestPermission: () => Promise<NotificationPermissionState>;
  sendTestReminder: () => Promise<void>;
  retry: () => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function allIndexIds(index: Record<string, Record<string, string>>) {
  return Object.values(index).flatMap((ids) => Object.values(ids));
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const { loading: authLoading, user } = useAuth();
  const { state: careState, loading: careLoading, error: careError, now } = useCare();
  const { activeProfile, profiles, loading: profilesLoading, switchProfile } = useProfiles();
  const [permission, setPermission] = useState<NotificationPermissionState>('checking');
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string>();
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRouteRef = useRef<NotificationRoute | undefined>(undefined);
  const handledResponseRef = useRef<string | undefined>(undefined);
  const lastUserIdRef = useRef<string | undefined>(undefined);
  const [statusOwner, setStatusOwner] = useState<string>();
  const dayKey = localDayKey(now);
  const owner = user && !activeProfile.isDemo ? `${user.userId}:${activeProfile.id}` : undefined;
  const ready = Boolean(owner && !authLoading && !profilesLoading && !careLoading && !careError);
  const scopeRef = useRef({ owner, ready });
  useLayoutEffect(() => { scopeRef.current = { owner, ready }; }, [owner, ready]);

  const plans = useMemo(() => desiredLocalReminderPlans(careState.reminders, careState.products, activeProfile.id, new Date(`${dayKey}T12:00:00`)), [activeProfile.id, careState.products, careState.reminders, dayKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // Settings can grant or revoke access while this provider stays mounted.
      setPermission('checking');
      setRetryAttempt((attempt) => attempt + 1);
    });
    return () => subscription.remove();
  }, []);

  const openRoute = useCallback(async (route: NotificationRoute) => {
    if (!user) {
      pendingRouteRef.current = route;
      router.push('/sign-in');
      return;
    }
    const target = profiles.find((profile) => profile.id === route.profileId && !profile.isDemo);
    if (!target) {
      setError('That reminder no longer points to an available profile. Review your notification settings.');
      router.push('/notifications' as Href);
      return;
    }
    if (activeProfile.id !== target.id) await switchProfile(target.id);
    router.push(notificationDestination(route.routeKey) as Href);
  }, [activeProfile.id, profiles, switchProfile, user]);

  const handleResponse = useCallback((response: Notifications.NotificationResponse) => {
    const responseId = `${response.notification.request.identifier}:${response.actionIdentifier}:${response.notification.date}`;
    if (handledResponseRef.current === responseId) return;
    const route = parseNotificationRoute(response.notification.request.content.data);
    if (!route) return;
    handledResponseRef.current = responseId;
    void openRoute(route).catch(() => setError('The reminder destination could not be opened. Try again from Notifications.'));
  }, [openRoute]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) handleResponse(response); }).catch(() => undefined);
    return () => subscription.remove();
  }, [handleResponse]);

  useEffect(() => {
    if (!user || authLoading || profilesLoading || !pendingRouteRef.current) return;
    const route = pendingRouteRef.current;
    pendingRouteRef.current = undefined;
    void openRoute(route).catch(() => setError('The reminder destination could not be opened. Try again from Notifications.'));
  }, [authLoading, openRoute, profilesLoading, user]);

  useEffect(() => {
    if (authLoading) return;
    const previousUserId = lastUserIdRef.current;
    const nextUserId = user?.userId;
    if (previousUserId === nextUserId) return;
    lastUserIdRef.current = nextUserId;
    if (!previousUserId) return;
    queueRef.current = queueRef.current.catch(() => undefined).then(async () => {
      try {
        await cancelAccountNotificationSchedules(previousUserId);
      } catch { /* sign-out still clears application state; stale OS entries show no private detail */ }
      setScheduledCount(0);
      setPermission('checking');
    });
  }, [authLoading, user]);

  useEffect(() => {
    if (!ready || !user) return;
    let active = true;
    const expectedUserId = user.userId;
    const expectedProfileId = activeProfile.id;
    const expectedOwner = owner;
    const isCurrent = () => active && scopeRef.current.ready && scopeRef.current.owner === expectedOwner;
    queueRef.current = queueRef.current.catch(() => undefined).then(async () => {
      if (!isCurrent()) return;
      setStatusOwner(expectedOwner);
      setSyncing(true);
      let scheduledIds: Record<string, string> = {};
      let recoveryIds: string[] = [];
      let recoveryLoaded = false;
      try {
        const nextPermission = await getNotificationPermissionState();
        if (!isCurrent()) return;
        recoveryIds = await loadNotificationRecoveryIds(expectedUserId);
        recoveryLoaded = true;
        await cancelNotificationIds(recoveryIds);
        await saveNotificationRecoveryIds(expectedUserId, []);
        recoveryIds = [];
        if (!isCurrent()) return;
        const index = await loadNotificationIndex(expectedUserId);
        const stored = await loadNotificationSchedule(expectedUserId, expectedProfileId);
        if (!isCurrent()) return;
        await cancelNotificationIds(Object.values(stored.scheduledIds));
        if (!isCurrent()) return;
        scheduledIds = nextPermission === 'granted' ? await scheduleLocalReminderPlans(plans, async (created) => {
          scheduledIds = { ...created };
          await saveNotificationRecoveryIds(expectedUserId, Object.values(created));
        }) : {};
        if (!isCurrent()) {
          await cancelNotificationIds(Object.values(scheduledIds));
          await saveNotificationRecoveryIds(expectedUserId, []);
          return;
        }
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        await saveNotificationSchedule(expectedUserId, expectedProfileId, { scheduledIds, timeZone, updatedAt: new Date().toISOString() });
        const nextIndex = { ...index, [expectedProfileId]: scheduledIds };
        if (nextPermission !== 'granted') {
          await cancelNotificationIds(allIndexIds(index));
          for (const profileId of Object.keys(nextIndex)) nextIndex[profileId] = {};
        }
        await saveNotificationIndex(expectedUserId, nextIndex);
        if (!isCurrent()) {
          await cancelNotificationIds(Object.values(scheduledIds));
          await saveNotificationRecoveryIds(expectedUserId, []);
          return;
        }
        await saveNotificationRecoveryIds(expectedUserId, []);
        setPermission(nextPermission);
        setScheduledCount(Object.keys(scheduledIds).length);
        setError(undefined);
      } catch (error) {
        try {
          await cancelNotificationIds([...recoveryIds, ...Object.values(scheduledIds)]);
          if (recoveryLoaded) await saveNotificationRecoveryIds(expectedUserId, []);
        } catch { /* Keep the durable recovery journal until a later reconciliation/sign-out can cancel it. */ }
        if (isCurrent()) {
          setScheduledCount(0);
          setError(error instanceof Error && error.message.includes('no room')
            ? error.message
            : 'Local reminders need recovery. Your saved preferences are unchanged; retry to reconcile this profile’s device schedules.');
        }
      } finally {
        if (isCurrent()) setSyncing(false);
      }
    });
    return () => { active = false; };
  }, [activeProfile.id, owner, plans, ready, retryAttempt, user]);

  const value = useMemo<NotificationContextValue>(() => ({
    permission,
    plans: ready ? plans : [],
    scheduledCount: ready && statusOwner === owner ? scheduledCount : 0,
    syncing: ready && (statusOwner !== owner || syncing),
    error: ready && statusOwner === owner ? error : undefined,
    async requestPermission() {
      const next = await requestNotificationPermission();
      setPermission(next);
      setRetryAttempt((attempt) => attempt + 1);
      return next;
    },
    async sendTestReminder() {
      if (!user || permission !== 'granted' || !scopeRef.current.ready || scopeRef.current.owner !== owner) throw new Error('Notification permission and the current profile are required.');
      await schedulePrivateTestReminder({ routeKey: 'notifications', profileId: activeProfile.id });
    },
    retry() {
      setError(undefined);
      setRetryAttempt((attempt) => attempt + 1);
    },
  }), [activeProfile.id, error, owner, permission, plans, ready, scheduledCount, statusOwner, syncing, user]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const value = useContext(NotificationContext);
  if (!value) throw new Error('useNotifications must be used inside NotificationProvider');
  return value;
}
