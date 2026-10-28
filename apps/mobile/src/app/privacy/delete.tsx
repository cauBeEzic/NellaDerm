import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/button';
import { ProfileDetailScreen } from '@/components/profile-ui';
import { PrivacyNotice, PrivacySignInGate } from '@/components/privacy-ui';
import { useAuth } from '@/contexts/auth-context';
import { useProfiles } from '@/contexts/profile-context';
import {
  NELLADERM_SUPPORT_EMAIL,
  buildDeletionSupportUrl,
  deletionRetentionRows,
  deletionTargetLabel,
  isDeletionRequestReady,
  parseDeletionTarget,
} from '@/lib/privacy';
import { colors, font, radius, size } from '@/theme';

function ConfirmationRow({ bordered = false, checked, label, onPress }: { bordered?: boolean; checked: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={({ pressed }) => [styles.confirmation, bordered && styles.rowBorder, pressed && styles.pressed]}>
      <MaterialCommunityIcons color={checked ? colors.actionPrimary : colors.borderStrong} name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={25} />
      <Text style={styles.confirmationText}>{label}</Text>
    </Pressable>
  );
}

export default function DeleteRequestScreen() {
  const params = useLocalSearchParams<{ target?: string | string[] }>();
  const { user } = useAuth();
  const { activeProfile } = useProfiles();
  const requestedTarget = parseDeletionTarget(params.target);
  const target = requestedTarget === 'profile' && activeProfile.type === 'dependent' ? 'profile' : 'account';
  const [acknowledgedConsequences, setAcknowledgedConsequences] = useState(false);
  const [acknowledgedRetention, setAcknowledgedRetention] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const ready = isDeletionRequestReady(acknowledgedConsequences, acknowledgedRetention, phrase);
  const targetLabel = deletionTargetLabel(target, activeProfile.name);
  const mailUrl = useMemo(() => user ? buildDeletionSupportUrl({ accountUsername: user.username, profileName: activeProfile.name, target }) : '', [activeProfile.name, target, user]);

  async function openSupportRequest() {
    try {
      await Linking.openURL(mailUrl);
      Alert.alert('Finish in your email app', `Send the prepared message from the email associated with MyEczema. Opening the draft did not submit a request, and ${target === 'account' ? 'your account' : `${activeProfile.name}’s profile`} remains active until NellaDerm support verifies it.`);
    } catch {
      Alert.alert('Email app unavailable', `Email ${NELLADERM_SUPPORT_EMAIL} from your account address and ask to delete ${targetLabel}. No request has been submitted from this app.`);
    }
  }

  if (!user) {
    return (
      <ProfileDetailScreen title="Deletion request">
        <PrivacySignInGate
          body="Support must verify the request against the mobile account. Guest activity does not create a deletable account."
          danger
          icon="account-lock-outline"
          title="Sign in before requesting deletion"
        />
      </ProfileDetailScreen>
    );
  }

  return (
    <ProfileDetailScreen title={target === 'account' ? 'Delete account' : 'Remove profile'}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!reviewing ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}><MaterialCommunityIcons color={colors.error} name={target === 'account' ? 'account-remove-outline' : 'account-cancel-outline'} size={30} /></View>
              <Text accessibilityRole="header" style={styles.title}>Request deletion of {targetLabel}</Text>
              <Text style={styles.body}>This is a support-mediated request. It is not an instant delete, and confirmation here does not remove data.</Text>
            </View>

            <PrivacyNotice danger icon="alert-outline">Export anything you want to keep first. When support verifies an account request, new writes and sign-in will be disabled as the approved deletion process begins.</PrivacyNotice>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>What happens next</Text>
              <View style={styles.steps}>
                {[
                  'You review and prepare the request in MyEczema.',
                  `You send it to ${NELLADERM_SUPPORT_EMAIL} from your account email.`,
                  'NellaDerm support verifies your identity and the requested scope.',
                  'After verification, support begins the grace, lock, purge, and confirmation process.',
                ].map((step, index) => <View key={step} style={styles.step}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View><Text style={styles.stepText}>{step}</Text></View>)}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Working retention schedule</Text>
              <Text style={styles.sectionBody}>These are technical defaults pending production legal and privacy approval for Canada and the United States.</Text>
              <View style={styles.retentionGroup}>
                {deletionRetentionRows.map((row, index) => <View key={row.label} style={[styles.retentionRow, index > 0 && styles.rowBorder]}><MaterialCommunityIcons color={colors.actionPrimary} name="clock-outline" size={21} /><View style={styles.retentionCopy}><Text style={styles.retentionTitle}>{row.label}</Text><Text style={styles.retentionDetail}>{row.detail}</Text></View></View>)}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Confirm before review</Text>
              <View style={styles.confirmationGroup}>
                <ConfirmationRow checked={acknowledgedConsequences} label={`I understand this request is for ${targetLabel} and may remove associated records${target === 'account' ? ', photos, local history, reminders, orders, and shipment subscriptions' : ''}.`} onPress={() => setAcknowledgedConsequences((value) => !value)} />
                <ConfirmationRow bordered checked={acknowledgedRetention} label="I understand minimum records may be retained when legally required, and that production retention language still requires approval." onPress={() => setAcknowledgedRetention((value) => !value)} />
              </View>
              <Text style={styles.inputLabel}>Type DELETE to continue</Text>
              <TextInput
                accessibilityLabel="Type DELETE to continue"
                autoCapitalize="characters"
                autoCorrect={false}
                onChangeText={setPhrase}
                placeholder="DELETE"
                placeholderTextColor={colors.borderStrong}
                style={styles.input}
                value={phrase}
              />
            </View>

            <SecondaryButton label="Export data first" onPress={() => router.push('/export')} />
            <PrimaryButton disabled={!ready} label="Review support request" onPress={() => setReviewing(true)} />
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}><MaterialCommunityIcons color={colors.error} name="email-alert-outline" size={30} /></View>
              <Text accessibilityRole="header" style={styles.title}>Ready to start the support request</Text>
              <Text style={styles.body}>MyEczema will open a pre-addressed email. Review and send it from <Text style={styles.emphasis}>{user.username}</Text> so support can begin identity verification.</Text>
            </View>

            <View style={styles.reviewCard}>
              <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Request</Text><Text style={styles.reviewValue}>{target === 'account' ? 'Delete mobile account' : `Remove ${activeProfile.name}’s profile`}</Text></View>
              <View style={[styles.reviewRow, styles.rowBorder]}><Text style={styles.reviewLabel}>To</Text><Text style={styles.reviewValue}>{NELLADERM_SUPPORT_EMAIL}</Text></View>
              <View style={[styles.reviewRow, styles.rowBorder]}><Text style={styles.reviewLabel}>Status</Text><Text style={[styles.reviewValue, styles.notSubmitted]}>Not submitted</Text></View>
            </View>

            <PrivacyNotice danger icon="email-outline">Opening the email draft does not submit a request. The account and profile stay active until support receives the message, verifies identity, and confirms the next step.</PrivacyNotice>
            <SecondaryButton label="Back to confirmation" onPress={() => setReviewing(false)} />
            <Pressable accessibilityRole="button" onPress={() => void openSupportRequest()} style={({ pressed }) => [styles.destructiveButton, pressed && styles.destructivePressed]}><MaterialCommunityIcons color={colors.onActionPrimary} name="email-outline" size={20} /><Text style={styles.destructiveLabel}>Open email to support</Text></Pressable>
          </>
        )}
      </ScrollView>
    </ProfileDetailScreen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 44, gap: 20 },
  hero: { borderRadius: 18, padding: 20, gap: 9, backgroundColor: colors.surface },
  heroIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorSurface },
  title: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 22, lineHeight: 30 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  emphasis: { color: colors.textPrimary, fontFamily: font.semibold },
  section: { gap: 10 },
  sectionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  sectionBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  steps: { borderRadius: 18, padding: 16, gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNumber: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  stepNumberText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 12 },
  stepText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  retentionGroup: { overflow: 'hidden', borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  retentionRow: { minHeight: 86, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  retentionCopy: { flex: 1, gap: 3 },
  retentionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 19 },
  retentionDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDefault },
  confirmationGroup: { overflow: 'hidden', borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  confirmation: { minHeight: 78, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  confirmationText: { flex: 1, color: colors.textPrimary, fontFamily: font.regular, fontSize: 12, lineHeight: 19 },
  inputLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 52, borderRadius: radius.control, borderWidth: 1, borderColor: colors.borderDefault, paddingHorizontal: 15, color: colors.textPrimary, backgroundColor: colors.surface, fontFamily: font.semibold, fontSize: 15, letterSpacing: 1 },
  reviewCard: { overflow: 'hidden', borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  reviewRow: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 12, gap: 4 },
  reviewLabel: { color: colors.textSecondary, fontFamily: font.semibold, fontSize: 11, lineHeight: 16, textTransform: 'uppercase' },
  reviewValue: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 13, lineHeight: 20 },
  notSubmitted: { color: colors.error },
  destructiveButton: { minHeight: size.primaryButtonHeight, borderRadius: radius.pill, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.error },
  destructivePressed: { opacity: 0.8 },
  destructiveLabel: { color: colors.onActionPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  pressed: { opacity: 0.68 },
});
