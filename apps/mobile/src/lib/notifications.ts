import { isProductScheduledOnDay, routineWeekdays, routineWeekdayLabels, type CareProduct, type CareReminders, type ReminderKey, type RoutinePeriod, type RoutineWeekday } from './care';
import { localDayKey } from './today';

export type NotificationPermissionState = 'checking' | 'undetermined' | 'granted' | 'denied' | 'unavailable';
export type NotificationRouteKey = 'check-in' | 'morning-routine' | 'evening-routine' | 'prescription' | 'weekly-review' | 'reorder' | 'notifications';
type RoutineReminderKey = 'morning' | 'evening' | 'prescription-morning' | 'prescription-evening';
export type ScheduledReminderKey = 'checkIn' | 'weeklyReview' | RoutineReminderKey | `${RoutineReminderKey}-${RoutineWeekday}`;

export type LocalNotificationPlan = {
  key: ScheduledReminderKey;
  routeKey: NotificationRouteKey;
  profileId: string;
  schedule: { kind: 'daily'; hour: number; minute: number } | { kind: 'weekly'; weekday: number; hour: number; minute: number };
};

export type NotificationRoute = {
  routeKey: NotificationRouteKey;
  profileId: string;
};

export type NotificationScheduleRecord = {
  scheduledIds: Record<string, string>;
  timeZone: string;
  updatedAt: string;
};

export function resolveNotificationPermissionState(input: {
  granted: boolean;
  canAskAgain: boolean;
  provisional?: boolean;
}): NotificationPermissionState {
  if (input.granted || input.provisional) return 'granted';
  return input.canAskAgain ? 'undetermined' : 'denied';
}

export const notificationPreferenceRows: {
  key: ReminderKey;
  title: string;
  detail: string;
  scheduleLabel: string;
}[] = [
  { key: 'checkIn', title: 'Check-in', detail: 'A gentle daily prompt to record how things are going', scheduleLabel: 'Daily · 8:00 PM' },
  { key: 'morning', title: 'Morning routine', detail: 'Skincare on the days saved in your routine', scheduleLabel: 'Scheduled days · 8:00 AM' },
  { key: 'evening', title: 'Evening routine', detail: 'Skincare on the days saved in your routine', scheduleLabel: 'Scheduled days · 9:00 PM' },
  { key: 'prescription', title: 'Prescription routine', detail: 'Uses the morning or evening period saved with prescription items', scheduleLabel: 'When scheduled' },
  { key: 'weeklyReview', title: 'Weekly review', detail: 'Opens the latest review after authentication', scheduleLabel: 'Sunday · 7:00 PM' },
  { key: 'productSupply', title: 'Reorder and supply', detail: 'Appears when a saved product is marked as getting low', scheduleLabel: 'Event-based' },
];

export const quietHourOptions = ['10:00 PM–7:00 AM', '9:30 PM–7:30 AM', '11:00 PM–6:30 AM'] as const;

export function buildLocalNotificationPlans(
  reminders: CareReminders,
  products: CareProduct[],
  profileId: string,
  now = new Date(),
): LocalNotificationPlan[] {
  const plans: LocalNotificationPlan[] = [];
  if (reminders.checkIn) plans.push({ key: 'checkIn', routeKey: 'check-in', profileId, schedule: { kind: 'daily', hour: 20, minute: 0 } });
  function addRoutinePlans(key: RoutineReminderKey, routeKey: NotificationRouteKey, period: Extract<RoutinePeriod, 'morning' | 'evening'>, prescription: boolean, hour: number, minute: number) {
    const days = new Set<RoutineWeekday>();
    const today = localDayKey(now);
    for (const product of products) {
      if ((product.kind === 'prescription' || product.category === 'Prescription') !== prescription) continue;
      if (/^\d{4}-\d{2}-\d{2}$/.test(product.startedOn) && product.startedOn > today) continue;
      for (let offset = 0; offset < 7; offset += 1) {
        const date = new Date(now);
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + offset);
        if (isProductScheduledOnDay(product, localDayKey(date), period)) days.add(routineWeekdays[date.getDay()]);
      }
    }
    if (days.size === 7) {
      plans.push({ key, routeKey, profileId, schedule: { kind: 'daily', hour, minute } });
    } else {
      routineWeekdays.forEach((day, index) => {
        if (days.has(day)) plans.push({ key: `${key}-${day}`, routeKey, profileId, schedule: { kind: 'weekly', weekday: index + 1, hour, minute } });
      });
    }
  }
  if (reminders.morning) addRoutinePlans('morning', 'morning-routine', 'morning', false, 8, 0);
  if (reminders.evening) addRoutinePlans('evening', 'evening-routine', 'evening', false, 21, 0);
  if (reminders.prescription) {
    addRoutinePlans('prescription-morning', 'prescription', 'morning', true, 8, 5);
    addRoutinePlans('prescription-evening', 'prescription', 'evening', true, 21, 5);
  }
  if (reminders.weeklyReview) plans.push({ key: 'weeklyReview', routeKey: 'weekly-review', profileId, schedule: { kind: 'weekly', weekday: 1, hour: 19, minute: 0 } });
  return plans;
}

export function genericNotificationContent(route: NotificationRoute) {
  return {
    title: 'A MyEczema reminder',
    body: 'Open MyEczema when you’re ready.',
    data: { routeKey: route.routeKey, profileId: route.profileId },
  };
}

const routeKeys = new Set<NotificationRouteKey>(['check-in', 'morning-routine', 'evening-routine', 'prescription', 'weekly-review', 'reorder', 'notifications']);

export function parseNotificationRoute(data: unknown): NotificationRoute | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const candidate = data as Partial<NotificationRoute>;
  if (typeof candidate.routeKey !== 'string' || !routeKeys.has(candidate.routeKey as NotificationRouteKey)) return undefined;
  if (typeof candidate.profileId !== 'string' || !candidate.profileId.trim()) return undefined;
  return { routeKey: candidate.routeKey as NotificationRouteKey, profileId: candidate.profileId };
}

export function notificationDestination(routeKey: NotificationRouteKey) {
  switch (routeKey) {
    case 'check-in': return '/check-in' as const;
    case 'morning-routine':
    case 'evening-routine': return '/(tabs)' as const;
    case 'prescription': return '/(tabs)/care?tab=routine' as const;
    case 'weekly-review': return '/insights/weekly' as const;
    case 'reorder': return '/(tabs)/care?tab=products' as const;
    case 'notifications': return '/notifications' as const;
  }
}

export function nextReminderLabel(plan: LocalNotificationPlan) {
  const time = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' })
    .format(new Date(2026, 0, 4, plan.schedule.hour, plan.schedule.minute));
  return plan.schedule.kind === 'weekly' ? `${routineWeekdayLabels[routineWeekdays[plan.schedule.weekday - 1]]} · ${time}` : `Daily · ${time}`;
}
