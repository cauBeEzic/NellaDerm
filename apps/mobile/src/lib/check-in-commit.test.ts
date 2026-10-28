import { describe, expect, it, vi } from 'vitest';

import { createCheckInDraft, saveCheckInDraft, type CheckInPhoto, type CheckInState } from './check-in';
import { commitCheckInChange } from './check-in-commit';

const photo: CheckInPhoto = {
  id: '59e1a47b-eda9-4d95-b733-76d7d365dc2b',
  localUri: 'file:///cache/myeczema-private-media/59e1a47b-eda9-4d95-b733-76d7d365dc2b.jpg',
  area: 'hands', note: '', mimeType: 'image/jpeg', size: 100, width: 20, height: 20,
  sha256: 'a'.repeat(64), createdAt: '2026-10-12T00:00:00.000Z',
  storage: 'app-private-cache', syncStatus: 'local-only',
};
const draft = { ...createCheckInDraft(new Date(2026, 9, 12), 'same'), photo, notes: 'Profile A' };
const entry = saveCheckInDraft(draft, new Date(2026, 9, 12));

describe('profile-bound check-in/photo commits', () => {
  it('rolls back only the initiating profile snapshots after a switch during an awaited write', async () => {
    let release!: () => void;
    const suspended = new Promise<void>((resolve) => { release = resolve; });
    const previousState = { entry };
    const previousHistory = [entry];
    let visibleState: CheckInState = previousState;
    let visibleHistory = previousHistory;
    const writeState = vi.fn().mockImplementationOnce(() => suspended).mockResolvedValue(undefined);
    const writeHistory = vi.fn().mockResolvedValue(undefined);
    const deletePhoto = vi.fn().mockReturnValue(false);
    const nextEntry = { ...entry, photo: undefined };
    const result = commitCheckInChange({
      previousState: visibleState, previousHistory: visibleHistory,
      nextState: { entry: nextEntry }, nextHistory: [nextEntry],
      writeState, writeHistory, deletePhoto,
    });
    // Hydration replaces the provider refs while profile A's filesystem operation is pending.
    visibleState = { draft: { ...draft, notes: 'Profile B', photo: undefined } };
    visibleHistory = [];
    release();
    await expect(result).rejects.toMatchObject({ reason: 'delete' });
    expect(writeState).toHaveBeenLastCalledWith(previousState);
    expect(writeHistory).toHaveBeenLastCalledWith(previousHistory);
    expect(writeState).not.toHaveBeenCalledWith(visibleState);
    expect(writeHistory).not.toHaveBeenCalledWith(visibleHistory);
  });

  it('preserves the physical saved photo when it is removed only from an edit draft', async () => {
    const deletePhoto = vi.fn().mockReturnValue(true);
    await commitCheckInChange({
      previousState: { draft, entry }, previousHistory: [entry],
      nextState: { draft: { ...draft, photo: undefined }, entry }, nextHistory: [entry],
      writeState: vi.fn().mockResolvedValue(undefined), deletePhoto,
    });
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  it('does not delete bytes if a metadata write fails', async () => {
    const deletePhoto = vi.fn();
    await expect(commitCheckInChange({
      previousState: { draft }, previousHistory: [], nextState: {}, nextHistory: [],
      writeState: vi.fn().mockRejectedValue(new Error('storage unavailable')), deletePhoto,
    })).rejects.toMatchObject({ reason: 'save' });
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  it('restores the draft and saved entry when the second metadata write fails', async () => {
    const previousState = { draft, entry };
    const previousHistory = [entry];
    const nextEntry = saveCheckInDraft({ ...draft, notes: 'Uncommitted edit' });
    let storedState: CheckInState = previousState;
    let storedHistory = previousHistory;
    const writeState = vi.fn(async (state: CheckInState) => { storedState = state; });
    const writeHistory = vi.fn()
      .mockRejectedValueOnce(new Error('history write failed'))
      .mockImplementationOnce(async (history) => { storedHistory = history; });
    const deletePhoto = vi.fn();
    await expect(commitCheckInChange({
      previousState, previousHistory, nextState: { entry: nextEntry }, nextHistory: [nextEntry],
      writeState, writeHistory, deletePhoto,
    })).rejects.toMatchObject({ reason: 'save' });
    expect(storedState).toEqual(previousState);
    expect(storedHistory).toEqual(previousHistory);
    expect(writeHistory).toHaveBeenLastCalledWith(previousHistory);
    expect(deletePhoto).not.toHaveBeenCalled();
  });

  it('still restores history when the state rollback fails', async () => {
    const writeState = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('state rollback failed'));
    const writeHistory = vi.fn().mockRejectedValueOnce(new Error('history write failed')).mockResolvedValueOnce(undefined);
    await expect(commitCheckInChange({
      previousState: { draft, entry }, previousHistory: [entry], nextState: {}, nextHistory: [],
      writeState, writeHistory, deletePhoto: vi.fn(),
    })).rejects.toMatchObject({ reason: 'save' });
    expect(writeHistory).toHaveBeenLastCalledWith([entry]);
  });

  it('deduplicates physical removal after both metadata writes succeed', async () => {
    const order: string[] = [];
    const deletePhoto = vi.fn(() => { order.push('delete'); return true; });
    await commitCheckInChange({
      previousState: { draft, entry }, previousHistory: [entry], nextState: {}, nextHistory: [],
      writeState: async () => { order.push('state'); },
      writeHistory: async () => { order.push('history'); }, deletePhoto,
    });
    expect(order).toEqual(['state', 'history', 'delete']);
    expect(deletePhoto).toHaveBeenCalledExactlyOnceWith(photo.localUri);
  });

  it('keeps deletion failure observable even when rollback storage also fails', async () => {
    const writeHistory = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('rollback failed'));
    await expect(commitCheckInChange({
      previousState: {}, previousHistory: [entry], nextState: {}, nextHistory: [],
      writeHistory, deletePhoto: () => false,
    })).rejects.toMatchObject({ reason: 'delete' });
    expect(writeHistory).toHaveBeenLastCalledWith([entry]);
  });
});
