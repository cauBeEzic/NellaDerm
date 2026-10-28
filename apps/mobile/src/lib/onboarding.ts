export type SubjectChoice = 'self' | 'caregiver' | 'both';
export type OnboardingStep = 'subject' | 'dependent' | 'check-in-owner' | 'areas' | 'product' | 'privacy';

export type OnboardingDraft = {
  subject?: SubjectChoice;
  dependentName: string;
  relationship: string;
  ageRange: string;
  checkInOwner?: 'me' | 'dependent' | 'together';
  areas: string[];
  symptoms: string[];
  firstProduct: string;
};

export const emptyOnboardingDraft: OnboardingDraft = {
  dependentName: '',
  relationship: '',
  ageRange: '',
  areas: [],
  symptoms: [],
  firstProduct: '',
};

export function stepsForSubject(subject?: SubjectChoice): OnboardingStep[] {
  return subject === 'caregiver' || subject === 'both'
    ? ['subject', 'dependent', 'check-in-owner', 'areas', 'product', 'privacy']
    : ['subject', 'check-in-owner', 'areas', 'product', 'privacy'];
}

export function canContinue(step: OnboardingStep, draft: OnboardingDraft) {
  if (step === 'subject') return Boolean(draft.subject);
  if (step === 'dependent') {
    return Boolean(draft.dependentName.trim() && draft.relationship && draft.ageRange);
  }
  if (step === 'check-in-owner') return Boolean(draft.checkInOwner);
  return true;
}
