import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { careStorageKey, type CareProfile } from './care-profile';
import { applyProfileDetails, ProfileDetailsValidationError } from './profile-details';
import { loadActiveProfileId, loadProfiles, profileStorageKeys, saveActiveProfileId, saveProfiles } from './profile-storage';

vi.mock('expo-secure-store', () => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn() }));
const records = new Map<string, string>();
const dependent: CareProfile = {
  id: 'dependent-synthetic-original-name', name: 'Synthetic original name', isDemo: false, type: 'dependent',
  relationship: 'Child', ageRange: '6–12', checkInOwner: 'together', areas: ['Hands', 'Legacy area'], symptoms: ['Itchy'], helpPreference: 'NOT_SURE',
};
const self: CareProfile = { id: 'self', name: 'Synthetic self', isDemo: false, type: 'self', areas: ['Face'], symptoms: ['Dry'], helpPreference: 'ROUTINE' };
beforeEach(() => {
  records.clear();
  vi.mocked(SecureStore.getItemAsync).mockReset().mockImplementation(async (key) => records.get(key) ?? null);
  vi.mocked(SecureStore.setItemAsync).mockReset().mockImplementation(async (key, value) => { records.set(key, value); });
});

describe('permitted care-profile detail edits', () => {
  it('renames without regenerating a legacy name-derived ID or changing tracking/respondent/goal fields', () => {
    const before = JSON.stringify(dependent);
    const renamed = applyProfileDetails(dependent, { name: '  Synthetic new nickname  ' });
    expect(renamed).toEqual({ ...dependent, name: 'Synthetic new nickname' });
    expect(JSON.stringify(dependent)).toBe(before);
  });

  it('patches only explicit fields against the latest profile, preserving another edit', () => {
    const latest = { ...dependent, relationship: 'Guardian', ageRange: '13–15', areas: ['Arms'], helpPreference: 'DOCTOR_VISIT' as const };
    expect(applyProfileDetails(latest, { name: 'Synthetic changed name' })).toEqual({ ...latest, name: 'Synthetic changed name' });
    expect(applyProfileDetails(latest, { relationship: '  Grandparent  ' })).toEqual({ ...latest, relationship: 'Grandparent' });
  });

  it('accepts the 80-character boundary and rejects empty, whitespace-only and oversized changed names', () => {
    expect(applyProfileDetails(self, { name: ` ${'N'.repeat(80)} ` }).name).toBe('N'.repeat(80));
    for (const name of ['', ' \n\t ', 'N'.repeat(81)]) expect(() => applyProfileDetails(self, { name })).toThrow(ProfileDetailsValidationError);
  });

  it('validates changed dependent relationships and age bands without collecting exact birth dates', () => {
    expect(applyProfileDetails(dependent, { relationship: 'R'.repeat(80), ageRange: '13–15' })).toEqual({ ...dependent, relationship: 'R'.repeat(80), ageRange: '13–15' });
    for (const relationship of ['', '  ', 'R'.repeat(81)]) expect(() => applyProfileDetails(dependent, { relationship })).toThrow(ProfileDetailsValidationError);
    for (const ageRange of ['', '20–30', '2020-01-01']) expect(() => applyProfileDetails(dependent, { ageRange })).toThrow(ProfileDetailsValidationError);
  });

  it('preserves an unchanged legacy age band and oversized legacy metadata when another field changes', () => {
    const legacy = { ...dependent, name: 'N'.repeat(100), relationship: 'R'.repeat(100), ageRange: 'Legacy school years' };
    expect(applyProfileDetails(legacy, { name: 'Synthetic nickname' })).toEqual({ ...legacy, name: 'Synthetic nickname' });
    expect(applyProfileDetails(legacy, { relationship: 'Guardian' })).toEqual({ ...legacy, relationship: 'Guardian' });
    expect(applyProfileDetails(legacy, { ageRange: ' Legacy school years ' })).toBe(legacy);
  });

  it('does not invent missing self metadata or permit dependent-only changes on a self profile', () => {
    expect(applyProfileDetails(self, { name: 'Synthetic self renamed' })).toEqual({ ...self, name: 'Synthetic self renamed' });
    expect(() => applyProfileDetails(self, { relationship: 'Parent' })).toThrow(ProfileDetailsValidationError);
    expect(() => applyProfileDetails(self, { ageRange: '18+' })).toThrow(ProfileDetailsValidationError);
  });

  it('cannot overwrite identity/type or unrelated fields through extra input properties', () => {
    const input = { name: 'Synthetic alias', id: 'different-id', type: 'dependent', isDemo: true, checkInOwner: 'dependent', areas: ['Legs'], email: 'not-an-identity-edit@example.test' };
    expect(applyProfileDetails(self, input)).toEqual({ ...self, name: 'Synthetic alias' });
    expect(() => applyProfileDetails({ ...self, isDemo: true }, { name: 'Must not save' })).toThrow();
  });

  it('returns an unchanged record for an empty or whitespace-equivalent edit', () => {
    expect(applyProfileDetails(dependent, {})).toBe(dependent);
    expect(applyProfileDetails(dependent, { name: ` ${dependent.name} `, relationship: ' Child ', ageRange: '6–12' })).toBe(dependent);
  });
});

describe('owned profile detail persistence and compatibility', () => {
  it('round-trips the edited dependent without moving ownership, active selection or historical record bytes', async () => {
    await saveProfiles('synthetic-account-a', [self, dependent]);
    await saveProfiles('synthetic-account-b', [{ ...self, name: 'Synthetic B' }]);
    await saveActiveProfileId('synthetic-account-a', dependent.id);
    const careKey = careStorageKey('synthetic-account-a', dependent.id);
    const historyKey = `myeczema.check-in-history.synthetic-account-a.${dependent.id}`;
    records.set(careKey, JSON.stringify({ products: [{ id: 'synthetic-product', schedule: ['evening'], personalInstructions: 'Synthetic label', packagingPhoto: { purpose: 'product-packaging', localUri: 'file:///synthetic-unchanged-owned-cache' } }], events: [{ productId: 'synthetic-product', dayKey: '2026-10-16', status: 'used' }] }));
    records.set(historyKey, JSON.stringify([{ dayKey: '2026-10-16', notes: 'Synthetic historical observation' }]));
    const snapshots = new Map(records);
    const loaded = (await loadProfiles('synthetic-account-a'))!;
    await saveProfiles('synthetic-account-a', loaded.map((profile) => profile.id === dependent.id ? applyProfileDetails(profile, { name: 'Synthetic renamed', relationship: 'Guardian', ageRange: '13–15' }) : profile));
    const reloaded = (await loadProfiles('synthetic-account-a'))!;
    expect(reloaded).toEqual([self, { ...dependent, name: 'Synthetic renamed', relationship: 'Guardian', ageRange: '13–15' }]);
    expect(await loadActiveProfileId('synthetic-account-a')).toBe(dependent.id);
    for (const [key, value] of snapshots) if (key !== profileStorageKeys.profilesKey('synthetic-account-a')) expect(records.get(key)).toBe(value);
  });

  it('keeps original durable metadata on failed write and reloads the actual later successful edit', async () => {
    await saveProfiles('synthetic-account-a', [dependent]);
    const before = new Map(records);
    vi.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('Synthetic device-store failure'));
    await expect(saveProfiles('synthetic-account-a', [applyProfileDetails(dependent, { name: 'Synthetic new name' })])).rejects.toThrow();
    expect(records).toEqual(before);
    expect(await loadProfiles('synthetic-account-a')).toEqual([dependent]);
    await saveProfiles('synthetic-account-a', [applyProfileDetails(dependent, { name: 'Synthetic new name' })]);
    expect(await loadProfiles('synthetic-account-a')).toEqual([{ ...dependent, name: 'Synthetic new name' }]);
  });

  it('treats a write that committed before rejection as uncertain and reloads its actual durable value', async () => {
    await saveProfiles('synthetic-account-a', [dependent]);
    vi.mocked(SecureStore.setItemAsync).mockImplementationOnce(async (key, value) => {
      records.set(key, value);
      throw new Error('Synthetic response failure after native commit');
    });
    await expect(saveProfiles('synthetic-account-a', [applyProfileDetails(dependent, { name: 'Synthetic committed despite response failure' })])).rejects.toThrow();
    expect(await loadProfiles('synthetic-account-a')).toEqual([{ ...dependent, name: 'Synthetic committed despite response failure' }]);
  });

  it('round-trips unknown legacy age metadata without defaulting it during a rename', async () => {
    const legacy = { ...dependent, ageRange: 'Legacy school years' };
    await saveProfiles('synthetic-account-a', [legacy]);
    const loaded = (await loadProfiles('synthetic-account-a'))![0];
    await saveProfiles('synthetic-account-a', [applyProfileDetails(loaded, { name: 'Synthetic renamed legacy' })]);
    expect((await loadProfiles('synthetic-account-a'))![0]).toEqual({ ...legacy, name: 'Synthetic renamed legacy' });
  });
});
