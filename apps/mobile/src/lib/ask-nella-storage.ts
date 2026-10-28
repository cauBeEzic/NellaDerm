import * as SecureStore from 'expo-secure-store';

import type { AskNellaAttachment, AskNellaGuidance, AskNellaMessage, AskNellaSession } from './ask-nella';

export const ASK_NELLA_REGISTERED_RETENTION_DAYS = 365;
const MAX_SESSIONS_PER_PROFILE = 50;
const keyFor = (userId: string, profileId: string) => `myeczema.ask-nella.${userId}.${profileId}`;

function isString(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function parseAttachment(value: unknown): AskNellaAttachment {
  if (!value || typeof value !== 'object') throw new Error('Invalid Ask Nella attachment.');
  const item = value as Partial<AskNellaAttachment>;
  if (!isString(item.id) || (item.kind !== 'photo' && item.kind !== 'voice') || !isString(item.label) || item.synthetic !== true) throw new Error('Invalid Ask Nella attachment.');
  if (item.durationSeconds !== undefined && (!Number.isInteger(item.durationSeconds) || item.durationSeconds < 0 || item.durationSeconds > 3600)) throw new Error('Invalid Ask Nella attachment duration.');
  return { id: item.id, kind: item.kind, label: item.label.trim(), synthetic: true, durationSeconds: item.durationSeconds };
}

function parseMessage(value: unknown): AskNellaMessage {
  if (!value || typeof value !== 'object') throw new Error('Invalid Ask Nella message.');
  const item = value as Partial<AskNellaMessage>;
  if (!isString(item.id) || (item.role !== 'user' && item.role !== 'assistant') || !isString(item.content) || !isString(item.createdAt) || Number.isNaN(Date.parse(item.createdAt)) || !['pending', 'complete', 'failed'].includes(item.responseStatus ?? '')) throw new Error('Invalid Ask Nella message.');
  if (item.clientMessageId !== undefined && !isString(item.clientMessageId)) throw new Error('Invalid Ask Nella client message id.');
  if (item.safetyCategory !== undefined && !['education', 'care', 'emergency', 'crisis', 'boundary', 'out-of-scope'].includes(item.safetyCategory)) throw new Error('Invalid Ask Nella safety category.');
  return { ...item, id: item.id, role: item.role, content: item.content.trim(), createdAt: item.createdAt, responseStatus: item.responseStatus } as AskNellaMessage;
}

function parseGuidance(value: unknown): AskNellaGuidance | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') throw new Error('Invalid Ask Nella guidance.');
  const item = value as Partial<AskNellaGuidance>;
  if (!['guidance', 'boundary', 'care', 'emergency'].includes(item.kind ?? '') || !['education', 'care', 'emergency', 'crisis', 'boundary', 'out-of-scope'].includes(item.safetyCategory ?? '') || !isString(item.title) || !isString(item.body) || !Array.isArray(item.personalizedFrom) || !item.personalizedFrom.every(isString) || (item.careReasons !== undefined && (!Array.isArray(item.careReasons) || !item.careReasons.every(isString)))) throw new Error('Invalid Ask Nella guidance.');
  return { kind: item.kind!, safetyCategory: item.safetyCategory!, title: item.title.trim(), body: item.body.trim(), personalizedFrom: item.personalizedFrom.map((source) => source.trim()), careReasons: item.careReasons?.map((reason) => reason.trim()) };
}

export function parseAskNellaSessions(value: unknown, profileId: string, now = new Date()): AskNellaSession[] {
  if (!Array.isArray(value)) throw new Error('Invalid Ask Nella session list.');
  const cutoff = now.getTime() - ASK_NELLA_REGISTERED_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const ids = new Set<string>();
  const sessions = value.map((record) => {
    if (!record || typeof record !== 'object') throw new Error('Invalid Ask Nella session.');
    const item = record as Partial<AskNellaSession>;
    if (item.version !== 1 || !isString(item.id) || item.profileId !== profileId || !isString(item.title) || !isString(item.createdAt) || !isString(item.updatedAt) || Number.isNaN(Date.parse(item.createdAt)) || Number.isNaN(Date.parse(item.updatedAt)) || (item.status !== 'active' && item.status !== 'closed') || typeof item.savedToRecord !== 'boolean' || !Array.isArray(item.attachments) || !Array.isArray(item.messages) || !isString(item.policyVersion)) throw new Error('Invalid Ask Nella session.');
    if (ids.has(item.id)) throw new Error('Duplicate Ask Nella session id.');
    ids.add(item.id);
    return {
      version: 1 as const,
      id: item.id,
      profileId,
      title: item.title.trim(),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      status: item.status,
      savedToRecord: item.savedToRecord,
      attachments: item.attachments.map(parseAttachment),
      messages: item.messages.map(parseMessage),
      guidance: parseGuidance(item.guidance),
      policyVersion: item.policyVersion,
    };
  });
  return sessions.filter((session) => Date.parse(session.updatedAt) >= cutoff).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, MAX_SESSIONS_PER_PROFILE);
}

export async function loadAskNellaSessions(userId: string, profileId: string, now = new Date()) {
  const stored = await SecureStore.getItemAsync(keyFor(userId, profileId));
  if (!stored) return [];
  return parseAskNellaSessions(JSON.parse(stored), profileId, now);
}

export async function saveAskNellaSessions(userId: string, profileId: string, sessions: AskNellaSession[], now = new Date()) {
  const sanitized = parseAskNellaSessions(sessions, profileId, now);
  await SecureStore.setItemAsync(keyFor(userId, profileId), JSON.stringify(sanitized));
}

export async function deleteAskNellaHistory(userId: string, profileId: string) {
  await SecureStore.deleteItemAsync(keyFor(userId, profileId));
}

export const askNellaStorageKey = keyFor;
