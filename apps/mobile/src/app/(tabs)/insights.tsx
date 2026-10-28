import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorBanner, InsightsHeader, NavigationRow, ProfileContext, SectionHeading, StatusDot } from '@/components/insights-layout';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import {
  calendarRecordingCounts,
  comparisonCounts,
  dateFromDayKey,
  demoInsightEntries,
  entriesInRange,
  productUseCount,
  productUseDayKeys,
  rangeDayKeys,
  routineStatusCounts,
  weeklyReview,
  type InsightRange,
} from '@/lib/insights';
import { colors, font, radius, size, spacing } from '@/theme';

const ranges: InsightRange[] = [7, 30, 90];
const rangeLabel = (range: InsightRange) => range === 7 ? '7 days' : `${range} days`;
const shortDay = (dayKey: string) => new Intl.DateTimeFormat('en-CA', { day: 'numeric' }).format(dateFromDayKey(dayKey));
const monthLabel = (dayKey: string) => new Intl.DateTimeFormat('en-CA', { month: 'short' }).format(dateFromDayKey(dayKey));

export default function InsightsScreen() {
  const { user } = useAuth();
  const { error: careError, loading: careLoading, now, profile, retry: retryCare, state: careState } = useCare();
  const { error: checkInError, history, loading: historyLoading, offline, retry: retryHistory } = useCheckIn();
  const [range, setRange] = useState<InsightRange>(7);
  const [calendarProduct, setCalendarProduct] = useState('all');
  const allEntries = useMemo(() => profile.isDemo ? demoInsightEntries(now) : history, [history, now, profile.isDemo]);
  const entries = useMemo(() => entriesInRange(allEntries, range, now), [allEntries, now, range]);
  const counts = useMemo(() => comparisonCounts(entries), [entries]);
  const review = useMemo(() => weeklyReview(allEntries, careState, now), [allEntries, careState, now]);
  const routine = useMemo(() => routineStatusCounts(review), [review]);
  const calendarKeys = useMemo(() => rangeDayKeys(Math.min(range, 30), now), [now, range]);
  const entriesByDay = useMemo(() => new Map(entries.map((entry) => [entry.dayKey, entry])), [entries]);
  const calendarCounts = useMemo(() => calendarRecordingCounts(calendarKeys, entriesByDay), [calendarKeys, entriesByDay]);
  const productDays = useMemo(() => productUseDayKeys(careState.events, calendarProduct, Math.min(range, 30), now), [calendarProduct, careState.events, now, range]);
  const loading = careLoading || historyLoading;
  const error = careError ?? checkInError;

  function retry() {
    if (careError) retryCare();
    if (checkInError) retryHistory();
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <InsightsHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileContext isDemo={profile.isDemo} name={profile.name} offline={offline} onPress={user ? () => router.push('/profile/switch') : undefined} />
        {error ? <ErrorBanner message={error} onRetry={retry} /> : null}
        {loading ? <View style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.loadingText}>Opening this profile’s history…</Text></View> : null}
        {!loading && !error ? (
          <>
            <View accessibilityRole="tablist" style={styles.segmented}>
              {ranges.map((item) => {
                const selected = range === item;
                return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={item} onPress={() => setRange(item)} style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && styles.pressed]}><Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{rangeLabel(item)}</Text></Pressable>;
              })}
            </View>

            <View style={styles.summary}>
              <View style={styles.summaryHeading}>
                <View style={styles.summaryCopy}><Text style={styles.summaryTitle}>{entries.length} of {range} days recorded</Text><Text style={styles.summaryBody}>{entries.length < 3 ? 'Keep checking in to build a useful personal record.' : 'Missing days are left blank and are not counted as improvement.'}</Text></View>
                <View accessibilityLabel={`${entries.length} recorded days out of ${range}`} style={styles.recordedBadge}><Text style={styles.recordedValue}>{entries.length}</Text><Text style={styles.recordedTotal}>/{range}</Text></View>
              </View>
              <View style={styles.metricRow}>
                <View style={styles.metric}><StatusDot tone="better" /><Text style={styles.metricValue}>{counts.better}</Text><Text style={styles.metricLabel}>Better</Text></View>
                <View style={styles.metric}><StatusDot tone="same" /><Text style={styles.metricValue}>{counts.same}</Text><Text style={styles.metricLabel}>Same</Text></View>
                <View style={styles.metric}><StatusDot tone="worse" /><Text style={styles.metricValue}>{counts.worse}</Text><Text style={styles.metricLabel}>Worse</Text></View>
              </View>
            </View>

            <View>
              <SectionHeading action="History" onAction={() => router.push('/insights/history' as Href)} title="Skin history" />
              <View style={styles.calendarCard}>
                <View style={styles.calendarTop}><Text style={styles.calendarTitle}>{monthLabel(calendarKeys[calendarKeys.length - 1])} · recent {calendarKeys.length} days</Text><Text accessibilityLabel={`Calendar showing ${calendarCounts.recorded} recorded days and ${calendarCounts.notRecorded} not recorded days`} style={styles.calendarNote}>{range === 90 ? 'Showing latest 30' : `${calendarCounts.recorded} recorded`}</Text></View>
                <ScrollView accessibilityLabel="Filter product-use markers" contentContainerStyle={styles.productFilters} horizontal showsHorizontalScrollIndicator={false}>
                  {[{ id: 'all', name: 'All products' }, ...careState.products].map((product) => {
                    const selected = calendarProduct === product.id;
                    return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={product.id} onPress={() => setCalendarProduct(product.id)} style={({ pressed }) => [styles.productFilter, selected && styles.productFilterSelected, pressed && styles.pressed]}><Text numberOfLines={1} style={[styles.productFilterText, selected && styles.productFilterTextSelected]}>{product.name}</Text></Pressable>;
                  })}
                </ScrollView>
                <View style={styles.calendarGrid}>
                  {calendarKeys.map((dayKey) => {
                    const entry = entriesByDay.get(dayKey);
                    const hasProductUse = productDays.has(dayKey);
                    const skinLabel = entry ? `skin ${entry.comparison}` : 'skin not recorded';
                    return <View accessible accessibilityLabel={`${dayKey}, ${skinLabel}${hasProductUse ? ', product use recorded' : ''}`} key={dayKey} style={[styles.calendarDay, entry && styles[`calendarDay_${entry.comparison}`]]}><Text style={[styles.calendarDayText, entry && styles.calendarDayTextRecorded]}>{shortDay(dayKey)}</Text>{entry ? <StatusDot tone={entry.comparison} /> : null}{hasProductUse ? <View style={styles.productUseMarker} /> : null}</View>;
                  })}
                </View>
                <View style={styles.legend}>
                  <View style={styles.legendItem}><StatusDot tone="better" /><Text style={styles.legendText}>Better</Text></View>
                  <View style={styles.legendItem}><StatusDot tone="same" /><Text style={styles.legendText}>Same</Text></View>
                  <View style={styles.legendItem}><StatusDot tone="worse" /><Text style={styles.legendText}>Worse</Text></View>
                  <View style={styles.legendItem}><StatusDot tone="missing" /><Text style={styles.legendText}>Not recorded</Text></View>
                  <View style={styles.legendItem}><View style={styles.legendProductUseMarker} /><Text style={styles.legendText}>Product use</Text></View>
                </View>
              </View>
            </View>

            <View>
              <SectionHeading title="What’s in the record" />
              <View style={styles.observationCard}>
                <View style={styles.observationIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="chart-box-outline" size={23} /></View>
                <View style={styles.observationCopy}><Text style={styles.observationTitle}>{entries.length < 3 ? 'Not enough recorded days yet' : `${counts.better + counts.same} better or same day${counts.better + counts.same === 1 ? '' : 's'} recorded`}</Text><Text style={styles.observationBody}>{entries.length < 3 ? 'Three or more recorded days are needed before this summary can describe the period.' : `${counts.worse} worse day${counts.worse === 1 ? '' : 's'} and ${range - entries.length} not-recorded day${range - entries.length === 1 ? '' : 's'}. This is a description of your entries, not a medical conclusion.`}</Text></View>
              </View>
            </View>

            <View>
              <SectionHeading title="Your care record" />
              <View style={styles.navigationList}>
                <NavigationRow detail={`${review.filter((day) => day.entry).length} of 7 skin days · ${routine.complete} complete routine days`} icon="calendar-week-outline" label="Weekly Review" onPress={() => router.push('/insights/weekly' as Href)} />
                <NavigationRow detail="Check-ins and product-use events in time order" icon="history" label="All history" onPress={() => router.push('/insights/history' as Href)} />
                <NavigationRow detail="Compare same-area photos on different recorded dates" icon="image-multiple-outline" label="Photo Progress" onPress={() => router.push('/insights/photos')} />
                {user ? <NavigationRow detail="Choose a range, preview, and share a patient-generated PDF" icon="file-document-outline" label="Care-team summary" onPress={() => router.push('/export' as Href)} /> : null}
              </View>
            </View>

            {careState.products.length ? <View><SectionHeading title="Product use" /><View style={styles.productList}>{careState.products.map((product) => {
              const uses = productUseCount(careState.events, product.id, range, now);
              return <Pressable accessibilityRole="button" key={product.id} onPress={() => router.push(`/insights/product/${encodeURIComponent(product.id)}` as Href)} style={({ pressed }) => [styles.productRow, pressed && styles.pressed]}><View style={styles.productIcon}><MaterialCommunityIcons color={colors.actionPrimary} name={product.kind === 'prescription' ? 'medical-bag' : 'lotion-outline'} size={20} /></View><View style={styles.productCopy}><Text numberOfLines={1} style={styles.productName}>{product.name}</Text><Text style={styles.productDetail}>{uses} recorded use{uses === 1 ? '' : 's'} in {rangeLabel(range).toLowerCase()}</Text></View><MaterialCommunityIcons color={colors.textSecondary} name="chevron-right" size={22} /></Pressable>;
            })}</View><Text style={styles.disclosure}>Products can overlap with each other and with many other changes. MyEczema does not claim that a product caused a skin change.</Text></View> : null}

            {!user ? <Text style={styles.boundary}>You’re viewing synthetic demo history. Sign in and record check-ins to build a private history for your own profile.</Text> : <Text style={styles.boundary}>History and patient-generated PDF export stay on this device in the current demo. Cloud sync is not connected yet.</Text>}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  segmented: { minHeight: 52, padding: 4, borderRadius: radius.pill, flexDirection: 'row', backgroundColor: colors.borderDefault },
  segment: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: { backgroundColor: colors.surface },
  segmentText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13 },
  segmentTextSelected: { color: colors.actionPrimary, fontFamily: font.semibold },
  summary: { borderRadius: 16, padding: 20, gap: 18, backgroundColor: colors.surface },
  summaryHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  summaryCopy: { flex: 1, gap: 4 },
  summaryTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  summaryBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  recordedBadge: { minWidth: 62, minHeight: 52, borderRadius: 14, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  recordedValue: { color: colors.actionPrimary, fontFamily: font.bold, fontSize: 25 },
  recordedTotal: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13 },
  metricRow: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 68, borderRadius: radius.card, padding: 10, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: colors.canvas },
  metricValue: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 18, lineHeight: 22 },
  metricLabel: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11 },
  calendarCard: { borderRadius: 16, padding: 16, gap: 14, backgroundColor: colors.surface },
  calendarTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calendarTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14 },
  calendarNote: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11 },
  productFilters: { gap: 8, paddingRight: 4 },
  productFilter: { minHeight: 48, maxWidth: 190, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderDefault, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  productFilterSelected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  productFilterText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 11 },
  productFilterTextSelected: { color: colors.actionPrimary, fontFamily: font.semibold },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  calendarDay: { width: 36, height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.borderDefault, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: colors.canvas },
  calendarDay_better: { borderColor: '#8ACCAD', backgroundColor: '#E9F8F0' },
  calendarDay_same: { borderColor: colors.accent, backgroundColor: colors.surfaceBrandSoft },
  calendarDay_worse: { borderColor: '#F3A49C', backgroundColor: colors.errorSurface },
  calendarDayText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 11 },
  calendarDayTextRecorded: { color: colors.textPrimary, fontFamily: font.semibold },
  productUseMarker: { position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.actionPrimary },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 10 },
  legendProductUseMarker: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.actionPrimary },
  observationCard: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  observationIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  observationCopy: { flex: 1, gap: 5 },
  observationTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  observationBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  navigationList: { gap: 10 },
  productList: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  productRow: { minHeight: 72, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDefault },
  productIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  productCopy: { flex: 1 },
  productName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  productDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16 },
  disclosure: { marginTop: spacing.sm, color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  boundary: { borderRadius: radius.card, padding: 14, color: colors.textSecondary, backgroundColor: colors.surfaceBrandSoft, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.68 },
});
