import { describe, expect, it } from 'vitest';

import { defaultReminders, type CareProduct } from './care';
import { buildLocalNotificationPlans, genericNotificationContent, nextReminderLabel, notificationDestination, parseNotificationRoute, resolveNotificationPermissionState } from './notifications';

const prescription: CareProduct = {
  id: 'prescription-opaque-id',
  name: 'Sensitive product name',
  category: 'Prescription',
  kind: 'prescription',
  schedule: ['morning', 'evening'],
  startedOn: '2026-10-01',
  supply: 'plenty',
  area: 'Sensitive body area',
  verified: false,
};

describe('notification planning and privacy', () => {
  it('keeps a fresh Android permission requestable until the user makes a final choice', () => {
    expect(resolveNotificationPermissionState({ granted: false, canAskAgain: true })).toBe('undetermined');
    expect(resolveNotificationPermissionState({ granted: false, canAskAgain: false })).toBe('denied');
    expect(resolveNotificationPermissionState({ granted: false, canAskAgain: false, provisional: true })).toBe('granted');
  });

  it('unions eligible skincare weekdays per period without including prescription days or duplicate reminders', () => {
    const now = new Date(2026, 9, 16, 12);
    const first = { ...prescription, id: 'skin-a', category: 'Treatment' as const, kind: 'skincare' as const, schedule: ['morning' as const], weekdays: ['mon' as const, 'fri' as const] };
    const second = { ...first, id: 'skin-b', weekdays: ['mon' as const, 'wed' as const] };
    const rx = { ...prescription, weekdays: ['sun' as const] };
    const plans = buildLocalNotificationPlans(defaultReminders, [first, second, rx], 'synthetic-profile', now);
    expect(plans.filter((plan) => plan.routeKey === 'morning-routine').map((plan) => plan.schedule)).toEqual([
      { kind: 'weekly', weekday: 2, hour: 8, minute: 0 },
      { kind: 'weekly', weekday: 4, hour: 8, minute: 0 },
      { kind: 'weekly', weekday: 6, hour: 8, minute: 0 },
    ]);
    expect(plans.filter((plan) => plan.routeKey === 'evening-routine')).toEqual([]);
    expect(plans.filter((plan) => plan.routeKey === 'prescription').map((plan) => plan.schedule)).toEqual([
      { kind: 'weekly', weekday: 1, hour: 8, minute: 5 },
      { kind: 'weekly', weekday: 1, hour: 21, minute: 5 },
    ]);
    expect(new Set(plans.map((plan) => plan.key)).size).toBe(plans.length);
    expect(plans.every((plan) => plan.profileId === 'synthetic-profile')).toBe(true);
    expect(nextReminderLabel(plans.find((plan) => plan.key === 'morning-wed')!)).toContain('Wednesday');
  });

  it('retains legacy daily cadence and unrelated check-in/weekly preferences without timing as-needed products', () => {
    const skincare = { ...prescription, category: 'Other' as const, kind: 'skincare' as const };
    const now = new Date(2026, 9, 16, 12);
    const plans = buildLocalNotificationPlans(defaultReminders, [skincare], 'synthetic-profile', now);
    expect(plans.filter((plan) => plan.routeKey.endsWith('-routine')).map((plan) => plan.schedule)).toEqual([
      { kind: 'daily', hour: 8, minute: 0 }, { kind: 'daily', hour: 21, minute: 0 },
    ]);
    const optional = buildLocalNotificationPlans(defaultReminders, [{ ...skincare, schedule: ['as-needed'], weekdays: ['fri'] }], 'synthetic-profile', now);
    expect(optional.map((plan) => plan.routeKey)).toEqual(['check-in', 'weekly-review']);
    expect(optional.find((plan) => plan.routeKey === 'weekly-review')?.schedule).toEqual({ kind: 'weekly', weekday: 1, hour: 19, minute: 0 });
  });

  it('reconciles future-start eligibility and preference-off changes without borrowing other periods', () => {
    const future = { ...prescription, category: 'Other' as const, kind: 'skincare' as const, schedule: ['evening' as const], weekdays: ['mon' as const], startedOn: '2026-10-19' };
    const before = buildLocalNotificationPlans(defaultReminders, [future], 'synthetic-profile', new Date(2026, 9, 16, 12));
    expect(before.some((plan) => plan.routeKey.endsWith('-routine'))).toBe(false);
    const active = buildLocalNotificationPlans(defaultReminders, [future], 'synthetic-profile', new Date(2026, 9, 19, 12));
    expect(active.filter((plan) => plan.routeKey === 'evening-routine').map((plan) => plan.schedule)).toEqual([{ kind: 'weekly', weekday: 2, hour: 21, minute: 0 }]);
    expect(buildLocalNotificationPlans({ ...defaultReminders, evening: false }, [future], 'synthetic-profile', new Date(2026, 9, 19, 12)).some((plan) => plan.routeKey === 'evening-routine')).toBe(false);
  });

  it('treats legacy prescription categories as prescription-only even when kind says skincare', () => {
    const plans = buildLocalNotificationPlans(defaultReminders, [{ ...prescription, kind: 'skincare', weekdays: ['tue'] }], 'synthetic-profile', new Date(2026, 9, 16, 12));
    expect(plans.some((plan) => plan.routeKey.endsWith('-routine'))).toBe(false);
    expect(plans.filter((plan) => plan.routeKey === 'prescription').map((plan) => plan.schedule)).toEqual([
      { kind: 'weekly', weekday: 3, hour: 8, minute: 5 }, { kind: 'weekly', weekday: 3, hour: 21, minute: 5 },
    ]);
    expect(buildLocalNotificationPlans({ ...defaultReminders, prescription: false }, [prescription], 'synthetic-profile', new Date(2026, 9, 16, 12)).some((plan) => plan.routeKey === 'prescription')).toBe(false);
  });

  it('does not schedule prescription reminders without a matching saved routine', () => {
    const plans = buildLocalNotificationPlans(defaultReminders, [], 'profile-opaque-id');
    expect(plans.some((plan) => plan.routeKey === 'prescription')).toBe(false);
  });

  it('uses generic lock-screen content and opaque routing data only', () => {
    const content = genericNotificationContent({ routeKey: 'prescription', profileId: 'profile-opaque-id' });
    expect(content).toEqual({
      title: 'A MyEczema reminder',
      body: 'Open MyEczema when you’re ready.',
      data: { routeKey: 'prescription', profileId: 'profile-opaque-id' },
    });
    const serialized = JSON.stringify(content).toLowerCase();
    expect(serialized).not.toContain('eczema flare');
    expect(serialized).not.toContain('sensitive product');
    expect(serialized).not.toContain('sensitive body');
  });

  it('accepts only known deep links with an opaque profile id', () => {
    expect(parseNotificationRoute({ routeKey: 'weekly-review', profileId: 'profile-opaque-id' })).toEqual({ routeKey: 'weekly-review', profileId: 'profile-opaque-id' });
    expect(parseNotificationRoute({ routeKey: 'unknown', profileId: 'profile-opaque-id' })).toBeUndefined();
    expect(parseNotificationRoute({ routeKey: 'check-in', profileId: '' })).toBeUndefined();
    expect(parseNotificationRoute('check-in')).toBeUndefined();
  });

  it('maps every supported response to a bounded authenticated app destination', () => {
    expect(notificationDestination('check-in')).toBe('/check-in');
    expect(notificationDestination('morning-routine')).toBe('/(tabs)');
    expect(notificationDestination('prescription')).toBe('/(tabs)/care?tab=routine');
    expect(notificationDestination('weekly-review')).toBe('/insights/weekly');
    expect(notificationDestination('reorder')).toBe('/(tabs)/care?tab=products');
    expect(notificationDestination('notifications')).toBe('/notifications');
  });
});
