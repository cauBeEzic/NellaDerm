import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/button';
import { ProfileDetailScreen } from '@/components/profile-ui';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { useProfiles } from '@/contexts/profile-context';
import { profileAgeRanges } from '@/lib/care-profile';
import { colors, font, radius, size, spacing } from '@/theme';


export default function AddDependentScreen() {
  const { loading: authLoading, user } = useAuth();
  const { error, profiles, retry } = useProfiles();
  useEffect(() => {
    if (!authLoading && !user) router.replace('/sign-in');
  }, [authLoading, user]);
  if (authLoading || !user) return <ProfileDetailScreen title="Add dependent"><View style={styles.content}><Text style={styles.subtitle}>Opening profiles…</Text></View></ProfileDetailScreen>;
  if (error) return <ProfileDetailScreen title="Add dependent"><ScrollView contentContainerStyle={styles.content}><Text accessibilityRole="alert" style={styles.fieldError}>{error}</Text><PrimaryButton label="Reload profiles" onPress={retry} /></ScrollView></ProfileDetailScreen>;
  if (!profiles.length) return <ProfileDetailScreen title="Add dependent"><View style={styles.content}><Text style={styles.subtitle}>Opening profiles…</Text></View></ProfileDetailScreen>;
  return <AddDependentForm key={user.userId} />;
}

function AddDependentForm() {
  const { addDependent, loading } = useProfiles();
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [ageRange, setAgeRange] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const savingRef = useRef(false);
  const focusedRef = useRef(false);
  const generationRef = useRef(0);
  useLayoutEffect(() => () => { focusedRef.current = false; generationRef.current += 1; }, []);
  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') generationRef.current += 1; });
    return () => { focusedRef.current = false; generationRef.current += 1; subscription.remove(); };
  }, []));
  const nameError = submitted && !name.trim() ? 'Enter a first name or nickname.' : undefined;
  const relationshipError = submitted && !relationship.trim() ? 'Enter your relationship to this person.' : undefined;
  const ageError = submitted && !ageRange ? 'Choose an age range.' : undefined;

  async function create() {
    if (loading || savingRef.current || !focusedRef.current || AppState.currentState !== 'active') return;
    setSubmitted(true);
    if (!name.trim() || !relationship.trim() || !ageRange || !authorized) return;
    const generation = generationRef.current;
    const isCurrent = () => focusedRef.current && generationRef.current === generation && AppState.currentState === 'active';
    savingRef.current = true;
    try {
      await addDependent({ name, relationship, ageRange });
      if (isCurrent()) router.replace('/(tabs)');
    } catch {
      if (isCurrent()) Alert.alert('Could not finish creating the profile', 'Reload profiles before trying again so a partial device save is not duplicated.');
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ProfileDetailScreen title="Add dependent">
        <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Who are you managing?</Text><Text style={styles.subtitle}>Create a separate care profile. A first name or nickname is enough to identify it.</Text></View>
          <TextField autoCapitalize="words" error={nameError} label="Name or nickname" onChangeText={setName} placeholder="e.g. Emma" value={name} />
          <TextField autoCapitalize="words" error={relationshipError} label="Relationship" onChangeText={setRelationship} placeholder="e.g. Child" value={relationship} />
          <View style={styles.ageGroup}><Text style={styles.fieldLabel}>Age range</Text><View accessibilityRole="radiogroup" style={styles.chips}>{profileAgeRanges.map((range) => { const selected = ageRange === range; return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={range} onPress={() => setAgeRange(range)} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{range}</Text></Pressable>; })}</View>{ageError ? <Text accessibilityRole="alert" style={styles.fieldError}>{ageError}</Text> : null}</View>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: authorized }} onPress={() => setAuthorized((value) => !value)} style={({ pressed }) => [styles.authorization, submitted && !authorized && styles.authorizationError, pressed && styles.pressed]}>
            <MaterialCommunityIcons color={authorized ? colors.actionPrimary : colors.borderStrong} name={authorized ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} />
            <Text style={styles.authorizationText}>I’m authorized to manage this person’s care record.</Text>
          </Pressable>
          {submitted && !authorized ? <Text accessibilityRole="alert" style={styles.fieldError}>Confirm that you’re authorized before creating the profile.</Text> : null}
          <PrimaryButton disabled={loading} label={loading ? 'Creating profile…' : 'Create profile'} onPress={() => void create()} />
          <View style={styles.disclosure}><Text style={styles.disclosureTitle}>Keeps records separate</Text><Text style={styles.disclosureBody}>Check-ins, products, photos, history, and reports belong only to this profile.</Text></View>
        </ScrollView>
      </ProfileDetailScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, gap: 16 },
  heading: { gap: 8, marginBottom: 6 },
  title: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 28, lineHeight: 36 },
  subtitle: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  ageGroup: { gap: spacing.xs },
  fieldLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 60, minHeight: 48, borderRadius: radius.pill, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  chipText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13 },
  chipTextSelected: { color: colors.actionPrimary, fontFamily: font.semibold },
  fieldError: { color: colors.error, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  authorization: { minHeight: 72, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: 'transparent' },
  authorizationError: { borderColor: colors.error },
  authorizationText: { flex: 1, color: colors.textPrimary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  disclosure: { borderRadius: 16, padding: 16, gap: 6, backgroundColor: colors.surface },
  disclosureTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  disclosureBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.68 },
});
