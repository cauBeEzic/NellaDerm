import { router, useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActiveProfileBar } from '@/components/active-profile-bar';
import { CareFlowLayout } from '@/components/care-flow-layout';
import { InfoCard, MultiChoiceRow, SubmitButton } from '@/components/care-form';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { routinePeriods, routineWeekdays, routineWeekdayLabels, type CareProduct, type RoutineScheduleEdit } from '@/lib/care';
import { localDayKey } from '@/lib/today';
import { colors, font, radius } from '@/theme';

const periodLabels = { morning: 'Morning', evening: 'Evening', 'as-needed': 'As needed' };
const weekdayChoices = [...routineWeekdays.slice(1), routineWeekdays[0]];

function leaveEditor() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)/care?tab=routine');
}

function RoutineForm({ dayKey, products }: { dayKey: string; products: CareProduct[] }) {
  const { saveRoutineSchedules } = useCare();
  const [original, setOriginal] = useState(products);
  const [draft, setDraft] = useState<RoutineScheduleEdit[]>(() => products.map((product) => ({
    productId: product.id, schedule: [...product.schedule], weekdays: [...(product.weekdays ?? routineWeekdays)],
  })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const savingRef = useRef(false);
  const focusedRef = useRef(false);
  const generationRef = useRef(0);
  useLayoutEffect(() => () => { focusedRef.current = false; generationRef.current += 1; }, []);
  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') generationRef.current += 1; });
    return () => { focusedRef.current = false; generationRef.current += 1; subscription.remove(); };
  }, []));

  const changes = draft.filter((edit) => {
    const product = original.find((item) => item.id === edit.productId)!;
    const days = product.weekdays ?? routineWeekdays;
    return edit.schedule.length !== product.schedule.length || edit.schedule.some((period) => !product.schedule.includes(period))
      || edit.weekdays.length !== days.length || edit.weekdays.some((day) => !days.includes(day));
  });

  function change(edit: RoutineScheduleEdit) {
    if (savingRef.current) return;
    setError(undefined);
    setDraft((current) => current.map((item) => item.productId === edit.productId ? edit : item));
  }

  async function save() {
    if (savingRef.current || !focusedRef.current || AppState.currentState !== 'active' || !changes.length) return;
    if (changes.some((edit) => !edit.schedule.length || !edit.weekdays.length)) {
      setError('Choose at least one day and one time period for each changed product.');
      return;
    }
    const generation = generationRef.current;
    const isCurrent = () => focusedRef.current && generationRef.current === generation && AppState.currentState === 'active';
    savingRef.current = true;
    setSaving(true);
    setError(undefined);
    try {
      await saveRoutineSchedules(changes, dayKey);
      // A retained form must compare future edits with this commit even when navigation is stale.
      setOriginal((current) => current.map((product) => {
        const saved = changes.find((edit) => edit.productId === product.id);
        return saved ? { ...product, schedule: [...saved.schedule], weekdays: [...saved.weekdays] } : product;
      }));
      if (isCurrent()) leaveEditor();
    } catch {
      if (isCurrent()) setError('Your schedule was not saved. Leave this editor and reload Care before trying again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      <ActiveProfileBar />
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.heading}>Choose days and time periods</Text>
        <Text style={styles.body}>Changes apply from today. Earlier schedules and recorded uses stay in your history. These are personal habits, not treatment advice.</Text>
      </View>
      {!products.length ? <InfoCard><Text style={styles.body}>Add a product in Care before setting its routine.</Text></InfoCard> : null}
      {draft.map((edit) => {
        const product = original.find((item) => item.id === edit.productId)!;
        return (
          <View key={edit.productId} style={styles.product}>
            <Text accessibilityRole="header" style={styles.productName}>{product.name}</Text>
            {product.kind === 'prescription' || product.category === 'Prescription' ? <Text style={styles.body}>Follow your pharmacy label. Prescription use is always logged individually, never in bulk.</Text> : null}
            <Text style={styles.label}>Days of the week</Text>
            <MultiChoiceRow choices={weekdayChoices} disabled={saving} labelFor={(day) => routineWeekdayLabels[day]} onChange={(weekdays) => change({ ...edit, weekdays })} values={edit.weekdays} />
            <Text style={styles.label}>Time periods</Text>
            <MultiChoiceRow choices={routinePeriods} disabled={saving} labelFor={(period) => periodLabels[period]} onChange={(schedule) => change({ ...edit, schedule })} values={edit.schedule} />
            <Text style={styles.helper}>As needed is available on the chosen days without a timed reminder.</Text>
          </View>
        );
      })}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {products.length ? <SubmitButton disabled={saving || !changes.length} label={saving ? 'Saving routine…' : 'Save routine'} onPress={() => void save()} /> : null}
      <Pressable accessibilityRole="button" onPress={leaveEditor} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelLabel}>{saving ? 'Leave editor' : 'Cancel'}</Text></Pressable>
      <Text style={styles.helper}>{saving ? 'An already-started save may finish for this profile after you leave.' : 'Cancel leaves your saved routine unchanged. Routine changes stay on this device in the current demo.'}</Text>
      <Pressable accessibilityRole="button" onPress={() => router.push('/notifications')} style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}><Text style={styles.cancelLabel}>Reminder preferences</Text></Pressable>
    </>
  );
}

export default function RoutineEditorScreen() {
  const { loading: authLoading, user } = useAuth();
  const { canWrite, error, loading, now, profile, retry, state } = useCare();
  if (authLoading || loading) return <CareFlowLayout title="Edit routine"><Text style={styles.body}>Opening this profile’s routine…</Text></CareFlowLayout>;
  if (!user) return <CareFlowLayout title="Edit routine"><Text accessibilityRole="header" style={styles.heading}>Sign in to edit a routine</Text><Text style={styles.body}>Guest preview does not save personal schedules.</Text><SubmitButton label="Sign in" onPress={() => router.push('/sign-in')} /></CareFlowLayout>;
  if (error || !canWrite) return <CareFlowLayout title="Edit routine"><InfoCard><Text accessibilityRole="alert" style={styles.body}>{error ?? 'Reload Care before editing this profile’s routine.'}</Text></InfoCard><SubmitButton label="Reload Care" onPress={retry} /></CareFlowLayout>;
  const dayKey = localDayKey(now);
  return <CareFlowLayout title="Edit routine"><RoutineForm dayKey={dayKey} key={`${user.userId}:${profile.id}:${dayKey}`} products={state.products} /></CareFlowLayout>;
}

const styles = StyleSheet.create({
  intro: { gap: 10 },
  heading: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 24, lineHeight: 33 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  product: { borderRadius: radius.card, padding: 16, gap: 12, backgroundColor: colors.surface },
  productName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 26 },
  label: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 21, marginTop: 4 },
  helper: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  error: { color: colors.error, fontFamily: font.medium, fontSize: 14, lineHeight: 21 },
  cancel: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: 12 },
  cancelLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 15 },
  pressed: { opacity: 0.68 },
});
