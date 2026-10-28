import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { appendAskNellaQuestion, completeAskNellaQuestion, createAskNellaGuidance, newAskNellaSession } from './ask-nella';
import { askNellaStorageKey, deleteAskNellaHistory, loadAskNellaSessions, parseAskNellaSessions, saveAskNellaSessions } from './ask-nella-storage';
import { demoCareProfile } from './care-profile';

vi.mock('expo-secure-store', () => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn() }));

describe('Ask Nella registered storage', () => {
  const now = new Date('2026-10-10T18:00:00.000Z');

  beforeEach(() => vi.clearAllMocks());

  function completeSession(profileId = 'profile-a', updatedAt = now) {
    const pending = appendAskNellaQuestion(newAskNellaSession(profileId, 'session-1', updatedAt), 'Could this fabric feel irritating?', 'client-1', [], updatedAt);
    return completeAskNellaQuestion(pending, 'client-1', createAskNellaGuidance('Could this fabric feel irritating?', { ...demoCareProfile, id: profileId, isDemo: false }), updatedAt);
  }

  it('scopes encrypted device history to both account and profile', async () => {
    vi.mocked(SecureStore.getItemAsync).mockResolvedValue(null);
    await expect(loadAskNellaSessions('account-a', 'profile-a', now)).resolves.toEqual([]);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('myeczema.ask-nella.account-a.profile-a');
    expect(askNellaStorageKey('account-a', 'profile-a')).not.toBe(askNellaStorageKey('account-a', 'profile-b'));
  });

  it('persists only validated history and removes entries older than 12 months', async () => {
    const current = completeSession();
    const expired = { ...completeSession('profile-a', new Date('2025-01-01T00:00:00.000Z')), id: 'expired' };
    await saveAskNellaSessions('account-a', 'profile-a', [expired, current], now);
    const [, payload] = vi.mocked(SecureStore.setItemAsync).mock.calls[0];
    expect(JSON.parse(payload)).toHaveLength(1);
  });

  it('fails closed for malformed records, duplicate ids, and wrong-profile data', () => {
    expect(() => parseAskNellaSessions([{ nope: true }], 'profile-a', now)).toThrow();
    const valid = completeSession();
    expect(() => parseAskNellaSessions([valid, valid], 'profile-a', now)).toThrow('Duplicate');
    expect(() => parseAskNellaSessions([{ ...valid, profileId: 'profile-b' }], 'profile-a', now)).toThrow();
  });

  it('deletes only the requested account and profile history', async () => {
    await deleteAskNellaHistory('account-a', 'profile-a');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledOnce();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('myeczema.ask-nella.account-a.profile-a');
  });
});
