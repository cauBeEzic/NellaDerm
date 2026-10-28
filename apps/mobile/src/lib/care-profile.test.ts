import { describe, expect, it } from 'vitest';

import { careStorageKey, createDependentProfile, profilesFromOnboarding, resolveCareProfile, selectActiveProfile } from './care-profile';

describe('Care profile ownership', () => {
  it('resolves self and dependent profiles to different ids', () => {
    const self = resolveCareProfile('alex@example.com', { subject: 'self', dependentName: '', relationship: '', ageRange: '', areas: [], symptoms: [], firstProduct: '' });
    const dependent = resolveCareProfile('alex@example.com', { subject: 'caregiver', dependentName: 'Maya', relationship: 'Parent', ageRange: '16–17', areas: [], symptoms: [], firstProduct: '' });
    expect(self.id).toBe('self');
    expect(dependent).toMatchObject({ id: 'dependent-maya', name: 'Maya' });
    expect(careStorageKey('user-1', self.id)).not.toBe(careStorageKey('user-1', dependent.id));
  });

  it('creates both profiles without moving onboarding tracking data to the self profile', () => {
    const profiles = profilesFromOnboarding('alex@example.com', { subject: 'both', dependentName: 'Maya', relationship: 'Parent', ageRange: '16–17', checkInOwner: 'together', areas: ['Hands'], symptoms: ['Itchy'], firstProduct: '' });
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toMatchObject({ id: 'self', name: 'Alex', type: 'self', areas: [] });
    expect(profiles[1]).toMatchObject({ id: 'dependent-maya', name: 'Maya', type: 'dependent', relationship: 'Parent', ageRange: '16–17', areas: ['Hands'] });
  });

  it('uses unique opaque-enough ids for dependents with the same name', () => {
    const first = createDependentProfile({ name: 'Maya', relationship: 'Child', ageRange: '16–17' }, [], 'abc123');
    const second = createDependentProfile({ name: 'Maya', relationship: 'Child', ageRange: '16–17' }, [first.id], 'abc123');
    expect(first.id).toBe('dependent-maya-abc123');
    expect(second.id).toBe('dependent-maya-abc123-2');
  });

  it('rejects incomplete dependent records and ignores stale active ids', () => {
    expect(() => createDependentProfile({ name: 'Maya', relationship: '', ageRange: '16–17' }, [], 'abc123')).toThrow();
    const profiles = profilesFromOnboarding('alex@example.com', null);
    expect(selectActiveProfile(profiles, 'other-account-profile', 'self')?.id).toBe('self');
  });
});
