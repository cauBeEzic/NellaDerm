import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CheckInAccessGate } from '@/components/check-in-access-gate';
import { CheckInFlowLayout } from '@/components/check-in-flow-layout';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { areaLabels, comparisonOptions, symptomLabels, type CheckInComparison, type CheckInSymptom } from '@/lib/check-in';
import { colors, font } from '@/theme';

const comparisonIcons: Record<CheckInComparison, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  better: 'emoticon-happy-outline',
  same: 'emoticon-neutral-outline',
  worse: 'weather-cloudy-alert',
};
const symptoms: CheckInSymptom[] = ['itch', 'dryness', 'redness', 'pain', 'sleep', 'other'];

export default function QuickCheckInScreen() {
  const { profile } = useCare();
  const { canWrite, offline, saveEntry, setComparison, state, toggleSymptom } = useCheckIn();
  const [saving, setSaving] = useState(false);
  const draft = state.draft;

  async function save() {
    if (!draft?.comparison || !canWrite) return;
    setSaving(true);
    try {
      const { firstSavedCheckIn } = await saveEntry();
      router.replace(firstSavedCheckIn && !profile.helpPreference ? '/profile/goals?source=check-in' : '/check-in/saved');
    } catch {
      Alert.alert('Could not save check-in', 'Your draft is still on this device. Reload the check-in and try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!draft || !canWrite) {
    return <CheckInAccessGate missingBody="Start from the comparison screen so this check-in stays attached to the correct profile and day." missingHeading="Choose today’s answer first" title="Daily check-in" />;
  }

  const symptomCount = Object.keys(draft.symptoms).length;
  const status = `${profile.name} · ${offline ? 'offline, draft saved on this device' : 'draft saved on this device'}`;

  return (
    <CheckInFlowLayout onClose={() => router.replace('/(tabs)')} status={status} title="Daily check-in">
      <View style={styles.intro}>
        <Text style={styles.heading}>How’s your skin compared with usual today?</Text>
        <Text style={styles.body}>Add any symptom details that feel relevant.</Text>
      </View>

      <View accessibilityRole="radiogroup" style={styles.comparisons}>
        {comparisonOptions.map((option) => {
          const selected = draft.comparison === option.value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.value}
              onPress={() => void setComparison(option.value)}
              style={({ pressed }) => [styles.comparison, selected && (option.value === 'worse' ? styles.worseSelected : styles.comparisonSelected), pressed && styles.pressed]}>
              <View style={styles.comparisonIcon}><MaterialCommunityIcons color={option.value === 'worse' && selected ? colors.error : option.value === 'better' ? colors.actionPrimary : colors.textSecondary} name={comparisonIcons[option.value]} size={24} /></View>
              <Text style={[styles.comparisonLabel, option.value === 'worse' && selected && styles.worseText]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.symptomCard}>
        <View style={styles.symptomHeading}>
          <View style={styles.symptomHeadingCopy}>
            <Text style={styles.cardTitle}>What’s bothering you today?</Text>
            <Text style={styles.body}>Optional — only share what feels relevant.</Text>
          </View>
          {symptomCount ? <Text style={styles.countPill}>{symptomCount} noted</Text> : null}
        </View>
        <View style={styles.chips}>
          {symptoms.map((symptom) => {
            const selected = Boolean(draft.symptoms[symptom]);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={symptom}
                onPress={() => void toggleSymptom(symptom)}
                style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
                <MaterialCommunityIcons color={selected ? colors.onActionPrimary : colors.textSecondary} name={selected ? 'check' : 'plus'} size={18} />
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{symptomLabels[symptom]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.detailActions}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/check-in/details')} style={({ pressed }) => [styles.detailAction, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={colors.actionPrimary} name="message-text" size={22} />
          <Text style={styles.detailActionText}>Add details</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/check-in/photo')} style={({ pressed }) => [styles.detailAction, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={colors.actionPrimary} name={draft.photo ? 'image-check-outline' : 'camera-plus'} size={22} />
          <Text style={styles.detailActionText}>{draft.photo ? 'Review photo' : 'Add photo'}</Text>
        </Pressable>
      </View>

      {draft.photo ? <View style={styles.photoStatus}><MaterialCommunityIcons color={colors.actionPrimary} name="shield-lock-outline" size={20} /><View style={styles.photoStatusCopy}><Text style={styles.photoStatusTitle}>1 private photo record</Text><Text style={styles.photoStatusBody}>{areaLabels[draft.photo.area]} · local file availability is checked when opened · not uploaded</Text></View></View> : null}

      <View style={styles.footer}>
        <PrimaryButton disabled={saving} label={saving ? 'Saving…' : 'Save check-in'} onPress={() => void save()} />
        <SecondaryButton label="Back to answer" onPress={() => router.replace('/check-in')} quiet />
      </View>
    </CheckInFlowLayout>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 6 },
  heading: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 22, lineHeight: 30 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  comparisons: { flexDirection: 'row', gap: 8 },
  comparison: { flex: 1, minHeight: 112, padding: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: 'transparent' },
  comparisonSelected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  worseSelected: { borderColor: colors.error, backgroundColor: colors.errorSurface },
  comparisonIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  comparisonLabel: { textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  worseText: { color: colors.error },
  symptomCard: { padding: 24, gap: 18, borderRadius: 16, backgroundColor: colors.surface },
  symptomHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  symptomHeadingCopy: { flex: 1, gap: 4 },
  cardTitle: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 18, lineHeight: 26 },
  countPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, overflow: 'hidden', color: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft, fontFamily: font.medium, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, paddingHorizontal: 14, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceBrandSoft },
  chipSelected: { backgroundColor: colors.actionPrimary },
  chipText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 14 },
  chipTextSelected: { color: colors.onActionPrimary },
  detailActions: { flexDirection: 'row', gap: 12 },
  detailAction: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  detailActionText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 15 },
  photoStatus: { minHeight: 72, padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surfaceBrandSoft },
  photoStatusCopy: { flex: 1, gap: 2 },
  photoStatusTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 19 },
  photoStatusBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  footer: { gap: 8 },
  pressed: { opacity: 0.68 },
});
