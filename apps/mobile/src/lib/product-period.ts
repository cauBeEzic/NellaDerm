import type { CareProduct, RoutineEvent } from './care';
import { parseCheckInHistory, type CheckInEntry } from './check-in';
import { calendarDayNumber, photoRecords, recordedRoutineEventsInPeriod, type PhotoAvailability } from './photo-progress';

export type TrackingInterval = { fromDay: string; toDay: string; calendarDays: number };

export function productTrackingInterval(product: CareProduct, toDay: string): TrackingInterval | undefined {
  const start = calendarDayNumber(product.startedOn);
  const end = calendarDayNumber(toDay);
  if (start === undefined || end === undefined || start > end) return undefined;
  return { fromDay: product.startedOn, toDay, calendarDays: end - start + 1 };
}

/** Available recorded evidence only; pass the current owner's loaded sources. */
export function productPeriodSummary(product: CareProduct, toDay: string, entries: CheckInEntry[], events: RoutineEvent[], products: CareProduct[], available: PhotoAvailability) {
  const interval = productTrackingInterval(product, toDay);
  if (!interval) return undefined;
  const inRange = (day: string) => calendarDayNumber(day) !== undefined && day >= interval.fromDay && day <= interval.toDay;
  const checkIns = parseCheckInHistory(entries).filter((entry) => inRange(entry.dayKey));
  const records = recordedRoutineEventsInPeriod(events, interval.fromDay, interval.toDay);
  const productRecords = records.filter((event) => event.productId === product.id);
  const used = productRecords.filter((event) => event.status === 'used');
  const usedDays = new Set(used.map((event) => event.dayKey));
  const recordedDays = new Set(productRecords.map((event) => event.dayKey)).size;
  const otherUses = records.filter((event) => event.productId !== product.id && event.status === 'used');
  const names = new Map(products.map((item) => [item.id, item.name]));
  const photoRecordCount = checkIns.filter((entry) => entry.photo).length;
  const availablePhotos = photoRecords(entries, available).filter((record) => inRange(record.dayKey)).length;
  return {
    interval,
    usedEvents: used.length,
    usedDays: usedDays.size,
    skippedEvents: productRecords.filter((event) => event.status === 'skipped').length,
    recordedDays,
    daysWithoutProductRecord: interval.calendarDays - recordedDays,
    checkInDays: checkIns.length,
    daysWithoutCheckIn: interval.calendarDays - checkIns.length,
    availablePhotos,
    unavailablePhotos: photoRecordCount - availablePhotos,
    otherProducts: [...new Set(otherUses.map((event) => event.productId))].map((id) => ({ id, name: names.get(id) ?? 'Product not in cabinet' })),
    overlappingUseDays: new Set(otherUses.filter((event) => usedDays.has(event.dayKey)).map((event) => event.dayKey)).size,
  };
}

export type ProductPeriodParams = {
  periodProduct?: string | string[];
  periodFrom?: string | string[];
  periodTo?: string | string[];
  periodType?: string | string[];
  periodScope?: string | string[];
};
export type ProductPeriodView = {
  product: CareProduct;
  interval: TrackingInterval;
  recordType: 'skin' | 'photos';
  readScope: string;
};
type PeriodResolution = { kind: 'none' } | { kind: 'unavailable' } | ({ kind: 'valid' } & ProductPeriodView);

/** Malformed/stale period links must never fall back to an unscoped ledger. */
export function resolveProductPeriod(params: ProductPeriodParams, readScope: string | undefined, products: CareProduct[], today: string): PeriodResolution {
  const keys = ['periodProduct', 'periodFrom', 'periodTo', 'periodType', 'periodScope'] as const;
  if (keys.every((key) => params[key] === undefined)) return { kind: 'none' };
  if (!keys.every((key) => typeof params[key] === 'string' && params[key]!.length > 0)
    || !readScope || params.periodScope !== readScope
    || (params.periodType !== 'skin' && params.periodType !== 'photos')
    || calendarDayNumber(today) === undefined || typeof params.periodTo !== 'string' || params.periodTo > today) return { kind: 'unavailable' };
  const product = products.find((item) => item.id === params.periodProduct);
  const interval = product && productTrackingInterval(product, params.periodTo);
  if (!product || !interval || interval.fromDay !== params.periodFrom) return { kind: 'unavailable' };
  return { kind: 'valid', product, interval, recordType: params.periodType, readScope };
}
