import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, type Href, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActiveProfileBar } from '@/components/active-profile-bar';
import { CareFlowLayout } from '@/components/care-flow-layout';
import { InfoCard, SubmitButton } from '@/components/care-form';
import { ErrorBanner } from '@/components/insights-layout';
import { ProductPackagingPhotoSection } from '@/components/product-packaging-photo';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { formatCareStartDate, routineDaysLabel, routineLabel, type CareProduct, type RoutineEvent } from '@/lib/care';
import type { CheckInEntry } from '@/lib/check-in';
import { checkInPhotoExists } from '@/lib/check-in-media';
import { demoInsightEntries } from '@/lib/insights';
import { photoRecords } from '@/lib/photo-progress';
import { productPeriodSummary } from '@/lib/product-period';
import { localDayKey } from '@/lib/today';
import { colors, font, radius } from '@/theme';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const { canWrite, error, loading, now, readScope, retry, state, setProductSupply } = useCare();
  const product = state.products.find((item) => item.id === id);
  if (loading) return <CareFlowLayout title="Product details"><ActiveProfileBar /><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.body}>Opening this profile’s product…</Text></CareFlowLayout>;
  if (error) return <CareFlowLayout title="Product details"><ActiveProfileBar /><InfoCard><Text accessibilityRole="alert" style={styles.body}>{error}</Text></InfoCard><SubmitButton label="Reload Care" onPress={retry} /></CareFlowLayout>;

  if (!product) {
    return <CareFlowLayout title="Product details"><InfoCard><Text style={styles.infoTitle}>Product unavailable</Text><Text style={styles.body}>This product is no longer in your cabinet.</Text></InfoCard><SubmitButton label="Return to Care" onPress={() => router.replace('/(tabs)/care')} /></CareFlowLayout>;
  }

  const selectedProduct = product;
  const low = product.supply === 'low';

  function handleSupply() {
    if (!canWrite) {
      if (error) {
        Alert.alert('Care is unavailable', 'Return to Care and reload your records before changing supply.');
        return;
      }
      Alert.alert('Sign in to save Care changes', 'You can explore this demo product as a guest. Sign in to save supply updates.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    void setProductSupply(selectedProduct.id, low ? 'plenty' : 'low')
      .catch(() => Alert.alert('Could not save', 'The supply update was not saved. Please try again.'));
  }
  return (
    <CareFlowLayout title="Product details">
      <ActiveProfileBar />
      <View style={styles.hero}>
        <View style={styles.productIcon}><MaterialCommunityIcons color={colors.actionPrimary} name={product.kind === 'prescription' ? 'medical-bag' : 'lotion-outline'} size={42} /></View>
        {product.verified ? <View style={styles.verified}><MaterialCommunityIcons color={colors.success} name="check-decagram" size={14} /><Text style={styles.verifiedLabel}>Verified information</Text></View> : <Text style={styles.unverified}>Manually added</Text>}
        <Text style={styles.title}>{product.name}</Text>
        <Text style={styles.manufacturer}>{product.manufacturer || 'Manufacturer not provided'}</Text>
      </View>

      <ProductPackagingPhotoSection key={JSON.stringify([readScope, product.id])} product={product} />

      <InfoCard><View style={styles.infoHeading}><MaterialCommunityIcons color={colors.actionPrimary} name="book-open-page-variant-outline" size={19} /><Text style={styles.infoTitle}>{product.kind === 'prescription' ? 'Your label instructions' : 'Manufacturer directions'}</Text></View><Text style={styles.body}>{product.personalInstructions || product.directions || 'Directions are unavailable. MyEczema will not generate a substitute.'}</Text></InfoCard>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About & ingredients</Text>
        <View style={styles.detailsCard}>
          <View style={styles.cardSection}><Text style={styles.infoTitle}>About this product</Text><Text style={styles.body}>{product.manufacturer ? `${product.name} is saved as a ${product.category.toLowerCase()} product from ${product.manufacturer}.` : `${product.name} was added manually.`}</Text></View>
          <View style={styles.divider} />
          <View style={styles.cardSection}><Text style={styles.infoTitle}>Ingredient awareness</Text><Text style={styles.body}>The ingredient list is not verified. Personal allergy or sensitivity matches cannot be checked yet.</Text><Pressable accessibilityRole="button" onPress={() => router.push(`/care/ingredients/${encodeURIComponent(product.id)}` as Href)} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}><Text style={styles.linkLabel}>Review ingredient status</Text><MaterialCommunityIcons color={colors.actionPrimary} name="chevron-right" size={20} /></Pressable></View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My routine</Text>
        <View style={styles.detailsCard}>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Application schedule</Text><Text style={styles.detailValue}>{routineLabel(product.schedule)}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Days of the week</Text><Text style={styles.detailValue}>{routineDaysLabel(product.weekdays)}</Text></View>
          <View style={styles.detailRow}><Text style={styles.detailLabel}>Started tracking</Text><Text style={styles.detailValue}>{formatCareStartDate(product.startedOn)}</Text></View>
        </View>
        <InfoCard><Text style={styles.infoTitle}>Personal routine</Text><Text style={styles.body}>This schedule reflects your habit. It is not treatment advice or a prescription.</Text></InfoCard>
        <Pressable accessibilityRole="button" onPress={() => router.push('/care/routine')} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}><Text style={styles.linkLabel}>Edit routine</Text><MaterialCommunityIcons color={colors.actionPrimary} name="pencil-outline" size={20} /></Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Supply</Text>
        <View style={styles.supplyCard}><View><Text style={styles.detailLabel}>Self-reported estimate</Text><Text style={[styles.supplyValue, low && styles.low]}>{low ? 'Getting low' : 'Plenty left'}</Text></View><SubmitButton label={low ? 'Mark as plenty' : 'Mark as low'} onPress={handleSupply} /></View>
      </View>

      <ProductHistory key={JSON.stringify([readScope, product.id, product.startedOn, localDayKey(now)])} product={product} />
    </CareFlowLayout>
  );
}

function ProductHistory({ product }: { product: CareProduct }) {
  const { now, profile, readScope, state } = useCare();
  const { error, history, loading, retry } = useCheckIn();
  const entries = useMemo(() => profile.isDemo ? demoInsightEntries(now) : history, [history, now, profile.isDemo]);
  if (loading) return <View style={styles.section}><Text style={styles.sectionTitle}>My history</Text><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.body}>Opening this profile’s history…</Text></View>;
  if (error) return <ErrorBanner message={error} onRetry={retry} />;
  if (!readScope) return <Text style={styles.historyNote}>History is unavailable. Reload Care before opening a period.</Text>;
  return <ProductHistoryContent entries={entries} events={state.events} product={product} products={state.products} readScope={readScope} toDay={localDayKey(now)} />;
}

function ProductHistoryContent({ entries, events, product, products, readScope, toDay }: { entries: CheckInEntry[]; events: RoutineEvent[]; product: CareProduct; products: CareProduct[]; readScope: string; toDay: string }) {
  const readPhotoAvailability = useCallback(() => ({
    entries,
    ids: new Set(photoRecords(entries, (photo) => checkInPhotoExists(photo.localUri)).map((record) => record.photo.id)),
  }), [entries]);
  const [availability, setAvailability] = useState(readPhotoAvailability);
  // Bind the external file snapshot to the loaded history; focus/foreground explicitly refresh it.
  if (availability.entries !== entries) setAvailability(readPhotoAvailability());
  const focusedRef = useRef(false);
  const wasFocusedRef = useRef(false);
  const generationRef = useRef(0);
  useLayoutEffect(() => () => { focusedRef.current = false; generationRef.current += 1; }, []);
  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    if (wasFocusedRef.current) setAvailability(readPhotoAvailability());
    wasFocusedRef.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') generationRef.current += 1;
      else setAvailability(readPhotoAvailability());
    });
    return () => { focusedRef.current = false; generationRef.current += 1; subscription.remove(); };
  }, [readPhotoAvailability]));
  const generation = generationRef.current;
  const summary = useMemo(() => productPeriodSummary(product, toDay, entries, events, products, (photo) => availability.ids.has(photo.id)), [availability, entries, events, product, products, toDay]);
  function openPeriod(recordType: 'skin' | 'photos') {
    if (!summary || !focusedRef.current || generationRef.current !== generation || AppState.currentState !== 'active') return;
    router.push({ pathname: '/insights/history', params: { periodProduct: product.id, periodFrom: summary.interval.fromDay, periodTo: summary.interval.toDay, periodType: recordType, periodScope: readScope } });
  }
  return <View style={styles.section}>
    <Text style={styles.sectionTitle}>My history</Text>
    {!summary ? <InfoCard><Text style={styles.infoTitle}>Tracking interval unavailable</Text><Text style={styles.body}>A valid saved start date on or before today is needed. Legacy labels and invalid or future dates are not guessed; saved records are unchanged.</Text></InfoCard> : <>
      <Text style={styles.historyNote}>{summary.interval.fromDay} – {summary.interval.toDay} · inclusive tracking interval, not days of use</Text>
      <View style={styles.metrics}>
        <View style={styles.metric}><Text style={styles.metricValue}>{summary.interval.calendarDays}</Text><Text style={styles.metricLabel}>Calendar days in interval</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{summary.recordedDays}</Text><Text style={styles.metricLabel}>Days with product records</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{summary.checkInDays}</Text><Text style={styles.metricLabel}>Available check-in days</Text></View>
        <View style={styles.metric}><Text style={styles.metricValue}>{summary.availablePhotos}</Text><Text style={styles.metricLabel}>Available skin photos</Text></View>
      </View>
      <Text style={styles.historyNote}>Recorded Used events: {summary.usedEvents} across {summary.usedDays} days. Recorded Skipped events: {summary.skippedEvents}. Not a measure of adherence or actual unrecorded use.</Text>
      <Text style={styles.historyNote}>{summary.daysWithoutProductRecord} calendar days without an available product record; {summary.daysWithoutCheckIn} without an available check-in. These are not missed treatments or symptom-free days. Only available local history is counted; up to 90 check-ins are retained.</Text>
      {summary.unavailablePhotos ? <Text style={styles.historyNote}>{summary.unavailablePhotos} photo record(s) are unavailable, ambiguous or missing their local file. No replacement is inferred.</Text> : null}
      <Text style={styles.historyNote}>{summary.otherProducts.length ? `${summary.otherProducts.length} other product(s) have recorded use during this interval; ${summary.overlappingUseDays} days also have this product’s recorded use. ${summary.otherProducts.map((item) => `${item.name} (${item.id})`).join(', ')}.` : 'No other product use is present in the available records. This does not establish exclusive use.'} Same-period or same-day skin records do not establish product association or causation.</Text>
      <Pressable accessibilityRole="button" onPress={() => openPeriod('skin')} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}><Text style={styles.linkLabel}>View skin history during this period</Text><MaterialCommunityIcons color={colors.actionPrimary} name="chevron-right" size={20} /></Pressable>
      <Pressable accessibilityRole="button" onPress={() => openPeriod('photos')} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}><Text style={styles.linkLabel}>View photos during this period</Text><MaterialCommunityIcons color={colors.actionPrimary} name="chevron-right" size={20} /></Pressable>
      <Text style={styles.historyNote}>These links show all this profile’s check-ins or photo records in the interval, not records linked to this product. No before-and-since or causal assessment is made.</Text>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 5, paddingVertical: 8 },
  productIcon: { width: 112, height: 112, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 7, backgroundColor: colors.surface },
  verified: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E7F4EE' },
  verifiedLabel: { color: colors.success, fontFamily: font.semibold, fontSize: 11 },
  unverified: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 11 },
  title: { textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 23, lineHeight: 31 },
  manufacturer: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  detailsCard: { borderRadius: 16, paddingHorizontal: 20, backgroundColor: colors.surface },
  section: { gap: 10 },
  sectionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  cardSection: { paddingVertical: 16, gap: 6 },
  divider: { height: 1, backgroundColor: colors.borderDefault },
  detailRow: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: colors.borderDefault, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  detailLabel: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  detailValue: { flex: 1, textAlign: 'right', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13 },
  low: { color: colors.warning },
  infoHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  linkButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkLabel: { flex: 1, color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 20 },
  supplyCard: { borderRadius: 16, padding: 16, gap: 14, backgroundColor: colors.surface },
  supplyValue: { marginTop: 3, color: colors.success, fontFamily: font.semibold, fontSize: 15 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexGrow: 1, flexBasis: 140, minHeight: 90, borderRadius: 14, padding: 16, justifyContent: 'center', gap: 4, backgroundColor: colors.surface },
  metricValue: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 24, lineHeight: 30 },
  metricLabel: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  historyNote: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.68 },
});
