import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, View } from 'react-native';

import { CareFlowLayout } from '@/components/care-flow-layout';
import { ChoiceRow, Field, InfoCard, SubmitButton } from '@/components/care-form';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { manualProductId, normalizeCareStartDate, type RoutinePeriod } from '@/lib/care';
import { colors, font, radius } from '@/theme';

const periods = ['morning', 'evening', 'as-needed'] as const;
const periodLabel = { morning: 'Morning', evening: 'Evening', 'as-needed': 'As needed' } as const;

export default function PrescriptionScreen() {
  const { user } = useAuth();
  const { loading, error, profile, retry } = useCare();
  if (loading) return <CareFlowLayout title="Prescription product"><Text style={styles.infoBody}>Opening Care…</Text></CareFlowLayout>;
  if (error) return <CareFlowLayout title="Prescription product"><InfoCard><Text style={styles.infoBody}>{error}</Text></InfoCard><SubmitButton label="Reload Care" onPress={retry} /></CareFlowLayout>;
  return <PrescriptionForm key={`${user?.userId ?? 'guest'}:${profile.id}`} />;
}

function PrescriptionForm() {
  const { addProduct, canWrite, error, profile } = useCare();
  const [instructions, setInstructions] = useState('');
  const [period, setPeriod] = useState<RoutinePeriod>('as-needed');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const focusedRef = useRef(false);
  const generationRef = useRef(0);
  useLayoutEffect(() => () => { focusedRef.current = false; generationRef.current += 1; }, []);
  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') generationRef.current += 1; });
    return () => { focusedRef.current = false; generationRef.current += 1; subscription.remove(); };
  }, []));

  async function save() {
    if (savingRef.current || !focusedRef.current || AppState.currentState !== 'active') return;
    if (!canWrite) {
      if (error) {
        Alert.alert('Care is unavailable', 'Return to Care and reload your records before adding a prescription product.');
        return;
      }
      Alert.alert('Sign in to save this prescription product', 'Guest changes are not saved. Sign in to add the product to a routine.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    const generation = generationRef.current;
    const isCurrent = () => focusedRef.current && generationRef.current === generation && AppState.currentState === 'active';
    savingRef.current = true;
    setSaving(true);
    try {
      await addProduct({ id: manualProductId('Tacrolimus ointment'), name: 'Tacrolimus ointment', manufacturer: 'Medication example', category: 'Prescription', kind: 'prescription', schedule: [period], startedOn: normalizeCareStartDate('Today')!, supply: 'plenty', area: 'As directed', personalInstructions: instructions.trim() || undefined, verified: false });
      if (isCurrent()) router.replace('/(tabs)/care');
    } catch {
      if (isCurrent()) Alert.alert('Could not add product', 'The prescription product was not saved. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <CareFlowLayout title="Prescription product">
      <View style={styles.identified}><MaterialCommunityIcons color={colors.actionPrimary} name="medical-bag" size={20} /><Text style={styles.identifiedText}>Prescription identified</Text></View>
      <View style={styles.productCard}><View style={styles.productIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="pill" size={36} /></View><View style={styles.productCopy}><Text style={styles.productName}>Tacrolimus ointment</Text><Text style={styles.productMeta}>Medication example</Text></View></View>
      <InfoCard><Text style={styles.infoTitle}>Label / manufacturer information</Text><Text style={styles.infoBody}>Verified information appears here when available.</Text></InfoCard>
      <View style={styles.section}><Text style={styles.sectionTitle}>My instructions</Text><Text style={styles.infoBody}>Enter the directions from your prescription label or pharmacy.</Text><Field label="Instructions" multiline onChangeText={setInstructions} placeholder="e.g. Apply as directed on label" style={styles.multiline} value={instructions} /></View>
      <View style={styles.section}><Text style={styles.sectionTitle}>My routine</Text><ChoiceRow choices={periods} labelFor={(choice) => periodLabel[choice]} onChange={setPeriod} value={period} /></View>
      <InfoCard><View style={styles.warning}><MaterialCommunityIcons color={colors.warning} name="alert-outline" size={20} /><View style={styles.warningCopy}><Text style={styles.warningTitle}>Follow your prescriber or pharmacy</Text><Text style={styles.infoBody}>MyEczema does not determine treatment or create prescription instructions.</Text></View></View></InfoCard>
      <SubmitButton disabled={saving} label={saving ? 'Adding…' : `Add to ${profile.name}’s routine`} onPress={() => void save()} />
    </CareFlowLayout>
  );
}

const styles = StyleSheet.create({
  identified: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceBrandSoft },
  identifiedText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 12 },
  productCard: { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.surface },
  productIcon: { width: 72, height: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  productCopy: { flex: 1, gap: 3 },
  productName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 19, lineHeight: 26 },
  productMeta: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  infoTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14 },
  infoBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  section: { gap: 8 },
  sectionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 20, lineHeight: 28 },
  multiline: { minHeight: 94, paddingTop: 14, textAlignVertical: 'top' },
  warning: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  warningCopy: { flex: 1, gap: 3 },
  warningTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13 },
});
