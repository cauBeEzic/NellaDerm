import { describe, expect, it } from 'vitest';

import { demoCareProducts, type RoutineEvent } from './care';
import { createCheckInDraft, saveCheckInDraft, type CheckInArea, type CheckInEntry } from './check-in';
import {
  calendarDayNumber, comparablePhotoAreas, defaultPhotoPair, findPhotoRecord,
  photoPeriodSummary, photoRecords, resolvePhotoPair,
} from './photo-progress';

const ids = [
  '59e1a47b-eda9-4d95-b733-76d7d365dc2b',
  '803dd9ed-62a6-42b8-b389-01e5e34262b6',
  '23c2aca2-1805-4e5c-ade1-c6aa05f071a8',
];

function entry(dayKey: string, id = ids[0], area: CheckInArea = 'hands'): CheckInEntry {
  const now = new Date(`${dayKey}T12:00:00Z`);
  return {
    ...saveCheckInDraft(createCheckInDraft(now, 'same'), now),
    dayKey,
    photo: {
      id, localUri: `file:///cache/myeczema-private-media/${id}.jpg`, area, note: '',
      mimeType: 'image/jpeg', size: 1024, width: 800, height: 600, sha256: 'a'.repeat(64),
      createdAt: now.toISOString(), storage: 'app-private-cache', syncStatus: 'local-only',
    },
  };
}

function event(dayKey: string, update: Partial<RoutineEvent> = {}): RoutineEvent {
  return { id: `use-${dayKey}`, productId: demoCareProducts[0].id, dayKey,
    period: 'morning', status: 'used', recordedAt: `${dayKey}T12:00:00Z`, displayTime: 'Noon', ...update };
}

describe('photo comparison eligibility', () => {
  it('rejects normalized invalid dates while handling leap years and early years', () => {
    for (const key of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-10-00', '26-10-01', '2026-1-01', '0000-01-01']) {
      expect(calendarDayNumber(key)).toBeUndefined();
    }
    expect(calendarDayNumber('2024-02-29')).toBeDefined();
    expect(calendarDayNumber('0099-01-01')).toBeDefined();
  });

  it('canonicalizes repeated history rows without changing inputs and sorts oldest first', () => {
    const earlier = entry('2026-10-01');
    const later = entry('2026-10-03', ids[1]);
    const history = [later, earlier, earlier];
    expect(photoRecords(history).map((record) => record.photo.id)).toEqual([ids[0], ids[1]]);
    expect(history).toEqual([later, earlier, earlier]);
  });

  it('excludes malformed, missing and ambiguous photo references', () => {
    const earlier = entry('2026-10-01');
    const sameFileLater = entry('2026-10-03');
    const unavailable = entry('2026-10-04', ids[1]);
    expect(photoRecords([earlier, sameFileLater, unavailable], (photo) => photo.id !== ids[1])).toEqual([]);
    expect(photoRecords([{ ...earlier, dayKey: '2026-02-30' }])).toEqual([]);
    expect(photoRecords([{ ...earlier, photo: { ...earlier.photo!, id: '../foreign' } }])).toEqual([]);
    expect(photoRecords([earlier], () => { throw new Error('file access'); })).toEqual([]);
  });

  it('resolves only IDs in the supplied owner history, never a URI or array parameter', () => {
    const records = photoRecords([entry('2026-10-01')]);
    expect(findPhotoRecord(records, ids[0])?.dayKey).toBe('2026-10-01');
    for (const id of [ids[1], `file:///cache/${ids[0]}.jpg`, [ids[0]], undefined]) {
      expect(findPhotoRecord(records, id)).toBeUndefined();
    }
    expect(findPhotoRecord([...records, ...records], ids[0])).toBeUndefined();
  });

  it('requires distinct IDs, distinct dates, chronological order and the same recorded area', () => {
    const records = photoRecords([entry('2026-10-01'), entry('2026-10-03', ids[1]), entry('2026-10-04', ids[2], 'face')]);
    expect(resolvePhotoPair(records, ids[0], ids[1])).toMatchObject({ earlier: { dayKey: '2026-10-01' }, later: { dayKey: '2026-10-03' } });
    expect(resolvePhotoPair(records, ids[0], ids[0])).toBeUndefined();
    expect(resolvePhotoPair(records, ids[1], ids[0])).toBeUndefined();
    expect(resolvePhotoPair(records, ids[0], ids[2])).toBeUndefined();
    expect(resolvePhotoPair([records[0], { ...records[1], dayKey: records[0].dayKey }], ids[0], ids[1])).toBeUndefined();
    expect(comparablePhotoAreas(records)).toEqual(['hands']);
    expect(defaultPhotoPair(records, 'face')).toBeUndefined();
    expect(defaultPhotoPair(records, 'hands')).toEqual(resolvePhotoPair(records, ids[0], ids[1]));
  });

  it('allows two Other records without interpreting them as an exact anatomical location', () => {
    const records = photoRecords([entry('2026-10-01', ids[0], 'other'), entry('2026-10-03', ids[1], 'other')]);
    expect(comparablePhotoAreas(records)).toEqual(['other']);
    expect(defaultPhotoPair(records, 'other')).toBeDefined();
  });
});

describe('date-bounded photo activity summary', () => {
  it('counts calendar spans across spring and autumn DST without rounding local hours', () => {
    for (const [start, end] of [['2026-03-07', '2026-03-09'], ['2026-10-31', '2026-11-02']]) {
      const history = [entry(start), entry(end, ids[1])];
      const pair = defaultPhotoPair(photoRecords(history), 'hands')!;
      expect(photoPeriodSummary(pair, history, [], [])).toMatchObject({ elapsedDays: 2, calendarDays: 3, skinRecordedDays: 2, skinNotRecordedDays: 1 });
    }
  });

  it('includes both endpoint dates and keeps missing skin days separate from product logs', () => {
    const history = [entry('2026-10-01'), entry('2026-10-04', ids[1])];
    const pair = defaultPhotoPair(photoRecords(history), 'hands')!;
    const events = [event('2026-09-30'), event('2026-10-01'), event('2026-10-02'), event('2026-10-04'), event('2026-10-05')];
    expect(photoPeriodSummary(pair, [...history, history[0]], events, demoCareProducts)).toMatchObject({
      elapsedDays: 3, calendarDays: 4, skinRecordedDays: 2, skinNotRecordedDays: 2, productUseDays: 3,
      products: [{ name: 'NellaCalm', days: 3, useCount: 3, periods: ['morning'] }],
    });
  });

  it('deduplicates use slots and dates while respecting later Skipped corrections', () => {
    const history = [entry('2026-10-01'), entry('2026-10-03', ids[1])];
    const pair = defaultPhotoPair(photoRecords(history), 'hands')!;
    const first = event('2026-10-01');
    const evening = event('2026-10-01', { id: 'evening', period: 'evening' });
    const corrected = event('2026-10-02', { status: 'skipped', recordedAt: '2026-10-02T13:00:00Z' });
    const events = [first, { ...first, id: 'duplicate' }, evening, corrected, event('2026-10-02')];
    expect(photoPeriodSummary(pair, history, events, demoCareProducts)).toMatchObject({
      productUseDays: 1, products: [{ days: 1, useCount: 2, periods: ['morning', 'evening'] }],
    });
  });

  it('does not invent product activity or a current product name for removed records', () => {
    const history = [entry('2026-10-01'), entry('2026-10-03', ids[1])];
    const pair = defaultPhotoPair(photoRecords(history), 'hands')!;
    const events = [event('2026-10-01', { productId: 'removed', period: 'as-needed' }), event('2026-10-02', { status: 'skipped' })];
    expect(photoPeriodSummary(pair, history, events, demoCareProducts)).toMatchObject({
      productUseDays: 1, products: [{ productId: 'removed', name: 'Previously tracked product', days: 1, useCount: 1, periods: ['as-needed'] }],
    });
    expect(photoPeriodSummary(pair, history, [], demoCareProducts)?.products).toEqual([]);
  });

  it('fails closed for an invalid pair and ignores malformed log dates/periods/timestamps', () => {
    const history = [entry('2026-10-01'), entry('2026-10-03', ids[1])];
    const pair = defaultPhotoPair(photoRecords(history), 'hands')!;
    expect(photoPeriodSummary({ earlier: pair.later, later: pair.earlier }, history, [], [])).toBeUndefined();
    const events = [event('2026-10-02', { recordedAt: 'broken' }), event('2026-10-02', { period: 'invalid' as RoutineEvent['period'] }), event('2026-10-00'), event('2026-10-02', { productId: '' })];
    expect(photoPeriodSummary(pair, history, events, [])).toMatchObject({ productUseDays: 0, products: [] });
  });
});
