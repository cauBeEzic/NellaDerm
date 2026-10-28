import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { buildLocalNotificationPlans, genericNotificationContent, resolveNotificationPermissionState, type LocalNotificationPlan, type NotificationRoute } from './notifications';
import type { CareProduct, CareReminders } from './care';

export const reminderChannelId = 'myeczema-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function prepareNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(reminderChannelId, {
    name: 'MyEczema reminders',
    description: 'Generic reminders that open private details only after the app is unlocked.',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    sound: null,
    vibrationPattern: [0, 180],
  });
}

function permissionState(status: Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>) {
  return resolveNotificationPermissionState({
    granted: status.granted,
    canAskAgain: status.canAskAgain,
    provisional: status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL,
  });
}

export async function getNotificationPermissionState() {
  try {
    await prepareNotificationChannel();
    return permissionState(await Notifications.getPermissionsAsync());
  } catch {
    return 'unavailable' as const;
  }
}

export async function requestNotificationPermission() {
  try {
    await prepareNotificationChannel();
    return permissionState(await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: false } }));
  } catch {
    return 'unavailable' as const;
  }
}

function triggerForPlan(plan: LocalNotificationPlan): Notifications.SchedulableNotificationTriggerInput {
  if (plan.schedule.kind === 'weekly') {
    return { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: plan.schedule.weekday, hour: plan.schedule.hour, minute: plan.schedule.minute, channelId: reminderChannelId };
  }
  return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: plan.schedule.hour, minute: plan.schedule.minute, channelId: reminderChannelId };
}

export async function cancelNotificationIds(ids: string[]) {
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

async function ensureNotificationCapacity(required: number) {
  // Conservative iOS pending budget; never rely on silent native eviction.
  if (required && Platform.OS === 'ios') {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    if (pending.length + required > 64) throw new Error('This device has no room for these reminder schedules. Reduce enabled reminders and retry.');
  }
}

export async function scheduleLocalReminderPlans(plans: LocalNotificationPlan[], onCreated?: (ids: Readonly<Record<string, string>>) => Promise<void>) {
  await ensureNotificationCapacity(plans.length);
  const scheduledIds: Record<string, string> = {};
  try {
    for (const plan of plans) {
      // Native-generated IDs avoid collisions between accounts with the same profile ID.
      const identifier = await Notifications.scheduleNotificationAsync({
        content: genericNotificationContent(plan),
        trigger: triggerForPlan(plan),
      });
      scheduledIds[plan.key] = identifier;
      await onCreated?.(scheduledIds);
    }
    return scheduledIds;
  } catch (error) {
    await cancelNotificationIds(Object.values(scheduledIds));
    throw error;
  }
}

export async function schedulePrivateTestReminder(route: NotificationRoute) {
  await prepareNotificationChannel();
  await ensureNotificationCapacity(1);
  return Notifications.scheduleNotificationAsync({
    content: genericNotificationContent(route),
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: reminderChannelId },
  });
}

export function desiredLocalReminderPlans(reminders: CareReminders, products: CareProduct[], profileId: string, now = new Date()) {
  return buildLocalNotificationPlans(reminders, products, profileId, now);
}
