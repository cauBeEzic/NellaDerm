import { describe, expect, it } from 'vitest';

import { demoCareProducts, emptyCareState, isProductScheduledOnDay, isRoutinePeriodComplete, routineHistory, routineScheduleForDay, routineWeekdays, setCareRoutineSchedules, setNamedRoutineStatus, setProductRoutineStatus, toRoutineProducts, type RoutineScheduleEdit } from './care';
import { routineStatusForDay, weeklyReview } from './insights';

const friday = new Date(2026, 9, 16, 9);
const legacy = { ...demoCareProducts[1], id: 'synthetic-legacy', startedOn: 'Added during setup', personalInstructions: 'Synthetic label note' };
const state = { ...emptyCareState, products: [legacy] };
const change: RoutineScheduleEdit = { productId: legacy.id, schedule: ['evening'], weekdays: ['mon', 'fri'] };

describe('routine weekday compatibility and history', () => {
  it('keeps legacy period-only records available every day without inventing an edit', () => {
    for (let day = 11; day <= 17; day += 1) {
      const date = new Date(2026, 9, day, 9);
      const dayKey = `2026-10-${day}`;
      expect(toRoutineProducts([legacy], [], 'morning', date).map((product) => product.id)).toEqual([legacy.id]);
      expect(isProductScheduledOnDay(legacy, dayKey, 'evening')).toBe(false);
    }
    const unchanged = setCareRoutineSchedules(state, [{ productId: legacy.id, schedule: [...legacy.schedule], weekdays: [...routineWeekdays] }], '2026-10-16');
    expect(unchanged).toBe(state);
    expect(unchanged.products[0]).not.toHaveProperty('scheduleHistory');
  });

  it('applies edited weekdays and periods from today while preserving yesterday’s expected routine and all records', () => {
    const yesterday = new Date(2026, 9, 15, 9);
    const events = setProductRoutineStatus([], legacy.id, 'morning', 'used', '9:00 AM', yesterday);
    const original = { ...state, events };
    const edited = setCareRoutineSchedules(original, [change], '2026-10-16');
    expect(edited.events).toEqual(events);
    expect(edited.reminders).toEqual(original.reminders);
    expect(edited.products[0]).toMatchObject({ supply: legacy.supply, startedOn: legacy.startedOn, personalInstructions: legacy.personalInstructions });
    expect(toRoutineProducts(edited.products, edited.events, 'morning', friday)).toEqual([]);
    expect(toRoutineProducts(edited.products, edited.events, 'evening', friday)).toMatchObject([{ id: legacy.id, status: 'due' }]);
    expect(toRoutineProducts(edited.products, edited.events, 'evening', new Date(2026, 9, 17, 21))).toEqual([]);
    expect(isRoutinePeriodComplete(edited, 'morning', friday)).toBe(false);
    expect(routineStatusForDay(edited, '2026-10-15')).toBe('complete');
    expect(weeklyReview([], edited, friday).find((day) => day.dayKey === '2026-10-15')?.routine).toBe('complete');
    expect(routineHistory(edited, friday).find((day) => day.dayKey === '2026-10-15')?.completed).toBe(true);
    expect(original.products[0]).toEqual(legacy);
  });

  it('keeps each earlier schedule version across later and repeated same-day edits', () => {
    const first = setCareRoutineSchedules(state, [change], '2026-10-16');
    const sameDay = setCareRoutineSchedules(first, [{ ...change, schedule: ['morning', 'evening'] }], '2026-10-16');
    const later = setCareRoutineSchedules(sameDay, [{ ...change, schedule: ['as-needed'], weekdays: ['tue'] }], '2026-10-19');
    const product = later.products[0];
    expect(product.scheduleHistory).toHaveLength(2);
    expect(routineScheduleForDay(product, '2026-10-15')).toMatchObject({ schedule: ['morning'], weekdays: routineWeekdays });
    expect(routineScheduleForDay(product, '2026-10-16')).toMatchObject({ schedule: ['morning', 'evening'], weekdays: ['mon', 'fri'] });
    expect(routineScheduleForDay(product, '2026-10-19')).toEqual({ schedule: ['as-needed'], weekdays: ['tue'] });
    expect(toRoutineProducts([product], [], 'evening', new Date(2026, 9, 20, 21))).toMatchObject([{ id: legacy.id }]);
    expect(isProductScheduledOnDay(product, '2026-10-20', 'evening')).toBe(false);
    expect(routineStatusForDay(later, '2026-10-20')).toBe('not-recorded');
    expect(() => setCareRoutineSchedules(later, [change], '2026-10-18')).toThrow('local date');
  });

  it('honors Sunday/local dates and start boundaries without relying on UTC weekday conversion', () => {
    const product = { ...legacy, weekdays: ['sun' as const], startedOn: '2026-10-18' };
    expect(isProductScheduledOnDay(product, '2026-10-11', 'morning')).toBe(false);
    expect(isProductScheduledOnDay(product, '2026-10-18', 'morning')).toBe(true);
    expect(isProductScheduledOnDay(product, '2026-10-19', 'morning')).toBe(false);
    expect(isProductScheduledOnDay({ ...product, weekdays: ['mon'] }, '2026-11-02', 'morning')).toBe(true);
  });

  it('rechecks selected-day eligibility for bulk writes and never includes either prescription representation', () => {
    const offDay = { ...legacy, id: 'off-day', weekdays: ['sat' as const] };
    const eligible = { ...legacy, weekdays: ['fri' as const] };
    const prescription = { ...eligible, id: 'prescription', kind: 'prescription' as const };
    const categoryPrescription = { ...eligible, id: 'legacy-prescription', category: 'Prescription' as const };
    const events = setProductRoutineStatus([], prescription.id, 'morning', 'used', '8:00 AM', friday);
    const current = { ...state, products: [eligible, offDay, prescription, categoryPrescription], events };
    const next = setNamedRoutineStatus(current, 'morning', current.products.map((product) => product.id), 'used', '9:00 AM', friday);
    expect(next.events.map((event) => event.productId)).toEqual([prescription.id, eligible.id]);
    expect(toRoutineProducts(next.products, next.events, 'morning', friday).find((product) => product.id === categoryPrescription.id)?.kind).toBe('prescription');
    expect(setNamedRoutineStatus(next, 'morning', current.products.map((product) => product.id), 'due', '9:01 AM', friday).events).toEqual(events);
  });

  it('rejects invalid and foreign-product edits atomically without changing any saved field', () => {
    const before = JSON.stringify(state);
    for (const invalid of [
      { ...change, schedule: [] },
      { ...change, weekdays: [] },
      { ...change, weekdays: ['unknown'] },
      { ...change, schedule: ['noon'] },
      { ...change, productId: 'foreign-product' },
    ]) {
      expect(() => setCareRoutineSchedules(state, [invalid as RoutineScheduleEdit], '2026-10-16')).toThrow();
    }
    expect(() => setCareRoutineSchedules(state, [change, change], '2026-10-16')).toThrow('Reload');
    expect(() => setCareRoutineSchedules(state, [change], '2026-02-30')).toThrow();
    expect(JSON.stringify(state)).toBe(before);
  });
});
