import * as SecureStore from 'expo-secure-store';

import { saveCareState } from './care-storage';
import { saveCheckInHistory } from './check-in-storage';
import { completeOnboarding } from './onboarding-storage';
import { saveActiveProfileId, saveProfiles } from './profile-storage';
import { createDemoFixture, demoSessionKey, parseDemoSession, type DemoScenario } from './synthetic-demo';

export async function restoreDemoSession() {
  return parseDemoSession(await SecureStore.getItemAsync(demoSessionKey));
}

export async function clearDemoSession() {
  await SecureStore.deleteItemAsync(demoSessionKey);
}

export async function prepareDemoSession(scenario: DemoScenario, runId: string, now = new Date()) {
  const fixture = createDemoFixture(scenario, runId, now);
  const { userId } = fixture.session;
  await saveProfiles(userId, [fixture.profile]);
  await saveActiveProfileId(userId, fixture.profile.id);
  if (fixture.onboarding) await completeOnboarding(userId, fixture.onboarding);
  await saveCareState(userId, fixture.profile.id, fixture.care);
  await saveCheckInHistory(userId, fixture.profile.id, fixture.history);
  // Publish only after all fixture writes succeed. Each start owns a fresh namespace.
  await SecureStore.setItemAsync(demoSessionKey, JSON.stringify(fixture.session));
  return fixture.session;
}
