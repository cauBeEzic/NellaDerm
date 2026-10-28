import { describe, expect, it } from 'vitest';

import {
  createCheckInDraft,
  draftUpdatedTimeLabel,
  draftForEditing,
  draftFromEntry,
  parseCheckInState,
  parseCheckInHistory,
  saveCheckInDraft,
  setDraftSymptomSeverity,
  toggleDraftSymptom,
  toggleDraftValue,
  upsertCheckInHistory,
  withDraftUpdate,
} from './check-in';

describe('daily check-in state', () => {
  const now = new Date(2026, 9, 8, 12);

  it('creates a stable daily draft and saves only with a comparison', () => {
    const draft = createCheckInDraft(now, 'worse');
    expect(draft.dayKey).toBe('2026-10-08');
    expect(saveCheckInDraft(draft, now)).toMatchObject({ comparison: 'worse', syncStatus: 'local-only' });
    expect(() => saveCheckInDraft(createCheckInDraft(now), now)).toThrow('CheckInComparisonRequired');
  });

  it('toggles symptoms and keeps their chosen severity', () => {
    let draft = toggleDraftSymptom(createCheckInDraft(now, 'same'), 'itch', now);
    expect(draft.symptoms.itch).toBe('mild');
    draft = setDraftSymptomSeverity(draft, 'itch', 'severe', now);
    expect(draft.symptoms.itch).toBe('severe');
    expect(toggleDraftSymptom(draft, 'itch', now).symptoms.itch).toBeUndefined();
  });

  it('toggles multi-select values without duplicates', () => {
    expect(toggleDraftValue([], 'hands')).toEqual(['hands']);
    expect(toggleDraftValue(['hands'], 'hands')).toEqual([]);
  });

  it('restores a saved entry for editing without mutating it', () => {
    const entry = saveCheckInDraft(withDraftUpdate(createCheckInDraft(now, 'better'), { areas: ['hands'], notes: 'Calmer today' }, now), now);
    const draft = draftFromEntry(entry, new Date(2026, 9, 8, 13));
    draft.areas.push('neck');
    expect(entry.areas).toEqual(['hands']);
    expect(draft.notes).toBe('Calmer today');
  });

  it('preserves an unsaved edited draft when editing is reopened', () => {
    const entry = saveCheckInDraft(createCheckInDraft(now, 'same'), now);
    const edited = withDraftUpdate(draftForEditing({ entry }, now), { notes: 'Unsaved change' }, now);
    expect(draftForEditing({ entry, draft: edited }, new Date(2026, 9, 8, 14))).toBe(edited);
    expect(draftForEditing({ entry, draft: edited }, new Date(2026, 9, 8, 14)).notes).toBe('Unsaved change');
  });

  it('sanitizes corrupted values and ignores records from another day', () => {
    const state = parseCheckInState({
      draft: { ...createCheckInDraft(now, 'worse'), symptoms: { itch: 'extreme', dryness: 'moderate' }, notes: 42 },
      entry: { ...saveCheckInDraft(createCheckInDraft(now, 'same'), now), syncStatus: 'uploaded' },
    }, '2026-10-08');
    expect(state.draft?.symptoms).toEqual({ dryness: 'moderate' });
    expect(state.draft?.notes).toBe('');
    expect(state.entry?.syncStatus).toBe('local-only');
    expect(parseCheckInState(state, '2026-10-09')).toEqual({ draft: undefined, entry: undefined });
    expect(parseCheckInState({ draft: { ...createCheckInDraft(now), updatedAt: 'not-a-date' } }, '2026-10-08')).toEqual({ draft: undefined, entry: undefined });
    expect(draftUpdatedTimeLabel('not-a-date')).toBe('an earlier time');
    const withBadPhoto = parseCheckInState({ draft: { ...createCheckInDraft(now), photo: { localUri: 'https://public.test/photo.jpg' } } }, '2026-10-08');
    expect(withBadPhoto.draft?.photo).toBeUndefined();
  });

  it('accepts only matching opaque photo ids and filenames', () => {
    const id = '59e1a47b-eda9-4d95-b733-76d7d365dc2b';
    const photo = {
      id,
      localUri: `file:///cache/myeczema-private-media/${id}.jpg`,
      area: 'hands',
      note: 'Local record',
      mimeType: 'image/jpeg',
      size: 1024,
      width: 800,
      height: 600,
      sha256: 'a'.repeat(64),
      createdAt: now.toISOString(),
      storage: 'app-private-cache',
      syncStatus: 'local-only',
    };
    expect(parseCheckInState({ draft: { ...createCheckInDraft(now), photo } }, '2026-10-08').draft?.photo?.id).toBe(id);
    expect(parseCheckInState({ draft: { ...createCheckInDraft(now), photo: { ...photo, id: 'photo-1' } } }, '2026-10-08').draft?.photo).toBeUndefined();
    expect(parseCheckInState({ draft: { ...createCheckInDraft(now), photo: { ...photo, localUri: 'file:///cache/myeczema-private-media/else.jpg' } } }, '2026-10-08').draft?.photo).toBeUndefined();
  });

  it('keeps one newest entry per day in descending history order', () => {
    const older = saveCheckInDraft(createCheckInDraft(new Date(2026, 9, 6, 12), 'same'), new Date(2026, 9, 6, 12));
    const firstToday = saveCheckInDraft(createCheckInDraft(now, 'worse'), now);
    const editedToday = { ...firstToday, comparison: 'better' as const, savedAt: new Date(2026, 9, 8, 13).toISOString() };
    const parsed = parseCheckInHistory([older, firstToday, editedToday, { broken: true }]);
    expect(parsed.map((entry) => entry.dayKey)).toEqual(['2026-10-08', '2026-10-06']);
    expect(parsed[0].comparison).toBe('better');
    expect(upsertCheckInHistory(parsed, { ...older, comparison: 'worse' })).toHaveLength(2);
  });
});
