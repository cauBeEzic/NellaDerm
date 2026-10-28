import * as SecureStore from 'expo-secure-store';

import { emptyCareState, validateStoredRoutineSchedule, type CareState } from './care';
import { careStorageKey } from './care-profile';

export async function loadCareState(userId: string, profileId: string): Promise<CareState> {
  const stored = await SecureStore.getItemAsync(careStorageKey(userId, profileId));
  if (!stored) return emptyCareState;

  const parsed = JSON.parse(stored) as Partial<CareState> | null;
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid Care state.');
  if (parsed.products !== undefined && !Array.isArray(parsed.products)) throw new Error('Invalid Care products.');
  if (parsed.events !== undefined && !Array.isArray(parsed.events)) throw new Error('Invalid Care events.');
  if (parsed.reminders !== undefined && (!parsed.reminders || typeof parsed.reminders !== 'object' || Array.isArray(parsed.reminders))) throw new Error('Invalid Care reminders.');
  for (const product of parsed.products ?? []) validateStoredRoutineSchedule(product);
  return {
    products: parsed.products ?? [],
    reminders: { ...emptyCareState.reminders, ...parsed.reminders },
    events: parsed.events ?? [],
  };
}

export async function saveCareState(userId: string, profileId: string, state: CareState) {
  await SecureStore.setItemAsync(careStorageKey(userId, profileId), JSON.stringify(state));
}
