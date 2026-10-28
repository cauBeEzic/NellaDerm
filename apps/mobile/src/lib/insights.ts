import { isProductScheduledOnDay, routineScheduleForDay, type CareProduct, type CareState, type RoutineEvent } from './care';
import { areaLabels, createCheckInDraft, saveCheckInDraft, withDraftUpdate, type CheckInArea, type CheckInComparison, type CheckInEntry } from './check-in';
import { localDayKey } from './today';

export type InsightRange = 7 | 30 | 90;
export type RoutineDayStatus = 'complete' | 'partial' | 'not-recorded';
export type HistoryFilter = 'all' | 'skin' | 'products' | 'photos';
export type HistoryFilters = {
  recordType: HistoryFilter;
  fromDay?: string;
  toDay?: string;
  area?: CheckInArea;
  productId?: string;
};

export type ReviewDay = {
  dayKey: string;
  date: Date;
  entry?: CheckInEntry;
  routine: RoutineDayStatus;
};

export type HistoryItem = {
  id: string;
  dayKey: string;
  recordedAt: string;
  type: 'skin' | 'product' | 'photo';
  title: string;
  detail: string;
  comparison?: CheckInComparison;
  photoId?: string;
  areas: readonly CheckInArea[];
  productId?: string;
};

export function dateFromDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function dayKeyOffset(daysAgo: number, now = new Date()) {
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  return localDayKey(date);
}

export function rangeDayKeys(days: number, now = new Date()) {
  return Array.from({ length: days }, (_, index) => dayKeyOffset(days - index - 1, now));
}

export function entriesInRange(entries: CheckInEntry[], days: InsightRange, now = new Date()) {
  const keys = new Set(rangeDayKeys(days, now));
  return entries.filter((entry) => keys.has(entry.dayKey));
}

export function calendarRecordingCounts(dayKeys: readonly string[], entriesByDay: ReadonlyMap<string, CheckInEntry>) {
  let recorded = 0;
  for (const dayKey of dayKeys) {
    if (entriesByDay.has(dayKey)) recorded += 1;
  }
  return { recorded, notRecorded: dayKeys.length - recorded };
}

export function comparisonCounts(entries: CheckInEntry[]) {
  return entries.reduce((counts, entry) => ({ ...counts, [entry.comparison]: counts[entry.comparison] + 1 }), {
    better: 0,
    same: 0,
    worse: 0,
  } satisfies Record<CheckInComparison, number>);
}

export function routineStatusForDay(state: Pick<CareState, 'products' | 'events'>, dayKey: string): RoutineDayStatus {
  const scheduled = state.products.flatMap((product) => routineScheduleForDay(product, dayKey).schedule
    .filter((period) => period !== 'as-needed' && isProductScheduledOnDay(product, dayKey, period))
    .map((period) => ({ productId: product.id, period })));
  if (!scheduled.length) return 'not-recorded';
  const events = state.events.filter((event) => event.dayKey === dayKey);
  const relevant = scheduled.map(({ productId, period }) => events.find((event) => event.productId === productId && event.period === period));
  const recorded = relevant.filter(Boolean);
  if (!recorded.length) return 'not-recorded';
  return recorded.length === scheduled.length && recorded.every((event) => event?.status === 'used') ? 'complete' : 'partial';
}

export function weeklyReview(entries: CheckInEntry[], careState: Pick<CareState, 'products' | 'events'>, now = new Date()): ReviewDay[] {
  const byDay = new Map(entries.map((entry) => [entry.dayKey, entry]));
  return rangeDayKeys(7, now).map((dayKey) => ({
    dayKey,
    date: dateFromDayKey(dayKey),
    entry: byDay.get(dayKey),
    routine: routineStatusForDay(careState, dayKey),
  }));
}

export function routineStatusCounts(days: ReviewDay[]) {
  return days.reduce((counts, day) => ({ ...counts, [day.routine]: counts[day.routine] + 1 }), {
    complete: 0,
    partial: 0,
    'not-recorded': 0,
  } satisfies Record<RoutineDayStatus, number>);
}

export function buildHistoryItems(entries: CheckInEntry[], events: RoutineEvent[], products: CareProduct[]): HistoryItem[] {
  const names = new Map(products.map((product) => [product.id, product.name]));
  return [
    ...entries.map((entry): HistoryItem => ({
      id: `skin-${entry.dayKey}`,
      dayKey: entry.dayKey,
      recordedAt: entry.savedAt,
      type: 'skin',
      title: entry.comparison === 'same' ? 'Skin felt about the same' : `Skin felt ${entry.comparison}`,
      detail: Object.keys(entry.symptoms).length
        ? `${Object.keys(entry.symptoms).length} symptom${Object.keys(entry.symptoms).length === 1 ? '' : 's'} recorded`
        : 'No symptoms added',
      comparison: entry.comparison,
      areas: entry.areas,
    })),
    ...entries.flatMap((entry): HistoryItem[] => entry.photo ? [{
      id: `photo-${entry.dayKey}`,
      dayKey: entry.dayKey,
      recordedAt: entry.photo.createdAt,
      type: 'photo',
      photoId: entry.photo.id,
      title: 'Private photo record',
      detail: `${areaLabels[entry.photo.area]} · private photo record`,
      areas: [entry.photo.area],
    }] : []),
    ...events.map((event): HistoryItem => ({
      id: `product-${event.id}`,
      dayKey: event.dayKey,
      recordedAt: event.recordedAt,
      type: 'product',
      areas: [],
      productId: event.productId,
      title: `${names.get(event.productId) ?? 'Product'} · ${event.status}`,
      detail: `${event.period === 'as-needed' ? 'As needed' : `${event.period[0].toUpperCase()}${event.period.slice(1)}`} · ${event.displayTime}`,
    })),
  ].sort((left, right) => right.dayKey.localeCompare(left.dayKey) || Date.parse(right.recordedAt) - Date.parse(left.recordedAt));
}

export function historyDateError(fromDay?: string, toDay?: string): string | undefined {
  for (const day of [fromDay, toDay]) {
    if (!day) continue;
    const date = new Date(`${day}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day.slice(0, 4) === '0000' || Number.isNaN(date.getTime())
      || date.getUTCFullYear() !== Number(day.slice(0, 4)) || date.getUTCMonth() + 1 !== Number(day.slice(5, 7)) || date.getUTCDate() !== Number(day.slice(8, 10))) {
      return 'Enter a real date as YYYY-MM-DD, or leave the date blank.';
    }
  }
  if (fromDay && toDay && fromDay > toDay) return 'The end date must be on or after the start date.';
}

export function filterHistoryItems(items: HistoryItem[], filters: HistoryFilters) {
  if (historyDateError(filters.fromDay, filters.toDay)) return [];
  const type = filters.recordType === 'products' ? 'product' : filters.recordType === 'photos' ? 'photo' : 'skin';
  return items.filter((item) =>
    (filters.recordType === 'all' || item.type === type)
    && (!filters.fromDay || item.dayKey >= filters.fromDay)
    && (!filters.toDay || item.dayKey <= filters.toDay)
    && (!filters.area || item.areas.includes(filters.area))
    && (!filters.productId || item.productId === filters.productId));
}

export function historyProductOptions(items: HistoryItem[], products: CareProduct[]) {
  const names = new Map(products.map((product) => [product.id, product.name]));
  for (const item of items) {
    if (item.productId && !names.has(item.productId)) names.set(item.productId, `Product not in cabinet · ${item.productId}`);
  }
  const counts = new Map<string, number>();
  for (const name of names.values()) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...names].map(([id, name]) => ({ id, label: counts.get(name)! > 1 ? `${name} · ${id}` : name }));
}

export function productUseCount(events: RoutineEvent[], productId: string, days: InsightRange, now = new Date()) {
  const keys = new Set(rangeDayKeys(days, now));
  return events.filter((event) => event.productId === productId && event.status === 'used' && keys.has(event.dayKey)).length;
}

export function productUseDayKeys(events: RoutineEvent[], productId: string | 'all', days: number, now = new Date()) {
  const range = new Set(rangeDayKeys(days, now));
  return new Set(events
    .filter((event) => event.status === 'used' && (productId === 'all' || event.productId === productId) && range.has(event.dayKey))
    .map((event) => event.dayKey));
}

export function demoInsightEntries(now = new Date()): CheckInEntry[] {
  const fixtures: { daysAgo: number; comparison: CheckInComparison; symptoms: CheckInEntry['symptoms']; notes: string }[] = [
    { daysAgo: 0, comparison: 'same', symptoms: { dryness: 'mild' }, notes: 'A steady day with some dryness.' },
    { daysAgo: 1, comparison: 'better', symptoms: { itch: 'mild' }, notes: 'Skin felt calmer by the evening.' },
    { daysAgo: 2, comparison: 'same', symptoms: { dryness: 'moderate' }, notes: '' },
    { daysAgo: 3, comparison: 'worse', symptoms: { itch: 'severe', redness: 'moderate' }, notes: 'More itch after a cold afternoon.' },
    { daysAgo: 5, comparison: 'better', symptoms: {}, notes: '' },
    { daysAgo: 6, comparison: 'same', symptoms: { redness: 'mild' }, notes: '' },
  ];
  return fixtures.map((fixture) => {
    const date = dateFromDayKey(dayKeyOffset(fixture.daysAgo, now));
    date.setHours(19, 30, 0, 0);
    const draft = withDraftUpdate(createCheckInDraft(date, fixture.comparison), {
      symptoms: fixture.symptoms,
      notes: fixture.notes,
      routine: fixture.daysAgo === 3 ? 'partially' : 'done',
    }, date);
    return saveCheckInDraft(draft, date);
  }).sort((left, right) => right.dayKey.localeCompare(left.dayKey));
}
