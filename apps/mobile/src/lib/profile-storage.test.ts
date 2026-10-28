import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDependentProfile, profilesFromOnboarding } from './care-profile';
import { loadActiveProfileId, loadProfiles, profileStorageKeys, saveActiveProfileId, saveProfiles } from './profile-storage';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));

const records = new Map<string, string>();

describe('profile storage', () => {
  beforeEach(() => {
    records.clear();
    vi.mocked(SecureStore.getItemAsync).mockReset().mockImplementation(async (key) => records.get(key) ?? null);
    vi.mocked(SecureStore.setItemAsync).mockReset().mockImplementation(async (key, value) => { records.set(key, value); });
  });

  it('keeps care-goal changes separate across profiles and accounts after reload', async () => {
    const self = profilesFromOnboarding('alex@example.com', null)[0];
    const dependent = createDependentProfile({ name: 'Maya', relationship: 'Child', ageRange: '6–12' }, [self.id], 'goals');
    await saveProfiles('account-a', [
      { ...self, helpPreference: 'SKIN_CHANGES' },
      { ...dependent, helpPreference: 'NOT_SURE' },
    ]);
    await saveProfiles('account-b', [{ ...self, helpPreference: 'ROUTINE' }]);
    await saveActiveProfileId('account-a', dependent.id);
    await saveActiveProfileId('account-b', self.id);

    const firstReload = await loadProfiles('account-a');
    expect(firstReload?.map((profile) => [profile.id, profile.helpPreference])).toEqual([
      [self.id, 'SKIN_CHANGES'], [dependent.id, 'NOT_SURE'],
    ]);
    expect(await loadActiveProfileId('account-a')).toBe(dependent.id);
    expect(await loadActiveProfileId('account-b')).toBe(self.id);

    await saveProfiles('account-a', firstReload!.map((profile) => profile.id === self.id ? { ...profile, helpPreference: 'DOCTOR_VISIT' } : profile));
    const secondReload = await loadProfiles('account-a');
    expect(secondReload?.find((profile) => profile.id === self.id)?.helpPreference).toBe('DOCTOR_VISIT');
    expect(secondReload?.find((profile) => profile.id === dependent.id)?.helpPreference).toBe('NOT_SURE');
    expect((await loadProfiles('account-b'))?.[0].helpPreference).toBe('ROUTINE');
  });

  it('opens legacy profiles as unanswered rather than silently choosing Not sure', async () => {
    const legacy = profilesFromOnboarding('alex@example.com', null);
    records.set(profileStorageKeys.profilesKey('legacy-account'), JSON.stringify(legacy));
    const loaded = await loadProfiles('legacy-account');
    expect(loaded?.[0].id).toBe(legacy[0].id);
    expect(loaded?.[0].helpPreference).toBeUndefined();
  });

  it('rejects an unknown stored goal rather than replacing it with another preference', async () => {
    const profile = profilesFromOnboarding('alex@example.com', null)[0];
    records.set(profileStorageKeys.profilesKey('account-a'), JSON.stringify([{ ...profile, helpPreference: 'UNKNOWN_GOAL' }]));
    await expect(loadProfiles('account-a')).rejects.toThrow();
  });

  it('fails closed for malformed, duplicate, or incomplete dependent data', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('{not-json');
    await expect(loadProfiles('account-a')).rejects.toThrow();

    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify([
      { id: 'self', name: 'Alex', isDemo: false, type: 'self', areas: [], symptoms: [] },
      { id: 'self', name: 'Alex again', isDemo: false, type: 'self', areas: [], symptoms: [] },
    ]));
    await expect(loadProfiles('account-a')).rejects.toThrow();

    vi.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify([
      { id: 'dependent-maya', name: 'Maya', isDemo: false, type: 'dependent', areas: [], symptoms: [] },
    ]));
    await expect(loadProfiles('account-a')).rejects.toThrow();
  });
});
