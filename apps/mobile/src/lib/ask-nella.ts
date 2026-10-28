import type { CareProfile } from './care-profile';

export const ASK_NELLA_POLICY_VERSION = 'demo-2026-10-10';
export const ASK_NELLA_MAX_QUESTION_LENGTH = 600;

export type AskNellaSafetyCategory = 'education' | 'care' | 'emergency' | 'crisis' | 'boundary' | 'out-of-scope';
export type AskNellaResponseStatus = 'pending' | 'complete' | 'failed';

export type AskNellaAttachment = {
  id: string;
  kind: 'photo' | 'voice';
  label: string;
  synthetic: true;
  durationSeconds?: number;
};

export type AskNellaGuidance = {
  kind: 'guidance' | 'boundary' | 'care' | 'emergency';
  safetyCategory: AskNellaSafetyCategory;
  title: string;
  body: string;
  personalizedFrom: string[];
  careReasons?: string[];
};

export type AskNellaMessage = {
  id: string;
  clientMessageId?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  responseStatus: AskNellaResponseStatus;
  safetyCategory?: AskNellaSafetyCategory;
};

export type AskNellaSession = {
  version: 1;
  id: string;
  profileId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'closed';
  savedToRecord: boolean;
  attachments: AskNellaAttachment[];
  messages: AskNellaMessage[];
  guidance?: AskNellaGuidance;
  policyVersion: string;
};

const patterns = {
  crisis: /\b(suicid|kill myself|hurt myself|self[- ]?harm|end my life|do not want to live|don't want to live)\b/i,
  emergency: /\b(trouble breathing|can(?:not|'t) breathe|severe allergic|anaphyl|swollen (?:tongue|lips)|passed out|unconscious)\b/i,
  care: /\b(fever|pus|rapidly spreading|spreading fast|increasing pain|infected|bleeding|seriously affects? (?:sleep|daily)|can(?:not|'t) sleep)\b/i,
  boundary: /\b(diagnos|what condition|is this eczema|stop (?:my )?(?:prescription|medication)|change (?:my )?dose|how much steroid|start .*treatment|cure (?:my )?eczema|caused? (?:my )?(?:flare|eczema)|made my skin (?:better|worse))\b/i,
  injection: /\b(ignore .*instructions?|system prompt|other users?'? data|database records?|api keys?|reveal secrets?)\b/i,
  outOfScope: /\b(stock price|investment advice|election|sports score|weather forecast|write (?:my )?code)\b/i,
};

const sentence = (value: string) => value.trim().replace(/\s+/g, ' ');

export function normalizeAskNellaQuestion(value: string) {
  return sentence(value).slice(0, ASK_NELLA_MAX_QUESTION_LENGTH);
}

export function classifyAskNellaQuestion(value: string): AskNellaSafetyCategory {
  const question = normalizeAskNellaQuestion(value);
  if (patterns.crisis.test(question)) return 'crisis';
  if (patterns.emergency.test(question)) return 'emergency';
  if (patterns.care.test(question)) return 'care';
  if (patterns.boundary.test(question) || patterns.injection.test(question)) return 'boundary';
  if (patterns.outOfScope.test(question)) return 'out-of-scope';
  return 'education';
}

function profileSources(profile: CareProfile, attachments: AskNellaAttachment[]) {
  const sources: string[] = [];
  if (!profile.isDemo && profile.symptoms.length) sources.push(`${profile.name}'s recorded symptoms`);
  if (!profile.isDemo && profile.areas.length) sources.push(`${profile.name}'s recorded areas`);
  if (attachments.length) sources.push('attachment labels only — image and audio analysis are not connected');
  if (!sources.length) sources.push(profile.isDemo ? 'your question only · synthetic demo guidance' : 'your question and active profile only');
  return sources;
}

export function createAskNellaGuidance(questionValue: string, profile: CareProfile, attachments: AskNellaAttachment[] = []): AskNellaGuidance {
  const question = normalizeAskNellaQuestion(questionValue);
  const safetyCategory = classifyAskNellaQuestion(question);
  const personalizedFrom = profileSources(profile, attachments);

  if (safetyCategory === 'crisis') {
    return {
      kind: 'emergency',
      safetyCategory,
      title: 'Get immediate support',
      body: 'I cannot provide crisis support. If you or someone else may be in immediate danger, call 911 now. In Canada or the U.S., call or text 988 for suicide crisis support.',
      personalizedFrom: ['the safety language in your question'],
      careReasons: ['Someone may be in immediate danger', 'There may be a risk of self-harm'],
    };
  }

  if (safetyCategory === 'emergency') {
    return {
      kind: 'emergency',
      safetyCategory,
      title: 'Get emergency help now',
      body: 'Trouble breathing or a severe allergic reaction can be an emergency. Call 911 now. Do not wait for an app response.',
      personalizedFrom: ['the urgent symptoms in your question'],
      careReasons: ['Trouble breathing', 'A severe allergic reaction', 'Loss of consciousness'],
    };
  }

  if (safetyCategory === 'care') {
    return {
      kind: 'care',
      safetyCategory,
      title: 'A clinician may need to help',
      body: 'The signs you described may need prompt clinical attention. Ask a clinician or urgent-care service for advice rather than relying on product guidance.',
      personalizedFrom,
      careReasons: ['The area is rapidly spreading', 'There is fever, pus, or increasing pain', 'Sleep or daily activity is seriously affected'],
    };
  }

  if (safetyCategory === 'boundary') {
    return {
      kind: 'boundary',
      safetyCategory,
      title: 'I can explain, but not diagnose',
      body: 'Ask Nella can share general eczema education, but it cannot diagnose a condition, tell you to start, stop, or change treatment, reveal private system data, or say that a product caused a skin change. A clinician or pharmacist can help with treatment decisions.',
      personalizedFrom: ['your question only · no diagnosis or treatment recommendation'],
    };
  }

  if (safetyCategory === 'out-of-scope') {
    return {
      kind: 'boundary',
      safetyCategory,
      title: 'That is outside Ask Nella',
      body: 'Ask Nella is limited to general eczema education, products, ingredients, fabrics, routines, and explanations of your recorded information. Try rephrasing your question within that scope.',
      personalizedFrom: ['your question only'],
    };
  }

  if (/\b(summary|summarize|recorded|my record|today)\b/i.test(question)) {
    const observations = [
      profile.areas.length ? `recorded areas include ${profile.areas.join(', ')}` : 'no body areas are recorded yet',
      profile.symptoms.length ? `recorded symptoms include ${profile.symptoms.join(', ')}` : 'no symptoms are recorded yet',
    ];
    return {
      kind: 'guidance',
      safetyCategory,
      title: profile.isDemo ? 'What a useful record can include' : `${profile.name}'s recorded context`,
      body: `${observations.join('; ')}. This describes saved entries only. Missing information is not treated as improvement, and this summary is not a medical conclusion.`,
      personalizedFrom,
    };
  }

  if (/\b(shampoo|product|ingredient|fragrance|soap|cream|lotion)\b/i.test(question)) {
    return {
      kind: 'guidance',
      safetyCategory,
      title: `A cautious choice for ${profile.name}`,
      body: 'Check the ingredient list for fragrance and other ingredients you have previously chosen to avoid. Fragrance can irritate some eczema-prone skin, but a label alone cannot predict a reaction. Consider a small patch test and stop if irritation appears.',
      personalizedFrom,
    };
  }

  if (/\b(fabric|clothing|wool|cotton|polyester)\b/i.test(question)) {
    return {
      kind: 'guidance',
      safetyCategory,
      title: 'Comfort depends on the fabric and the person',
      body: 'Rough texture, heat, sweat, seams, and detergent residue can feel irritating for some people. A soft, breathable layer and a short wear test may help you notice comfort without assuming the fabric caused a flare.',
      personalizedFrom,
    };
  }

  if (/\b(food|eat|diet|ingredient)\b/i.test(question)) {
    return {
      kind: 'guidance',
      safetyCategory,
      title: 'Food questions need cautious context',
      body: 'A food and a skin change happening near each other does not prove that one caused the other. Record what was eaten, timing, symptoms, and other changes, then discuss repeated or serious reactions with a clinician.',
      personalizedFrom,
    };
  }

  return {
    kind: 'guidance',
    safetyCategory,
    title: 'A careful next step',
    body: 'Record what you noticed, when it happened, and what else changed around the same time. Repeated observations can support a conversation with a clinician, but Ask Nella does not diagnose or establish a cause.',
    personalizedFrom,
  };
}

export function newAskNellaSession(profileId: string, sessionId: string, now = new Date()): AskNellaSession {
  const timestamp = now.toISOString();
  return {
    version: 1,
    id: sessionId,
    profileId,
    title: 'New question',
    createdAt: timestamp,
    updatedAt: timestamp,
    status: 'active',
    savedToRecord: false,
    attachments: [],
    messages: [],
    policyVersion: ASK_NELLA_POLICY_VERSION,
  };
}

export function appendAskNellaQuestion(session: AskNellaSession, questionValue: string, clientMessageId: string, attachments: AskNellaAttachment[], now = new Date()): AskNellaSession {
  const question = normalizeAskNellaQuestion(questionValue);
  if (!question) throw new Error('A question is required.');
  if (session.messages.some((message) => message.clientMessageId === clientMessageId && message.role === 'user')) return session;
  const timestamp = now.toISOString();
  return {
    ...session,
    title: question.length > 52 ? `${question.slice(0, 49)}…` : question,
    updatedAt: timestamp,
    attachments: attachments.map((attachment) => ({ ...attachment })),
    messages: [...session.messages, {
      id: `user-${clientMessageId}`,
      clientMessageId,
      role: 'user',
      content: question,
      createdAt: timestamp,
      responseStatus: 'pending',
    }],
  };
}

export function completeAskNellaQuestion(session: AskNellaSession, clientMessageId: string, guidance: AskNellaGuidance, now = new Date()): AskNellaSession {
  const assistantId = `assistant-${clientMessageId}`;
  const timestamp = now.toISOString();
  const messages = session.messages.map((message) => message.clientMessageId === clientMessageId && message.role === 'user'
    ? { ...message, responseStatus: 'complete' as const, safetyCategory: guidance.safetyCategory }
    : message);
  if (!messages.some((message) => message.id === assistantId)) {
    messages.push({
      id: assistantId,
      clientMessageId,
      role: 'assistant',
      content: guidance.body,
      createdAt: timestamp,
      responseStatus: 'complete',
      safetyCategory: guidance.safetyCategory,
    });
  }
  return { ...session, updatedAt: timestamp, messages, guidance };
}

export function failAskNellaQuestion(session: AskNellaSession, clientMessageId: string, now = new Date()): AskNellaSession {
  return {
    ...session,
    updatedAt: now.toISOString(),
    messages: session.messages.map((message) => message.clientMessageId === clientMessageId && message.role === 'user'
      ? { ...message, responseStatus: 'failed' as const }
      : message),
  };
}

export function latestAskNellaQuestion(session?: AskNellaSession) {
  return [...(session?.messages ?? [])].reverse().find((message) => message.role === 'user');
}
