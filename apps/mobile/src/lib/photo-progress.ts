import type { CareProduct, RoutineEvent, RoutinePeriod } from './care';
import { parseCheckInHistory, type CheckInArea, type CheckInEntry, type CheckInPhoto } from './check-in';

export type PhotoRecord = { dayKey: string; photo: CheckInPhoto };
export type PhotoPair = { earlier: PhotoRecord; later: PhotoRecord };
export type PhotoAvailability = (photo: CheckInPhoto) => boolean;
export type PhotoPeriodSummary = {
  elapsedDays: number;
  calendarDays: number;
  skinRecordedDays: number;
  skinNotRecordedDays: number;
  productUseDays: number;
  products: {
    productId: string;
    name: string;
    days: number;
    useCount: number;
    periods: RoutinePeriod[];
  }[];
};

const millisecondsPerDay = 86_400_000;
const periods: RoutinePeriod[] = ['morning', 'evening', 'as-needed'];

// Compare calendar dates, not local timestamps: DST days can contain 23 or 25 hours.
// Round-trip validation also rejects dates JS would otherwise silently normalize.
export function calendarDayNumber(dayKey: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return undefined;
  const [year, month, day] = dayKey.split('-').map(Number);
  if (year < 1) return undefined;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return date.getTime() / millisecondsPerDay;
}

/** Pass only the active owner's loaded history. This does not establish ownership. */
export function photoRecords(entries: CheckInEntry[], available: PhotoAvailability = () => true): PhotoRecord[] {
  const candidates = parseCheckInHistory(entries)
    .filter((entry) => entry.photo && calendarDayNumber(entry.dayKey) !== undefined)
    .map((entry): PhotoRecord => ({ dayKey: entry.dayKey, photo: entry.photo! }));
  const occurrences = new Map<string, number>();
  for (const record of candidates) occurrences.set(record.photo.id, (occurrences.get(record.photo.id) ?? 0) + 1);
  return candidates.filter((record) => {
    // A file referenced on multiple dates cannot be represented as two observations.
    if (occurrences.get(record.photo.id) !== 1) return false;
    try { return available(record.photo); } catch { return false; }
  }).sort((left, right) => left.dayKey.localeCompare(right.dayKey) || left.photo.id.localeCompare(right.photo.id));
}

/** A route can name a record, never a URI or an alternative owner. */
export function findPhotoRecord(records: PhotoRecord[], id: unknown): PhotoRecord | undefined {
  if (typeof id !== 'string') return undefined;
  const matches = records.filter((record) => record.photo.id === id);
  return matches.length === 1 ? matches[0] : undefined;
}

export function resolvePhotoPair(records: PhotoRecord[], earlierId: unknown, laterId: unknown): PhotoPair | undefined {
  const earlier = findPhotoRecord(records, earlierId);
  const later = findPhotoRecord(records, laterId);
  if (!earlier || !later || earlier.photo.id === later.photo.id || earlier.photo.area !== later.photo.area) return undefined;
  const start = calendarDayNumber(earlier.dayKey);
  const end = calendarDayNumber(later.dayKey);
  return start !== undefined && end !== undefined && start < end ? { earlier, later } : undefined;
}

export function defaultPhotoPair(records: PhotoRecord[], area: CheckInArea): PhotoPair | undefined {
  const matching = records.filter((record) => record.photo.area === area)
    .sort((left, right) => left.dayKey.localeCompare(right.dayKey));
  return resolvePhotoPair(matching, matching[0]?.photo.id, matching.at(-1)?.photo.id);
}

export function comparablePhotoAreas(records: PhotoRecord[]): CheckInArea[] {
  const areas: CheckInArea[] = ['hands', 'inner-elbows', 'neck', 'face', 'other'];
  return areas.filter((area) => defaultPhotoPair(records, area));
}

/** Original calendar dates and the latest correction per product/day/period. */
export function recordedRoutineEventsInPeriod(events: RoutineEvent[], fromDay: string, toDay: string): RoutineEvent[] {
  const start = calendarDayNumber(fromDay);
  const end = calendarDayNumber(toDay);
  if (start === undefined || end === undefined || start > end) return [];
  const slots = new Map<string, RoutineEvent>();
  for (const event of events) {
    const day = event && typeof event.dayKey === 'string' ? calendarDayNumber(event.dayKey) : undefined;
    if (!event || typeof event.productId !== 'string' || !event.productId.trim()
      || day === undefined || day < start || day > end
      || !periods.includes(event.period) || !['used', 'skipped'].includes(event.status)
      || typeof event.recordedAt !== 'string' || Number.isNaN(Date.parse(event.recordedAt))) continue;
    const key = JSON.stringify([event.productId, event.dayKey, event.period]);
    const previous = slots.get(key);
    if (!previous || Date.parse(event.recordedAt) >= Date.parse(previous.recordedAt)) slots.set(key, event);
  }
  return [...slots.values()];
}

/** Profile-wide logs in the inclusive interval; not adherence or a causal assessment. */
export function photoPeriodSummary(
  pair: PhotoPair,
  entries: CheckInEntry[],
  events: RoutineEvent[],
  products: CareProduct[],
): PhotoPeriodSummary | undefined {
  if (!resolvePhotoPair([pair.earlier, pair.later], pair.earlier.photo.id, pair.later.photo.id)) return undefined;
  const start = calendarDayNumber(pair.earlier.dayKey)!;
  const end = calendarDayNumber(pair.later.dayKey)!;
  const inRange = (dayKey: string) => {
    const day = calendarDayNumber(dayKey);
    return day !== undefined && day >= start && day <= end;
  };
  const skinDays = new Set(parseCheckInHistory(entries).filter((entry) => inRange(entry.dayKey)).map((entry) => entry.dayKey));
  const used = recordedRoutineEventsInPeriod(events, pair.earlier.dayKey, pair.later.dayKey).filter((event) => event.status === 'used');
  const names = new Map(products.filter((product) => product && typeof product.id === 'string')
    .map((product) => [product.id, typeof product.name === 'string' ? product.name.trim() : '']));
  const productIds = [...new Set(used.map((event) => event.productId))];
  const calendarDays = end - start + 1;
  return {
    elapsedDays: end - start,
    calendarDays,
    skinRecordedDays: skinDays.size,
    skinNotRecordedDays: calendarDays - skinDays.size,
    productUseDays: new Set(used.map((event) => event.dayKey)).size,
    products: productIds.map((productId) => {
      const productEvents = used.filter((event) => event.productId === productId);
      return {
        productId,
        name: names.get(productId) || 'Previously tracked product',
        days: new Set(productEvents.map((event) => event.dayKey)).size,
        useCount: productEvents.length,
        periods: periods.filter((period) => productEvents.some((event) => event.period === period)),
      };
    }).sort((left, right) => left.name.localeCompare(right.name) || left.productId.localeCompare(right.productId)),
  };
}
