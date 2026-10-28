import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '@/components/button';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { profileAreaChoices, profileSymptomChoices } from '@/lib/care-profile';
import {
  canContinue,
  emptyOnboardingDraft,
  stepsForSubject,
  type OnboardingDraft,
  type OnboardingStep,
  type SubjectChoice,
} from '@/lib/onboarding';
import {
  completeOnboarding,
  hasCompletedOnboarding,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from '@/lib/onboarding-storage';
import { safeReturnTo } from '@/lib/return-to';
import { colors, font, radius, size, spacing } from '@/theme';

type ChoiceProps = {
  description?: string;
  label: string;
  onPress: () => void;
  selected: boolean;
};

function Choice({ description, label, onPress, selected }: ChoiceProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceLabel}>{label}</Text>
        {description ? <Text style={styles.choiceDescription}>{description}</Text> : null}
      </View>
      <MaterialCommunityIcons color={selected ? colors.actionPrimary : colors.borderStrong} name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={24} />
    </Pressable>
  );
}

function Chip({ label, onPress, selected }: Omit<ChoiceProps, 'description'>) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function toggle(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function StepContent({ draft, setDraft, step }: {
  draft: OnboardingDraft;
  setDraft: (next: OnboardingDraft) => void;
  step: OnboardingStep;
}) {
  const update = <Key extends keyof OnboardingDraft>(key: Key, value: OnboardingDraft[Key]) => {
    setDraft({ ...draft, [key]: value });
  };

  if (step === 'subject') {
    const choices: { value: SubjectChoice; label: string; description: string }[] = [
      { value: 'self', label: 'Myself', description: 'Track my own skin, routines, and progress.' },
      { value: 'caregiver', label: 'Someone I care for', description: 'Keep their information separate and easy to follow.' },
      { value: 'both', label: 'Both', description: 'Set up my profile and one for someone I care for.' },
    ];
    return <View accessibilityRole="radiogroup" style={styles.stack}>{choices.map((choice) => <Choice key={choice.value} {...choice} onPress={() => update('subject', choice.value)} selected={draft.subject === choice.value} />)}</View>;
  }

  if (step === 'dependent') {
    return (
      <View style={styles.stack}>
        <TextField autoCapitalize="words" label="Their first name or nickname" onChangeText={(value) => update('dependentName', value)} placeholder="For example, Maya" value={draft.dependentName} />
        <Text style={styles.fieldLabel}>Your relationship</Text>
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {['Parent or guardian', 'Partner', 'Family member', 'Other'].map((value) => <Chip key={value} label={value} onPress={() => update('relationship', value)} selected={draft.relationship === value} />)}
        </View>
        <Text style={styles.fieldLabel}>Their age range</Text>
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {['0–5', '6–12', '13–15', '16–17', '18+'].map((value) => <Chip key={value} label={value} onPress={() => update('ageRange', value)} selected={draft.ageRange === value} />)}
        </View>
      </View>
    );
  }

  if (step === 'check-in-owner') {
    return (
      <View accessibilityRole="radiogroup" style={styles.stack}>
        <Choice description="I usually record how things are going." label="I do" onPress={() => update('checkInOwner', 'me')} selected={draft.checkInOwner === 'me'} />
        <Choice description="They usually answer for themselves." label="They do" onPress={() => update('checkInOwner', 'dependent')} selected={draft.checkInOwner === 'dependent'} />
        <Choice description="We usually complete check-ins together." label="We do it together" onPress={() => update('checkInOwner', 'together')} selected={draft.checkInOwner === 'together'} />
      </View>
    );
  }

  if (step === 'areas') {
    return (
      <View style={styles.stack}>
        <Text style={styles.fieldLabel}>Areas you want to follow</Text>
        <View style={styles.chips}>{profileAreaChoices.map((value) => <Chip key={value} label={value} onPress={() => update('areas', toggle(draft.areas, value))} selected={draft.areas.includes(value)} />)}</View>
        <Text style={[styles.fieldLabel, styles.groupGap]}>Symptoms you want to follow</Text>
        <View style={styles.chips}>{profileSymptomChoices.map((value) => <Chip key={value} label={value} onPress={() => update('symptoms', toggle(draft.symptoms, value))} selected={draft.symptoms.includes(value)} />)}</View>
      </View>
    );
  }

  if (step === 'product') {
    return (
      <View style={styles.stack}>
        <TextField autoCapitalize="sentences" label="Product name" onChangeText={(value) => update('firstProduct', value)} placeholder="For example, fragrance-free moisturizer" value={draft.firstProduct} />
        <View style={styles.tip}>
          <MaterialCommunityIcons color={colors.actionPrimary} name="information-outline" size={22} />
          <Text style={styles.tipText}>You can add products and build a routine later. MyEczema does not recommend or prescribe a product here.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.privacyCard}>
        <MaterialCommunityIcons color={colors.actionPrimary} name="shield-lock-outline" size={28} />
        <View style={styles.privacyCopy}><Text style={styles.privacyTitle}>Your information stays private</Text><Text style={styles.privacyBody}>Your account and saved records are protected. Health information is never public.</Text></View>
      </View>
      <View style={styles.privacyCard}>
        <MaterialCommunityIcons color={colors.actionPrimary} name="account-multiple-outline" size={28} />
        <View style={styles.privacyCopy}><Text style={styles.privacyTitle}>Profiles stay separate</Text><Text style={styles.privacyBody}>Each person has their own check-ins, routines, photographs, and history.</Text></View>
      </View>
      <View style={styles.privacyCard}>
        <MaterialCommunityIcons color={colors.actionPrimary} name="camera-off-outline" size={28} />
        <View style={styles.privacyCopy}><Text style={styles.privacyTitle}>Keep photographs appropriate</Text><Text style={styles.privacyBody}>Private-area photographs are not allowed. You stay in control of what you add.</Text></View>
      </View>
      <Text style={styles.privacyFootnote}>This demo stores onboarding choices securely on this device. Cloud profile sync will be added with the authenticated profile API.</Text>
    </View>
  );
}

const copy: Record<OnboardingStep, { title: string; subtitle: string }> = {
  subject: { title: 'Who are you setting up?', subtitle: 'You can keep each person’s information separate.' },
  dependent: { title: 'Tell us about them', subtitle: 'Use the name that feels most familiar to you.' },
  'check-in-owner': { title: 'Who usually answers check-ins?', subtitle: 'We’ll use this to make questions feel natural.' },
  areas: { title: 'What would you like to track?', subtitle: 'Choose any that apply, or skip for now.' },
  product: { title: 'Add a first product', subtitle: 'This is optional. You can build the routine later.' },
  privacy: { title: 'Your privacy choices', subtitle: 'A quick summary before your space is ready.' },
};

export default function OnboardingScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnTo(params.returnTo);
  const { loading: authLoading, user, syntheticDemo, signOutUser } = useAuth();
  const [draft, setDraft] = useState<OnboardingDraft>(emptyOnboardingDraft);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const steps = useMemo(() => stepsForSubject(draft.subject), [draft.subject]);
  const step = steps[Math.min(stepIndex, steps.length - 1)];

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/sign-in');
      return;
    }
    void (async () => {
      if (await hasCompletedOnboarding(user.userId)) {
        router.replace(returnTo ?? '/(tabs)');
        return;
      }
      setDraft(await loadOnboardingDraft(user.userId));
      setLoading(false);
    })();
  }, [authLoading, returnTo, user]);

  async function next() {
    if (!user || !canContinue(step, draft)) return;
    setBusy(true);
    try {
      if (step === 'privacy') {
        await completeOnboarding(user.userId, draft);
        router.replace(returnTo ?? '/(tabs)');
        return;
      }
      await saveOnboardingDraft(user.userId, draft);
      setStepIndex((value) => Math.min(value + 1, steps.length - 1));
    } catch {
      Alert.alert('Could not save your progress', 'Your choices are still on this screen. Try again when you are ready.');
    } finally {
      setBusy(false);
    }
  }

  async function back() {
    if (stepIndex === 0 && syntheticDemo) {
      if (busy) return;
      setBusy(true);
      try {
        await signOutUser();
        router.replace('/sign-in');
      } catch {
        Alert.alert('Could not leave demo', 'Try again after any pending save or file cleanup finishes.');
      } finally { setBusy(false); }
      return;
    }
    if (stepIndex === 0) router.back();
    else setStepIndex((value) => value - 1);
  }

  if (authLoading || loading) {
    return <SafeAreaView style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.loadingText}>Preparing your private space…</Text></SafeAreaView>;
  }

  const currentCopy = copy[step];
  const optional = step === 'areas' || step === 'product';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <SecondaryButton disabled={busy} label={stepIndex === 0 && syntheticDemo ? 'Choose demo' : 'Back'} onPress={back} quiet />
        <Text accessibilityLabel={`Step ${stepIndex + 1} of ${steps.length}`} style={styles.progress}>{stepIndex + 1} of {steps.length}</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((stepIndex + 1) / steps.length) * 100}%` }]} /></View>
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>{currentCopy.title}</Text>
          <Text style={styles.subtitle}>{currentCopy.subtitle}</Text>
        </View>
        <StepContent draft={draft} setDraft={setDraft} step={step} />
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton disabled={busy || !canContinue(step, draft)} label={busy ? 'Saving…' : step === 'privacy' ? 'Finish setup' : optional ? 'Continue' : 'Continue'} onPress={next} />
        {optional ? <SecondaryButton label="Skip for now" onPress={next} quiet /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.canvas },
  loadingText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14 },
  header: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', minHeight: 52, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSpacer: { width: 64 },
  progress: { color: colors.textSecondary, fontFamily: font.semibold, fontSize: 13 },
  progressTrack: { height: 3, backgroundColor: colors.borderDefault },
  progressFill: { height: 3, backgroundColor: colors.actionPrimary },
  content: { flexGrow: 1, width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  heading: { alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.xl },
  title: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 26, lineHeight: 34, textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: spacing.xs },
  stack: { gap: spacing.md },
  choice: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.card, backgroundColor: colors.surface },
  choiceSelected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  choiceCopy: { flex: 1 },
  choiceLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  choiceDescription: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginTop: 2 },
  pressed: { opacity: 0.72 },
  fieldLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14 },
  groupGap: { marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: size.iosTouchTarget, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.pill, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  chipLabel: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13 },
  chipLabelSelected: { color: colors.actionPrimary, fontFamily: font.semibold },
  tip: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', padding: spacing.md, borderRadius: radius.card, backgroundColor: colors.surfaceBrandSoft },
  tipText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  privacyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md, borderRadius: radius.card, backgroundColor: colors.surface },
  privacyCopy: { flex: 1 },
  privacyTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  privacyBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19, marginTop: spacing.xxs },
  privacyFootnote: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: spacing.sm },
  footer: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', gap: spacing.xs, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md, backgroundColor: colors.canvas },
});
