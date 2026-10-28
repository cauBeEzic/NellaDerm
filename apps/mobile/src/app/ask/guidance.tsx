import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AskNellaAction, AskNellaHeading, AskNellaInfoCard, AskNellaProfilePill, AskNellaScreen, AskNellaTopBar, askNellaTextStyles } from '@/components/ask-nella-ui';
import { useAskNella } from '@/contexts/ask-nella-context';
import { useAuth } from '@/contexts/auth-context';
import { useProfiles } from '@/contexts/profile-context';
import { colors, font } from '@/theme';

export default function AskNellaGuidanceScreen() {
  const { user } = useAuth();
  const { activeProfile } = useProfiles();
  const { activeSession, markSavedToRecord, startFollowUp } = useAskNella();
  const guidance = activeSession?.guidance;

  if (!guidance) {
    return (
      <AskNellaScreen>
        <AskNellaTopBar back />
        <AskNellaHeading title="Nella’s guidance" subtitle="No completed guidance is open." />
        <AskNellaInfoCard><Text style={askNellaTextStyles.cardBody}>Return to Ask Nella to review and send a question.</Text></AskNellaInfoCard>
        <AskNellaAction label="Return to Ask Nella" onPress={() => router.replace('/(tabs)/ask')} />
      </AskNellaScreen>
    );
  }

  const save = async () => {
    if (!user) {
      router.push('/sign-in');
      return;
    }
    try {
      await markSavedToRecord();
    } catch {
      Alert.alert('Could not save guidance', 'Your chat history is unchanged. Return to Ask Nella and reload this profile before trying again.');
    }
  };

  const followUp = () => {
    startFollowUp();
    router.replace('/(tabs)/ask');
  };

  return (
    <AskNellaScreen>
      <AskNellaTopBar back />
      <AskNellaHeading title="Nella’s guidance" subtitle="An educational answer with its limits made visible." />
      <AskNellaProfilePill />

      <AskNellaInfoCard>
        <View style={styles.guidanceTitleRow}>
          <View style={[styles.guidanceIcon, guidance.kind === 'boundary' && styles.guidanceIconBoundary]}><MaterialCommunityIcons color={guidance.kind === 'boundary' ? colors.warning : colors.actionPrimary} name={guidance.kind === 'boundary' ? 'shield-alert-outline' : 'lightbulb-on-outline'} size={22} /></View>
          <Text style={[askNellaTextStyles.cardTitle, styles.guidanceTitle]}>{guidance.title}</Text>
        </View>
        <Text style={askNellaTextStyles.cardBody}>{guidance.body}</Text>
      </AskNellaInfoCard>

      <AskNellaInfoCard tone="soft">
        <Text style={askNellaTextStyles.label}>Personalized from</Text>
        <Text style={askNellaTextStyles.cardBody}>{guidance.personalizedFrom.join(' · ')}</Text>
      </AskNellaInfoCard>

      <Pressable accessibilityHint="Opens general signs that may need clinical attention" accessibilityRole="button" onPress={() => router.push('/ask/care')} style={({ pressed }) => [styles.careLink, pressed && styles.pressed]}>
        <Text style={styles.disclaimer}>This is general guidance, not a diagnosis. Patch testing may help.</Text>
        <View style={styles.careLinkAction}><Text style={styles.careLinkText}>When care may be needed</Text><MaterialCommunityIcons color={colors.actionPrimary} name="arrow-right" size={18} /></View>
      </Pressable>

      <AskNellaAction disabled={Boolean(user && activeSession.savedToRecord)} label={!user ? 'Sign in to save guidance' : activeSession.savedToRecord ? `Saved to ${activeProfile.name}’s record` : `Save to ${activeProfile.name}’s record`} onPress={save} />
      <AskNellaAction label="Ask a follow-up" onPress={followUp} secondary />
      <Text style={styles.boundary}>{user ? 'Stored in encrypted local chat history for this profile. Cloud chat and PDF export are not connected.' : 'Guest guidance stays only in this in-memory session and disappears when the session ends.'}</Text>
    </AskNellaScreen>
  );
}

const styles = StyleSheet.create({
  guidanceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  guidanceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  guidanceIconBoundary: { backgroundColor: '#FFF0C2' },
  guidanceTitle: { flex: 1 },
  careLink: { minHeight: 76, borderRadius: 16, paddingVertical: 10, justifyContent: 'center', gap: 5 },
  disclaimer: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 12, lineHeight: 17 },
  careLinkAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  careLinkText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  boundary: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.68 },
});
