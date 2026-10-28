import * as SecureStore from 'expo-secure-store';

import { emptyCheckInState, parseCheckInHistory, parseCheckInState, upsertCheckInHistory, type CheckInEntry, type CheckInState } from './check-in';
import { localDayKey } from './today';

const keyFor = (userId: string, profileId: string, dayKey = localDayKey()) => `myeczema.check-in.${userId}.${profileId}.${dayKey}`;
const historyKeyFor = (userId: string, profileId: string) => `myeczema.check-in-history.${userId}.${profileId}`;

export async function loadCheckInState(userId: string, profileId: string, dayKey = localDayKey()): Promise<CheckInState> {
  const stored = await SecureStore.getItemAsync(keyFor(userId, profileId, dayKey));
  if (!stored) return emptyCheckInState();
  return parseCheckInState(JSON.parse(stored), dayKey);
}

export async function saveCheckInState(userId: string, profileId: string, state: CheckInState, dayKey = localDayKey()) {
  await SecureStore.setItemAsync(keyFor(userId, profileId, dayKey), JSON.stringify(state));
}

export async function loadCheckInHistory(userId: string, profileId: string): Promise<CheckInEntry[]> {
  const stored = await SecureStore.getItemAsync(historyKeyFor(userId, profileId));
  if (!stored) return [];
  return parseCheckInHistory(JSON.parse(stored));
}

export async function saveCheckInHistory(userId: string, profileId: string, history: CheckInEntry[]) {
  await SecureStore.setItemAsync(historyKeyFor(userId, profileId), JSON.stringify(parseCheckInHistory(history)));
}

/** Cache eviction does not delete recorded photo references. Availability is resolved by readers. */
export async function loadCheckInRecords(userId: string, profileId: string, dayKey = localDayKey()) {
  const [state, history] = await Promise.all([loadCheckInState(userId, profileId, dayKey), loadCheckInHistory(userId, profileId)]);
  const reconciledHistory = state.entry ? upsertCheckInHistory(history, state.entry) : history;
  if (state.entry && JSON.stringify(reconciledHistory) !== JSON.stringify(history)) {
    await saveCheckInHistory(userId, profileId, reconciledHistory);
  }
  return { state, history: reconciledHistory };
}
