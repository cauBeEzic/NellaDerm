import { profileAgeRanges, type CareProfile } from './care-profile';

export const MAX_PROFILE_DETAIL_LENGTH = 80;
export type ProfileDetailsEdit = Partial<Pick<CareProfile, 'name' | 'relationship' | 'ageRange'>>;

export class ProfileDetailsValidationError extends Error {
  constructor(readonly field: keyof ProfileDetailsEdit, message: string) {
    super(message);
    this.name = 'ProfileDetailsValidationError';
  }
}

function text(value: string, field: keyof ProfileDetailsEdit) {
  if (typeof value !== 'string') throw new ProfileDetailsValidationError(field, 'Enter text for this field.');
  return value.trim();
}

function required(value: string, field: 'name' | 'relationship') {
  if (!value || value.length > MAX_PROFILE_DETAIL_LENGTH) {
    throw new ProfileDetailsValidationError(field, field === 'name'
      ? 'Enter a profile display name of 1–80 characters.'
      : 'Enter a relationship of 1–80 characters.');
  }
}

/** Applies only explicit permitted edits; absent fields preserve the latest record. */
export function applyProfileDetails(profile: CareProfile, edit: ProfileDetailsEdit): CareProfile {
  if (profile.isDemo) throw new Error('Guest profiles cannot be edited.');
  let name = profile.name;
  let relationship = profile.relationship;
  let ageRange = profile.ageRange;
  if (edit.name !== undefined) {
    name = text(edit.name, 'name');
    if (name !== profile.name) required(name, 'name');
  }
  if (profile.type === 'self' && (edit.relationship !== undefined || edit.ageRange !== undefined)) {
    throw new ProfileDetailsValidationError(edit.relationship !== undefined ? 'relationship' : 'ageRange', 'Only dependent profiles have editable relationship and age-band details.');
  }
  if (edit.relationship !== undefined) {
    relationship = text(edit.relationship, 'relationship');
    if (relationship !== profile.relationship) required(relationship, 'relationship');
  }
  if (edit.ageRange !== undefined) {
    ageRange = text(edit.ageRange, 'ageRange');
    if (ageRange !== profile.ageRange && !profileAgeRanges.some((range) => range === ageRange)) {
      throw new ProfileDetailsValidationError('ageRange', 'Choose one of the available age bands.');
    }
  }
  if (name === profile.name && relationship === profile.relationship && ageRange === profile.ageRange) return profile;
  const next = { ...profile, name };
  if (relationship !== profile.relationship) next.relationship = relationship;
  if (ageRange !== profile.ageRange) next.ageRange = ageRange;
  return next;
}
