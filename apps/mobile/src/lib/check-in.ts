import { localDayKey } from './today';

export type CheckInComparison = 'better' | 'same' | 'worse';
export type CheckInSymptom = 'itch' | 'dryness' | 'redness' | 'pain' | 'sleep' | 'other';
export type SymptomSeverity = 'mild' | 'moderate' | 'severe';
export type CheckInArea = 'hands' | 'inner-elbows' | 'neck' | 'face' | 'other';
export type CheckInFactor = 'stress' | 'weather' | 'new-product' | 'routine-change' | 'illness' | 'other';
export type RoutineFollowThrough = 'done' | 'partially' | 'skipped';

export type CheckInPhoto = {
  id: string;
  localUri: string;
  area: CheckInArea;
  note: string;
  mimeType: 'image/jpeg';
  size: number;
  width: number;
  height: number;
  sha256: string;
  createdAt: string;
  storage: 'app-private-cache';
  syncStatus: 'local-only';
};

export type CheckInDraft = {
  dayKey: string;
  comparison?: CheckInComparison;
  symptoms: Partial<Record<CheckInSymptom, SymptomSeverity>>;
  areas: CheckInArea[];
  factors: CheckInFactor[];
  routine?: RoutineFollowThrough;
  notes: string;
  photo?: CheckInPhoto;
  createdAt: string;
  updatedAt: string;
};

export type CheckInEntry = CheckInDraft & {
  comparison: CheckInComparison;
  savedAt: string;
  syncStatus: 'local-only';
};

export type CheckInState = {
  draft?: CheckInDraft;
  entry?: CheckInEntry;
};

export const CHECK_IN_HISTORY_LIMIT = 90;

export const comparisonOptions: {
  value: CheckInComparison;
  label: string;
  description: string;
}[] = [
  { value: 'better', label: 'Better', description: 'Less itch, calmer skin, or less redness' },
  { value: 'same', label: 'About the same', description: 'Baseline rhythm, familiar comfort, or minor dryness' },
  { value: 'worse', label: 'Worse', description: 'Elevated flare sensations, warmth, or irritation' },
];

export const symptomLabels: Record<CheckInSymptom, string> = {
  itch: 'Itch',
  dryness: 'Dryness',
  redness: 'Redness',
  pain: 'Pain / soreness',
  sleep: 'Sleep impact',
  other: 'Other',
};

export const areaLabels: Record<CheckInArea, string> = {
  hands: 'Hands',
  'inner-elbows': 'Inner elbows',
  neck: 'Neck',
  face: 'Face',
  other: 'Other',
};

export const factorLabels: Record<CheckInFactor, string> = {
  stress: 'Stress',
  weather: 'Weather / environment',
  'new-product': 'New product',
  'routine-change': 'Routine change',
  illness: 'Illness',
  other: 'Other',
};

const comparisons = new Set<CheckInComparison>(['better', 'same', 'worse']);
const symptoms = new Set<CheckInSymptom>(['itch', 'dryness', 'redness', 'pain', 'sleep', 'other']);
const severities = new Set<SymptomSeverity>(['mild', 'moderate', 'severe']);
const areas = new Set<CheckInArea>(['hands', 'inner-elbows', 'neck', 'face', 'other']);
const factors = new Set<CheckInFactor>(['stress', 'weather', 'new-product', 'routine-change', 'illness', 'other']);
const routines = new Set<RoutineFollowThrough>(['done', 'partially', 'skipped']);
const photoIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function emptyCheckInState(): CheckInState {
  return {};
}

export function createCheckInDraft(now = new Date(), comparison?: CheckInComparison): CheckInDraft {
  const timestamp = now.toISOString();
  return {
    dayKey: localDayKey(now),
    comparison,
    symptoms: {},
    areas: [],
    factors: [],
    notes: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function draftFromEntry(entry: CheckInEntry, now = new Date()): CheckInDraft {
  const { savedAt: _savedAt, syncStatus: _syncStatus, ...draft } = entry;
  return { ...draft, symptoms: { ...draft.symptoms }, areas: [...draft.areas], factors: [...draft.factors], photo: draft.photo ? { ...draft.photo } : undefined, updatedAt: now.toISOString() };
}

export function draftForEditing(state: CheckInState, now = new Date()): CheckInDraft {
  return state.draft ?? (state.entry ? draftFromEntry(state.entry, now) : createCheckInDraft(now));
}

export function withDraftUpdate(draft: CheckInDraft, update: Partial<Omit<CheckInDraft, 'dayKey' | 'createdAt' | 'updatedAt'>>, now = new Date()): CheckInDraft {
  return { ...draft, ...update, updatedAt: now.toISOString() };
}

export function toggleDraftSymptom(draft: CheckInDraft, symptom: CheckInSymptom, now = new Date()): CheckInDraft {
  const next = { ...draft.symptoms };
  if (next[symptom]) delete next[symptom];
  else next[symptom] = 'mild';
  return withDraftUpdate(draft, { symptoms: next }, now);
}

export function setDraftSymptomSeverity(draft: CheckInDraft, symptom: CheckInSymptom, severity: SymptomSeverity, now = new Date()): CheckInDraft {
  return withDraftUpdate(draft, { symptoms: { ...draft.symptoms, [symptom]: severity } }, now);
}

export function toggleDraftValue<T extends string>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function saveCheckInDraft(draft: CheckInDraft, now = new Date()): CheckInEntry {
  if (!draft.comparison) throw new Error('CheckInComparisonRequired');
  return {
    ...draft,
    comparison: draft.comparison,
    updatedAt: now.toISOString(),
    savedAt: now.toISOString(),
    syncStatus: 'local-only',
  };
}

export function comparisonLabel(comparison: CheckInComparison) {
  return comparisonOptions.find((option) => option.value === comparison)?.label ?? comparison;
}

export function draftUpdatedTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'an earlier time';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function stringArray<T extends string>(value: unknown, allowed: Set<T>): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is T => typeof item === 'string' && allowed.has(item as T));
}

function parsePhoto(value: unknown): CheckInPhoto | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<CheckInPhoto>;
  if (
    typeof candidate.id !== 'string'
    || !photoIdPattern.test(candidate.id)
    || typeof candidate.localUri !== 'string'
    || !candidate.localUri.startsWith('file://')
    || !candidate.localUri.endsWith(`/${candidate.id}.jpg`)
    || !areas.has(candidate.area as CheckInArea)
    || candidate.mimeType !== 'image/jpeg'
    || !Number.isInteger(candidate.size)
    || (candidate.size ?? 0) < 1
    || (candidate.size ?? 0) > 8 * 1024 * 1024
    || !Number.isInteger(candidate.width)
    || (candidate.width ?? 0) < 1
    || !Number.isInteger(candidate.height)
    || (candidate.height ?? 0) < 1
    || typeof candidate.sha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(candidate.sha256)
    || typeof candidate.createdAt !== 'string'
    || Number.isNaN(new Date(candidate.createdAt).getTime())
    || candidate.storage !== 'app-private-cache'
    || candidate.syncStatus !== 'local-only'
  ) return undefined;
  return {
    id: candidate.id,
    localUri: candidate.localUri,
    area: candidate.area as CheckInArea,
    note: typeof candidate.note === 'string' ? candidate.note.slice(0, 500) : '',
    mimeType: 'image/jpeg',
    size: candidate.size as number,
    width: candidate.width as number,
    height: candidate.height as number,
    sha256: candidate.sha256,
    createdAt: candidate.createdAt,
    storage: 'app-private-cache',
    syncStatus: 'local-only',
  };
}

function parseDraft(value: unknown): CheckInDraft | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<CheckInDraft>;
  if (typeof candidate.dayKey !== 'string' || typeof candidate.createdAt !== 'string' || typeof candidate.updatedAt !== 'string') return undefined;
  if (Number.isNaN(new Date(candidate.createdAt).getTime()) || Number.isNaN(new Date(candidate.updatedAt).getTime())) return undefined;
  const parsedSymptoms: Partial<Record<CheckInSymptom, SymptomSeverity>> = {};
  if (candidate.symptoms && typeof candidate.symptoms === 'object') {
    for (const [key, severity] of Object.entries(candidate.symptoms)) {
      if (symptoms.has(key as CheckInSymptom) && severities.has(severity as SymptomSeverity)) parsedSymptoms[key as CheckInSymptom] = severity as SymptomSeverity;
    }
  }
  return {
    dayKey: candidate.dayKey,
    comparison: comparisons.has(candidate.comparison as CheckInComparison) ? candidate.comparison : undefined,
    symptoms: parsedSymptoms,
    areas: stringArray(candidate.areas, areas),
    factors: stringArray(candidate.factors, factors),
    routine: routines.has(candidate.routine as RoutineFollowThrough) ? candidate.routine : undefined,
    notes: typeof candidate.notes === 'string' ? candidate.notes.slice(0, 2000) : '',
    photo: parsePhoto(candidate.photo),
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

export function parseCheckInEntry(value: unknown): CheckInEntry | undefined {
  const rawEntry = parseDraft(value);
  const candidate = value as Partial<CheckInEntry> | undefined;
  return rawEntry && rawEntry.comparison && typeof candidate?.savedAt === 'string' && !Number.isNaN(new Date(candidate.savedAt).getTime())
    ? { ...rawEntry, comparison: rawEntry.comparison, savedAt: candidate.savedAt, syncStatus: 'local-only' }
    : undefined;
}

export function parseCheckInHistory(value: unknown): CheckInEntry[] {
  if (!Array.isArray(value)) return [];
  const byDay = new Map<string, CheckInEntry>();
  for (const item of value) {
    const entry = parseCheckInEntry(item);
    if (!entry) continue;
    const existing = byDay.get(entry.dayKey);
    if (!existing || entry.savedAt > existing.savedAt) byDay.set(entry.dayKey, entry);
  }
  return [...byDay.values()]
    .sort((left, right) => right.dayKey.localeCompare(left.dayKey) || right.savedAt.localeCompare(left.savedAt))
    .slice(0, CHECK_IN_HISTORY_LIMIT);
}

export function upsertCheckInHistory(history: CheckInEntry[], entry: CheckInEntry) {
  return parseCheckInHistory([entry, ...history.filter((item) => item.dayKey !== entry.dayKey)]);
}

export function parseCheckInState(value: unknown, dayKey = localDayKey()): CheckInState {
  if (!value || typeof value !== 'object') return {};
  const candidate = value as { draft?: unknown; entry?: unknown };
  const draft = parseDraft(candidate.draft);
  const entry = parseCheckInEntry(candidate.entry);
  return {
    draft: draft?.dayKey === dayKey ? draft : undefined,
    entry: entry?.dayKey === dayKey ? entry : undefined,
  };
}
