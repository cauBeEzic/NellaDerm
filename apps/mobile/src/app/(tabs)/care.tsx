import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useFocusEffect, type Href, useLocalSearchParams } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActiveProfileBar } from '@/components/active-profile-bar';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { formatCareStartDate, isBulkRoutineProduct, isProductScheduledOnDay, isRoutinePeriodComplete, routineConsistency, routineDaysLabel, routineHistory, routineLabel, toRoutineProducts, type CareProduct, type ReminderKey, type RoutinePeriod } from '@/lib/care';
import { localDayKey } from '@/lib/today';
import { colors, font, radius, size, spacing } from '@/theme';

type CareTab = 'routine' | 'products' | 'reminders';

type RoutineConfirmation = {
  scope: { userId: string | undefined; profileId: string; dayKey: string; canWrite: boolean; loading: boolean };
  generation: number;
  products: readonly Pick<CareProduct, 'id' | 'name' | 'category'>[];
  status: 'used' | 'due';
};

const tabs: { key: CareTab; label: string }[] = [
  { key: 'routine', label: 'Routine' },
  { key: 'products', label: 'Products' },
  { key: 'reminders', label: 'Reminders' },
];

function signInPrompt() {
  Alert.alert('Sign in to save Care changes', 'You can explore the demo as a guest. Sign in to save products, routines, supply, and reminder preferences.', [
    { text: 'Not now', style: 'cancel' },
    { text: 'Sign in', onPress: () => router.push('/sign-in') },
  ]);
}

function useAccountGate() {
  const { canWrite, error } = useCare();
  return () => {
    if (canWrite) return true;
    if (error) {
      Alert.alert('Care is unavailable', 'Reload Care before saving changes. Your previous records have not been replaced.');
      return false;
    }
    signInPrompt();
    return false;
  };
}

function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.wordmark}>
        <Text style={styles.brand}>MyEczema</Text>
        <Text style={styles.subBrand}>NellaDerm</Text>
      </View>
      <Text accessibilityRole="header" style={styles.headerTitle}>Care</Text>
      <Pressable accessibilityLabel="Open profile" accessibilityRole="button" onPress={() => router.push('/(tabs)/profile')} style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
        <MaterialCommunityIcons color={colors.onActionPrimary} name="account" size={19} />
      </Pressable>
    </View>
  );
}

function SegmentedControl({ active, onChange }: { active: CareTab; onChange: (tab: CareTab) => void }) {
  return (
    <View accessibilityRole="tablist" style={styles.segmented}>
      {tabs.map((tab) => {
        const selected = active === tab.key;
        return (
          <Pressable accessibilityRole="tab" accessibilityState={{ selected }} key={tab.key} onPress={() => onChange(tab.key)} style={({ pressed }) => [styles.segment, selected && styles.segmentActive, pressed && styles.pressed]}>
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ProductIcon({ product }: { product: CareProduct }) {
  return (
    <View style={[styles.productIcon, product.kind === 'prescription' && styles.prescriptionIcon]}>
      <MaterialCommunityIcons color={colors.actionPrimary} name={product.kind === 'prescription' ? 'medical-bag' : product.id === 'nella-calm' ? 'water-outline' : 'lotion-outline'} size={26} />
    </View>
  );
}

function ProductCard({ product }: { product: CareProduct }) {
  const { setProductSupply } = useCare();
  const requireAccount = useAccountGate();
  const low = product.supply === 'low';

  function handleSupply() {
    if (low) {
      router.push('/commerce/reorder');
      return;
    }
    if (!requireAccount()) return;
    void setProductSupply(product.id, 'low').catch(() => Alert.alert('Could not save', 'The supply update was not saved. Please try again.'));
  }

  return (
    <View style={styles.productCard}>
      <View style={styles.productHeading}>
        <View style={styles.productIdentity}>
          <ProductIcon product={product} />
          <View style={styles.productIdentityCopy}>
            {product.verified ? <View style={styles.verifiedRow}><MaterialCommunityIcons color={colors.success} name="check-decagram" size={13} /><Text style={styles.verified}>Verified</Text></View> : null}
            <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
            {product.manufacturer ? <Text style={styles.manufacturer}>{product.manufacturer}</Text> : null}
          </View>
        </View>
      </View>

      <View style={styles.productFacts}>
        <View style={styles.fact}>
          <View style={styles.factLabelRow}><MaterialCommunityIcons color={colors.textSecondary} name="clock-outline" size={14} /><Text style={styles.factLabel}>Routine</Text></View>
          <Text style={styles.factValue}>{routineLabel(product.schedule)} · {routineDaysLabel(product.weekdays)}</Text>
        </View>
        <View style={styles.fact}>
          <View style={styles.factLabelRow}><MaterialCommunityIcons color={colors.textSecondary} name="calendar-blank-outline" size={14} /><Text style={styles.factLabel}>Started</Text></View>
          <Text style={styles.factValue}>{formatCareStartDate(product.startedOn)}</Text>
        </View>
      </View>

      <View style={styles.supplyRow}>
        <View style={styles.supplyCopy}>
          <View style={[styles.supplyDot, low && styles.supplyDotLow]} />
          <Text style={styles.supplyLabel}>Supply</Text>
          <Text style={[styles.supplyValue, low && styles.supplyValueLow]}>{low ? 'Getting low' : 'Plenty left'}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={handleSupply} style={({ pressed }) => [styles.supplyButton, pressed && styles.pressed]}>
          <Text style={styles.supplyButtonLabel}>{low ? 'Reorder' : 'Update supply'}</Text>
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={() => router.push(`/care/product/${encodeURIComponent(product.id)}` as Href)} style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}>
        <Text style={styles.detailsButtonLabel}>View product details</Text>
        <MaterialCommunityIcons color={colors.actionPrimary} name="chevron-right" size={20} />
      </Pressable>
    </View>
  );
}

function Products() {
  const { profile, state } = useCare();
  return (
    <View style={styles.panel}>
      <View style={styles.titleRow}>
        <View><Text style={styles.profileLabel}>{profile.name}</Text><Text style={styles.title}>My products</Text><Text style={styles.subtitle}>Personal care cabinet</Text></View>
        <Text style={styles.activePill}>{state.products.length} active</Text>
      </View>
      {state.products.length ? <View style={styles.cardList}>{state.products.map((product) => <ProductCard key={product.id} product={product} />)}</View> : <View style={styles.emptyCard}><MaterialCommunityIcons color={colors.actionPrimary} name="package-variant-closed" size={28} /><Text style={styles.emptyTitle}>Your cabinet is empty</Text><Text style={styles.emptyBody}>Scan or add the first product you use. MyEczema will never invent missing directions.</Text></View>}
      <View style={styles.actionList}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/care/scan' as Href)} style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.onActionPrimary} name="barcode-scan" size={20} /><Text style={styles.primaryActionLabel}>Scan product</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/care/add-product' as Href)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.actionPrimary} name="plus" size={20} /><Text style={styles.secondaryActionLabel}>Add manually</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/commerce')} style={({ pressed }) => [styles.shopAction, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.actionPrimary} name="storefront-outline" size={20} /><Text style={styles.shopActionLabel}>Shop NellaDerm</Text></Pressable>
      </View>
    </View>
  );
}

function RoutinePeriodCard({ period, icon }: { period: Extract<RoutinePeriod, 'morning' | 'evening'>; icon: 'weather-sunset-up' | 'weather-night' }) {
  const { user } = useAuth();
  const { canWrite, loading, now, profile, state, setRoutinePeriodStatus } = useCare();
  const requireAccount = useAccountGate();
  const generationRef = useRef(0);
  const dayKey = localDayKey(now);
  const scope = useMemo(() => ({ userId: user?.userId, profileId: profile.id, dayKey, canWrite, loading }), [canWrite, dayKey, loading, profile.id, user?.userId]);
  const scopeRef = useRef(scope);
  const confirmationRef = useRef<RoutineConfirmation | undefined>(undefined);
  const [confirmation, setConfirmation] = useState<RoutineConfirmation>();
  const currentConfirmation = confirmation?.scope === scope ? confirmation : undefined;
  const products = state.products.filter((product) => isProductScheduledOnDay(product, dayKey, period));
  const bulkProducts = products.filter((product) => isBulkRoutineProduct(product, dayKey));
  const bulkDone = bulkProducts.length > 0 && toRoutineProducts(bulkProducts, state.events, period, now).every((product) => product.status === 'used');
  const done = isRoutinePeriodComplete(state, period, now);
  const label = period === 'morning' ? 'Morning routine' : 'Evening routine';
  const productIds = new Set(products.map((product) => product.id));
  const completedEvents = state.events.filter((event) => event.dayKey === dayKey && event.period === period && event.status === 'used' && productIds.has(event.productId));
  const completionTime = completedEvents.sort((left, right) => left.recordedAt.localeCompare(right.recordedAt)).at(-1)?.displayTime;
  const hasPrescriptions = products.some((product) => product.kind === 'prescription' || product.category === 'Prescription');
  const displayedProducts = currentConfirmation?.products ?? products;
  const cancelRoutine = useCallback(() => {
    confirmationRef.current = undefined;
    setConfirmation(undefined);
  }, []);

  useLayoutEffect(() => {
    scopeRef.current = scope;
    generationRef.current += 1;
    confirmationRef.current = undefined;
  }, [scope]);

  useFocusEffect(useCallback(() => {
    scopeRef.current = scope;
    generationRef.current += 1;
    cancelRoutine();
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        generationRef.current += 1;
        cancelRoutine();
      }
    });
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!confirmationRef.current) return false;
      cancelRoutine();
      return true;
    });
    return () => {
      generationRef.current += 1;
      cancelRoutine();
      subscription.remove();
      backSubscription.remove();
    };
  }, [cancelRoutine, scope]));

  function handleRoutine() {
    if (!requireAccount() || !bulkProducts.length || AppState.currentState !== 'active') return;
    const next: RoutineConfirmation = {
      scope,
      generation: generationRef.current,
      products: bulkProducts.map(({ id, name, category }) => ({ id, name, category })),
      status: bulkDone ? 'due' : 'used',
    };
    confirmationRef.current = next;
    setConfirmation(next);
  }

  function confirmRoutine(intent: RoutineConfirmation) {
    const isCurrent = () => scopeRef.current === intent.scope && generationRef.current === intent.generation && AppState.currentState === 'active' && localDayKey() === intent.scope.dayKey;
    if (confirmationRef.current !== intent || !isCurrent()) return;
    cancelRoutine();
    void setRoutinePeriodStatus(period, intent.products.map((product) => product.id), intent.status, intent.scope.dayKey).catch(() => {
      if (isCurrent()) Alert.alert('Could not save', 'The routine change was not saved. Please try again.');
    });
  }

  return (
    <View style={styles.routineCard}>
      <View style={styles.routineHeading}>
        <View style={styles.routineTitleRow}><View style={styles.routineIcon}><MaterialCommunityIcons color={colors.actionPrimary} name={icon} size={21} /></View><View><Text style={styles.routineTitle}>{label}</Text><Text style={styles.routineTime}>{done ? (completionTime ? `Done · ${completionTime}` : 'Done today') : 'No completion recorded today'}</Text></View></View>
        <Text style={[styles.statusPill, done ? styles.statusPillDone : styles.statusPillDue]}>{done ? 'Completed' : 'Not completed'}</Text>
      </View>
      {currentConfirmation ? <View><Text accessibilityRole="header" style={styles.routineTitle}>Review skin-care logs</Text><Text style={styles.emptyRoutine}>{profile.name} · {label}</Text></View> : null}
      <View style={styles.routineSteps}>
        {displayedProducts.length ? displayedProducts.map((product, index) => <View key={product.id} style={styles.routineStep}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{index + 1}</Text></View><View style={styles.stepCopy}><Text style={styles.stepCategory}>{product.category}</Text><Text numberOfLines={currentConfirmation ? undefined : 1} style={[styles.stepProduct, currentConfirmation && styles.routineTitle]}>{product.name}</Text></View></View>) : <Text style={styles.emptyRoutine}>No products scheduled for this time.</Text>}
      </View>
      {currentConfirmation ? (
        <>
          <Text style={styles.emptyRoutine}>{currentConfirmation.status === 'due' ? 'Clear only these Used logs' : 'Record only these products as Used'} for this period today.</Text>
          <Pressable accessibilityLabel={`Cancel ${period} skin-care logs`} accessibilityRole="button" onPress={cancelRoutine} style={({ pressed }) => [styles.routineButton, styles.routineButtonDone, pressed && styles.pressed]}><Text style={[styles.routineButtonLabel, styles.routineButtonLabelDone]}>Cancel</Text></Pressable>
          <Pressable accessibilityLabel={currentConfirmation.status === 'due' ? `Confirm undo ${period} skin-care logs` : `Confirm ${period} skin-care used`} accessibilityRole="button" onPress={() => confirmRoutine(currentConfirmation)} style={({ pressed }) => [styles.routineButton, pressed && styles.pressed]}><Text style={styles.routineButtonLabel}>{currentConfirmation.status === 'due' ? 'Undo logs' : 'Mark used'}</Text></Pressable>
        </>
      ) : (
        <Pressable
          accessibilityLabel={bulkDone ? `Undo ${period} skin-care logs` : `Mark ${period} skin-care done`}
          accessibilityRole="button"
          accessibilityState={{ disabled: !bulkProducts.length }}
          disabled={!bulkProducts.length}
          onPress={handleRoutine}
          style={({ pressed }) => [styles.routineButton, bulkDone && styles.routineButtonDone, !bulkProducts.length && styles.buttonDisabled, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={bulkDone ? colors.actionPrimary : colors.onActionPrimary} name={bulkDone ? 'undo' : 'check'} size={18} />
          <Text style={[styles.routineButtonLabel, bulkDone && styles.routineButtonLabelDone]}>{bulkDone ? 'Undo skin-care logs' : `Mark ${period} skin-care done`}</Text>
        </Pressable>
      )}
      {hasPrescriptions || currentConfirmation ? <Text style={styles.emptyRoutine}>Prescription use is logged individually in Today.</Text> : null}
    </View>
  );
}

function Routine() {
  const { now, profile, state } = useCare();
  const consistency = routineConsistency(state, now);
  const history = routineHistory(state, now);
  return (
    <View style={styles.panel}>
      <View><Text style={styles.profileLabel}>{profile.name}</Text><Text style={styles.title}>Today’s routine</Text><Text style={styles.subtitle}>Your products, in the order you use them</Text></View>
      <RoutinePeriodCard icon="weather-sunset-up" period="morning" />
      <RoutinePeriodCard icon="weather-night" period="evening" />
      <Pressable accessibilityRole="button" onPress={() => router.push('/care/routine')} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.actionPrimary} name="pencil-outline" size={19} /><Text style={styles.secondaryActionLabel}>Edit routine</Text></Pressable>
      <View style={styles.consistencyCard}>
        <View style={styles.consistencyHeading}><View><Text style={styles.consistencyTitle}>Routine consistency</Text><Text style={styles.consistencySubtitle}>{consistency.completedDays ? `${consistency.completedDays} of the past ${consistency.totalDays} days` : 'No routine history yet'}</Text></View><Text style={styles.consistencyMetric}>{consistency.completedDays ? `${consistency.percent}%` : '—'}</Text></View>
        <View style={styles.weekBars}>{history.map((day) => <View key={day.dayKey} style={styles.day}><View style={[styles.dayBar, day.completed ? styles.dayBarComplete : styles.dayBarMissed]} /><Text style={styles.dayLabel}>{day.label}</Text></View>)}</View>
      </View>
    </View>
  );
}

const reminderRows: { key: ReminderKey; title: string; subtitle: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { key: 'checkIn', title: 'Check-in', subtitle: '8:00 PM', icon: 'clipboard-pulse-outline' },
  { key: 'morning', title: 'Morning routine', subtitle: '8:00 AM', icon: 'weather-sunset-up' },
  { key: 'evening', title: 'Evening routine', subtitle: '9:00 PM', icon: 'weather-night' },
  { key: 'prescription', title: 'Prescription routine', subtitle: 'When a prescription item is scheduled', icon: 'medical-bag' },
  { key: 'weeklyReview', title: 'Weekly review', subtitle: 'Sunday evening', icon: 'calendar-week' },
  { key: 'productSupply', title: 'Reorder and supply', subtitle: 'When something may be running low', icon: 'package-variant-closed' },
];

function Reminders() {
  const { profile, state, toggleReminder } = useCare();
  const requireAccount = useAccountGate();
  return (
    <View style={styles.panel}>
      <View><Text style={styles.profileLabel}>{profile.name}</Text><Text style={styles.title}>Reminders</Text><Text style={styles.subtitle}>Choose what MyEczema should remind you about.</Text></View>
      <View style={styles.reminderList}>
        {reminderRows.map((row) => <View key={row.key} style={styles.reminderRow}><View style={styles.reminderIdentity}><View style={styles.reminderIcon}><MaterialCommunityIcons color={colors.actionPrimary} name={row.icon} size={20} /></View><View style={styles.reminderCopy}><Text style={styles.reminderTitle}>{row.title}</Text><Text style={styles.reminderSubtitle}>{row.subtitle}</Text></View></View><Switch accessibilityLabel={`${row.title} reminders`} ios_backgroundColor={colors.borderDefault} onValueChange={() => { if (requireAccount()) void toggleReminder(row.key).catch(() => Alert.alert('Could not save', 'The reminder preference was not saved. Please try again.')); }} thumbColor={colors.surface} trackColor={{ false: colors.borderDefault, true: colors.actionPrimary }} value={state.reminders[row.key]} /></View>)}
      </View>
      <View style={styles.quietCard}><View style={styles.quietHeading}><View style={styles.reminderIdentity}><View style={styles.reminderIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="moon-waning-crescent" size={20} /></View><View style={styles.reminderCopy}><Text style={styles.reminderTitle}>Quiet hours</Text><Text style={styles.reminderSubtitle}>{state.reminders.quietHoursLabel}</Text></View></View><Pressable accessibilityRole="button" onPress={() => router.push('/notifications' as Href)} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}><Text style={styles.editLink}>Edit</Text></Pressable></View><Text style={styles.quietNote}>Local device schedules and permission are managed in Notification settings. Lock-screen copy stays generic.</Text></View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/notifications' as Href)} style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.actionPrimary} name="bell-cog-outline" size={19} /><Text style={styles.secondaryActionLabel}>Open notification settings</Text></Pressable>
    </View>
  );
}

export default function CareScreen() {
  const { error, loading, profile, retry } = useCare();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const requestedTab = tabs.some((item) => item.key === tab) ? tab as CareTab : 'products';
  const [activeTab, setActiveTab] = useState<CareTab>(requestedTab);
  return <SafeAreaView edges={['top']} style={styles.safeArea}><Header /><ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}><SegmentedControl active={activeTab} onChange={setActiveTab} /><ActiveProfileBar />{profile.isDemo ? <View style={styles.demoBanner}><MaterialCommunityIcons color={colors.actionPrimary} name="eye-outline" size={18} /><Text style={styles.demoBannerText}>Demo cabinet · Sign in to save changes</Text></View> : null}{error ? <View accessibilityRole="alert" style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={retry} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}><Text style={styles.retryLabel}>Reload Care</Text></Pressable></View> : null}{loading ? <ActivityIndicator color={colors.actionPrimary} style={styles.loader} /> : null}{!loading && activeTab === 'products' ? <Products /> : null}{!loading && activeTab === 'routine' ? <Routine /> : null}{!loading && activeTab === 'reminders' ? <Reminders /> : null}</ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { width: 92 },
  brand: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 11, lineHeight: 16 },
  subBrand: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 9, lineHeight: 12 },
  headerTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary },
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 36, gap: 24 },
  segmented: { height: 56, padding: 4, borderRadius: radius.pill, flexDirection: 'row', backgroundColor: colors.borderDefault },
  segment: { flex: 1, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.surface },
  segmentLabel: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13 },
  segmentLabelActive: { color: colors.actionPrimary, fontFamily: font.semibold },
  loader: { paddingVertical: spacing.section },
  demoBanner: { minHeight: 48, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceBrandSoft },
  demoBannerText: { flex: 1, color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 12, lineHeight: 17 },
  errorBanner: { borderRadius: 12, padding: 14, gap: 10, backgroundColor: '#FEECE8' },
  errorText: { color: colors.error, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  retryButton: { minHeight: 48, alignSelf: 'flex-start', borderRadius: 24, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  retryLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  panel: { gap: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  title: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 24, lineHeight: 32 },
  subtitle: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  profileLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 11, lineHeight: 17, textTransform: 'uppercase', letterSpacing: 0.4 },
  activePill: { marginTop: 4, borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 4, color: colors.textSecondary, backgroundColor: colors.surfaceBrandSoft, fontFamily: font.regular, fontSize: 11 },
  cardList: { gap: 16 },
  emptyCard: { minHeight: 180, borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surface },
  emptyTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  emptyBody: { maxWidth: 260, textAlign: 'center', color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  productCard: { borderRadius: 16, padding: 20, gap: 15, backgroundColor: colors.surface },
  productHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  productIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 },
  productIcon: { width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  prescriptionIcon: { backgroundColor: '#F0F4FF' },
  productIdentityCopy: { flex: 1, gap: 1 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verified: { color: colors.success, fontFamily: font.semibold, fontSize: 11, lineHeight: 16 },
  productName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  manufacturer: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  productFacts: { borderRadius: 12, padding: 8, flexDirection: 'row', backgroundColor: colors.canvas },
  fact: { flex: 1, gap: 2 },
  factLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factLabel: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16 },
  factValue: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  supplyRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  supplyCopy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  supplyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  supplyDotLow: { backgroundColor: colors.warning },
  supplyLabel: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12 },
  supplyValue: { color: colors.success, fontFamily: font.semibold, fontSize: 12 },
  supplyValueLow: { color: colors.warning },
  supplyButton: { minHeight: 48, borderRadius: 24, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  supplyButtonLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 12 },
  detailsButton: { minHeight: 48, borderTopWidth: 1, borderTopColor: colors.borderDefault, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailsButtonLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  actionList: { gap: 10 },
  primaryAction: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.actionPrimary },
  primaryActionLabel: { color: colors.onActionPrimary, fontFamily: font.semibold, fontSize: 15 },
  secondaryAction: { height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.surface },
  secondaryActionLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 15 },
  shopAction: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shopActionLabel: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 14 },
  routineCard: { borderRadius: 16, padding: 20, gap: 16, backgroundColor: colors.surface },
  routineHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  routineTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  routineIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  routineTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  routineTime: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  statusPill: { borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, fontFamily: font.semibold, fontSize: 10 },
  statusPillDone: { color: colors.success, backgroundColor: '#E7F4EE' },
  statusPillDue: { color: colors.warning, backgroundColor: '#FFF3D6' },
  routineSteps: { gap: 10 },
  routineStep: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  stepNumberText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 11 },
  stepCopy: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  stepCategory: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 13 },
  stepProduct: { flex: 1, textAlign: 'right', color: colors.textSecondary, fontFamily: font.regular, fontSize: 12 },
  emptyRoutine: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  routineButton: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: colors.actionPrimary },
  routineButtonDone: { borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.surface },
  buttonDisabled: { opacity: 0.45 },
  routineButtonLabel: { flexShrink: 1, textAlign: 'center', color: colors.onActionPrimary, fontFamily: font.semibold, fontSize: 13 },
  routineButtonLabelDone: { color: colors.actionPrimary },
  consistencyCard: { borderRadius: 16, padding: 20, gap: 18, backgroundColor: colors.surface },
  consistencyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  consistencyTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  consistencySubtitle: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  consistencyMetric: { color: colors.actionPrimary, fontFamily: font.bold, fontSize: 22 },
  weekBars: { height: 58, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: 5 },
  dayBar: { width: 24, borderRadius: 6 },
  dayBarComplete: { height: 38, backgroundColor: colors.actionPrimary },
  dayBarMissed: { height: 18, backgroundColor: colors.borderDefault },
  dayLabel: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 10 },
  reminderList: { borderRadius: 16, paddingHorizontal: 20, backgroundColor: colors.surface },
  reminderRow: { minHeight: 76, borderBottomWidth: 1, borderBottomColor: colors.borderDefault, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  reminderIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  reminderCopy: { flex: 1 },
  reminderTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  reminderSubtitle: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
  quietCard: { borderRadius: 16, padding: 20, gap: 14, backgroundColor: colors.surface },
  quietHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  editButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  quietNote: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.borderDefault, color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  editLink: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  pressed: { opacity: 0.68 },
});
