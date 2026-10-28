import { describe, expect, it } from 'vitest';

import { validateEmail, validatePassword, validatePasswordConfirmation } from './auth-validation';

describe('demo auth validation', () => {
  it('accepts a plausible email and rejects an incomplete address', () => {
    expect(validateEmail('person@example.com')).toBeUndefined();
    expect(validateEmail('person@')).toMatch(/valid email/i);
  });

  it('requires eight password characters and a matching confirmation', () => {
    expect(validatePassword('short')).toMatch(/8 characters/i);
    expect(validatePassword('long-enough')).toBeUndefined();
    expect(validatePasswordConfirmation('long-enough', 'different')).toMatch(/do not match/i);
    expect(validatePasswordConfirmation('long-enough', 'long-enough')).toBeUndefined();
  });
});
