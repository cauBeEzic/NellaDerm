import * as SecureStore from 'expo-secure-store';

import { emptyTodayState, localDayKey, type TodayState } from './today';

const keyFor = (userId: string) => `myeczema.today.${userId}.${localDayKey()}`;

export async function loadTodayState(userId: string): Promise<TodayState> {
  const stored = await SecureStore.getItemAsync(keyFor(userId));
  if (!stored) return emptyTodayState;

  try {
    const parsed = JSON.parse(stored) as Partial<TodayState>;
    return {
      checkIn: parsed.checkIn,
      products: Array.isArray(parsed.products) ? parsed.products : [],
    };
  } catch {
    return emptyTodayState;
  }
}

export async function saveTodayState(userId: string, state: TodayState) {
  await SecureStore.setItemAsync(keyFor(userId), JSON.stringify(state));
}
