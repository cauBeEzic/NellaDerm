import type { CheckInEntry, CheckInState } from './check-in';

export function checkInPhotoUris(state: CheckInState, history: CheckInEntry[] = []) {
  const uris = new Set<string>();
  if (state.draft?.photo) uris.add(state.draft.photo.localUri);
  if (state.entry?.photo) uris.add(state.entry.photo.localUri);
  for (const entry of history) if (entry.photo) uris.add(entry.photo.localUri);
  return uris;
}
