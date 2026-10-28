import { describe, expect, it } from 'vitest';

import { profileSchema } from './profile.js';

describe('profileSchema', () => {
  it('accepts an owned self profile', () => {
    const parsed = profileSchema.parse({
      profileId: 'prof_01',
      accountId: 'acct_01',
      type: 'SELF',
      displayName: 'Maya',
      ageRange: 'ADULT',
      createdAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T00:00:00.000Z',
      version: 1,
    });

    expect(parsed.displayName).toBe('Maya');
  });

  it('rejects a blank display name', () => {
    expect(() =>
      profileSchema.parse({
        profileId: 'prof_01',
        accountId: 'acct_01',
        type: 'SELF',
        displayName: ' ',
        ageRange: 'ADULT',
        createdAt: '2026-10-06T00:00:00.000Z',
        updatedAt: '2026-10-06T00:00:00.000Z',
        version: 1,
      }),
    ).toThrow();
  });
});
