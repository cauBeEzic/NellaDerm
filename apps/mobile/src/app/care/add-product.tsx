import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Alert, AppState, StyleSheet, Text, View } from 'react-native';

import { ActiveProfileBar } from '@/components/active-profile-bar';
import { CareFlowLayout } from '@/components/care-flow-layout';
import { ChoiceRow, Field, InfoCard, SubmitButton } from '@/components/care-form';
import { PackagingPhotoField } from '@/components/product-packaging-photo';
import { useProductPackagingDraft } from '@/components/use-product-packaging-draft';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { manualProductId, normalizeCareStartDate, type CareProduct, type CareProductCategory, type RoutinePeriod } from '@/lib/care';
import { colors, font } from '@/theme';

const categories = ['Cleanser', 'Moisturizer', 'Treatment', 'Other'] as const;
const periods = ['morning', 'evening', 'as-needed'] as const;
const periodLabel = { morning: 'Morning', evening: 'Evening', 'as-needed': 'As needed' } as const;

export default function AddProductScreen() {
  const { user } = useAuth();
  const { loading, error, profile, readScope, retry } = useCare();
  if (loading) return <CareFlowLayout title="Add product"><ActiveProfileBar /><Text style={styles.infoBody}>Opening Care…</Text></CareFlowLayout>;
  if (error) return <CareFlowLayout title="Add product"><ActiveProfileBar /><InfoCard><Text style={styles.infoBody}>{error}</Text></InfoCard><SubmitButton label="Reload Care" onPress={retry} /></CareFlowLayout>;
  return <AddProductForm key={JSON.stringify([user?.userId ?? 'guest', profile.id, readScope])} />;
}

function AddProductForm() {
  const { addProduct, canWrite, error } = useCare();
  const [productId] = useState(() => manualProductId('product'));
  const photoDraft = useProductPackagingDraft(productId);
  const [completedProduct, setCompletedProduct] = useState<CareProduct>();
  const mountedRef = useRef(false);
  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState<CareProductCategory>('Moisturizer');
  const [period, setPeriod] = useState<RoutinePeriod>('morning');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const focusedRef = useRef(false);
  const generationRef = useRef(0);
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
    const trimmed = name.trim();
    if (completedProduct || !trimmed || savingRef.current || photoDraft.busy || photoDraft.cleanupPending || !focusedRef.current || AppState.currentState !== 'active') return;
    if (!canWrite) {
      if (error) {
        Alert.alert('Care is unavailable', 'Return to Care and reload your records before adding a product.');
        return;
      }
      Alert.alert('Sign in to add this product', 'Guest changes are not saved. Sign in to add products to your cabinet.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    const commit = photoDraft.beginCommit();
    if (!commit) return;
    const generation = generationRef.current;
    const isCurrent = () => focusedRef.current && generationRef.current === generation && AppState.currentState === 'active';
    savingRef.current = true;
    setSaving(true);
    try {
      const saved = await addProduct({ id: productId, name: trimmed, manufacturer: manufacturer.trim() || undefined, category, kind: 'skincare', schedule: [period], startedOn: normalizeCareStartDate('Today')!, supply: 'plenty', area: 'Choose an area when logging use', barcode: barcode.trim() || undefined, verified: false, packagingPhoto: commit.photo });
      if (mountedRef.current) setCompletedProduct(saved);
      const cleaned = await photoDraft.commitSucceeded(saved.packagingPhoto);
      if (isCurrent() && cleaned) router.replace('/(tabs)/care');
    } catch {
      photoDraft.commitUncertain();
      if (isCurrent()) Alert.alert('Could not add product', 'The product was not saved. Please try again.');
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  if (completedProduct) return <CareFlowLayout title="Add product"><ActiveProfileBar /><InfoCard><Text style={styles.infoTitle}>{completedProduct.id === productId ? 'Product saved' : 'Existing product preserved'}</Text><Text style={styles.infoBody}>{completedProduct.name} is in this profile’s cabinet. Existing barcode matches keep their saved details and photo.</Text></InfoCard>{photoDraft.error ? <Text accessibilityRole="alert" style={styles.infoBody}>{photoDraft.error}</Text> : null}{photoDraft.cleanupPending ? <SubmitButton label="Retry packaging-photo cleanup" onPress={() => void photoDraft.retryCleanup()} /> : null}<SubmitButton label="Return to Care" onPress={() => router.replace('/(tabs)/care')} /></CareFlowLayout>;

  return (
    <CareFlowLayout title="Add product">
      <ActiveProfileBar />
      <View style={styles.heading}><Text style={styles.title}>Add product manually</Text><Text style={styles.subtitle}>Use the product label when official information cannot be verified.</Text></View>
      <Field autoCapitalize="words" label="Product name" onChangeText={setName} placeholder="e.g. Moisturizing Cream" value={name} />
      <Field autoCapitalize="words" label="Manufacturer · optional" onChangeText={setManufacturer} placeholder="e.g. CeraVe" value={manufacturer} />
      <View style={styles.group}><Text style={styles.label}>Category</Text><ChoiceRow choices={categories} onChange={setCategory} value={category as typeof categories[number]} /></View>
      <Field keyboardType="number-pad" label="Barcode · optional" onChangeText={setBarcode} placeholder="Enter barcode number" value={barcode} />
      <PackagingPhotoField disabled={saving} draft={photoDraft} />
      <View style={styles.group}><Text style={styles.label}>My routine</Text><ChoiceRow choices={periods} labelFor={(choice) => periodLabel[choice]} onChange={setPeriod} value={period} /><Text style={styles.helper}>Selected: {periodLabel[period]}</Text></View>
      <InfoCard><View style={styles.infoHeading}><MaterialCommunityIcons color={colors.actionPrimary} name="information-outline" size={19} /><Text style={styles.infoTitle}>Directions unavailable?</Text></View><Text style={styles.infoBody}>Save the product without directions. MyEczema will not generate a substitute.</Text></InfoCard>
      <SubmitButton disabled={!name.trim() || saving || photoDraft.busy || photoDraft.cleanupPending} label={saving ? 'Adding product…' : 'Add product'} onPress={() => void save()} />
    </CareFlowLayout>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 4 },
  title: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 24, lineHeight: 32 },
  subtitle: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  group: { gap: 8 },
  label: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  helper: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12 },
  infoHeading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14 },
  infoBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
});
