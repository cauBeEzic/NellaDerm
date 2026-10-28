import { router, useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActiveProfileBar } from '@/components/active-profile-bar';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { ProfileDetailScreen } from '@/components/profile-ui';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { useProfiles } from '@/contexts/profile-context';
import { profileAgeRanges, type CareProfile } from '@/lib/care-profile';
import { applyProfileDetails, MAX_PROFILE_DETAIL_LENGTH, ProfileDetailsValidationError, type ProfileDetailsEdit } from '@/lib/profile-details';
import { colors, font, radius, size } from '@/theme';

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/profile');
}

function PersonalDetailsForm({ identifier, profile }: { identifier: string; profile: CareProfile }) {
  const { savePersonalDetails } = useProfiles();
  const [baseline, setBaseline] = useState(profile);
  const [name, setName] = useState(profile.name);
  const [relationship, setRelationship] = useState(profile.relationship ?? '');
  const [ageRange, setAgeRange] = useState(profile.ageRange ?? '');
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState<ProfileDetailsValidationError>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const mountedRef = useRef(false);
  const focusedRef = useRef(false);
  const generationRef = useRef(0);
  const savingRef = useRef(false);
  const dependent = profile.type === 'dependent';
  const hasEdits = name.trim() !== baseline.name
    || (dependent && (relationship.trim() !== baseline.relationship || ageRange !== baseline.ageRange));
  // Adopt external metadata before committing a pristine view; never replace an unsaved edit.
  if (!saving && !hasEdits && baseline !== profile) {
    setBaseline(profile); setName(profile.name); setRelationship(profile.relationship ?? ''); setAgeRange(profile.ageRange ?? '');
  }

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; focusedRef.current = false; generationRef.current += 1; };
  }, []);
  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') generationRef.current += 1; });
    return () => { focusedRef.current = false; generationRef.current += 1; subscription.remove(); };
  }, []));

  async function save() {
    if (savingRef.current || !focusedRef.current || AppState.currentState !== 'active' || !hasEdits) return;
    const edit: ProfileDetailsEdit = {};
    if (name.trim() !== baseline.name) edit.name = name;
    if (dependent && relationship.trim() !== baseline.relationship) edit.relationship = relationship;
    if (dependent && ageRange !== baseline.ageRange) edit.ageRange = ageRange;
    setValidation(undefined); setError(undefined);
    try { applyProfileDetails(baseline, edit); }
    catch (failure) {
      if (failure instanceof ProfileDetailsValidationError) setValidation(failure);
      else setError('These details could not be validated. Cancel and reopen this profile before trying again.');
      return;
    }
    const generation = generationRef.current;
    const isCurrent = () => mountedRef.current && focusedRef.current && generationRef.current === generation && AppState.currentState === 'active';
    savingRef.current = true; setSaving(true);
    try {
      const stored = await savePersonalDetails(profile.id, edit);
      if (mountedRef.current) {
        setBaseline(stored); setName(stored.name); setRelationship(stored.relationship ?? ''); setAgeRange(stored.ageRange ?? ''); setSaved(true);
      }
      if (isCurrent()) leave();
    } catch (failure) {
      if (isCurrent()) {
        if (failure instanceof ProfileDetailsValidationError) setValidation(failure);
        else setError('Your change could not be confirmed. Reload profiles before trying again.');
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  return <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <ActiveProfileBar detail="Editing care-profile details" />
    <View style={styles.group}><Text accessibilityRole="header" style={styles.heading}>Care-profile details</Text><Text style={styles.body}>A first name or nickname is enough. These changes stay in this device’s encrypted profile records; they do not change your account sign-in identity or sync to a server.</Text></View>
    <TextField autoCapitalize="words" editable={!saving} error={validation?.field === 'name' ? validation.message : undefined} label="Profile display name" maxLength={MAX_PROFILE_DETAIL_LENGTH} onChangeText={(value) => { setName(value); setValidation(undefined); }} value={name} />
    {dependent ? <>
      <TextField autoCapitalize="words" editable={!saving} error={validation?.field === 'relationship' ? validation.message : undefined} label="Relationship" maxLength={MAX_PROFILE_DETAIL_LENGTH} onChangeText={(value) => { setRelationship(value); setValidation(undefined); }} value={relationship} />
      <View style={styles.group}><Text accessibilityRole="header" style={styles.label}>Age band</Text><Text style={styles.body}>An age band is enough. Do not enter a date of birth.</Text>
        <View accessibilityLabel="Age band" accessibilityRole="radiogroup" style={styles.choices}>
          {baseline.ageRange && !profileAgeRanges.some((range) => range === baseline.ageRange) ? <Pressable accessibilityLabel={`Keep saved age band: ${baseline.ageRange}`} accessibilityRole="radio" accessibilityState={{ checked: ageRange === baseline.ageRange, disabled: saving }} disabled={saving} onPress={() => setAgeRange(baseline.ageRange!)} style={({ pressed }) => [styles.choice, styles.savedChoice, ageRange === baseline.ageRange && styles.selected, pressed && styles.pressed]}><Text style={styles.choiceText}>Keep saved: {baseline.ageRange}</Text></Pressable> : null}
          {profileAgeRanges.map((range) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: range === ageRange, disabled: saving }} disabled={saving} key={range} onPress={() => { setAgeRange(range); setValidation(undefined); }} style={({ pressed }) => [styles.choice, range === ageRange && styles.selected, pressed && styles.pressed]}><Text style={styles.choiceText}>{range}</Text></Pressable>)}
        </View>
        {validation?.field === 'ageRange' ? <Text accessibilityRole="alert" style={styles.error}>{validation.message}</Text> : null}
      </View>
    </> : null}
    <Text style={styles.note}>Changed names and relationships must contain 1–80 characters. Existing profile identifiers and historical records stay unchanged.</Text>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <View style={styles.group}><PrimaryButton disabled={saving || !hasEdits} label={saving ? 'Saving details…' : 'Save details'} onPress={() => void save()} /><SecondaryButton disabled={saving} label="Cancel changes" onPress={leave} /><Text accessibilityLiveRegion="polite" style={styles.note}>{!hasEdits ? saved ? 'Changes saved on this device.' : 'No changes to save.' : 'Only changed profile fields will be saved.'}</Text></View>
    <View style={styles.account}><Text accessibilityRole="header" style={styles.label}>Account identity · read-only</Text><Text selectable style={styles.body}>{identifier.trim() ? identifier : 'Sign-in identifier unavailable'}</Text><Text style={styles.body}>Shown as supplied by your sign-in session. Email, password and other authentication details cannot be edited here.</Text></View>
  </ScrollView>;
}

export default function PersonalInformationScreen() {
  const { loading: authLoading, user } = useAuth();
  const { activeProfile, error, loading, readScope, retry } = useProfiles();
  if (authLoading || (user && loading)) return <ProfileDetailScreen title="Personal information"><View style={styles.state}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.body}>Opening care-profile details…</Text></View></ProfileDetailScreen>;
  if (!user) return <ProfileDetailScreen title="Personal information"><View style={styles.content}><Text accessibilityRole="header" style={styles.heading}>Sign in to edit profile details</Text><Text style={styles.body}>Guest preview does not retain personal profile changes.</Text><PrimaryButton label="Sign in" onPress={() => router.push('/sign-in')} /></View></ProfileDetailScreen>;
  if (error || activeProfile.isDemo || !readScope) return <ProfileDetailScreen title="Personal information"><ScrollView contentContainerStyle={styles.content}><Text accessibilityRole="alert" style={styles.body}>{error ?? 'Reload profiles before editing care-profile details.'}</Text><PrimaryButton label="Reload profiles" onPress={retry} /></ScrollView></ProfileDetailScreen>;
  return <ProfileDetailScreen title="Personal information"><PersonalDetailsForm identifier={user.username} key={JSON.stringify([user.userId, activeProfile.id, readScope])} profile={activeProfile} /></ProfileDetailScreen>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', padding: 24, paddingTop: 12, paddingBottom: 32, gap: 20 },
  group: { gap: 12 },
  heading: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 24, lineHeight: 32 },
  label: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 23 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  note: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  error: { color: colors.error, fontFamily: font.medium, fontSize: 13, lineHeight: 20 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minWidth: 60, maxWidth: '100%', minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  savedChoice: { width: '100%', borderRadius: radius.control, alignItems: 'flex-start' },
  selected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  choiceText: { maxWidth: '100%', flexShrink: 1, color: colors.textPrimary, fontFamily: font.medium, fontSize: 14, lineHeight: 21 },
  account: { padding: 16, borderRadius: radius.card, backgroundColor: colors.surface, gap: 12 },
  state: { padding: 24, minHeight: 180, justifyContent: 'center', alignItems: 'center', gap: 12 },
  pressed: { opacity: 0.68 },
});
