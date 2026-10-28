import { describe, expect, it } from 'vitest';

import { demoCareProducts, type RoutineEvent } from './care';
import { createCheckInDraft, saveCheckInDraft, type CheckInPhoto } from './check-in';
import { productPeriodSummary, productTrackingInterval, resolveProductPeriod, type ProductPeriodParams } from './product-period';

const product = { ...demoCareProducts[0], id: 'synthetic-a', startedOn: '2026-10-14' };
const photo = (id: string): CheckInPhoto => ({
  id, localUri: `file:///synthetic/${id}.jpg`, area: 'hands', note: '', mimeType: 'image/jpeg', size: 1024,
  width: 800, height: 600, sha256: 'a'.repeat(64), createdAt: '2026-10-17T01:00:00Z', storage: 'app-private-cache', syncStatus: 'local-only',
});
const entry = (day: string, attachment?: CheckInPhoto) => saveCheckInDraft({
  ...createCheckInDraft(new Date(`${day}T12:00:00Z`), 'same'), dayKey: day, photo: attachment,
}, new Date(`${day}T12:00:00Z`));
const event = (id: string, dayKey: string, status: 'used' | 'skipped', productId = product.id, period: 'morning' | 'evening' = 'morning'): RoutineEvent => ({
  id, dayKey, status, productId, period, recordedAt: `${dayKey}T09:00:00Z`, displayTime: '9:00 AM',
});
const photoA = photo('59e1a47b-eda9-4d95-b733-76d7d365dc2b');
const photoB = photo('69e1a47b-eda9-4d95-b733-76d7d365dc2c');
const entries = [entry('2026-10-14', photoA), entry('2026-10-16', photoB)];
const events = [
  event('before', '2026-10-13', 'used'), event('old-use', '2026-10-14', 'used'),
  { ...event('corrected-skip', '2026-10-14', 'skipped'), recordedAt: '2026-10-14T08:30:00-04:00' },
  event('am', '2026-10-15', 'used'), event('pm', '2026-10-15', 'used', product.id, 'evening'),
  event('skip', '2026-10-16', 'skipped'), event('after', '2026-10-17', 'used'),
  event('other-same-day', '2026-10-15', 'used', 'synthetic-b'), event('other-period', '2026-10-14', 'used', 'old-id'),
  event('other-skip', '2026-10-16', 'skipped', 'skip-only'),
];
const request: ProductPeriodParams = { periodProduct: product.id, periodFrom: product.startedOn, periodTo: '2026-10-16', periodType: 'skin', periodScope: 'process-a:4' };

describe('product tracking intervals and period evidence', () => {
  it('uses inclusive saved start through end, including a one-day interval', () => {
    expect(productTrackingInterval(product, '2026-10-16')).toEqual({ fromDay: '2026-10-14', toDay: '2026-10-16', calendarDays: 3 });
    expect(productTrackingInterval(product, '2026-10-14')?.calendarDays).toBe(1);
  });

  it('counts original Gregorian days independently of DST and skipped local dates', () => {
    expect(productTrackingInterval({ ...product, startedOn: '2011-12-29' }, '2011-12-31')?.calendarDays).toBe(3);
    expect(productTrackingInterval({ ...product, startedOn: '2026-03-07' }, '2026-03-09')?.calendarDays).toBe(3);
    expect(productTrackingInterval({ ...product, startedOn: '0099-01-01' }, '0099-01-02')?.calendarDays).toBe(2);
  });

  it.each(['Today', 'Sep 20, 2024', '2026-02-30', '2026-2-01', '0000-01-01', '2026-10-17'])('does not invent an interval for legacy, invalid or future start %s', (startedOn) => {
    expect(productTrackingInterval({ ...product, startedOn }, '2026-10-16')).toBeUndefined();
    expect(productPeriodSummary({ ...product, startedOn }, '2026-10-16', entries, events, [product], () => true)).toBeUndefined();
  });

  it('separates corrected product records from same-period check-ins/photos and other product use', () => {
    const summary = productPeriodSummary(product, '2026-10-16', entries, events, [product], (item) => item.id === photoA.id)!;
    expect(summary).toMatchObject({ usedEvents: 2, usedDays: 1, skippedEvents: 2, recordedDays: 3, daysWithoutProductRecord: 0, checkInDays: 2, daysWithoutCheckIn: 1, availablePhotos: 1, unavailablePhotos: 1, overlappingUseDays: 1 });
    expect(new Set(summary.otherProducts.map((item) => item.id))).toEqual(new Set(['synthetic-b', 'old-id']));
  });

  it('keeps empty sources unrecorded without manufacturing use or improvement', () => {
    expect(productPeriodSummary(product, '2026-10-16', [], [], [product], () => true)).toMatchObject({ usedEvents: 0, usedDays: 0, skippedEvents: 0, recordedDays: 0, daysWithoutProductRecord: 3, checkInDays: 0, daysWithoutCheckIn: 3, availablePhotos: 0, unavailablePhotos: 0, otherProducts: [], overlappingUseDays: 0 });
  });

  it('discloses missing, ambiguous and failed photo availability without deleting metadata', () => {
    const snapshot = JSON.stringify({ entries, events, product });
    expect(productPeriodSummary(product, '2026-10-16', entries, events, [product], () => { throw new Error('Synthetic missing cache'); })).toMatchObject({ availablePhotos: 0, unavailablePhotos: 2 });
    const ambiguous = [entry('2026-10-14', photoA), entry('2026-10-16', photoA)];
    expect(productPeriodSummary(product, '2026-10-16', ambiguous, [], [product], () => true)).toMatchObject({ availablePhotos: 0, unavailablePhotos: 2 });
    expect(JSON.stringify({ entries, events, product })).toBe(snapshot);
  });

  it('rejects an in-period photo whose ID is ambiguous elsewhere in the retained owner history', () => {
    const globallyAmbiguous = [entry('2026-10-13', photoA), entry('2026-10-15', photoA)];
    expect(productPeriodSummary(product, '2026-10-16', globallyAmbiguous, [], [product], () => true)).toMatchObject({ checkInDays: 1, availablePhotos: 0, unavailablePhotos: 1 });
  });

  it('qualifies older gaps using the bounded available history, not a claim that nothing was recorded', () => {
    const history = Array.from({ length: 100 }, (_, index) => entry(new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10)));
    expect(productPeriodSummary({ ...product, startedOn: '2026-01-01' }, '2026-04-10', history, [], [product], () => true)).toMatchObject({ interval: { calendarDays: 100 }, checkInDays: 90, daysWithoutCheckIn: 10, daysWithoutProductRecord: 100 });
  });
});

describe('product-period route ownership and validation', () => {
  it('freezes a valid earlier end day while retaining only the intended Skin or Photos view', () => {
    expect(resolveProductPeriod(request, 'process-a:4', [product], '2026-10-17')).toMatchObject({ kind: 'valid', recordType: 'skin', interval: { fromDay: '2026-10-14', toDay: '2026-10-16' } });
    expect(resolveProductPeriod({ ...request, periodType: 'photos' }, 'process-a:4', [product], '2026-10-16')).toMatchObject({ kind: 'valid', recordType: 'photos' });
    expect(resolveProductPeriod({}, undefined, [], '2026-10-16')).toEqual({ kind: 'none' });
  });

  it.each([undefined, 'process-a:5', 'process-b:4'])('rejects absent, reloaded, owner-round-trip or restarted scope %s without substituting the same product ID', (scope) => {
    expect(resolveProductPeriod(request, scope, [{ ...product, name: 'Other owner same ID' }], '2026-10-16')).toEqual({ kind: 'unavailable' });
  });

  it('rejects missing products and changed starts instead of substituting another interval', () => {
    expect(resolveProductPeriod(request, 'process-a:4', [], '2026-10-16')).toEqual({ kind: 'unavailable' });
    expect(resolveProductPeriod(request, 'process-a:4', [{ ...product, startedOn: '2026-10-15' }], '2026-10-16')).toEqual({ kind: 'unavailable' });
  });

  it.each([
    { periodScope: ['process-a:4'] }, { periodProduct: [product.id] }, { periodFrom: '2026-02-30' },
    { periodTo: '2026-10-13' }, { periodTo: '2026-10-17' }, { periodType: 'all' }, { periodFrom: undefined },
  ])('rejects malformed, reversed or future period request %j', (patch) => {
    expect(resolveProductPeriod({ ...request, ...patch }, 'process-a:4', [product], '2026-10-16')).toEqual({ kind: 'unavailable' });
  });
});
