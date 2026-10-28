import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { CareFlowLayout } from '@/components/care-flow-layout';
import { Field, InfoCard, MultiChoiceRow, SubmitButton } from '@/components/care-form';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { findCareProductByBarcode, findExistingCareProduct, normalizeCareStartDate, routineDaysLabel, routineLabel, type RoutinePeriod } from '@/lib/care';
import { colors, font, radius } from '@/theme';

const periods = ['morning', 'evening', 'as-needed'] as const;
const periodLabel = { morning: 'Morning', evening: 'Evening', 'as-needed': 'As needed' } as const;

export default function ProductFoundScreen() {
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  const { user } = useAuth();
  const { loading, error, profile, retry, state } = useCare();
  if (loading) return <CareFlowLayout title="Track entry"><Text style={styles.infoBody}>Opening Care…</Text></CareFlowLayout>;
  if (error) return <CareFlowLayout title="Track entry"><InfoCard><Text style={styles.infoBody}>{error}</Text></InfoCard><SubmitButton label="Reload Care" onPress={retry} /></CareFlowLayout>;
  const product = findCareProductByBarcode(barcode);
  const existing = user && product ? findExistingCareProduct(state.products, product) : undefined;
  if (existing) {
    return (
      <CareFlowLayout title="Scan product">
        <View style={styles.duplicateHero}>
          <View style={styles.duplicateIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="archive-outline" size={36} /></View>
          <Text accessibilityRole="header" style={styles.duplicateTitle}>Already in your products</Text>
          <Text style={styles.duplicateBody}>{existing.name} is already saved in {profile.name}’s care profile.</Text>
        </View>
        <View style={styles.duplicateCard}>
          <Text style={styles.duplicateSupply}>Marked: {existing.supply === 'low' ? 'Getting low' : 'Plenty left'}</Text>
          <Text style={styles.infoBody}>Routine: {routineLabel(existing.schedule)} · {routineDaysLabel(existing.weekdays)}</Text>
        </View>
        <SubmitButton label="View existing product" onPress={() => router.replace({ pathname: '/care/product/[id]', params: { id: existing.id } })} />
        <Pressable accessibilityRole="button" onPress={() => router.replace('/care/scan')} style={({ pressed }) => [styles.scanAnother, pressed && styles.pressed]}><Text style={styles.scanAnotherLabel}>Scan another</Text></Pressable>
      </CareFlowLayout>
    );
  }
  return <ProductFoundForm barcode={barcode} key={`${user?.userId ?? 'guest'}:${profile.id}:${barcode ?? ''}`} />;
}

function ProductFoundForm({ barcode }: { barcode?: string }) {
  const { addProduct, canWrite, error } = useCare();
  const [periodsSelected, setPeriodsSelected] = useState<RoutinePeriod[]>(['morning']);
  const [startDate, setStartDate] = useState(() => normalizeCareStartDate('Today')!);
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
  const product = findCareProductByBarcode(barcode);

  async function save() {
    if (savingRef.current || !focusedRef.current || AppState.currentState !== 'active') return;
    if (!product) return;
    const normalizedStartDate = normalizeCareStartDate(startDate);
    if (!normalizedStartDate) {
      Alert.alert('Check the start date', 'Enter the date as YYYY-MM-DD, or use Today.');
      return;
    }
    if (!canWrite) {
      if (error) {
        Alert.alert('Care is unavailable', 'Return to Care and reload your records before adding a product.');
        return;
      }
      Alert.alert('Sign in to add this product', 'Guest changes are not saved. Sign in to add products to your routine.', [
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
      await addProduct({ ...product, barcode: product.barcode, schedule: periodsSelected, startedOn: normalizedStartDate });
      if (isCurrent()) router.replace('/(tabs)/care');
    } catch {
      if (isCurrent()) Alert.alert('Could not add product', 'The product was not saved. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!product) {
    return (
      <CareFlowLayout title="Track entry">
        <InfoCard><View style={styles.notice}><MaterialCommunityIcons color={colors.warning} name="alert-outline" size={19} /><View style={styles.unmatchedCopy}><Text style={styles.infoTitle}>Product match unavailable</Text><Text style={styles.infoBody}>This demo only recognizes the sample barcode. Return to scanning or add the product manually.</Text></View></View></InfoCard>
        <SubmitButton label="Add product manually" onPress={() => router.replace('/care/add-product')} />
        <Pressable accessibilityRole="button" onPress={() => router.replace('/care/scan')} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}><Text style={styles.skipLabel}>Return to scan</Text></Pressable>
      </CareFlowLayout>
    );
  }

  return (
    <CareFlowLayout title="Track entry">
      <View style={styles.match}><MaterialCommunityIcons color={colors.success} name="check-circle" size={20} /><Text style={styles.matchText}>Sample match · demo catalogue</Text></View>
      <View style={styles.productCard}><View style={styles.productIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="lotion-outline" size={36} /></View><View style={styles.productCopy}><Text style={styles.brand}>CeraVe</Text><Text style={styles.productName}>CeraVe Moisturizing Cream</Text><Text style={styles.size}>453 g · 16 oz</Text></View></View>
      <InfoCard><View style={styles.infoHeading}><MaterialCommunityIcons color={colors.actionPrimary} name="book-open-page-variant-outline" size={19} /><View><Text style={styles.infoTitle}>Manufacturer directions</Text><Text style={styles.official}>Official reference</Text></View></View><Text style={styles.infoBody}>“Apply liberally as often as needed, or as directed by a physician. Suitable for use on face and body.”</Text></InfoCard>
      <View style={styles.group}><Text style={styles.sectionTitle}>Your routine</Text><Text style={styles.subtitle}>When do you usually use this product?</Text><MultiChoiceRow choices={periods} labelFor={(choice) => periodLabel[choice]} onChange={setPeriodsSelected} values={periodsSelected} /></View>
      <Field autoCapitalize="none" label="Start date · YYYY-MM-DD" onChangeText={setStartDate} placeholder="2026-10-08" value={startDate} />
      <InfoCard><View style={styles.notice}><MaterialCommunityIcons color={colors.actionPrimary} name="information-outline" size={19} /><Text style={styles.noticeText}>Your routine is personal to your habits and is not a medical prescription.</Text></View></InfoCard>
      <SubmitButton disabled={saving || !periodsSelected.length} label={saving ? 'Adding to routine…' : 'Add to my routine'} onPress={() => void save()} />
      <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/care')} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}><Text style={styles.skipLabel}>Skip routine setup</Text></Pressable>
    </CareFlowLayout>
  );
}

const styles = StyleSheet.create({
  duplicateHero: { alignItems: 'center', gap: 16, paddingVertical: 8 },
  duplicateIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  duplicateTitle: { textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 24, lineHeight: 33 },
  duplicateBody: { textAlign: 'center', color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  duplicateCard: { borderRadius: radius.control, padding: 16, gap: 6, backgroundColor: colors.surface },
  duplicateSupply: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 13, lineHeight: 20 },
  scanAnother: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 12, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.borderDefault },
  scanAnotherLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 15 },
  match: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#E7F4EE' },
  matchText: { color: colors.success, fontFamily: font.semibold, fontSize: 12 },
  productCard: { borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.surface },
  productIcon: { width: 72, height: 72, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  productCopy: { flex: 1, gap: 2 },
  brand: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 12 },
  productName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  size: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  infoHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  infoTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14 },
  official: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 10, textTransform: 'uppercase' },
  infoBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  group: { gap: 8 },
  sectionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 20, lineHeight: 28 },
  subtitle: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  unmatchedCopy: { flex: 1, gap: 4 },
  noticeText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  skip: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  skipLabel: { color: colors.textSecondary, fontFamily: font.semibold, fontSize: 14 },
  pressed: { opacity: 0.68 },
});
