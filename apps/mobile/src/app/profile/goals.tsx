import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/button';
import { HelpPreferenceOptions } from '@/components/help-preference-options';
import { ProfileDetailScreen } from '@/components/profile-ui';
import { useAuth } from '@/contexts/auth-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { useProfiles } from '@/contexts/profile-context';
import type { CareProfile, HelpPreference } from '@/lib/care-profile';
import { colors, font, size } from '@/theme';

function CareGoalForm({ afterCheckIn, profile }: { afterCheckIn: boolean; profile: CareProfile }) {
  const { saveHelpPreference } = useProfiles();
  const [preference, setPreference] = useState<HelpPreference | undefined>(profile.helpPreference);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const focusedRef = useRef(false);
  const savingRef = useRef(false);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    return () => { focusedRef.current = false; };
  }, []));

  async function save() {
    if (!preference || savingRef.current || !focusedRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await saveHelpPreference(profile.id, preference);
      if (!focusedRef.current) return;
      if (afterCheckIn) router.replace('/check-in/saved');
      else if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/profile');
    } catch {
      if (focusedRef.current) setError('Your care goal was not saved. Try again or reload profiles from Profile.');
    } finally {
      savingRef.current = false;
      if (focusedRef.current) setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.heading}>{profile.type === 'self' ? 'What would help you most right now?' : `What would help most with ${profile.name}’s care?`}</Text>
        <Text style={styles.body}>{profile.type === 'self' ? `Pick one for ${profile.name}. Your other features stay available.` : 'Pick one. Your other features stay available.'}</Text>
        {afterCheckIn ? <Text style={styles.saved}>Your check-in is saved on this device.</Text> : null}
      </View>
      <HelpPreferenceOptions disabled={saving} onChange={setPreference} profile={profile} value={preference} />
      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      <PrimaryButton disabled={!preference || saving} label={saving ? 'Saving goal…' : afterCheckIn ? 'Continue' : 'Save goal'} onPress={() => void save()} />
      <Text style={styles.footer}>This preference stays on this device. You can change it anytime in Profile.</Text>
    </ScrollView>
  );
}

export default function CareGoalsScreen() {
  const params = useLocalSearchParams<{ source?: string | string[] }>();
  const { loading: authLoading, user } = useAuth();
  const { activeProfile, error, loading, retry } = useProfiles();
  const { error: checkInError, loading: checkInLoading, state } = useCheckIn();
  const checkInSource = params.source === 'check-in';

  if (authLoading || (user && (loading || (checkInSource && checkInLoading && !error)))) {
    return <ProfileDetailScreen title="Care goals"><View style={styles.state}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.body}>Opening care goals…</Text></View></ProfileDetailScreen>;
  }

  if (!user) {
    return (
      <ProfileDetailScreen title="Care goals">
        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.heading}>Sign in to save a care goal</Text>
          <Text style={styles.body}>Care goals belong to a signed-in care profile. Guest preview does not save health preferences.</Text>
          <PrimaryButton label="Sign in" onPress={() => router.push('/sign-in')} />
        </View>
      </ProfileDetailScreen>
    );
  }

  if (error || activeProfile.isDemo) {
    return (
      <ProfileDetailScreen title="Care goals">
        <View accessibilityRole="alert" style={styles.content}>
          <Text accessibilityRole="header" style={styles.heading}>Care goals are unavailable</Text>
          <Text style={styles.body}>{error ?? 'Reload profiles before saving a care goal.'}</Text>
          <PrimaryButton label="Reload profiles" onPress={retry} />
        </View>
      </ProfileDetailScreen>
    );
  }

  return (
    <ProfileDetailScreen title="Care goals">
      <CareGoalForm afterCheckIn={checkInSource && Boolean(state.entry) && !checkInError} key={`${user.userId}:${activeProfile.id}`} profile={activeProfile} />
    </ProfileDetailScreen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 16 },
  intro: { gap: 12 },
  heading: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 24, lineHeight: 32 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  saved: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 19 },
  footer: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  state: { minHeight: 180, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: colors.error, fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
});
