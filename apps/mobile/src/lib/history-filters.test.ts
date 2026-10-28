import { describe, expect, it } from 'vitest';

import { demoCareProducts, type RoutineEvent } from './care';
import { createCheckInDraft, saveCheckInDraft, type CheckInArea, type CheckInPhoto } from './check-in';
import { buildHistoryItems, filterHistoryItems, historyDateError, historyProductOptions, type HistoryFilters } from './insights';

const photo: CheckInPhoto = {
  id: '59e1a47b-eda9-4d95-b733-76d7d365dc2b', localUri: 'file:///synthetic/private.jpg', area: 'neck', note: '',
  mimeType: 'image/jpeg', size: 1024, width: 800, height: 600, sha256: 'a'.repeat(64),
  createdAt: '2026-10-17T01:00:00Z', storage: 'app-private-cache', syncStatus: 'local-only',
};
const entry = (day: string, areas: CheckInArea[], attachment?: CheckInPhoto) => saveCheckInDraft({
  ...createCheckInDraft(new Date(`${day}T12:00:00Z`), 'same'), dayKey: day, areas, photo: attachment,
}, new Date(`${day}T12:00:00Z`));
const event = (id: string, dayKey: string, productId: string, status: 'used' | 'skipped' = 'used'): RoutineEvent => ({
  id, dayKey, productId, status, period: 'morning', recordedAt: `${dayKey}T08:00:00Z`, displayTime: '8:00 AM',
});
const products = [
  { ...demoCareProducts[0], id: 'synthetic-a', name: 'Same name', area: 'Hands' },
  { ...demoCareProducts[0], id: 'synthetic-b', name: 'Same name', area: 'Neck' },
  { ...demoCareProducts[0], id: 'synthetic-no-events', name: 'No events' },
];
const entries = [entry('2025-12-31', []), entry('2026-10-15', ['hands']), entry('2026-10-16', ['hands', 'face'], photo)];
const events = [event('a', '2026-10-16', 'synthetic-a'), event('b', '2026-10-16', 'synthetic-b', 'skipped'), event('orphan', '2026-10-15', 'historical-id')];
const items = buildHistoryItems(entries, events, products);
const ids = (filters: HistoryFilters) => filterHistoryItems(items, filters).map((item) => item.id);

describe('History filters over recorded metadata', () => {
  it('accepts saved Gregorian bounds independently of skipped dates in the current timezone', () => {
    const previous = process.env.TZ;
    process.env.TZ = 'Pacific/Apia';
    try {
      expect(historyDateError('2011-12-30', '2011-12-30')).toBeUndefined();
      const historical = buildHistoryItems([entry('2011-12-30', ['hands'])], [], []);
      expect(filterHistoryItems(historical, { recordType: 'all', fromDay: '2011-12-30', toDay: '2011-12-30' }).map((item) => item.dayKey)).toEqual(['2011-12-30']);
      expect(historyDateError('0099-01-01')).toBeUndefined();
    } finally {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    }
  });

  it('supports inclusive single-day, closed and one-sided ranges without imposing a recent-day window', () => {
    expect(ids({ recordType: 'all', fromDay: '2026-10-16', toDay: '2026-10-16' })).toEqual(['photo-2026-10-16', 'skin-2026-10-16', 'product-a', 'product-b']);
    expect(ids({ recordType: 'skin', fromDay: '2026-10-15', toDay: '2026-10-16' })).toEqual(['skin-2026-10-16', 'skin-2026-10-15']);
    expect(ids({ recordType: 'skin', toDay: '2026-10-15' })).toEqual(['skin-2026-10-15', 'skin-2025-12-31']);
    expect(ids({ recordType: 'skin', fromDay: '2026-10-16' })).toEqual(['skin-2026-10-16']);
  });

  it('matches a photo only by its own area, without borrowing the parent check-in areas or UTC date', () => {
    expect(ids({ recordType: 'all', area: 'hands' })).toEqual(['skin-2026-10-16', 'skin-2026-10-15']);
    expect(ids({ recordType: 'photos', area: 'neck', toDay: '2026-10-16' })).toEqual(['photo-2026-10-16']);
    expect(ids({ recordType: 'photos', area: 'hands' })).toEqual([]);
    expect(ids({ recordType: 'skin', area: 'other' })).toEqual([]);
  });

  it('matches exact product IDs, keeps Skipped and historical orphan events, and infers no same-day association', () => {
    expect(ids({ recordType: 'all', productId: 'synthetic-b' })).toEqual(['product-b']);
    expect(filterHistoryItems(items, { recordType: 'products', productId: 'synthetic-b' })[0].title).toContain('skipped');
    expect(ids({ recordType: 'all', productId: 'historical-id' })).toEqual(['product-orphan']);
    expect(ids({ recordType: 'skin', productId: 'synthetic-a' })).toEqual([]);
    expect(ids({ recordType: 'photos', productId: 'synthetic-a' })).toEqual([]);
    expect(ids({ recordType: 'all', productId: 'synthetic-no-events' })).toEqual([]);
  });

  it('ANDs all dimensions and never treats a product application-area label as a recorded routine area', () => {
    expect(ids({ recordType: 'skin', area: 'face', fromDay: '2026-10-16', toDay: '2026-10-16' })).toEqual(['skin-2026-10-16']);
    expect(ids({ recordType: 'products', productId: 'synthetic-a', fromDay: '2026-10-15', toDay: '2026-10-15' })).toEqual([]);
    expect(ids({ recordType: 'all', productId: 'synthetic-a', area: 'hands' })).toEqual([]);
  });

  it('clears to the original ordered ledger without rewriting, dropping or manufacturing source records', () => {
    const snapshot = JSON.stringify({ entries, events, products });
    ids({ recordType: 'photos', area: 'other', fromDay: '2026-10-16' });
    expect(ids({ recordType: 'all' })).toEqual([
      'photo-2026-10-16', 'skin-2026-10-16', 'product-a', 'product-b', 'skin-2026-10-15', 'product-orphan', 'skin-2025-12-31',
    ]);
    expect(JSON.stringify({ entries, events, products })).toBe(snapshot);
    expect(filterHistoryItems([], { recordType: 'all' })).toEqual([]);
  });

  it('orders each original day by actual timestamp even when valid stored offsets differ', () => {
    const older = { ...events[0], id: 'older', recordedAt: '2026-10-16T09:00:00Z' };
    const newer = { ...events[0], id: 'newer', recordedAt: '2026-10-16T08:00:00-04:00' };
    expect(buildHistoryItems([], [older, newer, event('previous-day', '2026-10-15', 'synthetic-a')], products).map((item) => item.id)).toEqual(['product-newer', 'product-older', 'product-previous-day']);
  });

  it('offers current and historical IDs and disambiguates products with the same display name', () => {
    const options = historyProductOptions(items, products);
    expect(options.map((option) => option.id)).toEqual(['synthetic-a', 'synthetic-b', 'synthetic-no-events', 'historical-id']);
    expect(options.find((option) => option.id === 'synthetic-a')?.label).toContain('synthetic-a');
    expect(options.find((option) => option.id === 'synthetic-b')?.label).toContain('synthetic-b');
    expect(options.find((option) => option.id === 'historical-id')?.label).toContain('historical-id');
  });

  it.each(['2026-02-29', '1900-02-29', '2026-09-31', '2026-13-01', '2026-1-01', '2026-01-00', '0000-01-01', 'not-a-date'])('rejects invalid date %s rather than silently shifting or dropping the bound', (day) => {
    expect(historyDateError(day)).toBeDefined();
    expect(filterHistoryItems(items, { recordType: 'all', fromDay: day })).toEqual([]);
  });

  it('accepts leap days and blank bounds but rejects reversed ranges in either boundary position', () => {
    expect(historyDateError('2000-02-29', '2024-02-29')).toBeUndefined();
    expect(historyDateError('', '')).toBeUndefined();
    expect(historyDateError('2026-10-16', '2026-10-15')).toBeDefined();
    expect(historyDateError(undefined, '2026-02-30')).toBeDefined();
  });
});
