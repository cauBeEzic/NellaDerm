import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/button';
import { CheckInAccessGate } from '@/components/check-in-access-gate';
import { CheckInFlowLayout } from '@/components/check-in-flow-layout';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import {
  areaLabels,
  factorLabels,
  symptomLabels,
  type CheckInArea,
  type CheckInFactor,
  type CheckInSymptom,
  type RoutineFollowThrough,
  type SymptomSeverity,
} from '@/lib/check-in';
import { colors, font } from '@/theme';

const symptoms: CheckInSymptom[] = ['itch', 'dryness', 'redness', 'pain', 'sleep'];
const areas: CheckInArea[] = ['hands', 'inner-elbows', 'neck', 'face', 'other'];
const factors: CheckInFactor[] = ['stress', 'weather', 'new-product', 'routine-change', 'illness', 'other'];
const severities: SymptomSeverity[] = ['mild', 'moderate', 'severe'];
const routines: { value: RoutineFollowThrough; label: string }[] = [
  { value: 'done', label: 'Done' },
  { value: 'partially', label: 'Partially' },
  { value: 'skipped', label: 'Skipped' },
];
const symptomIcons: Record<CheckInSymptom, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  itch: 'waves',
  dryness: 'dots-circle',
  redness: 'water-outline',
  pain: 'bandage',
  sleep: 'weather-night',
  other: 'dots-horizontal',
};

export default function CheckInDetailsScreen() {
  const { profile } = useCare();
  const {
    canWrite,
    offline,
    saveEntry,
    setNotes,
    setRoutine,
    setSymptomSeverity,
    state,
    toggleArea,
    toggleFactor,
    toggleSymptom,
  } = useCheckIn();
  const draft = state.draft;
  const [notes, setLocalNotes] = useState(draft?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const notesRef = useRef(notes);
  const savedNotesRef = useRef(draft?.notes ?? '');
  const draftDayRef = useRef(draft?.dayKey);
  const setNotesRef = useRef(setNotes);

  useEffect(() => {
    setNotesRef.current = setNotes;
  }, [setNotes]);

  useEffect(() => {
    if (!draft) return;
    if (draftDayRef.current !== draft.dayKey) {
      draftDayRef.current = draft.dayKey;
      notesRef.current = draft.notes;
      savedNotesRef.current = draft.notes;
      setLocalNotes(draft.notes);
      return;
    }
    if (notesRef.current === savedNotesRef.current && draft.notes !== savedNotesRef.current) {
      notesRef.current = draft.notes;
      savedNotesRef.current = draft.notes;
      setLocalNotes(draft.notes);
    }
  }, [draft]);

  const flushNotes = useCallback(async () => {
    const next = notesRef.current;
    if (next === savedNotesRef.current) return;
    await setNotesRef.current(next);
    savedNotesRef.current = next;
  }, []);

  useEffect(() => {
    if (notes === savedNotesRef.current) return;
    const timeout = setTimeout(() => {
      void flushNotes().catch(() => undefined);
    }, 500);
    return () => clearTimeout(timeout);
  }, [flushNotes, notes]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') void flushNotes().catch(() => undefined);
    });
    return () => {
      subscription.remove();
      void flushNotes().catch(() => undefined);
    };
  }, [flushNotes]);

  async function leave(action: () => void) {
    try {
      await flushNotes();
      action();
    } catch {
      Alert.alert('Could not save notes', 'Your latest notes could not be saved on this device. Reload the check-in and try again.');
    }
  }

  async function save() {
    if (!draft?.comparison || !canWrite) return;
    setSaving(true);
    try {
      await flushNotes();
      const { firstSavedCheckIn } = await saveEntry();
      router.replace(firstSavedCheckIn && !profile.helpPreference ? '/profile/goals?source=check-in' : '/check-in/saved');
    } catch {
      Alert.alert('Could not save check-in', 'Your draft remains on this device. Reload the check-in and try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!draft || !canWrite) {
    return <CheckInAccessGate missingBody="Choose how your skin compares with usual before adding optional details." missingHeading="Start today’s check-in first" title="Check-in details" />;
  }

  const status = `${profile.name} · ${offline ? 'offline, draft saved on this device' : 'draft saved on this device'}`;

  return (
    <CheckInFlowLayout onBack={() => void leave(router.back)} onClose={() => void leave(() => router.replace('/(tabs)'))} status={status} title="Check-in details">
      <View style={styles.sectionHeading}>
        <View style={styles.sectionTitleRow}><MaterialCommunityIcons color={colors.actionPrimary} name="spa" size={21} /><Text style={styles.heading}>Symptoms</Text></View>
        <Text style={styles.meta}>Optional</Text>
      </View>

      <View style={styles.symptomList}>
        {symptoms.map((symptom) => {
          const severity = draft.symptoms[symptom];
          return (
            <View key={symptom} style={styles.symptomBlock}>
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: Boolean(severity) }} onPress={() => void toggleSymptom(symptom)} style={({ pressed }) => [styles.symptomRow, pressed && styles.pressed]}>
                <View style={[styles.roundIcon, severity && styles.roundIconSelected]}><MaterialCommunityIcons color={severity ? colors.actionPrimary : colors.textSecondary} name={symptomIcons[symptom]} size={20} /></View>
                <Text style={styles.symptomLabel}>{symptomLabels[symptom]}</Text>
                <View style={[styles.addCircle, severity && styles.addCircleSelected]}><MaterialCommunityIcons color={severity ? colors.onActionPrimary : colors.textSecondary} name={severity ? 'check' : 'plus'} size={18} /></View>
              </Pressable>
              {severity ? (
                <View accessibilityRole="radiogroup" style={styles.segmented}>
                  {severities.map((item) => (
                    <Pressable accessibilityRole="radio" accessibilityState={{ checked: severity === item }} key={item} onPress={() => void setSymptomSeverity(symptom, item)} style={({ pressed }) => [styles.segment, severity === item && styles.segmentSelected, pressed && styles.pressed]}>
                      <Text style={[styles.segmentText, severity === item && styles.segmentTextSelected]}>{item[0].toUpperCase() + item.slice(1)}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <SelectionCard title="Tracked areas">
        {areas.map((area) => <ChoiceChip key={area} label={areaLabels[area]} onPress={() => void toggleArea(area)} selected={draft.areas.includes(area)} />)}
      </SelectionCard>

      <SelectionCard subtitle="Optional observations" title="Anything different today?">
        {factors.map((factor) => <ChoiceChip key={factor} label={factorLabels[factor]} onPress={() => void toggleFactor(factor)} selected={draft.factors.includes(factor)} />)}
      </SelectionCard>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Usual routine</Text>
        <Text style={styles.body}>How closely did today match your planned routine?</Text>
        <View accessibilityRole="radiogroup" style={styles.segmented}>
          {routines.map((routine) => (
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: draft.routine === routine.value }} key={routine.value} onPress={() => void setRoutine(routine.value)} style={({ pressed }) => [styles.segment, draft.routine === routine.value && styles.segmentSelected, pressed && styles.pressed]}>
              <Text style={[styles.segmentText, draft.routine === routine.value && styles.segmentTextSelected]}>{routine.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notes</Text>
        <TextInput
          accessibilityLabel="Personal observations"
          maxLength={2000}
          multiline
          onBlur={() => void flushNotes().catch(() => undefined)}
          onChangeText={(value) => { notesRef.current = value; setLocalNotes(value); }}
          placeholder="Add any additional personal observations…"
          placeholderTextColor={colors.textSecondary}
          style={styles.notes}
          textAlignVertical="top"
          value={notes}
        />
        <Text style={styles.characterCount}>{notes.length} / 2000</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.photoHeading}><View><Text style={styles.cardTitle}>Photo record</Text><Text style={styles.body}>For your personal history or patient-generated PDF</Text></View><MaterialCommunityIcons color={colors.textSecondary} name="camera" size={20} /></View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/check-in/photo')} style={({ pressed }) => [styles.photoButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={colors.actionPrimary} name={draft.photo ? 'image-check-outline' : 'camera-plus'} size={22} />
          <Text style={styles.photoButtonText}>{draft.photo ? 'Review attached photo' : 'Add a private photo'}</Text>
        </Pressable>
        <Text style={styles.photoBoundary}>{draft.photo ? `${areaLabels[draft.photo.area]} · photo record · local file may be unavailable · not uploaded` : 'Camera or library access is requested only after you choose a body area and confirm the private-area rule.'}</Text>
      </View>

      <PrimaryButton disabled={saving} label={saving ? 'Saving…' : 'Save check-in'} onPress={() => void save()} />
    </CheckInFlowLayout>
  );
}

function SelectionCard({ children, subtitle, title }: React.PropsWithChildren<{ title: string; subtitle?: string }>) {
  return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text>{subtitle ? <Text style={styles.body}>{subtitle}</Text> : null}<View style={styles.chips}>{children}</View></View>;
}

function ChoiceChip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}>
      <MaterialCommunityIcons color={selected ? colors.onActionPrimary : colors.textSecondary} name={selected ? 'check' : 'plus'} size={17} />
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 18, lineHeight: 26 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  meta: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12 },
  sectionHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  symptomList: { gap: 12 },
  symptomBlock: { gap: 8 },
  symptomRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  roundIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  roundIconSelected: { backgroundColor: colors.accentSurface },
  symptomLabel: { flex: 1, color: colors.textPrimary, fontFamily: font.medium, fontSize: 15 },
  addCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.borderDefault },
  addCircleSelected: { backgroundColor: colors.actionPrimary },
  segmented: { padding: 4, borderRadius: 28, flexDirection: 'row', backgroundColor: colors.borderDefault },
  segment: { flex: 1, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: { backgroundColor: colors.surface },
  segmentText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13 },
  segmentTextSelected: { color: colors.actionPrimary, fontFamily: font.semibold },
  card: { padding: 20, gap: 10, borderRadius: 16, backgroundColor: colors.surface },
  cardTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 17, lineHeight: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, paddingHorizontal: 14, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceBrandSoft },
  chipSelected: { backgroundColor: colors.actionPrimary },
  chipText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13 },
  chipTextSelected: { color: colors.onActionPrimary },
  notes: { minHeight: 124, padding: 16, borderRadius: 12, color: colors.textPrimary, backgroundColor: colors.canvas, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  characterCount: { alignSelf: 'flex-end', color: colors.textSecondary, fontFamily: font.regular, fontSize: 11 },
  photoHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  photoButton: { minHeight: 54, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surfaceBrandSoft },
  photoButtonText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 14 },
  photoBoundary: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16 },
  pressed: { opacity: 0.68 },
});
