import * as SecureStore from 'expo-secure-store';

import { isHelpPreference, type CareProfile } from './care-profile';

const profilesKey = (userId: string) => `myeczema.profiles.${userId}`;
const activeProfileKey = (userId: string) => `myeczema.active-profile.${userId}`;

function parseProfile(value: unknown): CareProfile {
  if (!value || typeof value !== 'object') throw new Error('Invalid profile record.');
  const candidate = value as Partial<CareProfile>;
  if (
    typeof candidate.id !== 'string'
    || !candidate.id
    || typeof candidate.name !== 'string'
    || !candidate.name.trim()
    || candidate.isDemo !== false
    || (candidate.type !== 'self' && candidate.type !== 'dependent')
    || !Array.isArray(candidate.areas)
    || !candidate.areas.every((item) => typeof item === 'string')
    || !Array.isArray(candidate.symptoms)
    || !candidate.symptoms.every((item) => typeof item === 'string')
    || (candidate.checkInOwner !== undefined && !['me', 'dependent', 'together'].includes(candidate.checkInOwner))
    || (candidate.helpPreference !== undefined && !isHelpPreference(candidate.helpPreference))
  ) throw new Error('Invalid profile record.');
  if (candidate.type === 'dependent' && (!candidate.relationship?.trim() || !candidate.ageRange?.trim())) {
    throw new Error('Invalid dependent profile record.');
  }
  return {
    id: candidate.id,
    name: candidate.name.trim(),
    isDemo: false,
    type: candidate.type,
    relationship: candidate.relationship?.trim(),
    ageRange: candidate.ageRange?.trim(),
    checkInOwner: candidate.checkInOwner,
    areas: [...candidate.areas],
    symptoms: [...candidate.symptoms],
    helpPreference: candidate.helpPreference,
  };
}

export async function loadProfiles(userId: string): Promise<CareProfile[] | null> {
  const stored = await SecureStore.getItemAsync(profilesKey(userId));
  if (!stored) return null;
  const parsed = JSON.parse(stored) as unknown;
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('Invalid profile list.');
  const profiles = parsed.map(parseProfile);
  if (new Set(profiles.map((profile) => profile.id)).size !== profiles.length) throw new Error('Duplicate profile ids.');
  return profiles;
}

export async function saveProfiles(userId: string, profiles: CareProfile[]) {
  if (!profiles.length || profiles.some((profile) => profile.isDemo)) throw new Error('Invalid profile list.');
  const sanitized = profiles.map(parseProfile);
  await SecureStore.setItemAsync(profilesKey(userId), JSON.stringify(sanitized));
}

export async function loadActiveProfileId(userId: string) {
  return SecureStore.getItemAsync(activeProfileKey(userId));
}

export async function saveActiveProfileId(userId: string, profileId: string) {
  if (!profileId.trim()) throw new Error('Profile id is required.');
  await SecureStore.setItemAsync(activeProfileKey(userId), profileId);
}

export const profileStorageKeys = { profilesKey, activeProfileKey };
