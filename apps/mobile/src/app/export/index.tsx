import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/button';
import { ErrorBanner, InsightsDetailScreen, ProfileContext } from '@/components/insights-layout';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { usePdfExport } from '@/contexts/pdf-export-context';
import { useProfiles } from '@/contexts/profile-context';
import { hasExportableSection, type PdfExportSection } from '@/lib/pdf-export';
import type { InsightRange } from '@/lib/insights';
import { colors, font, radius, size, spacing } from '@/theme';

const ranges: InsightRange[] = [7, 30, 90];
const sections: { key: PdfExportSection; title: string; detail: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { key: 'skin', title: 'Skin history', detail: 'Recorded days, comparisons, concerns, and areas', icon: 'chart-timeline-variant' },
  { key: 'routine', title: 'Routine record', detail: 'Complete, partly complete, and not-recorded days', icon: 'calendar-check-outline' },
  { key: 'products', title: 'Products', detail: 'Care list and recorded uses in the selected period', icon: 'lotion-outline' },
  { key: 'photos', title: 'Photos', detail: 'Up to 8 recent private photos from this device', icon: 'image-lock-outline' },
  { key: 'notes', title: 'Notes', detail: 'Appointment note and recorded check-in notes', icon: 'note-text-outline' },
];

export default function PdfExportSetupScreen() {
  const { user } = useAuth();
  const { config, setAppointmentNotes, setRange, toggleSection } = usePdfExport();
  const { error: profileError, loading: profileLoading, retry: retryProfiles } = useProfiles();
  const { error: careError, loading: careLoading, profile, retry: retryCare } = useCare();
  const { error: checkInError, loading: checkInLoading, offline, retry: retryCheckIn } = useCheckIn();
  const loading = profileLoading || careLoading || checkInLoading;
  const error = profileError ?? careError ?? checkInError;

  function retry() {
    if (profileError) {
      retryProfiles();
      return;
    }
    if (careError) retryCare();
    if (checkInError) retryCheckIn();
  }

  return (
    <InsightsDetailScreen title="Prepare summary">
      <ScrollView contentContainerStyle={styles.content} key={`${user?.userId ?? 'guest'}:${profile.id}:${loading ? 'loading' : error ? 'error' : 'ready'}`} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {!user ? (
          <View style={styles.gate}>
            <View style={styles.gateIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="file-lock-outline" size={30} /></View>
            <Text accessibilityRole="header" style={styles.gateTitle}>Sign in to prepare a summary</Text>
            <Text style={styles.gateBody}>Export uses retained records for one active profile. Guest activity stays temporary and cannot be exported.</Text>
            <PrimaryButton label="Sign in" onPress={() => router.push('/sign-in')} />
          </View>
        ) : (
          <>
            <ProfileContext isDemo={false} name={profile.name} offline={offline} onPress={() => router.push('/profile/switch')} />
            {error ? <ErrorBanner message={error} onRetry={retry} /> : null}
            {loading ? <View style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.loadingText}>Opening {profile.name}’s records…</Text></View> : null}
            {!loading && !error ? (
              <>
                <View style={styles.intro}>
                  <View style={styles.introIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="file-document-outline" size={27} /></View>
                  <View style={styles.introCopy}><Text accessibilityRole="header" style={styles.introTitle}>Care-team summary</Text><Text style={styles.introBody}>Choose what to include in a patient-generated PDF for {profile.name}. You can review everything before sharing.</Text></View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Reporting window</Text>
                  <View accessibilityRole="tablist" style={styles.segmented}>
                    {ranges.map((range) => {
                      const selected = config.range === range;
                      return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={range} onPress={() => setRange(range)} style={({ pressed }) => [styles.segment, selected && styles.segmentSelected, pressed && styles.pressed]}><Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{range} days</Text></Pressable>;
                    })}
                  </View>
                  <Text style={styles.help}>Missing days remain visible and are not counted as improvement.</Text>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Include in the summary</Text>
                  <View style={styles.optionGroup}>
                    {sections.map((section, index) => {
                      const selected = config.sections[section.key];
                      return (
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          key={section.key}
                          onPress={() => toggleSection(section.key)}
                          style={({ pressed }) => [styles.option, index > 0 && styles.optionBorder, pressed && styles.pressed]}>
                          <View style={styles.optionIcon}><MaterialCommunityIcons color={colors.actionPrimary} name={section.icon} size={21} /></View>
                          <View style={styles.optionCopy}><Text style={styles.optionTitle}>{section.title}</Text><Text style={styles.optionDetail}>{section.detail}</Text></View>
                          <MaterialCommunityIcons color={selected ? colors.actionPrimary : colors.borderStrong} name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'} size={25} />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {config.sections.notes ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notes for the appointment</Text>
                    <TextInput
                      accessibilityLabel="Notes for the appointment"
                      maxLength={1000}
                      multiline
                      onChangeText={setAppointmentNotes}
                      placeholder="Questions, changes, or details you want to remember"
                      placeholderTextColor={colors.textSecondary}
                      style={styles.notes}
                      textAlignVertical="top"
                      value={config.appointmentNotes}
                    />
                    <Text style={styles.characterCount}>{config.appointmentNotes.length}/1000 · Not saved; cleared when profile or sign-in session changes</Text>
                  </View>
                ) : null}

                {!hasExportableSection(config.sections) ? <Text accessibilityRole="alert" style={styles.selectionError}>Choose at least one available section to continue.</Text> : null}
                <View style={styles.disclosure}><MaterialCommunityIcons color={colors.actionPrimary} name="shield-lock-outline" size={21} /><Text style={styles.disclosureText}>A temporary PDF is created on this device and opens in the native share sheet. MyEczema removes it when sharing finishes. Your chosen app may keep a copy.</Text></View>
                <PrimaryButton disabled={!hasExportableSection(config.sections)} label="Preview summary" onPress={() => router.push('/export/summary' as Href)} />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </InsightsDetailScreen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  gate: { minHeight: 390, borderRadius: 16, padding: 26, justifyContent: 'center', gap: 12, backgroundColor: colors.surface },
  gateIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  gateTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 21, lineHeight: 29 },
  gateBody: { marginBottom: spacing.sm, color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  intro: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.surface },
  introIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  introCopy: { flex: 1, gap: 5 },
  introTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 19, lineHeight: 26 },
  introBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  section: { gap: 10 },
  sectionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 17, lineHeight: 24 },
  segmented: { minHeight: 52, padding: 4, borderRadius: radius.pill, flexDirection: 'row', backgroundColor: colors.borderDefault },
  segment: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: { backgroundColor: colors.surface },
  segmentText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13 },
  segmentTextSelected: { color: colors.actionPrimary, fontFamily: font.semibold },
  help: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  optionGroup: { overflow: 'hidden', borderRadius: 16, backgroundColor: colors.surface },
  option: { minHeight: 76, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDefault },
  optionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  optionCopy: { flex: 1 },
  optionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  optionDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16 },
  notes: { minHeight: 132, borderRadius: radius.control, borderWidth: 1, borderColor: colors.borderDefault, padding: 14, color: colors.textPrimary, backgroundColor: colors.surface, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  characterCount: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 10, lineHeight: 15, textAlign: 'right' },
  selectionError: { borderRadius: radius.card, padding: 13, color: colors.error, backgroundColor: colors.errorSurface, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  disclosure: { borderRadius: radius.card, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surfaceBrandSoft },
  disclosureText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.68 },
});
