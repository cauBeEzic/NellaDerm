import { router } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, Text } from 'react-native';

import { AskNellaAction, AskNellaBullet, AskNellaHeading, AskNellaInfoCard, AskNellaProfilePill, AskNellaScreen, AskNellaTopBar, askNellaTextStyles } from '@/components/ask-nella-ui';
import { useAskNella } from '@/contexts/ask-nella-context';
import { useAuth } from '@/contexts/auth-context';
import { colors, font } from '@/theme';

const defaultReasons = ['The area is rapidly spreading', 'There is fever, pus, or increasing pain', 'Sleep or daily activity is seriously affected'];

export default function AskNellaCareScreen() {
  const { user } = useAuth();
  const { activeSession, markSavedToRecord } = useAskNella();
  const guidance = activeSession?.guidance;
  const emergency = guidance?.kind === 'emergency';
  const crisis = guidance?.safetyCategory === 'crisis';
  const reasons = guidance?.careReasons?.length ? guidance.careReasons : defaultReasons;

  const confirmCall = (number: '911' | '988') => {
    Alert.alert(`Call ${number}?`, number === '911' ? 'Use 911 for an immediate emergency.' : 'Call 988 for suicide crisis support in Canada or the United States.', [
      { text: 'Cancel', style: 'cancel' },
      { text: `Call ${number}`, onPress: () => { void Linking.openURL(`tel:${number}`); } },
    ]);
  };

  const contactCare = () => {
    Alert.alert('No care team is connected', 'Contact your own clinician, pharmacist, provincial or state health line, or local urgent-care service. MyEczema does not currently message a provider.');
  };

  const save = async () => {
    if (!user) {
      router.push('/sign-in');
      return;
    }
    try {
      await markSavedToRecord();
    } catch {
      Alert.alert('Could not save guidance', 'Your local chat history was not changed. Reload Ask Nella before trying again.');
    }
  };

  return (
    <AskNellaScreen>
      <AskNellaTopBar back />
      <AskNellaHeading title="When care may be needed" subtitle="A clear safety path, separate from shopping." />
      <AskNellaProfilePill />

      <AskNellaInfoCard tone="danger">
        <Text style={askNellaTextStyles.cardTitle}>{emergency ? guidance.title : 'Get medical help'}</Text>
        <Text style={askNellaTextStyles.cardBody}>{emergency ? guidance.body : 'These signs may need prompt clinical attention.'}</Text>
      </AskNellaInfoCard>

      <AskNellaInfoCard>
        <Text style={askNellaTextStyles.cardTitle}>{emergency ? 'Act now if' : 'Contact a clinician soon if'}</Text>
        {reasons.map((reason) => <AskNellaBullet key={reason} tone="danger">{reason}</AskNellaBullet>)}
      </AskNellaInfoCard>

      {emergency ? <AskNellaAction label="Call 911" onPress={() => confirmCall('911')} /> : <AskNellaAction label="Contact a clinician" onPress={contactCare} />}
      {crisis ? <AskNellaAction label="Call 988 crisis support" onPress={() => confirmCall('988')} secondary /> : <AskNellaAction disabled={Boolean(user && activeSession?.savedToRecord)} label={!user ? 'Sign in to save this guidance' : activeSession?.savedToRecord ? 'Guidance saved to record' : 'Save this guidance'} onPress={save} secondary />}
      {crisis && user ? <Pressable accessibilityRole="button" onPress={save} style={({ pressed }) => [styles.saveCrisis, pressed && styles.pressed]}><Text style={styles.saveCrisisText}>{activeSession?.savedToRecord ? 'Guidance saved to record' : 'Save this guidance'}</Text></Pressable> : null}

      <Text accessibilityRole="alert" style={styles.emergencyCopy}>{crisis ? 'If you or someone else is in immediate danger, call 911. In Canada or the U.S., call or text 988 for suicide crisis support.' : 'If there is trouble breathing or a severe allergic reaction, call 911.'}</Text>
      <Text style={styles.pendingCopy}>Demo safety copy pending clinical and legal approval. Ask Nella does not diagnose and no provider portal is connected.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/ask')} style={({ pressed }) => [styles.returnAction, pressed && styles.pressed]}><Text style={styles.returnActionText}>Return to Ask Nella</Text></Pressable>
    </AskNellaScreen>
  );
}

const styles = StyleSheet.create({
  emergencyCopy: { color: colors.error, fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
  pendingCopy: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 11, lineHeight: 17 },
  saveCrisis: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  saveCrisisText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  returnAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  returnActionText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  pressed: { opacity: 0.68 },
});
