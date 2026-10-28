import { describe, expect, it } from 'vitest';

import {
  NELLADERM_SUPPORT_EMAIL,
  buildDeletionSupportUrl,
  deletionTargetLabel,
  isDeletionRequestReady,
  parseDeletionTarget,
} from './privacy';

describe('privacy and deletion request helpers', () => {
  it('fails closed to account deletion for unsupported route values', () => {
    expect(parseDeletionTarget(undefined)).toBe('account');
    expect(parseDeletionTarget('unexpected')).toBe('account');
    expect(parseDeletionTarget(['profile'])).toBe('account');
    expect(parseDeletionTarget('profile')).toBe('profile');
  });

  it('requires both acknowledgements and the explicit deletion phrase', () => {
    expect(isDeletionRequestReady(true, true, ' delete ')).toBe(true);
    expect(isDeletionRequestReady(true, false, 'DELETE')).toBe(false);
    expect(isDeletionRequestReady(false, true, 'DELETE')).toBe(false);
    expect(isDeletionRequestReady(true, true, 'REMOVE')).toBe(false);
  });

  it('describes the requested scope without treating a profile request as an account request', () => {
    expect(deletionTargetLabel('account', 'Maya')).toContain('every profile');
    expect(deletionTargetLabel('profile', 'Maya')).toBe('Maya’s profile');
  });

  it('builds an encoded support request for the verified NellaDerm support address', () => {
    const url = buildDeletionSupportUrl({
      accountUsername: ' Person@Example.com ',
      profileName: 'Maya & Sam',
      target: 'profile',
    });

    expect(url.startsWith(`mailto:${NELLADERM_SUPPORT_EMAIL}?`)).toBe(true);
    expect(decodeURIComponent(url)).toContain('Account email: person@example.com');
    expect(decodeURIComponent(url)).toContain('Profile name: Maya & Sam');
    expect(decodeURIComponent(url)).toContain('account remains active until that confirmation');
    expect(decodeURIComponent(url)).not.toContain('all associated profiles');
  });
});
