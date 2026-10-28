import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AskNellaAction, AskNellaBullet, AskNellaError, AskNellaHeading, AskNellaInfoCard, AskNellaLoading, AskNellaProfilePill, AskNellaScreen, AskNellaTopBar, askNellaTextStyles } from '@/components/ask-nella-ui';
import { useAskNella } from '@/contexts/ask-nella-context';
import { useAuth } from '@/contexts/auth-context';
import { ASK_NELLA_MAX_QUESTION_LENGTH } from '@/lib/ask-nella';
import { colors, font, radius, spacing } from '@/theme';

const suggestions = ['Is this shampoo a good fit?', 'Could this fabric feel irritating?', 'What should I record today?'];

export default function AskScreen() {
  const { user } = useAuth();
  const { disclosureAccepted, draft, attachments, sessions, loading, error, acceptGuestDisclosure, addDemoAttachment, clearQuestion, endGuestSession, openSession, removeAttachment, retryLoad, setDraft } = useAskNella();

  if (loading) return <AskNellaScreen><AskNellaTopBar /><AskNellaLoading /></AskNellaScreen>;

  if (!user && !disclosureAccepted) {
    return (
      <AskNellaScreen>
        <AskNellaTopBar />
        <AskNellaHeading title="Before you begin" subtitle="A private-session notice for guest conversations." />
        <AskNellaInfoCard tone="soft">
          <Text style={askNellaTextStyles.cardTitle}>Educational support only</Text>
          <Text style={askNellaTextStyles.cardBody}>Ask Nella can explain general eczema topics. It cannot diagnose, change treatment, or replace a clinician.</Text>
        </AskNellaInfoCard>
        <AskNellaInfoCard>
          <Text style={askNellaTextStyles.cardTitle}>What happens to this chat</Text>
          <AskNellaBullet icon="cellphone-off">The conversation disappears from this app when you end the guest session or close the app.</AskNellaBullet>
          <AskNellaBullet icon="clock-outline">The planned service retains a protected backend copy for 30 days. This local demo does not send the conversation to AWS yet.</AskNellaBullet>
          <AskNellaBullet icon="account-off-outline">A guest conversation cannot later be attached to an account.</AskNellaBullet>
        </AskNellaInfoCard>
        <Text style={styles.pendingCopy}>Retention and emergency language are demo copy pending clinical, legal, and privacy approval.</Text>
        <AskNellaAction label="Continue to Ask Nella" onPress={acceptGuestDisclosure} />
        <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)')} style={({ pressed }) => [styles.quietAction, pressed && styles.pressed]}><Text style={styles.quietActionText}>Not now</Text></Pressable>
      </AskNellaScreen>
    );
  }

  const review = () => {
    if (!draft.trim()) return;
    router.push('/ask/review');
  };

  const addAttachment = (kind: 'photo' | 'voice') => {
    const label = kind === 'photo' ? 'photo label' : 'voice note';
    Alert.alert(
      `Use a synthetic ${label}?`,
      `Camera, upload, and audio capture are not connected yet. You can add a clearly labelled synthetic ${label} to review the Figma flow without storing real health media.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Use demo', onPress: () => addDemoAttachment(kind) }],
    );
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <AskNellaScreen>
        <AskNellaTopBar />
        <AskNellaHeading title="Ask Nella" subtitle="Share a product label, food ingredient, fabric, or routine question." />
        <AskNellaProfilePill />
        {error ? <AskNellaError onRetry={retryLoad}>{error}</AskNellaError> : null}
        <View style={styles.trySection}>
          <Text style={styles.sectionLabel}>Try asking</Text>
          {suggestions.map((suggestion) => (
            <Pressable accessibilityRole="button" key={suggestion} onPress={() => { setDraft(suggestion); router.push('/ask/review'); }} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
              <Text style={styles.suggestionText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.composerSection}>
          <View style={styles.composer}>
            <Pressable accessibilityLabel="Add a synthetic photo label" accessibilityRole="button" onPress={() => addAttachment('photo')} style={({ pressed }) => [styles.composerIconSoft, pressed && styles.pressed]}>
              <MaterialCommunityIcons color={colors.actionPrimary} name="plus" size={22} />
            </Pressable>
            <TextInput
              accessibilityLabel="Ask Nella question"
              blurOnSubmit
              maxLength={ASK_NELLA_MAX_QUESTION_LENGTH}
              multiline
              onChangeText={setDraft}
              onSubmitEditing={review}
              placeholder="Ask about a product, food, or fabric…"
              placeholderTextColor="#5D6C86"
              returnKeyType="send"
              style={styles.input}
              value={draft}
            />
            <Pressable accessibilityLabel={draft.trim() ? 'Review question' : 'Add a synthetic voice note'} accessibilityRole="button" onPress={draft.trim() ? review : () => addAttachment('voice')} style={({ pressed }) => [styles.composerIcon, pressed && styles.pressed]}>
              <MaterialCommunityIcons color={colors.onActionPrimary} name={draft.trim() ? 'arrow-up' : 'microphone-outline'} size={21} />
            </Pressable>
          </View>
          <View style={styles.options}>
            <InputOption icon="camera-outline" label="Take photo" onPress={() => addAttachment('photo')} />
            <InputOption icon="upload-outline" label="Upload" onPress={() => addAttachment('photo')} />
            <InputOption icon="microphone-outline" label="Voice" onPress={() => addAttachment('voice')} />
          </View>
        </View>

        {attachments.length ? <View style={styles.attachments}><Text style={styles.sectionLabel}>Demo attachments</Text>{attachments.map((attachment) => <View key={attachment.id} style={styles.attachment}><MaterialCommunityIcons color={colors.actionPrimary} name={attachment.kind === 'photo' ? 'image-outline' : 'microphone-outline'} size={19} /><Text style={styles.attachmentText}>{attachment.label}</Text><Pressable accessibilityLabel={`Remove ${attachment.label}`} accessibilityRole="button" onPress={() => removeAttachment(attachment.id)} style={({ pressed }) => [styles.removeAttachment, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.textSecondary} name="close" size={20} /></Pressable></View>)}</View> : null}

        {draft || attachments.length ? <Pressable accessibilityRole="button" onPress={clearQuestion} style={({ pressed }) => [styles.clearDraft, pressed && styles.pressed]}><Text style={styles.clearDraftText}>Clear question</Text></Pressable> : null}

        {user && sessions.length ? <View style={styles.history}><View style={styles.historyHeading}><Text style={styles.sectionLabel}>Recent guidance</Text><Text style={styles.historyBoundary}>12-month local demo history</Text></View>{sessions.slice(0, 5).map((session) => <Pressable accessibilityRole="button" key={session.id} onPress={() => { openSession(session.id); router.push(session.guidance?.kind === 'care' || session.guidance?.kind === 'emergency' ? '/ask/care' : '/ask/guidance'); }} style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}><View style={styles.historyIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="message-text-outline" size={19} /></View><View style={styles.historyCopy}><Text numberOfLines={1} style={styles.historyTitle}>{session.title}</Text><Text style={styles.historyDate}>{new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(new Date(session.updatedAt))} · {session.savedToRecord ? 'Saved to record' : 'Chat history'}</Text></View><MaterialCommunityIcons color={colors.textSecondary} name="chevron-right" size={21} /></Pressable>)}</View> : null}

        <Text style={styles.boundary}>{user ? 'Private local chat history for this profile · AWS chat and cross-device sync are not connected.' : 'Guest conversation · memory only in this demo. End the session to remove it from the app.'}</Text>
        {!user ? <Pressable accessibilityRole="button" onPress={endGuestSession} style={({ pressed }) => [styles.endSession, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.error} name="logout-variant" size={19} /><Text style={styles.endSessionText}>End guest session</Text></Pressable> : null}
      </AskNellaScreen>
    </KeyboardAvoidingView>
  );
}

function InputOption({ icon, label, onPress }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.option, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.actionPrimary} name={icon} size={16} /><Text style={styles.optionText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.canvas },
  trySection: { gap: 12, marginTop: 6 },
  sectionLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  suggestion: { minHeight: 48, alignSelf: 'flex-start', maxWidth: '100%', borderRadius: radius.pill, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  suggestionText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 15, lineHeight: 21 },
  composerSection: { gap: 12, marginTop: spacing.sm },
  composer: { minHeight: 68, borderWidth: 1.5, borderColor: colors.actionPrimary, borderRadius: 20, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface },
  composerIconSoft: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  composerIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary },
  input: { flex: 1, minHeight: 48, maxHeight: 120, paddingVertical: 4, color: colors.textPrimary, fontFamily: font.regular, fontSize: 15, lineHeight: 22, textAlignVertical: 'center' },
  options: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, minHeight: 48, borderRadius: radius.pill, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.surfaceBrandSoft },
  optionText: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 12 },
  attachments: { gap: 8 },
  attachment: { minHeight: 52, borderRadius: 14, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.surfaceBrandSoft },
  attachmentText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  removeAttachment: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  clearDraft: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  clearDraftText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  history: { gap: 10, marginTop: 4 },
  historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  historyBoundary: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 10 },
  historyRow: { minHeight: 68, borderRadius: 16, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface },
  historyIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  historyCopy: { flex: 1, gap: 2 },
  historyTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  historyDate: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16 },
  boundary: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 11, lineHeight: 17 },
  endSession: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 },
  endSessionText: { color: colors.error, fontFamily: font.semibold, fontSize: 13 },
  pendingCopy: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  quietAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  quietActionText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 14 },
  pressed: { opacity: 0.68 },
});
