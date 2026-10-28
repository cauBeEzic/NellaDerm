import { describe, expect, it } from 'vitest';

import {
  demoCareProducts,
  demoEvents,
  emptyCareState,
  findCareProductByBarcode,
  findExistingCareProduct,
  insertCareProduct,
  isRoutinePeriodComplete,
  manualProductId,
  normalizeCareStartDate,
  routineConsistency,
  SAMPLE_CARE_BARCODE,
  setNamedRoutineStatus,
  setProductRoutineStatus,
  toRoutineProducts,
  setCareProductSupply,
} from './care';

describe('care products', () => {
  it('keeps separate manual entries for products with the same name', () => {
    expect(manualProductId('Moisturizing Cream', 'entry-a')).not.toBe(manualProductId('Moisturizing Cream', 'entry-b'));
  });

  it('stores stable start dates and rejects ambiguous input', () => {
    const today = new Date(2026, 9, 8, 12);
    expect(normalizeCareStartDate('Today', today)).toBe('2026-10-08');
    expect(normalizeCareStartDate('2026-02-30', today)).toBeUndefined();
    expect(normalizeCareStartDate('next week', today)).toBeUndefined();
    expect(normalizeCareStartDate('2026-10-09', today)).toBeUndefined();
  });

  it('does not make a new product retroactively incomplete or due before its start date', () => {
    const now = new Date(2026, 9, 8, 9);
    const established = { ...demoCareProducts[1], startedOn: '2026-10-01' };
    const newProduct = { ...demoCareProducts[0], id: 'new-today', startedOn: '2026-10-08', schedule: ['morning' as const] };
    const yesterday = new Date(2026, 9, 7, 9);
    const events = setProductRoutineStatus([], established.id, 'morning', 'used', '9:00 AM', yesterday);
    expect(routineConsistency({ products: [established, newProduct], events }, now).completedDays).toBe(1);

    const future = { ...newProduct, id: 'future', startedOn: '2026-10-09' };
    expect(toRoutineProducts([future], [], 'morning', now)).toHaveLength(0);
    expect(isRoutinePeriodComplete({ ...emptyCareState, products: [future] }, 'morning', now)).toBe(false);
  });

  it('offers a decodable EAN-13 demo sample and no match for unknown or URL payloads', () => {
    expect(SAMPLE_CARE_BARCODE).toMatch(/^\d{13}$/);
    const digits = [...SAMPLE_CARE_BARCODE].map(Number);
    const weightedSum = digits.slice(0, 12).reduce((sum, digit, index) => sum + digit * (index % 2 ? 3 : 1), 0);
    expect(digits[12]).toBe((10 - weightedSum % 10) % 10);
    expect(findCareProductByBarcode(` ${SAMPLE_CARE_BARCODE} `)?.id).toBe('cerave-moisturizing-cream');
    expect(findCareProductByBarcode('2000000000022')).toBeUndefined();
    expect(findCareProductByBarcode('')).toBeUndefined();
    expect(findCareProductByBarcode(`https://example.invalid/${SAMPLE_CARE_BARCODE}`)).toBeUndefined();
  });

  it('never fabricates a future routine event for the current demo day', () => {
    const afternoon = new Date(2026, 9, 8, 16, 39);
    const today = '2026-10-08';
    const todayEvents = demoEvents(afternoon).filter((event) => event.dayKey === today);
    expect(todayEvents.length).toBeGreaterThan(0);
    expect(todayEvents.every((event) => event.period === 'morning')).toBe(true);

    const lateEvening = new Date(2026, 9, 8, 21, 1);
    expect(demoEvents(lateEvening).some((event) => event.dayKey === today && event.period === 'evening')).toBe(true);
  });

  it('maps the care cabinet into Today routine entries', () => {
    const routine = toRoutineProducts(demoCareProducts, [], 'morning', new Date(2026, 9, 8, 8));
    expect(routine).toHaveLength(2);
    expect(routine[0]).toMatchObject({ id: 'nella-calm', status: 'due', kind: 'skincare' });
  });

  it('uses one event source for Care completion and Today product state', () => {
    const now = new Date(2026, 9, 8, 8, 15);
    let events = setProductRoutineStatus([], demoCareProducts[0].id, 'morning', 'used', '8:15 AM', now);
    const firstRoutine = toRoutineProducts(demoCareProducts, events, 'morning', now);
    expect(firstRoutine[0]).toMatchObject({ status: 'used', usedAt: '8:15 AM' });
    expect(isRoutinePeriodComplete({ products: demoCareProducts, reminders: emptyCareState.reminders, events }, 'morning', now)).toBe(false);

    events = setProductRoutineStatus(events, demoCareProducts[1].id, 'morning', 'used', '8:16 AM', now);
    expect(isRoutinePeriodComplete({ products: demoCareProducts, reminders: emptyCareState.reminders, events }, 'morning', now)).toBe(true);

    events = setProductRoutineStatus(events, demoCareProducts[0].id, 'morning', 'due', '8:17 AM', now);
    expect(toRoutineProducts(demoCareProducts, events, 'morning', now)[0].status).toBe('due');
  });

  it('calculates seven-day consistency from recorded use events', () => {
    const now = new Date(2026, 9, 8, 8, 15);
    const products = [demoCareProducts[1]];
    const events = [0, 1, 2].flatMap((daysAgo) => {
      const day = new Date(now);
      day.setDate(day.getDate() - daysAgo);
      return setProductRoutineStatus([], products[0].id, 'morning', 'used', '8:15 AM', day);
    });
    expect(routineConsistency({ products, events }, now)).toEqual({ completedDays: 3, totalDays: 7, percent: 43 });
  });

  it('preserves every saved field when a catalogue product is added again', () => {
    const sample = findCareProductByBarcode(SAMPLE_CARE_BARCODE)!;
    const saved = { ...sample, schedule: ['evening' as const], supply: 'low' as const, startedOn: '2026-01-12', personalInstructions: 'Synthetic personal instruction' };
    const cabinet = [saved, demoCareProducts[0]];
    const rescanned = { ...sample, schedule: ['morning' as const], startedOn: '2026-10-16' };

    expect(findExistingCareProduct(cabinet, rescanned)).toEqual(saved);
    expect(insertCareProduct(cabinet, rescanned)).toEqual([saved, demoCareProducts[0]]);
    // Repeated/queued adds must remain insert-only.
    expect(insertCareProduct(insertCareProduct(cabinet, rescanned), rescanned)).toEqual(cabinet);
  });

  it('recognizes a saved barcode under a different record id without merging names or empty barcodes', () => {
    const sample = findCareProductByBarcode(SAMPLE_CARE_BARCODE)!;
    const saved = { ...sample, id: 'manual-synthetic', barcode: ` ${SAMPLE_CARE_BARCODE} `, personalInstructions: 'Keep my original label' };
    expect(findExistingCareProduct([saved], sample)?.id).toBe(saved.id);
    expect(insertCareProduct([saved], sample)).toEqual([saved]);
    const manual = { ...sample, id: 'manual-other', barcode: undefined };
    const separate = { ...manual, id: 'manual-separate', barcode: '' };
    expect(insertCareProduct([manual], separate)).toEqual([manual, separate]);
    expect(insertCareProduct([], sample)).toEqual([sample]);
  });

  it('changes only supply without replacing a newer saved schedule', () => {
    const saved = { ...demoCareProducts[0], schedule: ['evening' as const], weekdays: ['mon' as const], personalInstructions: 'Synthetic note' };
    const state = { ...emptyCareState, products: [saved, demoCareProducts[1]] };
    const updated = setCareProductSupply(state, saved.id, 'plenty');
    expect(updated.products).toEqual([{ ...saved, supply: 'plenty' }, demoCareProducts[1]]);
    expect(updated.events).toEqual(state.events);
  });
});

describe('named routine logs', () => {
  const now = new Date(2026, 9, 8, 8, 15);
  const first = { ...demoCareProducts[1], id: 'first', startedOn: '2026-10-01' };
  const second = { ...first, id: 'second' };
  const prescription = { ...first, id: 'prescription', kind: 'prescription' as const, category: 'Prescription' as const };

  it('records only confirmed products and never rewrites prescription or unconfirmed logs', () => {
    const categoryOnlyPrescription = { ...first, id: 'legacy-prescription', category: 'Prescription' as const };
    const events = [
      ...setProductRoutineStatus([], second.id, 'morning', 'skipped', '8:00 AM', now),
      ...setProductRoutineStatus([], prescription.id, 'morning', 'used', '8:01 AM', now),
    ];
    const state = { ...emptyCareState, products: [first, second, prescription, categoryOnlyPrescription], events };
    const next = setNamedRoutineStatus(state, 'morning', [first.id, first.id, prescription.id, categoryOnlyPrescription.id, 'foreign'], 'used', '8:15 AM', now);

    expect(next.events.slice(0, events.length)).toEqual(events);
    expect(next.events.slice(events.length).map(({ productId, period, status, dayKey }) => ({ productId, period, status, dayKey })))
      .toEqual([{ productId: first.id, period: 'morning', status: 'used', dayKey: '2026-10-08' }]);
  });

  it('does not log products that are not due in the confirmed scheduled period', () => {
    const evening = { ...first, id: 'evening', schedule: ['evening' as const] };
    const asNeeded = { ...first, id: 'as-needed', schedule: ['as-needed' as const] };
    const future = { ...first, id: 'future', startedOn: '2026-10-09' };
    const state = { ...emptyCareState, products: [evening, asNeeded, future] };
    const next = setNamedRoutineStatus(state, 'morning', [evening.id, asNeeded.id, future.id], 'used', '8:15 AM', now);

    expect(next).toEqual(state);
  });

  it('undoes only the named current-period logs, preserving prescriptions, other products and history', () => {
    const yesterday = new Date(2026, 9, 7, 8, 15);
    const prescriptionEvent = setProductRoutineStatus([], prescription.id, 'morning', 'used', '8:00 AM', now)[0];
    const currentEvent = setProductRoutineStatus([], first.id, 'morning', 'used', '8:01 AM', now)[0];
    const eveningEvent = setProductRoutineStatus([], first.id, 'evening', 'used', '8:02 PM', now)[0];
    const historicalEvent = setProductRoutineStatus([], first.id, 'morning', 'used', '8:00 AM', yesterday)[0];
    const otherEvent = setProductRoutineStatus([], second.id, 'morning', 'skipped', '8:02 AM', now)[0];
    const state = { ...emptyCareState, products: [first, second, prescription], events: [prescriptionEvent, currentEvent, eveningEvent, historicalEvent, otherEvent] };

    const next = setNamedRoutineStatus(state, 'morning', [first.id, prescription.id], 'due', '8:15 AM', now);

    expect(next.events).toEqual([prescriptionEvent, eveningEvent, historicalEvent, otherEvent]);
  });

  it('keeps an explicit Used intent instead of toggling it after another completion', () => {
    const state = { ...emptyCareState, products: [first] };
    const completed = setNamedRoutineStatus(state, 'morning', [first.id], 'used', '8:15 AM', now);
    const repeated = setNamedRoutineStatus(completed, 'morning', [first.id], 'used', '8:16 AM', now);

    expect(toRoutineProducts(repeated.products, repeated.events, 'morning', now)).toMatchObject([{ id: first.id, status: 'used' }]);
    expect(repeated.events.map((event) => event.id)).toEqual(['first-morning-2026-10-08']);
  });
});
