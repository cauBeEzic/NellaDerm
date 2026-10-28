import type { OnboardingDraft } from './onboarding';

export type HelpPreference = 'SKIN_CHANGES' | 'ROUTINE' | 'DOCTOR_VISIT' | 'NOT_SURE';

export function isHelpPreference(value: unknown): value is HelpPreference {
  return value === 'SKIN_CHANGES' || value === 'ROUTINE' || value === 'DOCTOR_VISIT' || value === 'NOT_SURE';
}

export type CareProfile = {
  id: string;
  name: string;
  isDemo: boolean;
  type: 'self' | 'dependent';
  relationship?: string;
  ageRange?: string;
  checkInOwner?: 'me' | 'dependent' | 'together';
  areas: string[];
  symptoms: string[];
  helpPreference?: HelpPreference;
};

export const profileAreaChoices = ['Face', 'Neck', 'Hands', 'Arms', 'Legs', 'Torso'] as const;
export const profileSymptomChoices = ['Itchy', 'Dry', 'Red or discoloured', 'Sore', 'Cracked', 'Oozing'] as const;
export const profileAgeRanges = ['0–5', '6–12', '13–15', '16–17', '18+'] as const;

export type DependentProfileInput = {
  name: string;
  relationship: string;
  ageRange: string;
};

function slug(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
}

function displayName(username?: string) {
  const localPart = username?.split('@')[0].replace(/[._-]+/g, ' ').trim();
  return localPart ? localPart.replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'My profile';
}

function selfProfile(username?: string, onboarding?: OnboardingDraft | null): CareProfile {
  const ownsTracking = onboarding?.subject === 'self';
  return {
    id: 'self',
    name: displayName(username),
    isDemo: false,
    type: 'self',
    checkInOwner: ownsTracking ? onboarding?.checkInOwner : undefined,
    areas: ownsTracking ? onboarding?.areas ?? [] : [],
    symptoms: ownsTracking ? onboarding?.symptoms ?? [] : [],
  };
}

function onboardingDependent(onboarding: OnboardingDraft): CareProfile {
  return {
    id: `dependent-${slug(onboarding.dependentName)}`,
    name: onboarding.dependentName.trim(),
    isDemo: false,
    type: 'dependent',
    relationship: onboarding.relationship,
    ageRange: onboarding.ageRange,
    checkInOwner: onboarding.checkInOwner,
    areas: onboarding.areas,
    symptoms: onboarding.symptoms,
  };
}

export function profilesFromOnboarding(username?: string, onboarding?: OnboardingDraft | null): CareProfile[] {
  const hasDependent = Boolean(
    (onboarding?.subject === 'caregiver' || onboarding?.subject === 'both')
    && onboarding.dependentName.trim(),
  );
  if (onboarding?.subject === 'caregiver' && hasDependent) return [onboardingDependent(onboarding)];
  if (onboarding?.subject === 'both' && hasDependent) return [selfProfile(username, onboarding), onboardingDependent(onboarding)];
  return [selfProfile(username, onboarding)];
}

export function createDependentProfile(input: DependentProfileInput, existingIds: string[], suffix: string): CareProfile {
  const name = input.name.trim();
  const relationship = input.relationship.trim();
  const ageRange = input.ageRange.trim();
  if (!name || !relationship || !ageRange) throw new Error('Dependent profile details are required.');
  const baseId = `dependent-${slug(name)}`;
  const safeSuffix = slug(suffix);
  let id = `${baseId}-${safeSuffix}`;
  let duplicate = 2;
  while (existingIds.includes(id)) {
    id = `${baseId}-${safeSuffix}-${duplicate}`;
    duplicate += 1;
  }
  return {
    id,
    name,
    isDemo: false,
    type: 'dependent',
    relationship,
    ageRange,
    areas: [],
    symptoms: [],
  };
}

export function selectActiveProfile(profiles: CareProfile[], requestedId?: string | null, fallbackId?: string) {
  return profiles.find((profile) => profile.id === requestedId)
    ?? profiles.find((profile) => profile.id === fallbackId)
    ?? profiles[0];
}

export function resolveCareProfile(username?: string, onboarding?: OnboardingDraft | null): CareProfile {
  const profiles = profilesFromOnboarding(username, onboarding);
  const dependent = profiles.find((profile) => profile.type === 'dependent');
  return dependent ?? profiles[0];
}

export const demoCareProfile: CareProfile = {
  id: 'guest-demo',
  name: 'Demo profile',
  isDemo: true,
  type: 'self',
  areas: [],
  symptoms: [],
};

export const careStorageKey = (userId: string, profileId: string) => `myeczema.care.${userId}.${profileId}`;
