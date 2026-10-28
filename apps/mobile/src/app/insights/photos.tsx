import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '@/components/button';
import { EmptyInsight, ErrorBanner, InsightsDetailScreen, ProfileContext } from '@/components/insights-layout';
import { PrivatePhotoPanel, photoDateLabel } from '@/components/private-photo-panel';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import type { CareProduct, RoutineEvent } from '@/lib/care';
import { areaLabels, type CheckInArea, type CheckInEntry } from '@/lib/check-in';
import { checkInPhotoExists } from '@/lib/check-in-media';
import { comparablePhotoAreas, defaultPhotoPair, photoPeriodSummary, photoRecords, resolvePhotoPair, type PhotoRecord } from '@/lib/photo-progress';
import { colors, font, radius, size } from '@/theme';

export default function PhotoProgressScreen() {
  const { loading: authLoading, user } = useAuth();
  const { error: careError, loading: careLoading, profile, retry: retryCare, state: care } = useCare();
  const { error: historyError, history, loading: historyLoading, offline, retry: retryHistory } = useCheckIn();
  const insets = useSafeAreaInsets();
  const records = useMemo(() => photoRecords(history, (photo) => checkInPhotoExists(photo.localUri)), [history]);
  const loading = authLoading || careLoading || historyLoading;
  const error = careError ?? historyError;
  function retry() { retryHistory(); if (careError) retryCare(); }
  return (
    <InsightsDetailScreen title="Photo Progress">
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(40, insets.bottom + 24) }]} showsVerticalScrollIndicator={false}>
        {loading ? <View style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.body}>Opening this profile’s photos…</Text></View> : !user || profile.isDemo ? <EmptyInsight action="Sign in" body="Guest mode does not retain health photos. Sign in to view a private record for your own profile." icon="image-lock-outline" onAction={() => router.push('/sign-in')} title="Sign in to review photos" /> : <>
          <ProfileContext isDemo={false} name={profile.name} offline={offline} onPress={() => router.push('/profile/switch')} />
          {error ? <ErrorBanner message={error} onRetry={retry} /> : <ComparisonContent key={`${user.userId}:${profile.id}`} entries={history} events={care.events} onReload={retry} products={care.products} records={records} />}
        </>}
      </ScrollView>
    </InsightsDetailScreen>
  );
}

function ComparisonContent({ entries, events, onReload, products, records }: {
  entries: CheckInEntry[]; events: RoutineEvent[]; onReload: () => void; products: CareProduct[]; records: PhotoRecord[];
}) {
  const areas = [...new Set(records.map((record) => record.photo.area))];
  const [area, setArea] = useState<CheckInArea | undefined>(() => comparablePhotoAreas(records)[0] ?? areas[0]);
  const [selection, setSelection] = useState<{ earlier?: string; later?: string }>({});
  const [picker, setPicker] = useState<'area' | 'earlier' | 'later'>();
  const { fontScale, width } = useWindowDimensions();
  const stacked = width < 360 || fontScale >= 1.2;
  const matching = records.filter((record) => record.photo.area === area);
  const pair = selection.earlier || selection.later
    ? resolvePhotoPair(records, selection.earlier, selection.later)
    : area ? defaultPhotoPair(records, area) : undefined;
  const summary = pair ? photoPeriodSummary(pair, entries, events, products) : undefined;
  const dateOptions = picker === 'earlier'
    ? matching.filter((record) => record.dayKey < (matching.at(-1)?.dayKey ?? ''))
    : matching.filter((record) => record.dayKey > (pair?.earlier.dayKey ?? matching[0]?.dayKey ?? ''));

  function chooseDate(record: PhotoRecord) {
    if (picker === 'earlier') {
      const later = pair?.later && pair.later.dayKey > record.dayKey ? pair.later : matching.at(-1);
      setSelection({ earlier: record.photo.id, later: later?.photo.id });
    } else setSelection({ earlier: pair?.earlier.photo.id ?? matching[0]?.photo.id, later: record.photo.id });
    setPicker(undefined);
  }

  if (!records.length) return <EmptyInsight action="Record a check-in" body="Add an optional photo to a signed-in check-in. Two photos on different dates in the same recorded body area are needed to compare." icon="camera-outline" onAction={() => router.push('/check-in')} title="No local photos yet" />;

  return <>
    <Text style={styles.intro}>Compare photos from your skin history.</Text>
    <View style={styles.selectors}>
      <Pressable accessibilityLabel={`Body area: ${area ? areaLabels[area] : 'Choose an area'}`} accessibilityRole="button" accessibilityState={{ expanded: picker === 'area' }} onPress={() => setPicker(picker === 'area' ? undefined : 'area')} style={({ pressed }) => [styles.selectButton, pressed && styles.pressed]}>
        <MaterialCommunityIcons color={colors.actionPrimary} name="hand-back-left-outline" size={20} /><Text style={styles.selectLabel}>{area ? areaLabels[area] : 'Choose an area'}</Text><MaterialCommunityIcons color={colors.textSecondary} name={picker === 'area' ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>
      {pair ? <View style={[styles.dateRow, stacked && styles.stacked]}>{(['earlier', 'later'] as const).map((side) => <Pressable key={side} accessibilityLabel={`Choose ${side} date, ${photoDateLabel(pair[side].dayKey)}`} accessibilityRole="button" accessibilityState={{ expanded: picker === side }} onPress={() => setPicker(picker === side ? undefined : side)} style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}><Text style={styles.caption}>{side === 'earlier' ? 'Earlier' : 'Later'}</Text><Text style={styles.selectLabel}>{photoDateLabel(pair[side].dayKey)}</Text><MaterialCommunityIcons color={colors.actionPrimary} name="chevron-down" size={18} /></Pressable>)}</View> : null}
      {picker ? <ScrollView accessibilityRole="radiogroup" contentContainerStyle={styles.options} nestedScrollEnabled style={styles.optionList}>
        {picker === 'area' ? areas.map((value) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: area === value }} key={value} onPress={() => { setArea(value); setSelection({}); setPicker(undefined); }} style={({ pressed }) => [styles.option, pressed && styles.pressed]}><Text style={styles.selectLabel}>{areaLabels[value]}</Text>{area === value ? <MaterialCommunityIcons color={colors.actionPrimary} name="check" size={20} /> : null}</Pressable>) : dateOptions.map((record) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: pair?.[picker].photo.id === record.photo.id }} key={record.photo.id} onPress={() => chooseDate(record)} style={({ pressed }) => [styles.option, pressed && styles.pressed]}><Text style={styles.selectLabel}>{photoDateLabel(record.dayKey)}</Text>{pair?.[picker].photo.id === record.photo.id ? <MaterialCommunityIcons color={colors.actionPrimary} name="check" size={20} /> : null}</Pressable>)}
      </ScrollView> : null}
      {area === 'other' ? <Text style={styles.body}>“Other” can refer to different locations. Confirm that these photos show the same area before comparing.</Text> : null}
    </View>

    {pair && summary ? <>
      <View style={styles.photoGroup}><View style={[styles.photoRow, stacked && styles.stacked]}><PrivatePhotoPanel key={pair.earlier.photo.id} label="Earlier" onReload={onReload} record={pair.earlier} /><PrivatePhotoPanel key={pair.later.photo.id} label="Later" onReload={onReload} record={pair.later} /></View><View style={styles.zoomHint}><MaterialCommunityIcons color={colors.textSecondary} name="magnify-plus-outline" size={18} /><Text style={styles.body}>Tap either photo to zoom into the stored local copy.</Text></View></View>
      <View style={styles.period}>
        <View style={styles.sectionHeading}><MaterialCommunityIcons color={colors.actionPrimary} name="calendar-month-outline" size={21} /><Text accessibilityRole="header" style={styles.sectionTitle}>During this period</Text></View>
        <Text style={styles.body}>{summary.skinRecordedDays} of {summary.calendarDays} skin days recorded · {summary.skinNotRecordedDays} not recorded. Both photo dates are included.</Text>
        <View style={[styles.stats, stacked && styles.stacked]}><View style={styles.stat}><Text style={styles.caption}>Elapsed span</Text><Text style={styles.statValue}>{summary.elapsedDays} {summary.elapsedDays === 1 ? 'day' : 'days'}</Text><Text style={styles.body}>Between photo dates</Text></View><View style={styles.stat}><Text style={styles.caption}>Product use recorded</Text><Text style={styles.statValue}>{summary.productUseDays} of {summary.calendarDays} days</Text><Text style={styles.body}>Marked Used</Text></View></View>
        <Text style={styles.productHeading}>Products recorded as used</Text>
        {summary.products.length ? summary.products.map((product) => <View key={product.productId} style={styles.productRow}><MaterialCommunityIcons color={colors.actionPrimary} name="clipboard-check-outline" size={21} /><View style={styles.productCopy}><Text style={styles.productName}>{product.name}</Text><Text style={styles.body}>{product.days} {product.days === 1 ? 'day' : 'days'} · {product.useCount} recorded {product.useCount === 1 ? 'use' : 'uses'}</Text><Text style={styles.caption}>{product.periods.map((period) => period === 'as-needed' ? 'As needed' : period === 'morning' ? 'Morning' : 'Evening').join(' + ')}</Text></View></View>) : <Text style={styles.body}>No product use was marked Used during these dates.</Text>}
        <Text style={styles.body}>These are this profile’s logs and may relate to other body areas. Recorded use is not proof of adherence or that a product caused a skin change.</Text>
      </View>
    </> : <>
      <EmptyInsight body={selection.earlier || selection.later ? 'A selected photo is no longer available for this profile. Choose the body area again to select another pair, or reload photos.' : 'Record another photo on a different date in this body area. Photos from different areas cannot form a pair.'} icon="image-multiple-outline" title={selection.earlier || selection.later ? 'Selected pair unavailable' : 'Two recorded dates needed'} />
      {matching.length === 1 ? <View style={styles.photoGroup}><PrivatePhotoPanel key={matching[0].photo.id} label="Recorded photo" onReload={onReload} record={matching[0]} /></View> : null}
    </>}
    <View style={styles.actions}><PrimaryButton label="View timeline" onPress={() => router.push('/insights/history')} /><SecondaryButton label="Add new check-in photo" onPress={() => router.push('/check-in')} quiet /></View>
    <View style={styles.notice}><MaterialCommunityIcons color={colors.textSecondary} name="information-outline" size={19} /><Text style={styles.noticeText}>Photos are personal records, not a medical diagnosis. Lighting, camera distance and angle can change their appearance. Images are local-only and are not analyzed or synchronized.</Text></View>
  </>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, gap: 24 },
  loading: { minHeight: 180, gap: 12, justifyContent: 'center', alignItems: 'center' },
  intro: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  caption: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  selectors: { padding: 16, gap: 8, borderRadius: radius.card, backgroundColor: colors.surface },
  selectButton: { minHeight: 48, paddingHorizontal: 12, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.canvas },
  selectLabel: { flexShrink: 1, color: colors.textPrimary, fontFamily: font.medium, fontSize: 13, lineHeight: 20 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateButton: { flex: 1, minHeight: 68, padding: 12, borderRadius: radius.card, gap: 3, backgroundColor: colors.canvas },
  optionList: { maxHeight: 240 },
  options: { gap: 8 },
  option: { minHeight: 48, padding: 12, borderRadius: radius.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: colors.surfaceBrandSoft },
  photoGroup: { padding: 16, gap: 16, borderRadius: radius.card, backgroundColor: colors.surface },
  photoRow: { flexDirection: 'row', gap: 8 },
  stacked: { flexDirection: 'column' },
  zoomHint: { padding: 12, borderRadius: radius.card, flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.canvas },
  period: { padding: 24, gap: 16, borderRadius: radius.card, backgroundColor: colors.surface },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { flexShrink: 1, color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 16, gap: 6, borderRadius: radius.card, backgroundColor: colors.canvas },
  statValue: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 26 },
  productHeading: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 13, lineHeight: 20 },
  productRow: { minHeight: 64, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: radius.card, backgroundColor: colors.canvas },
  productCopy: { flex: 1, gap: 4 },
  productName: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 13, lineHeight: 20 },
  actions: { gap: 8 },
  notice: { padding: 16, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noticeText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  pressed: { opacity: 0.7 },
});
