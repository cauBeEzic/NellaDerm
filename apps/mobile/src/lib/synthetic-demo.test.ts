import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isProductScheduledOnDay } from './care';
import { loadCareState } from './care-storage';
import { parseCheckInHistory } from './check-in';
import { loadCheckInRecords } from './check-in-storage';
import { hasCompletedOnboarding } from './onboarding-storage';
import { loadProfiles } from './profile-storage';
import { allowsSyntheticDemo, createDemoFixture, demoSessionKey, parseDemoSession } from './synthetic-demo';
import { clearDemoSession, prepareDemoSession, restoreDemoSession } from './synthetic-demo-storage';
import { localDayKey } from './today';

const store = vi.hoisted(() => ({ values: new Map<string, string>(), failKey: '' }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => store.values.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { if (key.includes(store.failKey) && store.failKey) throw new Error('Synthetic disk failure'); store.values.set(key, value); },
  deleteItemAsync: async (key: string) => { store.values.delete(key); },
}));

describe('repeatable iOS synthetic demos', () => {
  const now = new Date(2026, 9, 25, 10, 30);
  beforeEach(() => { store.values.clear(); store.failKey = ''; });

  it('requires explicit opt-in and development iOS, including when a release retains the flag', () => {
    expect(allowsSyntheticDemo(true, 'ios', '1')).toBe(true);
    for (const args of [[false, 'ios', '1'], [true, 'android', '1'], [true, 'web', '1'], [true, 'ios', undefined], [true, 'ios', 'true']] as const) expect(allowsSyntheticDemo(args[0], args[1], args[2])).toBe(false);
  });

  it('new user has no completed setup or private records, and resets into a fresh owner', async () => {
    const first = await prepareDemoSession('new', 'first', now);
    expect(await hasCompletedOnboarding(first.userId)).toBe(false);
    expect(await loadProfiles(first.userId)).toMatchObject([{ name: 'Alex Demo', type: 'self', areas: [] }]);
    expect(await loadCareState(first.userId, 'self')).toMatchObject({ products: [], events: [] });
    expect(await loadCheckInRecords(first.userId, 'self')).toEqual({ state: {}, history: [] });
    store.values.set(`myeczema.onboarding.${first.userId}.complete`, 'previous rehearsal');
    const next = await prepareDemoSession('new', 'second', now);
    expect(await hasCompletedOnboarding(next.userId)).toBe(false);
    expect(next.userId).not.toBe(first.userId);
  });

  it('seeds sixty completed local days with gaps and valid varied history, leaving today empty', async () => {
    const fixture = createDemoFixture('two-months', 'first', now);
    expect(fixture).toEqual(createDemoFixture('two-months', 'first', now));
    expect(parseCheckInHistory(fixture.history)).toHaveLength(52);
    expect(fixture.history[0].dayKey).toBe('2026-10-24');
    expect(fixture.history.at(-1)?.dayKey).toBe('2026-08-26');
    expect(new Set(fixture.history.map((entry) => entry.comparison)).size).toBe(3);
    expect(new Set(fixture.care.events.map((entry) => entry.status))).toEqual(new Set(['used', 'skipped']));
    for (const event of fixture.care.events) {
      const product = fixture.care.products.find((item) => item.id === event.productId)!;
      expect(isProductScheduledOnDay(product, event.dayKey, event.period)).toBe(true);
      expect(localDayKey(new Date(event.recordedAt))).toBe(event.dayKey);
      expect(event.dayKey < localDayKey(now)).toBe(true);
    }
    expect(fixture.history.every((entry) => !entry.photo)).toBe(true);
    expect(fixture.care.products.every((product) => !product.verified)).toBe(true);
    expect(Object.entries(fixture.care.reminders).filter(([, value]) => value === true)).toEqual([['quietHours', true]]);
    const session = await prepareDemoSession('two-months', 'first', now);
    expect(await hasCompletedOnboarding(session.userId)).toBe(true);
    expect((await loadCheckInRecords(session.userId, 'self', localDayKey(now))).state).toEqual({});
    expect(await restoreDemoSession()).toEqual(session);
  });

  it('uses calendar-day offsets across DST and year boundaries', () => {
    for (const date of [new Date(2026, 10, 3, 0, 5), new Date(2026, 2, 10, 0, 5), new Date(2027, 0, 2)]) {
      const fixture = createDemoFixture('two-months', 'boundary', date);
      const start = new Date(date); start.setDate(start.getDate() - 60);
      expect(fixture.care.products[0].startedOn).toBe(localDayKey(start));
      expect(new Set(fixture.history.map((entry) => entry.dayKey)).size).toBe(52);
      expect(fixture.history.every((entry) => localDayKey(new Date(entry.savedAt)) === entry.dayKey)).toBe(true);
    }
  });

  it('does not publish partially written fixtures or alter another account', async () => {
    store.values.set('myeczema.profiles.real-owner', 'untouched');
    store.failKey = 'check-in-history';
    await expect(prepareDemoSession('two-months', 'failed', now)).rejects.toThrow('Synthetic disk failure');
    expect(store.values.has(demoSessionKey)).toBe(false);
    expect(store.values.get('myeczema.profiles.real-owner')).toBe('untouched');
    store.failKey = '';
    await prepareDemoSession('new', 'retry', now);
    expect((await restoreDemoSession())?.scenario).toBe('new');
    await clearDemoSession();
    expect(await restoreDemoSession()).toBeNull();
    expect(store.values.get('myeczema.profiles.real-owner')).toBe('untouched');
  });

  it('rejects corrupt sessions and non-demo identities', () => {
    expect(parseDemoSession(null)).toBeNull();
    for (const value of ['{}', '{broken', JSON.stringify({ userId: 'real-user', username: 'alex.demo@example.invalid', scenario: 'new' })]) expect(() => parseDemoSession(value)).toThrow();
  });
});
