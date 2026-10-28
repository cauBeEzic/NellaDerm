import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AskNellaAction, AskNellaError, AskNellaHeading, AskNellaInfoCard, AskNellaProfilePill, AskNellaScreen, AskNellaTopBar, askNellaTextStyles } from '@/components/ask-nella-ui';
import { useAskNella } from '@/contexts/ask-nella-context';
import { latestAskNellaQuestion } from '@/lib/ask-nella';
import { colors, font, radius, spacing } from '@/theme';

export default function ReviewAskNellaQuestionScreen() {
  const { activeSession, attachments, draft, error, sending, submitQuestion } = useAskNella();
  const failed = latestAskNellaQuestion(activeSession)?.responseStatus === 'failed' ? latestAskNellaQuestion(activeSession) : undefined;
  const retryId = failed?.content === draft.trim() ? failed.clientMessageId : undefined;

  const send = async () => {
    try {
      const guidance = await submitQuestion(retryId);
      router.replace(guidance.kind === 'care' || guidance.kind === 'emergency' ? '/ask/care' : '/ask/guidance');
    } catch {
      // The provider preserves the question and exposes a retry state.
    }
  };

  if (!draft.trim()) {
    return (
      <AskNellaScreen>
        <AskNellaTopBar back />
        <AskNellaHeading title="Review your question" subtitle="There is no question to review yet." />
        <AskNellaInfoCard><Text style={askNellaTextStyles.cardBody}>Return to Ask Nella and enter a question before sending.</Text></AskNellaInfoCard>
        <AskNellaAction label="Return to Ask Nella" onPress={() => router.replace('/(tabs)/ask')} />
      </AskNellaScreen>
    );
  }

  const photo = attachments.find((attachment) => attachment.kind === 'photo');
  const voice = attachments.find((attachment) => attachment.kind === 'voice');

  return (
    <AskNellaScreen>
      <AskNellaTopBar back />
      <AskNellaHeading title="Review your question" subtitle="Check what will be shared before sending." />
      <AskNellaProfilePill />

      {photo ? (
        <AskNellaInfoCard tone="soft">
          <Text style={askNellaTextStyles.label}>SYNTHETIC PHOTO LABEL</Text>
          <Text style={askNellaTextStyles.cardTitle}>Shampoo label placeholder attached</Text>
          <Text style={styles.attachmentBoundary}>No image was captured or uploaded. The local demo sends only this label.</Text>
        </AskNellaInfoCard>
      ) : null}

      <AskNellaInfoCard>
        <Text style={styles.question}>“{draft.trim()}”</Text>
      </AskNellaInfoCard>

      {voice ? <View style={styles.voice}><MaterialCommunityIcons color={colors.actionPrimary} name="circle" size={10} /><Text style={styles.voiceText}>Synthetic voice note · {voice.durationSeconds ?? 0}s</Text></View> : null}
      {!attachments.length ? <View style={styles.noAttachments}><MaterialCommunityIcons color={colors.actionPrimary} name="shield-check-outline" size={20} /><Text style={styles.noAttachmentsText}>No photo or voice attachment will be shared.</Text></View> : null}

      <Text style={styles.boundary}>Demo safety check · the question is evaluated locally. AWS Bedrock, media analysis, and server retention are not connected.</Text>
      {error ? <AskNellaError onRetry={send}>{error}</AskNellaError> : null}
      <AskNellaAction disabled={sending} label={retryId ? 'Retry Ask Nella' : 'Ask Nella'} loading={sending} onPress={send} />
      <AskNellaAction disabled={sending} label={attachments.length ? 'Edit question or attachments' : 'Edit question'} onPress={() => router.back()} secondary />
      <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/ask')} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelText}>Cancel question</Text></Pressable>
    </AskNellaScreen>
  );
}

const styles = StyleSheet.create({
  question: { color: colors.textPrimary, fontFamily: font.regular, fontSize: 18, lineHeight: 27 },
  attachmentBoundary: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 11, lineHeight: 17 },
  voice: { minHeight: 48, alignSelf: 'flex-start', maxWidth: '100%', borderRadius: radius.pill, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.surfaceBrandSoft },
  voiceText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  noAttachments: { minHeight: 52, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceBrandSoft },
  noAttachmentsText: { flex: 1, color: colors.textSecondary, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  boundary: { marginTop: spacing.xs, color: colors.textSecondary, fontFamily: font.medium, fontSize: 11, lineHeight: 17 },
  cancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  pressed: { opacity: 0.68 },
});
