import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CheckInFlowLayout } from '@/components/check-in-flow-layout';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { comparisonOptions, draftUpdatedTimeLabel, type CheckInComparison } from '@/lib/check-in';
import { colors, font, radius, spacing } from '@/theme';

const icons: Record<CheckInComparison, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  better: 'emoticon-happy-outline',
  same: 'emoticon-neutral-outline',
  worse: 'weather-cloudy-alert',
};

export default function ChooseCheckInScreen() {
  const { user } = useAuth();
  const { profile } = useCare();
  const { acknowledgeRestoredDraft, beginDraft, canWrite, discardDraft, error, loading, offline, restoredDraftPending, retry, setComparison, state } = useCheckIn();
  const [saving, setSaving] = useState(false);
  const selected = state.draft?.comparison;

  async function choose(value: CheckInComparison) {
    if (!canWrite) return;
    setSaving(true);
    try {
      if (state.draft) await setComparison(value);
      else await beginDraft(value);
    } catch {
      Alert.alert('Could not save draft', 'Your answer was not saved on this device. Reload and try again.');
    } finally {
      setSaving(false);
    }
  }

  function close() {
    if (!state.draft) {
      router.replace('/(tabs)');
      return;
    }
    Alert.alert('Leave check-in?', 'Your draft is saved on this device.', [
      { text: 'Keep draft', onPress: () => router.replace('/(tabs)') },
      {
        text: 'Discard draft',
        style: 'destructive',
        onPress: () => void discardDraft()
          .then(() => router.replace('/(tabs)'))
          .catch(() => Alert.alert('Could not discard draft', 'The saved draft is still on this device. Reload and try again.')),
      },
      { text: 'Keep editing', style: 'cancel' },
    ]);
  }

  if (loading) return <Loading />;
  if (!user || profile.isDemo) return <AccountGate />;
  if (error) return <Unavailable message={error} onRetry={retry} />;
  if (state.draft && restoredDraftPending) {
    const updatedAt = draftUpdatedTimeLabel(state.draft.updatedAt);
    return (
      <CheckInFlowLayout status={`${profile.name} · private device draft`} title="Draft restored">
        <View style={styles.restoredIntro}>
          <Text accessibilityRole="header" style={styles.heading}>Your check-in draft is safe</Text>
          <Text style={styles.body}>MyEczema found work saved on this device after the check-in was interrupted.</Text>
        </View>
        <View accessibilityRole="alert" style={styles.restoredFeedback}>
          <MaterialCommunityIcons color={colors.actionPrimary} name="backup-restore" size={24} />
          <View style={styles.restoredFeedbackCopy}>
            <Text style={styles.restoredFeedbackTitle}>Saved for {profile.name}</Text>
            <Text style={styles.restoredFeedbackBody}>Private device draft · nothing was uploaded</Text>
          </View>
        </View>
        <View style={styles.restoredCard}>
          <Text style={styles.restoredCardTitle}>Your check-in is ready</Text>
          <Text style={styles.body}>It was saved on this device at {updatedAt}. Review it before adding it to {profile.name}’s record.</Text>
        </View>
        <View style={styles.restoredActions}>
          <PrimaryButton label="Review draft" onPress={() => {
            acknowledgeRestoredDraft();
            router.replace(state.draft?.comparison ? '/check-in/quick' : '/check-in');
          }} />
          <SecondaryButton label="Discard draft" onPress={() => Alert.alert(
            'Discard saved draft?',
            'This removes the unsaved check-in from this device. Your existing history will not change.',
            [
              { text: 'Keep draft', style: 'cancel' },
              {
                text: 'Discard',
                style: 'destructive',
                onPress: () => void discardDraft()
                  .then(() => router.replace('/(tabs)'))
                  .catch(() => Alert.alert('Could not discard draft', 'The saved draft is still on this device. Reload and try again.')),
              },
            ],
          )} />
        </View>
      </CheckInFlowLayout>
    );
  }

  const status = state.draft ? `${profile.name} · ${offline ? 'offline, draft saved on this device' : 'draft saved on this device'}` : `${profile.name} · not saved`;

  return (
    <CheckInFlowLayout onClose={close} status={status} title="Daily check-in">
      <View style={styles.intro}>
        <Text style={styles.heading}>How’s your skin compared with usual today?</Text>
        <Text style={styles.body}>A quick check-in helps build your history over time.</Text>
      </View>
      <View accessibilityRole="radiogroup" style={styles.options}>
        {comparisonOptions.map((option) => {
          const isSelected = selected === option.value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              disabled={saving}
              key={option.value}
              onPress={() => void choose(option.value)}
              style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, pressed && styles.pressed]}>
              <View style={[styles.optionIcon, isSelected && styles.optionIconSelected]}>
                <MaterialCommunityIcons color={isSelected ? colors.onActionPrimary : option.value === 'better' ? colors.actionPrimary : colors.textSecondary} name={icons[option.value]} size={25} />
              </View>
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{option.label}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
              </View>
              <View style={[styles.check, isSelected && styles.checkSelected]}>
                {isSelected ? <MaterialCommunityIcons color={colors.onActionPrimary} name="check" size={18} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.footer}>
        <View style={styles.helper}>
          <MaterialCommunityIcons color={colors.textSecondary} name="information-outline" size={18} />
          <Text style={styles.helperText}>{selected ? 'Add only the details that feel relevant.' : 'Choose an answer to continue.'}</Text>
        </View>
        <PrimaryButton disabled={!selected || saving} label={saving ? 'Saving draft…' : 'Continue'} onPress={() => router.push('/check-in/quick')} />
      </View>
    </CheckInFlowLayout>
  );
}

function Loading() {
  return <View style={styles.center}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.body}>Opening your check-in…</Text></View>;
}

function AccountGate() {
  return (
    <CheckInFlowLayout title="Daily check-in">
      <View style={styles.gateIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="account-lock-outline" size={32} /></View>
      <Text style={styles.heading}>Sign in to record a check-in</Text>
      <Text style={styles.body}>Guest mode does not store health observations. Sign in to keep each profile’s check-ins separate.</Text>
      <PrimaryButton label="Sign in" onPress={() => router.push('/sign-in')} />
      <SecondaryButton label="Return to Today" onPress={() => router.replace('/(tabs)')} quiet />
    </CheckInFlowLayout>
  );
}

function Unavailable({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <CheckInFlowLayout title="Daily check-in">
      <View style={styles.gateIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="cloud-alert-outline" size={32} /></View>
      <Text style={styles.heading}>Check-in data is unavailable</Text>
      <Text style={styles.body}>{message}</Text>
      <PrimaryButton label="Reload check-in" onPress={onRetry} />
      <SecondaryButton label="Return to Today" onPress={() => router.replace('/(tabs)')} quiet />
    </CheckInFlowLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.canvas },
  intro: { gap: 6 },
  heading: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 22, lineHeight: 30 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  options: { gap: 12 },
  option: { minHeight: 112, padding: 20, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent' },
  optionSelected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  optionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  optionIconSelected: { backgroundColor: colors.actionPrimary },
  optionCopy: { flex: 1, gap: 4 },
  optionTitle: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 16, lineHeight: 22 },
  optionDescription: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  check: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  checkSelected: { backgroundColor: colors.actionPrimary },
  helper: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  helperText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  footer: { gap: 8 },
  restoredIntro: { gap: 6 },
  restoredFeedback: { minHeight: 112, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.surfaceBrandSoft, borderWidth: 1, borderColor: colors.focus },
  restoredFeedbackCopy: { flex: 1, gap: 6 },
  restoredFeedbackTitle: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 17, lineHeight: 24 },
  restoredFeedbackBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  restoredCard: { borderRadius: 18, padding: 18, gap: 10, backgroundColor: colors.surface },
  restoredCardTitle: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 17, lineHeight: 24 },
  restoredActions: { gap: 12 },
  gateIcon: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  pressed: { opacity: 0.68 },
});
