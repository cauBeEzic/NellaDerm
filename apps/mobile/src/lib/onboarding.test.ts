import { describe, expect, it } from 'vitest';

import { canContinue, emptyOnboardingDraft, stepsForSubject } from './onboarding';

describe('onboarding branches', () => {
  it('skips dependent identity for a self-only profile', () => {
    expect(stepsForSubject('self')).not.toContain('dependent');
  });

  it.each(['caregiver', 'both'] as const)('collects dependent identity for %s', (subject) => {
    expect(stepsForSubject(subject)).toContain('dependent');
  });

  it('allows the optional area and product steps to be skipped', () => {
    expect(canContinue('areas', emptyOnboardingDraft)).toBe(true);
    expect(canContinue('product', emptyOnboardingDraft)).toBe(true);
  });

  it('requires all dependent identity fields', () => {
    expect(canContinue('dependent', emptyOnboardingDraft)).toBe(false);
    expect(canContinue('dependent', {
      ...emptyOnboardingDraft,
      dependentName: 'Maya',
      relationship: 'Child',
      ageRange: '6–12',
    })).toBe(true);
  });
});
