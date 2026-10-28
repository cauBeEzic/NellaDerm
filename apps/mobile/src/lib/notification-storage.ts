import * as SecureStore from 'expo-secure-store';

import type { NotificationScheduleRecord } from './notifications';

const notificationScheduleKey = (userId: string, profileId: string) => `myeczema.notifications.${userId}.${profileId}`;
const notificationIndexKey = (userId: string) => `myeczema.notification-index.${userId}`;
const notificationRecoveryKey = (userId: string) => `myeczema.notification-recovery.${userId}`;

export async function loadNotificationSchedule(userId: string, profileId: string): Promise<NotificationScheduleRecord> {
  const value = await SecureStore.getItemAsync(notificationScheduleKey(userId, profileId));
  if (!value) return { scheduledIds: {}, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, updatedAt: '' };
  const parsed = JSON.parse(value) as Partial<NotificationScheduleRecord> | null;
  if (!parsed || typeof parsed !== 'object' || !parsed.scheduledIds || typeof parsed.scheduledIds !== 'object' || Array.isArray(parsed.scheduledIds)) throw new Error('Invalid notification schedule.');
  if (!Object.values(parsed.scheduledIds).every((item) => typeof item === 'string')) throw new Error('Invalid scheduled notification id.');
  if (typeof parsed.timeZone !== 'string' || typeof parsed.updatedAt !== 'string') throw new Error('Invalid notification schedule metadata.');
  return { scheduledIds: { ...parsed.scheduledIds }, timeZone: parsed.timeZone, updatedAt: parsed.updatedAt };
}

export async function saveNotificationSchedule(userId: string, profileId: string, record: NotificationScheduleRecord) {
  await SecureStore.setItemAsync(notificationScheduleKey(userId, profileId), JSON.stringify(record));
}

export async function loadNotificationIndex(userId: string): Promise<Record<string, Record<string, string>>> {
  const value = await SecureStore.getItemAsync(notificationIndexKey(userId));
  if (!value) return {};
  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid notification index.');
  for (const ids of Object.values(parsed)) {
    if (!ids || typeof ids !== 'object' || Array.isArray(ids) || !Object.values(ids).every((item) => typeof item === 'string')) throw new Error('Invalid notification index entry.');
  }
  return parsed as Record<string, Record<string, string>>;
}

export async function saveNotificationIndex(userId: string, index: Record<string, Record<string, string>>) {
  await SecureStore.setItemAsync(notificationIndexKey(userId), JSON.stringify(index));
}

// Journal newly issued IDs until they are indexed successfully or cancelled.
export async function loadNotificationRecoveryIds(userId: string): Promise<string[]> {
  const value = await SecureStore.getItemAsync(notificationRecoveryKey(userId));
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || !parsed.every((id) => typeof id === 'string' && id.length > 0)) throw new Error('Invalid notification recovery identifiers.');
  return parsed;
}

export async function saveNotificationRecoveryIds(userId: string, ids: readonly string[]) {
  await SecureStore.setItemAsync(notificationRecoveryKey(userId), JSON.stringify(ids));
}

export const notificationStorageKeys = { notificationScheduleKey, notificationIndexKey, notificationRecoveryKey };
