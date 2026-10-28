import type { CheckInEntry, CheckInState } from './check-in';
import { checkInPhotoUris } from './check-in-photo-references';

export class CheckInCommitError extends Error {
  constructor(public reason: 'save' | 'delete') {
    super(reason === 'save' ? 'CheckInSaveFailed' : 'CheckInPhotoDeleteFailed');
  }
}

/** All persistence and rollback arguments belong to the initiating profile. */
export async function commitCheckInChange(input: {
  previousState: CheckInState;
  previousHistory: CheckInEntry[];
  nextState: CheckInState;
  nextHistory: CheckInEntry[];
  writeState?: (state: CheckInState) => Promise<void>;
  writeHistory?: (history: CheckInEntry[]) => Promise<void>;
  deletePhoto: (uri: string) => boolean;
}) {
  const { previousState, previousHistory, nextState, nextHistory, writeState, writeHistory, deletePhoto } = input;
  const retained = checkInPhotoUris(nextState, nextHistory);
  const removed = [...checkInPhotoUris(previousState, previousHistory)].filter((uri) => !retained.has(uri));
  async function restoreMetadata() {
    // Attempt both original-owner snapshots even if one rollback write fails.
    for (const restore of [() => writeState?.(previousState), () => writeHistory?.(previousHistory)]) {
      try { await restore(); } catch { /* The provider keeps writes locked until reload. */ }
    }
  }
  try {
    await writeState?.(nextState);
    await writeHistory?.(nextHistory);
  } catch {
    await restoreMetadata();
    throw new CheckInCommitError('save');
  }
  if (removed.some((uri) => !deletePhoto(uri))) {
    await restoreMetadata();
    throw new CheckInCommitError('delete');
  }
}
