import { describe, expect, it } from 'vitest';

import { createDemoCareState, demoCareProducts, demoEvents } from './care';
import {
  calendarRecordingCounts,
  comparisonCounts,
  demoInsightEntries,
  entriesInRange,
  productUseDayKeys,
  rangeDayKeys,
  routineStatusCounts,
  routineStatusForDay,
  weeklyReview,
} from './insights';

describe('insights and review derivations', () => {
  const now = new Date(2026, 9, 10, 16);

  it('keeps missing days distinct from recorded comparisons', () => {
    const entries = demoInsightEntries(now);
    const week = weeklyReview(entries, { products: demoCareProducts, events: demoEvents(now) }, now);
    expect(entriesInRange(entries, 7, now)).toHaveLength(6);
    expect(week.filter((day) => day.entry)).toHaveLength(6);
    expect(week.find((day) => !day.entry)?.dayKey).toBe('2026-10-06');
    expect(comparisonCounts(entries)).toEqual({ better: 2, same: 3, worse: 1 });
  });

  it('counts only displayed days for a populated 90-day selection while retaining the full summary', () => {
    const template = demoInsightEntries(now)[0];
    const entries = rangeDayKeys(60, now).map((dayKey) => ({ ...template, dayKey }));
    const selected = entriesInRange(entries, 90, now);
    const byDay = new Map(selected.map((entry) => [entry.dayKey, entry]));

    expect(selected).toHaveLength(60);
    expect(calendarRecordingCounts(rangeDayKeys(30, now), byDay)).toEqual({ recorded: 30, notRecorded: 0 });
  });

  it('does not mistake older records for completeness in a sparse displayed month', () => {
    const template = demoInsightEntries(now)[0];
    const keys = rangeDayKeys(90, now);
    const entries = [...keys.slice(0, 59), keys[89]].map((dayKey) => ({ ...template, dayKey }));
    const selected = entriesInRange(entries, 90, now);
    const byDay = new Map(selected.map((entry) => [entry.dayKey, entry]));

    expect(selected).toHaveLength(60);
    expect(calendarRecordingCounts(rangeDayKeys(30, now), byDay)).toEqual({ recorded: 1, notRecorded: 29 });
  });

  it.each([7, 30, 90] as const)('keeps an empty %i-day selection entirely not recorded', (range) => {
    const keys = rangeDayKeys(Math.min(range, 30), now);
    expect(calendarRecordingCounts(keys, new Map())).toEqual({ recorded: 0, notRecorded: keys.length });
  });

  it('recalculates displayed missingness across range changes without counting duplicate or off-grid entries', () => {
    const template = demoInsightEntries(now)[0];
    const keys = rangeDayKeys(90, now);
    const entries = [keys[0], keys[60], keys[83], keys[89], keys[89], '2026-10-11'].map((dayKey) => ({ ...template, dayKey }));
    const byDay = new Map(entries.map((entry) => [entry.dayKey, entry]));
    const expected = [
      { range: 90, recorded: 3, notRecorded: 27 },
      { range: 7, recorded: 2, notRecorded: 5 },
      { range: 30, recorded: 3, notRecorded: 27 },
      { range: 90, recorded: 3, notRecorded: 27 },
    ] as const;
    for (const { range, recorded, notRecorded } of expected) {
      expect(calendarRecordingCounts(rangeDayKeys(Math.min(range, 30), now), byDay)).toEqual({ recorded, notRecorded });
    }
  });

  it('separates complete, partial, and not-recorded routine days', () => {
    const products = [demoCareProducts[1]];
    const events = demoEvents(now).filter((event) => event.productId === products[0].id);
    expect(routineStatusForDay({ products, events }, '2026-10-10')).toBe('complete');
    expect(routineStatusForDay({ products, events: [] }, '2026-10-10')).toBe('not-recorded');
    expect(routineStatusForDay({ products, events: [{ ...events[0], dayKey: '2026-10-10', status: 'skipped' }] }, '2026-10-10')).toBe('partial');
    expect(routineStatusCounts(weeklyReview(demoInsightEntries(now), { products, events }, now))['not-recorded']).toBe(1);
  });


  it('uses one clock anchor for demo skin and care records', () => {
    const state = createDemoCareState(now);
    const entryDays = new Set(demoInsightEntries(now).map((entry) => entry.dayKey));
    expect(state.events.some((event) => event.dayKey === '2026-10-10')).toBe(true);
    expect(entryDays.has('2026-10-10')).toBe(true);
  });

  it('filters product-use calendar markers without changing missing skin days', () => {
    const events = demoEvents(now);
    const allDays = productUseDayKeys(events, 'all', 7, now);
    const nellaDays = productUseDayKeys(events, demoCareProducts[0].id, 7, now);
    expect(allDays).toEqual(new Set(['2026-10-04', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']));
    expect(nellaDays).toEqual(allDays);
    expect(allDays.has('2026-10-05')).toBe(false);
  });
});
