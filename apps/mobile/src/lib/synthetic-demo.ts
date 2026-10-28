import { type CareState, defaultReminders } from './care';
import { type CareProfile } from './care-profile';
import { type CheckInEntry, createCheckInDraft, saveCheckInDraft } from './check-in';
import { emptyOnboardingDraft, type OnboardingDraft } from './onboarding';
import { localDayKey } from './today';

export type DemoScenario = 'new' | 'two-months';
export type DemoSession = { userId: string; username: string; scenario: DemoScenario };
export const demoSessionKey = 'myeczema.synthetic-demo.session.v1';

export function allowsSyntheticDemo(development: boolean, platform: string, enabled?: string) {
  return development && platform === 'ios' && enabled === '1';
}

export function parseDemoSession(value: string | null): DemoSession | null {
  if (!value) return null;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid demo session');
  const session = parsed as DemoSession;
  if (!['new', 'two-months'].includes(session.scenario)
    || !new RegExp(`^synthetic-demo-${session.scenario}-[a-zA-Z0-9-]+$`).test(session.userId)
    || session.username !== (session.scenario === 'new' ? 'alex.demo@example.invalid' : 'jordan.demo@example.invalid')) {
    throw new Error('Invalid demo session');
  }
  return { userId: session.userId, username: session.username, scenario: session.scenario };
}

export function createDemoFixture(scenario: DemoScenario, runId: string, now = new Date()) {
  if (!['new', 'two-months'].includes(scenario) || !/^[a-zA-Z0-9-]+$/.test(runId) || !Number.isFinite(now.getTime())) throw new Error('Invalid demo fixture request');
  const session: DemoSession = {
    userId: `synthetic-demo-${scenario}-${runId}`,
    username: scenario === 'new' ? 'alex.demo@example.invalid' : 'jordan.demo@example.invalid',
    scenario,
  };
  const profile: CareProfile = {
    id: 'self', name: scenario === 'new' ? 'Alex Demo' : 'Jordan Demo', type: 'self', isDemo: false,
    checkInOwner: 'me', areas: scenario === 'new' ? [] : ['Hands', 'Arms'],
    symptoms: scenario === 'new' ? [] : ['Itchy', 'Dry'], helpPreference: scenario === 'new' ? undefined : 'SKIN_CHANGES',
  };
  const onboarding: OnboardingDraft | null = scenario === 'new' ? null : {
    ...emptyOnboardingDraft, subject: 'self', checkInOwner: 'me', areas: profile.areas,
    symptoms: profile.symptoms, firstProduct: 'Demo daily moisturizer',
  };
  const at = (daysAgo: number, hour = 12) => {
    const date = new Date(now);
    date.setHours(hour, 0, 0, 0);
    date.setDate(date.getDate() - daysAgo);
    return date;
  };
  const care: CareState = {
    products: [], events: [], reminders: {
      ...defaultReminders, checkIn: false, morning: false, evening: false,
      prescription: false, weeklyReview: false, productSupply: false,
    },
  };
  const history: CheckInEntry[] = [];
  if (scenario === 'two-months') {
    care.products = [
      { id: 'demo-moisturizer', name: 'Demo daily moisturizer', category: 'Moisturizer', kind: 'skincare', schedule: ['morning', 'evening'], startedOn: localDayKey(at(60)), supply: 'low', area: 'Hands and arms', verified: false, personalInstructions: 'Fictional demo product; follow your own product label.' },
      { id: 'demo-cleanser', name: 'Demo gentle cleanser', category: 'Cleanser', kind: 'skincare', schedule: ['evening'], startedOn: localDayKey(at(45)), supply: 'plenty', area: 'Hands', verified: false },
    ];
    // Sixty completed local days, ending yesterday. Today stays open for a live check-in.
    for (let ago = 1; ago <= 60; ago++) {
      const date = at(ago);
      const dayKey = localDayKey(date);
      // Deliberate gaps and varied observations; no invented photo or product-causation claims.
      if (ago % 7 !== 0) history.push(saveCheckInDraft({
        ...createCheckInDraft(date, ago % 6 === 0 ? 'worse' : ago % 3 === 0 ? 'better' : 'same'),
        symptoms: { itch: ago % 6 === 0 ? 'moderate' : 'mild', dryness: 'mild' },
        areas: ago % 2 === 0 ? ['hands', 'inner-elbows'] : ['hands'],
        factors: ago % 6 === 0 ? ['weather'] : ago % 5 === 0 ? ['stress'] : [],
        routine: ago % 9 === 0 ? 'partially' : 'done',
        notes: ago % 6 === 0 ? 'Synthetic demo observation: hands felt itchier today.' : 'Synthetic demo observation: recorded my usual routine.',
      }, date));
      for (const product of care.products) {
        if (dayKey < product.startedOn || ago % 11 === 0) continue;
        for (const period of product.schedule) {
          const recorded = at(ago, period === 'morning' ? 8 : 20);
          care.events.push({ id: `${product.id}-${dayKey}-${period}`, productId: product.id, period,
            status: ago % 9 === 0 && period === 'evening' ? 'skipped' : 'used', dayKey,
            recordedAt: recorded.toISOString(), displayTime: period === 'morning' ? '8:00 AM' : '8:00 PM' });
        }
      }
    }
  }
  return { session, profile, onboarding, care, history };
}
