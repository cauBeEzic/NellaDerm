import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadNotificationIndex, loadNotificationRecoveryIds, loadNotificationSchedule, saveNotificationIndex, saveNotificationRecoveryIds, saveNotificationSchedule } from './notification-storage';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

describe('notification schedule storage', () => {
  const records = new Map<string, string>();
  beforeEach(() => {
    vi.clearAllMocks();
    records.clear();
    vi.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => records.get(key) ?? null);
    vi.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { records.set(key, value); });
  });

  it('keeps schedules separate across accounts and profiles with identical reminder keys', async () => {
    const a = { scheduledIds: { morning: 'native-a' }, timeZone: 'America/Vancouver', updatedAt: '2026-10-16T09:00:00.000Z' };
    const b = { ...a, scheduledIds: { morning: 'native-b' } };
    const dependent = { ...a, scheduledIds: { morning: 'native-dependent' } };
    await saveNotificationSchedule('synthetic-a', 'self', a);
    await saveNotificationSchedule('synthetic-b', 'self', b);
    await saveNotificationSchedule('synthetic-a', 'dependent', dependent);
    await saveNotificationSchedule('synthetic-a', 'self', { ...a, scheduledIds: {} });
    expect((await loadNotificationSchedule('synthetic-a', 'self')).scheduledIds).toEqual({});
    expect(await loadNotificationSchedule('synthetic-b', 'self')).toEqual(b);
    expect(await loadNotificationSchedule('synthetic-a', 'dependent')).toEqual(dependent);
  });

  it('retains owner-scoped recovery IDs independently of healthy indexed schedules until cleanup succeeds', async () => {
    const index = { self: { morning: 'healthy-a' }, dependent: { evening: 'healthy-dependent' } };
    await saveNotificationIndex('synthetic-a', index);
    await saveNotificationRecoveryIds('synthetic-a', ['partial-native-a']);
    await saveNotificationRecoveryIds('synthetic-b', ['partial-native-b']);
    expect(await loadNotificationRecoveryIds('synthetic-a')).toEqual(['partial-native-a']);
    await saveNotificationRecoveryIds('synthetic-a', []);
    expect(await loadNotificationRecoveryIds('synthetic-a')).toEqual([]);
    expect(await loadNotificationRecoveryIds('synthetic-b')).toEqual(['partial-native-b']);
    expect(await loadNotificationIndex('synthetic-a')).toEqual(index);
  });

  it('fails closed on malformed native identifier records', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({ scheduledIds: { morning: 3 }, timeZone: 'America/Vancouver', updatedAt: '' }));
    await expect(loadNotificationSchedule('account-a', 'profile-a')).rejects.toThrow('scheduled notification id');
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({ 'profile-a': { morning: 3 } }));
    await expect(loadNotificationIndex('account-a')).rejects.toThrow('index entry');
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(['native-id', 7]));
    await expect(loadNotificationRecoveryIds('synthetic-a')).rejects.toThrow('recovery');
  });
});
