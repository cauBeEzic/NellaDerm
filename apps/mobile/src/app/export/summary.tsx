import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Print from 'expo-print';
import { router, useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/button';
import { ErrorBanner, InsightsDetailScreen, ProfileContext } from '@/components/insights-layout';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { usePdfExport } from '@/contexts/pdf-export-context';
import { useProfiles } from '@/contexts/profile-context';
import { readCheckInPhotoDataUri } from '@/lib/check-in-media';
import { buildPatientGeneratedPdfHtml, buildPatientGeneratedSummary } from '@/lib/pdf-export';
import { beginPdfExport, finishPdfExport, pdfCleanupGeneration } from '@/lib/pdf-export-files';
import { colors, font, radius, size, spacing } from '@/theme';

function EmptyLine({ children }: { children: string }) {
  return <Text style={styles.empty}>{children}</Text>;
}

export default function PdfExportSummaryScreen() {
  const { reportPdfCleanupFailure, user } = useAuth();
  const { config } = usePdfExport();
  const { error: profileError, loading: profileLoading, retry: retryProfiles } = useProfiles();
  const { error: careError, loading: careLoading, now, profile, retry: retryCare, state: careState } = useCare();
  const { error: checkInError, history, loading: checkInLoading, offline, retry: retryCheckIn } = useCheckIn();
  const loading = profileLoading || careLoading || checkInLoading;
  const error = profileError ?? careError ?? checkInError;
  const summary = useMemo(() => buildPatientGeneratedSummary({ profile, entries: history, careState, config, generatedAt: now }), [careState, config, history, now, profile]);
  const scope = useMemo(() => ({ userId: user?.userId, profileId: profile.id, ready: !loading && !error }), [error, loading, profile.id, user?.userId]);
  const [generationState, setGenerationState] = useState<{ scope: typeof scope; generating: boolean; error?: string }>();
  const generating = generationState?.scope === scope && generationState.generating;
  const generationError = generationState?.scope === scope ? generationState.error : undefined;
  const scopeRef = useRef(scope);
  const operationRef = useRef(0);
  const focusedRef = useRef(false);

  useLayoutEffect(() => {
    scopeRef.current = scope;
    operationRef.current += 1;
  }, [scope]);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    operationRef.current += 1;
    setGenerationState(undefined);
    return () => {
      focusedRef.current = false;
      operationRef.current += 1;
    };
  }, []));

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') return;
      operationRef.current += 1;
      setGenerationState(undefined);
    });
    return () => subscription.remove();
  }, []);

  function retry() {
    if (profileError) {
      retryProfiles();
      return;
    }
    if (careError) retryCare();
    if (checkInError) retryCheckIn();
  }

  async function generateAndShare() {
    if (!scope.userId || !scope.ready || scopeRef.current !== scope || !focusedRef.current || AppState.currentState !== 'active') return;
    const operation = ++operationRef.current;
    const fileGeneration = beginPdfExport();
    const isCurrent = () => operationRef.current === operation && scopeRef.current === scope
      && focusedRef.current && AppState.currentState === 'active' && pdfCleanupGeneration() === fileGeneration;
    let generatedUri: string | undefined;
    setGenerationState({ scope, generating: true });
    try {
      const available = await Sharing.isAvailableAsync();
      if (!isCurrent()) return;
      if (!available) {
        setGenerationState({ scope, generating: false, error: 'Native file sharing is not available on this device. Try again on an iOS or Android device with sharing enabled.' });
        return;
      }
      const photoDataUris: Record<string, string> = {};
      await Promise.all(summary.photos.items.map(async (photo) => {
        try {
          photoDataUris[photo.id] = await readCheckInPhotoDataUri(photo.localUri);
        } catch {
          // The PDF keeps a clear unavailable placeholder if the OS cleared a cached photo.
        }
      }));
      if (!isCurrent()) return;
      const html = buildPatientGeneratedPdfHtml(summary, photoDataUris);
      const result = await Print.printToFileAsync({
        html,
        width: 612,
        height: 792,
        margins: { top: 28, right: 28, bottom: 28, left: 28 },
      });
      generatedUri = result.uri;
      if (!isCurrent()) return;
      await Sharing.shareAsync(generatedUri, {
        UTI: 'com.adobe.pdf',
        mimeType: 'application/pdf',
        dialogTitle: `Share ${profile.name}'s MyEczema summary`,
      });
    } catch {
      if (isCurrent()) setGenerationState({ scope, generating: false, error: 'The PDF could not be prepared on this device. Your records were not changed. Try again.' });
    } finally {
      if (!finishPdfExport(generatedUri)) reportPdfCleanupFailure();
      if (operationRef.current === operation && scopeRef.current === scope) {
        setGenerationState((current) => current?.scope === scope && current.generating ? { ...current, generating: false } : current);
      }
    }
  }

  return (
    <InsightsDetailScreen title="Care Team Summary">
      <ScrollView contentContainerStyle={styles.content} key={`${user?.userId ?? 'guest'}:${profile.id}:${loading ? 'loading' : error ? 'error' : 'ready'}`} showsVerticalScrollIndicator={false}>
        {!user ? (
          <View style={styles.gate}><MaterialCommunityIcons color={colors.actionPrimary} name="file-lock-outline" size={32} /><Text accessibilityRole="header" style={styles.gateTitle}>This summary needs a signed-in profile</Text><PrimaryButton label="Sign in" onPress={() => router.replace('/sign-in')} /></View>
        ) : (
          <>
            <ProfileContext isDemo={false} name={profile.name} offline={offline} />
            {error ? <ErrorBanner message={error} onRetry={retry} /> : null}
            {loading ? <View style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.loadingText}>Preparing the preview…</Text></View> : null}
            {!loading && !error ? (
              <>
                <View style={styles.hero}>
                  <View style={styles.pill}><MaterialCommunityIcons color={colors.actionPrimary} name="account-heart-outline" size={16} /><Text style={styles.pillText}>Patient-generated · Visit preparation</Text></View>
                  <Text accessibilityRole="header" style={styles.heroTitle}>Care Team Summary</Text>
                  <Text style={styles.heroBody}>A portable view of what {profile.name} recorded in MyEczema.</Text>
                  <View style={styles.rangeRow}><View><Text style={styles.rangeLabel}>{summary.rangeLabel}</Text><Text style={styles.rangeDate}>{summary.dateLabel}</Text></View><Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.change, pressed && styles.pressed]}><Text style={styles.changeText}>Change</Text></Pressable></View>
                </View>

                <View style={styles.completeness}>
                  <View><Text style={styles.completenessValue}>{summary.completeness.recorded}</Text><Text style={styles.completenessTotal}>of {summary.completeness.expected} days recorded</Text></View>
                  <Text style={styles.completenessBody}>{summary.completeness.missing} day{summary.completeness.missing === 1 ? '' : 's'} not recorded. Missing days are not counted as improvement.</Text>
                </View>

                {summary.sections.skin ? <View style={styles.summarySection}><Text accessibilityRole="header" style={styles.sectionTitle}>Skin history</Text><View style={styles.metrics}><View style={styles.metric}><Text style={styles.metricValue}>{summary.completeness.recorded}</Text><Text style={styles.metricLabel}>Total logs</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{summary.skin.worse}</Text><Text style={styles.metricLabel}>Worse-skin days</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{summary.completeness.missing}</Text><Text style={styles.metricLabel}>Not recorded</Text></View></View><Text style={styles.subheading}>Most frequently recorded concerns</Text>{summary.skin.concerns.length ? summary.skin.concerns.slice(0, 5).map((item) => <View key={item.label} style={styles.dataRow}><Text style={styles.dataLabel}>{item.label}</Text><Text style={styles.dataValue}>{item.count}</Text></View>) : <EmptyLine>No concerns were recorded in this period.</EmptyLine>}<Text style={styles.subheading}>Common areas</Text>{summary.skin.areas.length ? summary.skin.areas.slice(0, 5).map((item) => <View key={item.label} style={styles.dataRow}><Text style={styles.dataLabel}>{item.label}</Text><Text style={styles.dataValue}>{item.count}</Text></View>) : <EmptyLine>No body areas were recorded in this period.</EmptyLine>}<Text style={styles.context}>Recorded comparisons: {summary.skin.better} better, {summary.skin.same} about the same, and {summary.skin.worse} worse.</Text></View> : null}

                {summary.sections.routine ? <View style={styles.summarySection}><Text accessibilityRole="header" style={styles.sectionTitle}>Routine record</Text><Text style={styles.sectionLead}>{summary.routine.recorded} of {summary.range} days had a complete or partly complete routine record.</Text><View style={styles.metrics}><View style={styles.metric}><Text style={styles.metricValue}>{summary.routine.complete}</Text><Text style={styles.metricLabel}>Complete</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{summary.routine.partial}</Text><Text style={styles.metricLabel}>Partly complete</Text></View><View style={styles.metric}><Text style={styles.metricValue}>{summary.routine.notRecorded}</Text><Text style={styles.metricLabel}>Not recorded</Text></View></View></View> : null}

                {summary.sections.products ? <View style={styles.summarySection}><Text accessibilityRole="header" style={styles.sectionTitle}>Products</Text>{summary.products.length ? summary.products.map((product) => <View key={product.id} style={styles.productRow}><View style={styles.productIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="lotion-outline" size={20} /></View><View style={styles.productCopy}><Text style={styles.productName}>{product.name}</Text><Text style={styles.productDetail}>{product.detail}</Text></View><Text style={styles.productUses}>{product.recordedUses} use{product.recordedUses === 1 ? '' : 's'}</Text></View>) : <EmptyLine>No products are in this profile’s Care list.</EmptyLine>}<Text style={styles.context}>Products, routines, and skin entries can overlap. This summary does not claim that a product caused a skin change.</Text></View> : null}

                {summary.sections.photos ? <View style={styles.summarySection}><Text accessibilityRole="header" style={styles.sectionTitle}>Photos</Text>{summary.photos.items.length ? <View style={styles.photoGrid}>{summary.photos.items.map((photo) => <View key={photo.id} style={styles.photoCard}><Image accessibilityLabel={`Private skin record from ${photo.dayLabel}`} resizeMode="cover" source={{ uri: photo.localUri }} style={styles.photo} /><Text style={styles.photoMeta}>{photo.dayLabel} · {photo.areaLabel}</Text>{photo.note ? <Text numberOfLines={2} style={styles.photoNote}>{photo.note}</Text> : null}</View>)}</View> : <View style={styles.unavailable}><MaterialCommunityIcons color={colors.textSecondary} name="image-lock-outline" size={21} /><Text style={styles.unavailableText}>{summary.photos.reason}</Text></View>}{summary.photos.totalRecorded > summary.photos.items.length ? <Text style={styles.context}>Showing the 8 most recent of {summary.photos.totalRecorded} recorded photos.</Text> : null}<Text style={styles.context}>These photos are included only because you selected Photos for this export.</Text></View> : null}

                {summary.sections.notes ? <View style={styles.summarySection}><Text accessibilityRole="header" style={styles.sectionTitle}>Notes for the appointment</Text>{summary.notes.appointment ? <Text style={styles.appointmentNote}>{summary.notes.appointment}</Text> : <EmptyLine>No appointment note was added for this export.</EmptyLine>}<Text style={styles.subheading}>Recorded check-in notes</Text>{summary.notes.recorded.length ? summary.notes.recorded.map((note, index) => <View key={`${note.dayLabel}-${index}`} style={styles.noteRow}><Text style={styles.noteDate}>{note.dayLabel}</Text><Text style={styles.noteText}>{note.text}</Text></View>) : <EmptyLine>No check-in notes were recorded in this period.</EmptyLine>}{summary.notes.totalRecorded > summary.notes.recorded.length ? <Text style={styles.context}>Showing the 12 most recent of {summary.notes.totalRecorded} recorded notes.</Text> : null}</View> : null}

                <View style={styles.disclaimer}><MaterialCommunityIcons color={colors.actionPrimary} name="information-outline" size={20} /><Text style={styles.disclaimerText}>This patient-generated summary organizes information the user recorded. It is not a diagnosis, clinical record, or treatment recommendation.</Text></View>
                {generationError ? <Text accessibilityRole="alert" style={styles.generationError}>{generationError}</Text> : null}
                <View style={styles.actions}><PrimaryButton disabled={generating} label={generating ? 'Preparing PDF…' : 'Share PDF'} onPress={() => void generateAndShare()} /><SecondaryButton disabled={generating} label="Change summary" onPress={() => router.back()} /></View>
                <Text style={styles.boundary}>The temporary file is removed when sharing finishes. Your chosen app may keep a copy. MyEczema does not upload the report.</Text>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </InsightsDetailScreen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 44, gap: 18 },
  gate: { minHeight: 340, borderRadius: 16, padding: 26, justifyContent: 'center', gap: 15, backgroundColor: colors.surface },
  gateTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 20, lineHeight: 28 },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  hero: { borderRadius: 16, padding: 21, gap: 7, backgroundColor: colors.surface },
  pill: { alignSelf: 'flex-start', minHeight: 34, borderRadius: radius.pill, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceBrandSoft },
  pillText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 10 },
  heroTitle: { marginTop: 4, color: colors.textPrimary, fontFamily: font.bold, fontSize: 24, lineHeight: 31 },
  heroBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  rangeRow: { marginTop: spacing.sm, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.borderDefault, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  rangeLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  rangeDate: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16 },
  change: { minWidth: 56, minHeight: 48, alignItems: 'flex-end', justifyContent: 'center' },
  changeText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  completeness: { borderRadius: 16, padding: 18, gap: 7, backgroundColor: colors.surfaceBrandSoft },
  completenessValue: { color: colors.actionPrimary, fontFamily: font.bold, fontSize: 27, lineHeight: 31 },
  completenessTotal: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  completenessBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  summarySection: { borderRadius: 16, padding: 18, gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  sectionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  sectionLead: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  metrics: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 73, borderRadius: radius.card, padding: 10, justifyContent: 'center', backgroundColor: colors.canvas },
  metricValue: { color: colors.actionPrimary, fontFamily: font.bold, fontSize: 20, lineHeight: 24 },
  metricLabel: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 10, lineHeight: 14 },
  subheading: { marginTop: 6, color: colors.textSecondary, fontFamily: font.semibold, fontSize: 11, lineHeight: 17 },
  dataRow: { minHeight: 42, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDefault, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dataLabel: { flex: 1, color: colors.textPrimary, fontFamily: font.medium, fontSize: 13 },
  dataValue: { color: colors.actionPrimary, fontFamily: font.bold, fontSize: 13 },
  empty: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  context: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 10, lineHeight: 16 },
  productRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDefault },
  productIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  productCopy: { flex: 1 },
  productName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 19 },
  productDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 10, lineHeight: 15 },
  productUses: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 11 },
  unavailable: { borderRadius: radius.card, padding: 13, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.canvas },
  unavailableText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoCard: { width: '48%', gap: 4 },
  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.card, backgroundColor: colors.canvas },
  photoMeta: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 10, lineHeight: 15 },
  photoNote: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 10, lineHeight: 15 },
  appointmentNote: { borderRadius: radius.card, padding: 13, color: colors.textPrimary, backgroundColor: colors.surfaceBrandSoft, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  noteRow: { gap: 3, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDefault },
  noteDate: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 10, lineHeight: 15 },
  noteText: { color: colors.textPrimary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  disclaimer: { borderRadius: radius.card, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surfaceBrandSoft },
  disclaimerText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  generationError: { borderRadius: radius.card, padding: 13, color: colors.error, backgroundColor: colors.errorSurface, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  actions: { gap: 10 },
  boundary: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 10, lineHeight: 16, textAlign: 'center' },
  pressed: { opacity: 0.68 },
});
