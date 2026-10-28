import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyInsight, ErrorBanner, InsightsDetailScreen, ProfileContext, StatusDot } from '@/components/insights-layout';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { dateFromDayKey, demoInsightEntries } from '@/lib/insights';
import { colors, font, radius, size } from '@/theme';

const dayLabel = (dayKey: string) => new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric' }).format(dateFromDayKey(dayKey));

export default function ProductInsightScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const productId = decodeURIComponent(id ?? '');
  const { error: careError, loading: careLoading, now, profile, retry: retryCare, state } = useCare();
  const { error: checkInError, history, loading: historyLoading, offline, retry: retryHistory } = useCheckIn();
  const product = state.products.find((item) => item.id === productId);
  const entries = useMemo(() => profile.isDemo ? demoInsightEntries(now) : history, [history, now, profile.isDemo]);
  const entriesByDay = useMemo(() => new Map(entries.map((entry) => [entry.dayKey, entry])), [entries]);
  const uses = useMemo(() => state.events
    .filter((event) => event.productId === productId && event.status === 'used')
    .sort((left, right) => right.dayKey.localeCompare(left.dayKey) || right.recordedAt.localeCompare(left.recordedAt)), [productId, state.events]);
  const uniqueUseDays = new Set(uses.map((event) => event.dayKey));
  const loading = careLoading || historyLoading;
  const error = careError ?? checkInError;

  function retry() {
    if (careError) retryCare();
    if (checkInError) retryHistory();
  }

  return (
    <InsightsDetailScreen title="Product use">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileContext isDemo={profile.isDemo} name={profile.name} offline={offline} />
        {error ? <ErrorBanner message={error} onRetry={retry} /> : null}
        {loading ? <View style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.loadingText}>Opening product history…</Text></View> : null}
        {!loading && !error && !product ? <EmptyInsight body="This product is not available in the active profile." icon="package-variant-closed" title="Product not found" /> : null}
        {!loading && !error && product ? (
          <>
            <View style={styles.productCard}>
              <View style={styles.productIcon}><MaterialCommunityIcons color={colors.actionPrimary} name={product.kind === 'prescription' ? 'medical-bag' : 'lotion-outline'} size={30} /></View>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productMeta}>{product.category} · {product.area}</Text>
              <View style={styles.useMetric}><Text style={styles.useValue}>{uniqueUseDays.size}</Text><Text style={styles.useLabel}>days with recorded use</Text></View>
            </View>

            <View>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Recent use</Text>
              <View style={styles.sameDayNotice}><MaterialCommunityIcons color={colors.textSecondary} name="information-outline" size={19} /><View style={styles.sameDayCopy}><Text style={styles.sameDayTitle}>Same-day context only</Text><Text style={styles.sameDayBody}>A skin label on the same day does not mean this product caused the change.</Text></View></View>
              {uses.length ? <View style={styles.useList}>{uses.slice(0, 12).map((event) => {
                const entry = entriesByDay.get(event.dayKey);
                return <View key={event.id} style={styles.useRow}><View style={styles.useRowIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="check" size={18} /></View><View style={styles.useRowCopy}><Text style={styles.useRowTitle}>{dayLabel(event.dayKey)} · {event.period === 'as-needed' ? 'As needed' : event.period}</Text><Text style={styles.useRowDetail}>Recorded {event.displayTime}</Text></View>{entry ? <View style={styles.skinStatus}><StatusDot tone={entry.comparison} /><Text style={styles.skinStatusText}>Skin {entry.comparison === 'same' ? 'same' : entry.comparison}</Text></View> : <Text style={styles.notRecorded}>No skin check-in</Text>}</View>;
              })}</View> : <EmptyInsight body="Record product use from Today or Care to see dates here." icon="lotion-outline" title="No use recorded" />}
            </View>

            <View style={styles.comparisonCard}>
              <View style={styles.comparisonHeading}><MaterialCommunityIcons color={colors.textSecondary} name="shield-check-outline" size={22} /><Text style={styles.comparisonTitle}>Before-and-since comparison unavailable</Text></View>
              <Text style={styles.comparisonBody}>Product use can overlap with weather, routines, prescriptions, and other changes. Comparative product claims remain disabled until the data, clinical, and legal review gates are complete.</Text>
            </View>
            <Text style={styles.boundary}>{profile.isDemo ? 'Synthetic demo product activity' : 'Private local product activity'} · this screen describes co-recorded events and does not claim that this product changed your skin.</Text>
          </>
        ) : null}
      </ScrollView>
    </InsightsDetailScreen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  loading: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  productCard: { borderRadius: 16, padding: 22, alignItems: 'center', gap: 6, backgroundColor: colors.surface },
  productIcon: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  productName: { marginTop: 4, color: colors.textPrimary, fontFamily: font.semibold, fontSize: 20, lineHeight: 27, textAlign: 'center' },
  productMeta: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  useMetric: { marginTop: 10, borderRadius: radius.card, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'baseline', gap: 7, backgroundColor: colors.canvas },
  useValue: { color: colors.actionPrimary, fontFamily: font.bold, fontSize: 23 },
  useLabel: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 11 },
  sectionTitle: { minHeight: 42, color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  sameDayNotice: { marginBottom: 10, borderRadius: radius.card, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: colors.surfaceBrandSoft },
  sameDayCopy: { flex: 1, gap: 2 },
  sameDayTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 12, lineHeight: 18 },
  sameDayBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  useList: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  useRow: { minHeight: 72, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDefault },
  useRowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  useRowCopy: { flex: 1 },
  useRowTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 12, lineHeight: 18, textTransform: 'capitalize' },
  useRowDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16 },
  skinStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  skinStatusText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 10 },
  notRecorded: { maxWidth: 66, color: colors.textSecondary, fontFamily: font.regular, fontSize: 10, lineHeight: 14, textAlign: 'right' },
  comparisonCard: { borderRadius: 16, padding: 18, gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  comparisonHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  comparisonTitle: { flex: 1, color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  comparisonBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  boundary: { borderRadius: radius.card, padding: 14, color: colors.textSecondary, backgroundColor: colors.surfaceBrandSoft, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
});
