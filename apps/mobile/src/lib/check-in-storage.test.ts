import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createCheckInDraft, saveCheckInDraft, type CheckInPhoto } from './check-in';
import { loadCheckInHistory, loadCheckInRecords, saveCheckInHistory, saveCheckInState } from './check-in-storage';

const storage = vi.hoisted(() => ({ records: new Map<string, string>(), failWrites: false }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => storage.records.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => { if (storage.failWrites) throw new Error('Synthetic storage failure'); storage.records.set(key, value); },
}));
const photo: CheckInPhoto = {
  id: '59e1a47b-eda9-4d95-b733-76d7d365dc2b', localUri: 'file:///synthetic/missing/myeczema-private-media/59e1a47b-eda9-4d95-b733-76d7d365dc2b.jpg',
  area: 'hands', note: '', mimeType: 'image/jpeg', size: 1024, width: 800, height: 600, sha256: 'a'.repeat(64),
  createdAt: '2026-10-16T12:00:00Z', storage: 'app-private-cache', syncStatus: 'local-only',
};
const entry = (day: string, attachment?: CheckInPhoto) => saveCheckInDraft({ ...createCheckInDraft(new Date(`${day}T12:00:00Z`), 'same'), dayKey: day, photo: attachment }, new Date(`${day}T12:00:00Z`));

describe('owner-scoped check-in record loading', () => {
  beforeEach(() => { storage.records.clear(); storage.failWrites = false; });

  it('retains saved and draft photo references through repeated loads without rewriting missing-cache evidence', async () => {
    const saved = entry('2026-10-16', photo);
    await saveCheckInState('synthetic-a', 'self', { entry: saved, draft: { ...saved, notes: 'Synthetic draft' } }, saved.dayKey);
    await saveCheckInHistory('synthetic-a', 'self', [saved]);
    const bytes = [...storage.records];
    for (let reload = 0; reload < 2; reload++) {
      const loaded = await loadCheckInRecords('synthetic-a', 'self', saved.dayKey);
      expect(loaded.state.entry?.photo).toEqual(photo);
      expect(loaded.state.draft?.photo).toEqual(photo);
      expect(loaded.history[0].photo).toEqual(photo);
    }
    expect([...storage.records]).toEqual(bytes);
  });

  it('repairs an unindexed current entry without dropping earlier photos or another owner’s bytes', async () => {
    const older = entry('2026-10-15', photo);
    const current = entry('2026-10-16');
    await saveCheckInHistory('synthetic-a', 'self', [older]);
    await saveCheckInState('synthetic-a', 'self', { entry: current }, current.dayKey);
    await saveCheckInHistory('synthetic-b', 'self', [entry('2026-10-14', photo)]);
    const otherBytes = storage.records.get('myeczema.check-in-history.synthetic-b.self');
    const loaded = await loadCheckInRecords('synthetic-a', 'self', current.dayKey);
    expect(loaded.history.map((item) => item.dayKey)).toEqual(['2026-10-16', '2026-10-15']);
    expect(loaded.history[1].photo).toEqual(photo);
    expect(await loadCheckInHistory('synthetic-a', 'self')).toEqual(loaded.history);
    expect(storage.records.get('myeczema.check-in-history.synthetic-b.self')).toBe(otherBytes);
  });

  it('keeps account and dependent histories isolated through owner round trips', async () => {
    await saveCheckInHistory('synthetic-a', 'self', [entry('2026-10-16', photo)]);
    await saveCheckInHistory('synthetic-a', 'dependent', [entry('2026-10-15')]);
    await saveCheckInHistory('synthetic-b', 'self', [entry('2026-10-14')]);
    for (const [account, profile, day] of [['synthetic-a', 'self', '2026-10-16'], ['synthetic-a', 'dependent', '2026-10-15'], ['synthetic-b', 'self', '2026-10-14'], ['synthetic-a', 'self', '2026-10-16']]) {
      const loaded = await loadCheckInRecords(account, profile, '2026-10-16');
      expect(loaded.history.map((item) => item.dayKey)).toEqual([day]);
    }
    expect((await loadCheckInRecords('synthetic-a', 'empty', '2026-10-16')).history).toEqual([]);
  });

  it('preserves durable snapshots and fails closed when current-entry history repair cannot persist', async () => {
    const current = entry('2026-10-16', photo);
    await saveCheckInState('synthetic-a', 'self', { entry: current }, current.dayKey);
    await saveCheckInHistory('synthetic-a', 'self', [entry('2026-10-15')]);
    const bytes = [...storage.records];
    storage.failWrites = true;
    await expect(loadCheckInRecords('synthetic-a', 'self', current.dayKey)).rejects.toThrow('Synthetic storage failure');
    expect([...storage.records]).toEqual(bytes);
  });

  it('fails closed on corrupt retained history without replacing it with an empty collection', async () => {
    storage.records.set('myeczema.check-in-history.synthetic-a.self', '{not-json');
    await expect(loadCheckInRecords('synthetic-a', 'self', '2026-10-16')).rejects.toThrow();
    expect(storage.records.get('myeczema.check-in-history.synthetic-a.self')).toBe('{not-json');
  });
});
