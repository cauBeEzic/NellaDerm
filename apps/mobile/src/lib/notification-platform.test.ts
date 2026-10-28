import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defaultReminders, demoCareProducts } from './care';
import { cancelNotificationIds, desiredLocalReminderPlans, scheduleLocalReminderPlans, schedulePrivateTestReminder } from './notification-platform';
import { cancelAccountNotificationSchedules } from './notification-account-cleanup';
import { loadNotificationIndex, loadNotificationRecoveryIds, notificationStorageKeys, saveNotificationIndex, saveNotificationRecoveryIds } from './notification-storage';

const native = vi.hoisted(() => ({
  pending: new Map<string, { trigger: unknown; content: unknown }>(), records: new Map<string, string>(),
  calls: 0, failAt: 0, failCancel: false,
  failedReadKey: undefined as string | undefined, failedWriteKey: undefined as string | undefined, failCancelId: undefined as string | undefined,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => { if (key === native.failedReadKey) throw new Error('Synthetic read failure'); return native.records.get(key) ?? null; },
  setItemAsync: async (key: string, value: string) => { if (key === native.failedWriteKey) throw new Error('Synthetic write failure'); native.records.set(key, value); },
}));
vi.mock('expo-notifications', () => ({
  setNotificationHandler: vi.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily', WEEKLY: 'weekly' },
  getAllScheduledNotificationsAsync: async () => [...native.pending].map(([identifier, request]) => ({ identifier, ...request })),
  scheduleNotificationAsync: async (request: { content: unknown; trigger: unknown }) => {
    native.calls += 1;
    if (native.calls === native.failAt) throw new Error('Synthetic scheduling failure');
    const id = `native-generated-${native.calls}`;
    native.pending.set(id, request);
    return id;
  },
  cancelScheduledNotificationAsync: async (id: string) => {
    if (native.failCancel || id === native.failCancelId) throw new Error('Synthetic cancellation failure');
    native.pending.delete(id);
  },
}));

const now = new Date(2026, 9, 16, 12);
const preferences = { ...defaultReminders, checkIn: false, evening: false, prescription: false, weeklyReview: false };
const product = { ...demoCareProducts[1], startedOn: '2026-01-01' };

describe('native reminder replacement boundary', () => {
  beforeEach(() => {
    native.pending.clear(); native.records.clear(); native.calls = 0; native.failAt = 0; native.failCancel = false;
    native.failedReadKey = undefined; native.failedWriteKey = undefined; native.failCancelId = undefined;
  });
  it('replaces a legacy daily trigger with exactly the edited local weekdays and leaves another profile intact', async () => {
    native.pending.set('healthy-other-profile', { content: {}, trigger: { type: 'daily', hour: 20 } });
    const original = await scheduleLocalReminderPlans(desiredLocalReminderPlans(preferences, [product], 'self', now));
    await cancelNotificationIds(Object.values(original));
    const next = await scheduleLocalReminderPlans(desiredLocalReminderPlans(preferences, [{ ...product, weekdays: ['mon', 'wed'] }], 'self', now));
    expect(native.pending.has('healthy-other-profile')).toBe(true);
    expect(Object.values(original).every((id) => !native.pending.has(id))).toBe(true);
    expect(Object.values(next).map((id) => native.pending.get(id)?.trigger)).toEqual([
      { type: 'weekly', weekday: 2, hour: 8, minute: 0, channelId: 'myeczema-reminders' },
      { type: 'weekly', weekday: 4, hour: 8, minute: 0, channelId: 'myeczema-reminders' },
    ]);
    expect(native.pending.size).toBe(3);
    await cancelNotificationIds(Object.values(next));
    expect([...native.pending.keys()]).toEqual(['healthy-other-profile']);
  });

  it('does not collide across accounts that share a self profile identifier', async () => {
    const a = await scheduleLocalReminderPlans(desiredLocalReminderPlans(preferences, [product], 'self', now));
    const b = await scheduleLocalReminderPlans(desiredLocalReminderPlans(preferences, [{ ...product, weekdays: ['fri'] }], 'self', now));
    await cancelNotificationIds(Object.values(a));
    expect([...native.pending.keys()]).toEqual(Object.values(b));
    expect(native.pending.get(Object.values(b)[0])?.trigger).toMatchObject({ type: 'weekly', weekday: 6 });
  });

  it('rolls back partial new schedules on failure without deleting a healthy existing profile', async () => {
    native.pending.set('healthy-other-profile', { trigger: {}, content: {} });
    native.failAt = 2;
    await expect(scheduleLocalReminderPlans(desiredLocalReminderPlans(preferences, [{ ...product, weekdays: ['mon', 'wed'] }], 'self', now))).rejects.toThrow('Synthetic scheduling');
    expect([...native.pending.keys()]).toEqual(['healthy-other-profile']);
  });

  it('refuses to exceed the conservative iOS pending budget rather than evicting other schedules', async () => {
    for (let index = 0; index < 62; index += 1) native.pending.set(`healthy-${index}`, { trigger: {}, content: {} });
    await scheduleLocalReminderPlans(desiredLocalReminderPlans(preferences, [{ ...product, weekdays: ['mon', 'wed'] }], 'self', now));
    expect(native.pending.size).toBe(64);
    const before = new Map(native.pending);
    await expect(scheduleLocalReminderPlans(desiredLocalReminderPlans(preferences, [product], 'dependent', now))).rejects.toThrow('no room');
    expect(native.pending).toEqual(before);
    await expect(schedulePrivateTestReminder({ routeKey: 'notifications', profileId: 'self' })).rejects.toThrow('no room');
    expect(native.pending).toEqual(before);
  });

  it('keeps failed-rollback IDs in the durable owner journal for successful recovery even after disabling reminders', async () => {
    native.pending.set('healthy-other-account', { trigger: {}, content: {} });
    await saveNotificationRecoveryIds('synthetic-b', ['healthy-other-account']);
    native.failAt = 2;
    native.failCancel = true;
    await expect(scheduleLocalReminderPlans(
      desiredLocalReminderPlans(preferences, [{ ...product, weekdays: ['mon', 'wed'] }], 'self', now),
      async (created) => saveNotificationRecoveryIds('synthetic-a', Object.values(created)),
    )).rejects.toThrow('cancellation');
    const recovery = await loadNotificationRecoveryIds('synthetic-a');
    expect(recovery).toEqual(['native-generated-1']);
    expect(native.pending.has(recovery[0])).toBe(true);
    native.failCancel = false;
    await cancelNotificationIds(await loadNotificationRecoveryIds('synthetic-a'));
    await saveNotificationRecoveryIds('synthetic-a', []);
    await scheduleLocalReminderPlans([]);
    expect([...native.pending.keys()]).toEqual(['healthy-other-account']);
    expect(await loadNotificationRecoveryIds('synthetic-b')).toEqual(['healthy-other-account']);
    expect(await loadNotificationRecoveryIds('synthetic-a')).toEqual([]);
  });

  it.each(['read', 'write', 'cancel'] as const)('cancels indexed account reminders even when recovery journal %s fails', async (failure) => {
    native.pending.set('healthy-indexed-a', { trigger: {}, content: {} });
    native.pending.set('orphan-a', { trigger: {}, content: {} });
    native.pending.set('healthy-other-owner', { trigger: {}, content: {} });
    await saveNotificationIndex('synthetic-a', { self: { morning: 'healthy-indexed-a' } });
    await saveNotificationRecoveryIds('synthetic-a', ['orphan-a']);
    const journalKey = notificationStorageKeys.notificationRecoveryKey('synthetic-a');
    if (failure === 'read') native.failedReadKey = journalKey;
    if (failure === 'write') native.failedWriteKey = journalKey;
    if (failure === 'cancel') native.failCancelId = 'orphan-a';
    await expect(cancelAccountNotificationSchedules('synthetic-a')).rejects.toThrow('cleanup');
    expect(native.pending.has('healthy-indexed-a')).toBe(false);
    expect(native.pending.has('healthy-other-owner')).toBe(true);
    expect(await loadNotificationIndex('synthetic-a')).toEqual({});
    native.failedReadKey = undefined;
    expect(await loadNotificationRecoveryIds('synthetic-a')).toEqual(['orphan-a']);
  });

  it('drains recovery IDs even when cancelling a known indexed schedule fails', async () => {
    native.pending.set('indexed-a', { trigger: {}, content: {} });
    native.pending.set('orphan-a', { trigger: {}, content: {} });
    await saveNotificationIndex('synthetic-a', { self: { morning: 'indexed-a' } });
    await saveNotificationRecoveryIds('synthetic-a', ['orphan-a']);
    native.failCancelId = 'indexed-a';
    await expect(cancelAccountNotificationSchedules('synthetic-a')).rejects.toThrow('cleanup');
    expect(native.pending.has('orphan-a')).toBe(false);
    expect(await loadNotificationRecoveryIds('synthetic-a')).toEqual([]);
    expect(await loadNotificationIndex('synthetic-a')).toEqual({ self: { morning: 'indexed-a' } });
  });

  it('surfaces cancellation failure instead of claiming an edited schedule was removed', async () => {
    native.pending.set('old-weekday', { trigger: {}, content: {} });
    native.failCancel = true;
    await expect(cancelNotificationIds(['old-weekday'])).rejects.toThrow('cancellation');
    expect(native.pending.has('old-weekday')).toBe(true);
  });
});
