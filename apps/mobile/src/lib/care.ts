import type { ProductPackagingPhoto } from './product-packaging';
import { localDayKey, type RoutineProduct, type RoutineProductStatus } from './today';

export type CareProductKind = 'skincare' | 'prescription';
export type CareProductCategory = 'Cleanser' | 'Moisturizer' | 'Treatment' | 'Prescription' | 'Other';
export type RoutinePeriod = 'morning' | 'evening' | 'as-needed';
export type SupplyLevel = 'plenty' | 'low';
export const routineWeekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type RoutineWeekday = typeof routineWeekdays[number];
export const routineWeekdayLabels: Record<RoutineWeekday, string> = {
  sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday',
};
export const routinePeriods: readonly RoutinePeriod[] = ['morning', 'evening', 'as-needed'];
export type RoutineScheduleSnapshot = {
  // Exclusive upper bound: these rules apply before this local date.
  beforeDay: string;
  schedule: RoutinePeriod[];
  weekdays: RoutineWeekday[];
};
export type RoutineScheduleEdit = {
  productId: string;
  schedule: RoutinePeriod[];
  weekdays: RoutineWeekday[];
};

export type CareProduct = {
  id: string;
  name: string;
  manufacturer?: string;
  category: CareProductCategory;
  kind: CareProductKind;
  schedule: RoutinePeriod[];
  weekdays?: RoutineWeekday[];
  scheduleHistory?: RoutineScheduleSnapshot[];
  startedOn: string;
  supply: SupplyLevel;
  area: string;
  barcode?: string;
  directions?: string;
  personalInstructions?: string;
  packagingPhoto?: ProductPackagingPhoto;
  verified: boolean;
};

export type ReminderKey = 'checkIn' | 'morning' | 'evening' | 'prescription' | 'weeklyReview' | 'productSupply';

export type CareReminders = Record<ReminderKey, boolean> & {
  quietHours: boolean;
  quietHoursLabel: string;
};

export type RoutineEvent = {
  id: string;
  productId: string;
  period: RoutinePeriod;
  status: Extract<RoutineProductStatus, 'used' | 'skipped'>;
  dayKey: string;
  recordedAt: string;
  displayTime: string;
};

export type CareState = {
  products: CareProduct[];
  reminders: CareReminders;
  events: RoutineEvent[];
};

export const defaultReminders: CareReminders = {
  checkIn: true,
  morning: true,
  evening: true,
  prescription: true,
  weeklyReview: true,
  productSupply: true,
  quietHours: true,
  quietHoursLabel: '10:00 PM–7:00 AM',
};

// Synthetic demo mapping, not a manufacturer identifier; checksum must be valid for native EAN-13 detection.
export const SAMPLE_CARE_BARCODE = '2000000000015';

export const demoCareProducts: CareProduct[] = [
  {
    id: 'nella-calm',
    name: 'NellaCalm',
    manufacturer: 'NellaDerm',
    category: 'Treatment',
    kind: 'skincare',
    schedule: ['morning', 'evening'],
    startedOn: 'Sep 20 · 3 weeks',
    supply: 'low',
    area: 'Face and neck',
    verified: true,
    directions: 'Use the directions shown on the product label.',
  },
  {
    id: 'cerave-moisturizing-cream',
    name: 'CeraVe Moisturizing Cream',
    manufacturer: 'CeraVe',
    category: 'Moisturizer',
    kind: 'skincare',
    schedule: ['morning'],
    startedOn: 'Aug 14 · 8 weeks',
    supply: 'plenty',
    area: 'Hands, inner elbows',
    barcode: SAMPLE_CARE_BARCODE,
    verified: true,
    directions: 'Apply liberally as often as needed, or as directed by a physician. Suitable for use on face and body.',
  },
];

export const emptyCareState: CareState = { products: [], reminders: defaultReminders, events: [] };

function dayKeyOffset(daysAgo: number, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  return localDayKey(date);
}

export function demoEvents(now = new Date()): RoutineEvent[] {
  return [0, 1, 2, 3, 4, 6].flatMap((daysAgo) => {
    const dayKey = dayKeyOffset(daysAgo, now);
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    return demoCareProducts.flatMap((product) => product.schedule
      .filter((period) => period !== 'as-needed')
      .filter((period) => daysAgo > 0 || minutesNow >= (period === 'morning' ? 8 * 60 + 15 : 21 * 60))
      .map((period) => ({
      id: `demo-${product.id}-${period}-${dayKey}`,
      productId: product.id,
      period,
      status: 'used' as const,
      dayKey,
      recordedAt: `${dayKey}T${period === 'morning' ? '08:15' : '21:00'}:00.000Z`,
      displayTime: period === 'morning' ? '8:15 AM' : '9:00 PM',
      })));
  });
}

export function createDemoCareState(now = new Date()): CareState {
  return { products: demoCareProducts, reminders: defaultReminders, events: demoEvents(now) };
}

export function findCareProductByBarcode(barcode?: string) {
  const normalized = barcode?.trim();
  if (!normalized) return undefined;
  return demoCareProducts.find((product) => product.barcode === normalized);
}

export function productId(name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `product-${Date.now()}`;
}

export function manualProductId(name: string, uniqueSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`) {
  return `manual-${productId(name)}-${uniqueSuffix}`;
}

export function routineLabel(schedule: readonly RoutinePeriod[]) {
  const labels = { morning: 'Morning', evening: 'Evening', 'as-needed': 'As needed' };
  return routinePeriods.filter((period) => schedule.includes(period)).map((period) => labels[period]).join(' + ') || 'Not scheduled';
}

export function routineDaysLabel(weekdays: readonly RoutineWeekday[] = routineWeekdays) {
  return weekdays.length === 7 ? 'Every day' : routineWeekdays.filter((day) => weekdays.includes(day)).map((day) => routineWeekdayLabels[day].slice(0, 3)).join(', ') || 'No days selected';
}

export function routineScheduleForDay(product: CareProduct, dayKey: string): { schedule: readonly RoutinePeriod[]; weekdays: readonly RoutineWeekday[] } {
  const historical = product.scheduleHistory?.find((snapshot) => dayKey < snapshot.beforeDay);
  return historical ?? { schedule: product.schedule, weekdays: product.weekdays ?? routineWeekdays };
}

export function isProductScheduledOnDay(product: CareProduct, dayKey: string, period: RoutinePeriod, includeAsNeeded = false) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(product.startedOn) && product.startedOn > dayKey) return false;
  const [year, month, day] = dayKey.split('-').map(Number);
  const weekday = routineWeekdays[new Date(year, month - 1, day, 12).getDay()];
  const rules = routineScheduleForDay(product, dayKey);
  return rules.weekdays.includes(weekday) && (rules.schedule.includes(period) || (includeAsNeeded && rules.schedule.includes('as-needed')));
}

function validLocalDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  return localDayKey(new Date(year, month - 1, day, 12)) === value;
}

function validateSchedule(schedule: readonly RoutinePeriod[], weekdays: readonly RoutineWeekday[], allowEmptyPeriod = false) {
  if (!Array.isArray(schedule) || (!allowEmptyPeriod && !schedule.length) || schedule.some((period) => !routinePeriods.includes(period))) {
    throw new Error('Choose at least one valid time period for each changed product.');
  }
  if (!Array.isArray(weekdays) || !weekdays.length || weekdays.some((day) => !routineWeekdays.includes(day))) {
    throw new Error('Choose at least one day for each changed product.');
  }
}

export function validateStoredRoutineSchedule(product: CareProduct) {
  if (product.weekdays !== undefined) validateSchedule(product.schedule, product.weekdays, true);
  if (product.scheduleHistory === undefined) return;
  if (!Array.isArray(product.scheduleHistory)) throw new Error('Invalid routine schedule history.');
  let previousDay = '';
  for (const snapshot of product.scheduleHistory) {
    if (!snapshot || typeof snapshot.beforeDay !== 'string' || !validLocalDay(snapshot.beforeDay) || snapshot.beforeDay <= previousDay) {
      throw new Error('Invalid routine schedule history dates.');
    }
    validateSchedule(snapshot.schedule, snapshot.weekdays, true);
    previousDay = snapshot.beforeDay;
  }
}

export function setCareRoutineSchedules(state: CareState, edits: readonly RoutineScheduleEdit[], dayKey: string): CareState {
  if (!validLocalDay(dayKey)) throw new Error('Reload Care to use the current local date.');
  const changes = new Map<string, RoutineScheduleEdit>();
  for (const edit of edits) {
    if (changes.has(edit.productId) || !state.products.some((product) => product.id === edit.productId)) throw new Error('A product is no longer available. Reload Care.');
    validateSchedule(edit.schedule, edit.weekdays);
    changes.set(edit.productId, edit);
  }
  let changed = false;
  const products = state.products.map((product) => {
    const edit = changes.get(product.id);
    if (!edit) return product;
    const schedule = routinePeriods.filter((period) => edit.schedule.includes(period));
    const weekdays = routineWeekdays.filter((day) => edit.weekdays.includes(day));
    const oldDays = product.weekdays ?? routineWeekdays;
    if (schedule.length === product.schedule.length && schedule.every((period) => product.schedule.includes(period))
      && weekdays.length === oldDays.length && weekdays.every((day) => oldDays.includes(day))) return product;
    const history = product.scheduleHistory ?? [];
    const lastBoundary = history.at(-1)?.beforeDay;
    if (lastBoundary && lastBoundary > dayKey) throw new Error('The local date precedes your last schedule change. Check the device date and reload.');
    changed = true;
    return {
      ...product,
      schedule,
      weekdays,
      scheduleHistory: lastBoundary === dayKey ? history : [...history, { beforeDay: dayKey, schedule: [...product.schedule], weekdays: [...oldDays] }],
    };
  });
  return changed ? { ...state, products } : state;
}

export function setCareProductSupply(state: CareState, productIdValue: string, supply: SupplyLevel): CareState {
  if (!state.products.some((product) => product.id === productIdValue)) throw new Error('Product unavailable.');
  return { ...state, products: state.products.map((product) => product.id === productIdValue ? { ...product, supply } : product) };
}

export function normalizeCareStartDate(value: string, today = new Date()) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'today') return localDayKey(today);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return undefined;
  const candidate = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (localDayKey(candidate) !== trimmed) return undefined;
  return trimmed <= localDayKey(today) ? trimmed : undefined;
}

export function formatCareStartDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function activeRoutinePeriod(date = new Date()): Extract<RoutinePeriod, 'morning' | 'evening'> {
  return date.getHours() < 15 ? 'morning' : 'evening';
}

export function isBulkRoutineProduct(product: CareProduct, dayKey: string) {
  return product.kind === 'skincare' && product.category !== 'Prescription'
    && (!/^\d{4}-\d{2}-\d{2}$/.test(product.startedOn) || product.startedOn <= dayKey);
}

export function toRoutineProducts(products: CareProduct[], events: RoutineEvent[] = [], period: RoutinePeriod = activeRoutinePeriod(), date = new Date()): RoutineProduct[] {
  const dayKey = localDayKey(date);
  return products.filter((product) => isProductScheduledOnDay(product, dayKey, period, true)).map((product) => {
    const event = [...events].reverse().find((item) => item.productId === product.id && item.period === period && item.dayKey === dayKey);
    return {
    id: product.id,
    name: product.name,
    area: product.kind === 'prescription' || product.category === 'Prescription'
      ? `${product.area} · follow your pharmacy label`
      : product.area,
    kind: product.category === 'Prescription' ? 'prescription' : product.kind,
    status: event?.status ?? 'due',
    usedAt: event?.status === 'used' ? event.displayTime : undefined,
  };
  });
}

export function initialCareProduct(name: string): CareProduct {
  return {
    id: manualProductId(name),
    name,
    category: 'Other',
    kind: 'skincare',
    schedule: ['morning', 'evening'],
    startedOn: 'Added during setup',
    supply: 'plenty',
    area: 'Choose an area when logging use',
    verified: false,
  };
}

export function setProductRoutineStatus(
  events: RoutineEvent[],
  productIdValue: string,
  period: RoutinePeriod,
  status: Extract<RoutineProductStatus, 'used' | 'skipped'> | 'due',
  displayTime: string,
  now = new Date(),
) {
  const dayKey = localDayKey(now);
  const remaining = events.filter((event) => !(event.productId === productIdValue && event.period === period && event.dayKey === dayKey));
  if (status === 'due') return remaining;
  return [...remaining, {
    id: `${productIdValue}-${period}-${dayKey}`,
    productId: productIdValue,
    period,
    status,
    dayKey,
    recordedAt: now.toISOString(),
    displayTime,
  }];
}

export function setNamedRoutineStatus(
  state: CareState,
  period: Extract<RoutinePeriod, 'morning' | 'evening'>,
  productIds: readonly string[],
  status: 'used' | 'due',
  displayTime: string,
  now = new Date(),
): CareState {
  const dayKey = localDayKey(now);
  const requested = new Set(productIds);
  let events = state.events;
  for (const product of state.products) {
    if (requested.has(product.id) && isProductScheduledOnDay(product, dayKey, period) && isBulkRoutineProduct(product, dayKey)) {
      events = setProductRoutineStatus(events, product.id, period, status, displayTime, now);
    }
  }
  return events === state.events ? state : { ...state, events };
}

export function isRoutinePeriodComplete(state: CareState, period: RoutinePeriod, date = new Date()) {
  const dayKey = localDayKey(date);
  const scheduled = state.products.filter((product) => isProductScheduledOnDay(product, dayKey, period));
  if (!scheduled.length) return false;
  const statuses = toRoutineProducts(scheduled, state.events, period, date);
  return statuses.every((product) => product.status === 'used');
}

function routineDayComplete(state: Pick<CareState, 'products' | 'events'>, dayKey: string) {
  const scheduled = state.products.flatMap((product) => routineScheduleForDay(product, dayKey).schedule
    .filter((period) => period !== 'as-needed' && isProductScheduledOnDay(product, dayKey, period))
    .map((period) => ({ productId: product.id, period })));
  if (!scheduled.length) return false;
  return scheduled.every(({ productId: scheduledProductId, period }) => state.events.some((event) => (
    event.productId === scheduledProductId
    && event.period === period
    && event.dayKey === dayKey
    && event.status === 'used'
  )));
}

export function routineConsistency(state: Pick<CareState, 'products' | 'events'>, date = new Date()) {
  const completedDays = Array.from({ length: 7 }, (_, index) => dayKeyOffset(index, date))
    .filter((dayKey) => routineDayComplete(state, dayKey)).length;
  return { completedDays, totalDays: 7, percent: Math.round((completedDays / 7) * 100) };
}

export function routineHistory(state: Pick<CareState, 'products' | 'events'>, date = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const daysAgo = 6 - index;
    const itemDate = new Date(date);
    itemDate.setDate(itemDate.getDate() - daysAgo);
    const dayKey = localDayKey(itemDate);
    return {
      dayKey,
      label: new Intl.DateTimeFormat('en-CA', { weekday: 'narrow' }).format(itemDate),
      completed: routineDayComplete(state, dayKey),
    };
  });
}

export function findExistingCareProduct(products: CareProduct[], product: CareProduct) {
  const barcode = product.barcode?.trim();
  return products.find((item) => item.id === product.id || Boolean(barcode && item.barcode?.trim() === barcode));
}

// Adds are insert-only, including when a duplicate reaches the serialized write queue.
export function insertCareProduct(products: CareProduct[], product: CareProduct) {
  return findExistingCareProduct(products, product) ? products : [...products, product];
}

export function setCareProductPackagingPhoto(state: CareState, productId: string, expectedPhotoId: string | undefined, photo: ProductPackagingPhoto | undefined): CareState {
  const product = state.products.find((item) => item.id === productId);
  if (!product) throw new Error('The product is unavailable. Reload Care.');
  if (product.packagingPhoto?.id !== expectedPhotoId) throw new Error('The packaging photo changed. Reload the product before editing it.');
  if (product.packagingPhoto === photo) return state;
  return { ...state, products: state.products.map((item) => item.id === productId ? { ...item, packagingPhoto: photo } : item) };
}
