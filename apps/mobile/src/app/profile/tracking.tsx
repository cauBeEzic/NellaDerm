import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActiveProfileBar } from '@/components/active-profile-bar';
import { PrimaryButton } from '@/components/button';
import { MultiChoiceRow } from '@/components/care-form';
import { ProfileDetailScreen } from '@/components/profile-ui';
import { useAuth } from '@/contexts/auth-context';
import { useProfiles } from '@/contexts/profile-context';
import { profileAreaChoices, profileSymptomChoices, type CareProfile } from '@/lib/care-profile';
import { colors, font, radius, size } from '@/theme';

function TrackingForm({ profile }: { profile: CareProfile }) {
  const { saveTrackingPreferences } = useProfiles();
  const [areas, setAreas] = useState(profile.areas);
  const [symptoms, setSymptoms] = useState(profile.symptoms);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const focusedRef = useRef(false);
  const savingRef = useRef(false);
  const focusGenerationRef = useRef(0);
  // Keep previously stored choices visible and removable rather than silently dropping them.
  const areaChoices = [...new Set([...profileAreaChoices, ...profile.areas])];
  const symptomChoices = [...new Set([...profileSymptomChoices, ...profile.symptoms])];

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    return () => { focusedRef.current = false; focusGenerationRef.current += 1; };
  }, []));

  async function save() {
    if (savingRef.current || !focusedRef.current) return;
    const focusGeneration = focusGenerationRef.current;
    savingRef.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await saveTrackingPreferences(profile.id, { areas, symptoms });
      if (!focusedRef.current || focusGenerationRef.current !== focusGeneration) return;
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/profile');
    } catch {
      if (focusedRef.current && focusGenerationRef.current === focusGeneration) setError('Your tracking preferences were not saved. Reload profiles from Profile before trying again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ActiveProfileBar />
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.heading}>Choose what to follow</Text>
        <Text style={styles.body}>Both groups are optional. Select any that apply to {profile.name}, or leave them empty.</Text>
      </View>
      <View style={styles.group}>
        <Text accessibilityRole="header" style={styles.groupTitle}>{profile.type === 'self' ? 'Where does eczema usually affect you?' : `Where does eczema usually affect ${profile.name}?`}</Text>
        <MultiChoiceRow choices={areaChoices} disabled={saving} labelFor={(value) => value.trim() || 'Unlabelled saved area'} onChange={setAreas} values={areas} />
      </View>
      <View style={styles.symptomGroup}>
        <Text accessibilityRole="header" style={styles.groupTitle}>{profile.type === 'self' ? 'What tends to bother you most?' : `What tends to bother ${profile.name} most?`}</Text>
        <Text style={styles.body}>Optional — pick any that apply.</Text>
        <MultiChoiceRow choices={symptomChoices} disabled={saving} labelFor={(value) => value.trim() || 'Unlabelled saved symptom'} onChange={setSymptoms} values={symptoms} />
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      <PrimaryButton disabled={saving} label={saving ? 'Saving preferences…' : 'Save preferences'} onPress={() => void save()} />
      <Text style={styles.footer}>These preferences stay on this device. They do not change past check-ins. You can edit them anytime in Profile.</Text>
    </ScrollView>
  );
}

export default function ProfileTrackingScreen() {
  const { loading: authLoading, user } = useAuth();
  const { activeProfile, error, loading, retry } = useProfiles();

  if (authLoading || (user && loading)) {
    return <ProfileDetailScreen title="Tracking preferences"><View style={styles.state}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.body}>Opening tracking preferences…</Text></View></ProfileDetailScreen>;
  }

  if (!user) {
    return (
      <ProfileDetailScreen title="Tracking preferences">
        <View style={styles.content}>
          <Text accessibilityRole="header" style={styles.heading}>Sign in to save tracking preferences</Text>
          <Text style={styles.body}>Common areas and typical symptoms belong to a signed-in care profile. Guest preview does not save health preferences.</Text>
          <PrimaryButton label="Sign in" onPress={() => router.push('/sign-in')} />
        </View>
      </ProfileDetailScreen>
    );
  }

  if (error || activeProfile.isDemo) {
    return (
      <ProfileDetailScreen title="Tracking preferences">
        <View accessibilityRole="alert" style={styles.content}>
          <Text accessibilityRole="header" style={styles.heading}>Tracking preferences are unavailable</Text>
          <Text style={styles.body}>{error ?? 'Reload profiles before saving tracking preferences.'}</Text>
          <PrimaryButton label="Reload profiles" onPress={retry} />
        </View>
      </ProfileDetailScreen>
    );
  }

  return <ProfileDetailScreen title="Tracking preferences"><TrackingForm key={`${user.userId}:${activeProfile.id}`} profile={activeProfile} /></ProfileDetailScreen>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 28, gap: 24 },
  intro: { gap: 12 },
  heading: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 24, lineHeight: 32 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  group: { gap: 12 },
  symptomGroup: { padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, gap: 12 },
  groupTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 26 },
  footer: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  state: { minHeight: 180, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: colors.error, fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
});
