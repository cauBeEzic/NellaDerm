import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, type Href } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyInsight, ErrorBanner, InsightsDetailScreen, ProfileContext, StatusDot } from '@/components/insights-layout';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { comparisonCounts, demoInsightEntries, routineStatusCounts, weeklyReview } from '@/lib/insights';
import { colors, font, radius, size } from '@/theme';

const shortDate = (date: Date) => new Intl.DateTimeFormat('en-CA', { weekday: 'short', day: 'numeric' }).format(date);
const fullDate = (date: Date) => new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(date);

const comparisonLabels = { better: 'Better', same: 'Same', worse: 'Worse' } as const;
const routineLabels = { complete: 'Complete', partial: 'Partly complete', 'not-recorded': 'Not recorded' } as const;

export default function WeeklyReviewScreen() {
  const { error: careError, loading: careLoading, now, profile, retry: retryCare, state: careState } = useCare();
  const { error: checkInError, history, loading: historyLoading, offline, retry: retryHistory } = useCheckIn();
  const entries = useMemo(() => profile.isDemo ? demoInsightEntries(now) : history, [history, now, profile.isDemo]);
  const days = useMemo(() => weeklyReview(entries, careState, now), [careState, entries, now]);
  const weekEntries = useMemo(() => days.flatMap((day) => day.entry ? [day.entry] : []), [days]);
  const skin = useMemo(() => comparisonCounts(weekEntries), [weekEntries]);
  const routine = useMemo(() => routineStatusCounts(days), [days]);
  const loading = careLoading || historyLoading;
  const error = careError ?? checkInError;
  const first = days[0]?.date;
  const last = days.at(-1)?.date;

  function retry() {
    if (careError) retryCare();
    if (checkInError) retryHistory();
  }

  return (
    <InsightsDetailScreen title="Weekly Review">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileContext isDemo={profile.isDemo} name={profile.name} offline={offline} />
        {error ? <ErrorBanner message={error} onRetry={retry} /> : null}
        {loading ? <View style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.loadingText}>Preparing the last seven days…</Text></View> : null}
        {!loading && !error && !weekEntries.length ? <EmptyInsight action="Record a check-in" body="Weekly Review needs at least one saved skin check-in. Missing days will stay visible once your review begins." onAction={() => router.push('/check-in' as Href)} title="No recorded days this week" /> : null}
        {!loading && !error && weekEntries.length ? (
          <>
            <View style={styles.opening}>
              <View style={styles.openingIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="weather-partly-cloudy" size={27} /></View>
              <Text style={styles.openingTitle}>A quiet record of how things felt</Text>
              <Text style={styles.openingDates}>{first && last ? `${fullDate(first)}–${fullDate(last)}` : 'Last seven days'}</Text>
              <Text style={styles.openingBody}>{weekEntries.length} of 7 days recorded. This review describes your entries and leaves missing days visible.</Text>
            </View>

            <View style={styles.metrics}>
              <View style={styles.metric}><Text style={styles.metricValue}>{weekEntries.length}/7</Text><Text style={styles.metricLabel}>Skin days recorded</Text></View>
              <View style={styles.metric}><Text style={styles.metricValue}>{routine.complete}/7</Text><Text style={styles.metricLabel}>Routine days complete</Text></View>
            </View>

            <View>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Week at a glance</Text>
              <View accessibilityLabel={`Seven day review: ${weekEntries.length} skin days recorded, ${7 - weekEntries.length} missing, ${routine.complete} routine days complete, ${routine.partial} partly complete`} style={styles.weekCard}>
                {days.map((day) => (
                  <View key={day.dayKey} style={styles.dayRow}>
                    <Text style={styles.dayLabel}>{shortDate(day.date)}</Text>
                    <View style={styles.dayStatus}>
                      {day.entry ? <StatusDot tone={day.entry.comparison} /> : <StatusDot tone="missing" />}
                      <Text style={[styles.statusText, !day.entry && styles.missingText]}>{day.entry ? comparisonLabels[day.entry.comparison] : 'Not recorded'}</Text>
                    </View>
                    <View style={styles.dayStatus}>
                      <StatusDot tone={day.routine === 'complete' ? 'complete' : day.routine === 'partial' ? 'partial' : 'missing'} />
                      <Text numberOfLines={2} style={[styles.statusText, day.routine === 'not-recorded' && styles.missingText]}>{routineLabels[day.routine]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Recorded this week</Text>
              <View style={styles.findingList}>
                <View style={styles.finding}><StatusDot tone="better" /><Text style={styles.findingText}>{skin.better} better day{skin.better === 1 ? '' : 's'}, {skin.same} steady day{skin.same === 1 ? '' : 's'}, and {skin.worse} worse day{skin.worse === 1 ? '' : 's'} were recorded.</Text></View>
                <View style={styles.finding}><StatusDot tone="complete" /><Text style={styles.findingText}>{routine.complete} complete, {routine.partial} partly complete, and {routine['not-recorded']} not-recorded routine day{routine['not-recorded'] === 1 ? '' : 's'}.</Text></View>
                <View style={styles.finding}><MaterialCommunityIcons color={colors.textSecondary} name="information-outline" size={17} /><Text style={styles.findingText}>Skin and routine entries may appear on the same day, but that does not show that one caused the other.</Text></View>
              </View>
            </View>

            <Pressable accessibilityRole="button" onPress={() => router.push('/insights/history' as Href)} style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.actionPrimary} name="history" size={20} /><Text style={styles.historyButtonText}>See complete history</Text><MaterialCommunityIcons color={colors.actionPrimary} name="chevron-right" size={21} /></Pressable>
            {!profile.isDemo ? <Pressable accessibilityRole="button" onPress={() => router.push('/export' as Href)} style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.actionPrimary} name="file-document-outline" size={20} /><Text style={styles.historyButtonText}>Prepare care-team summary</Text><MaterialCommunityIcons color={colors.actionPrimary} name="chevron-right" size={21} /></Pressable> : null}
            <Text style={styles.boundary}>{profile.isDemo ? 'Synthetic demo review · Sign in to export retained records.' : 'Private local review · Patient-generated PDF sharing is available on this device; cloud-generated summaries are not connected.'}</Text>
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
  opening: { borderRadius: 16, padding: 22, alignItems: 'center', gap: 7, backgroundColor: colors.surface },
  openingIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  openingTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 20, lineHeight: 28, textAlign: 'center' },
  openingDates: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 12, lineHeight: 18 },
  openingBody: { maxWidth: 290, color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, minHeight: 98, borderRadius: radius.card, padding: 15, justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  metricValue: { color: colors.actionPrimary, fontFamily: font.bold, fontSize: 23, lineHeight: 29 },
  metricLabel: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 11, lineHeight: 16 },
  sectionTitle: { minHeight: 42, color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  weekCard: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  dayRow: { minHeight: 64, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDefault },
  dayLabel: { width: 46, color: colors.textPrimary, fontFamily: font.semibold, fontSize: 12 },
  dayStatus: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { flex: 1, color: colors.textPrimary, fontFamily: font.medium, fontSize: 11, lineHeight: 15 },
  missingText: { color: colors.textSecondary, fontFamily: font.regular },
  findingList: { borderRadius: 16, padding: 17, gap: 15, backgroundColor: colors.surface },
  finding: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  findingText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  historyButton: { minHeight: 56, borderRadius: radius.card, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  historyButtonText: { flex: 1, color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 14 },
  boundary: { borderRadius: radius.card, padding: 14, color: colors.textSecondary, backgroundColor: colors.surfaceBrandSoft, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.68 },
});
