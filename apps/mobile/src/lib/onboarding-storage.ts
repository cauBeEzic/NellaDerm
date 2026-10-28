import * as SecureStore from 'expo-secure-store';

import { emptyOnboardingDraft, type OnboardingDraft } from './onboarding';

const keyFor = (userId: string, kind: 'draft' | 'complete') => `myeczema.onboarding.${userId}.${kind}`;

export async function loadOnboardingDraft(userId: string): Promise<OnboardingDraft> {
  const stored = await SecureStore.getItemAsync(keyFor(userId, 'draft'));
  if (!stored) return emptyOnboardingDraft;

  try {
    return { ...emptyOnboardingDraft, ...(JSON.parse(stored) as OnboardingDraft) };
  } catch {
    return emptyOnboardingDraft;
  }
}

export async function saveOnboardingDraft(userId: string, draft: OnboardingDraft) {
  await SecureStore.setItemAsync(keyFor(userId, 'draft'), JSON.stringify(draft));
}

export async function completeOnboarding(userId: string, draft: OnboardingDraft) {
  await SecureStore.setItemAsync(keyFor(userId, 'complete'), JSON.stringify(draft));
  await SecureStore.deleteItemAsync(keyFor(userId, 'draft'));
}

export async function hasCompletedOnboarding(userId: string) {
  return Boolean(await SecureStore.getItemAsync(keyFor(userId, 'complete')));
}

export async function loadCompletedOnboarding(userId: string): Promise<OnboardingDraft | null> {
  const stored = await SecureStore.getItemAsync(keyFor(userId, 'complete'));
  if (!stored) return null;

  try {
    return { ...emptyOnboardingDraft, ...(JSON.parse(stored) as OnboardingDraft) };
  } catch {
    return null;
  }
}
