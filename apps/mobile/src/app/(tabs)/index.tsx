import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActiveProfileBar } from '@/components/active-profile-bar';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { comparisonLabel, type CheckInComparison } from '@/lib/check-in';
import { activeRoutinePeriod, toRoutineProducts, type RoutinePeriod } from '@/lib/care';
import { type RoutineProduct } from '@/lib/today';
import { colors, font, radius, size, spacing } from '@/theme';

const checkInOptions = [
  { value: 'better', label: 'Better', icon: 'weather-windy' },
  { value: 'same', label: 'Same', icon: 'minus' },
  { value: 'worse', label: 'Worse', icon: 'water' },
] as const;

function todayLabel(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function greetingLabel(date = new Date()) {
  if (date.getHours() < 12) return 'Good morning';
  if (date.getHours() < 18) return 'Good afternoon';
  return 'Good evening';
}

function IconCircle({ icon, muted = false }: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  muted?: boolean;
}) {
  return (
    <View style={[styles.productIcon, muted && styles.productIconMuted]}>
      <MaterialCommunityIcons color={muted ? colors.textSecondary : colors.actionPrimary} name={icon} size={20} />
    </View>
  );
}

function ProductCard({ onStatusChange, product }: {
  onStatusChange: (product: RoutineProduct, status: 'used' | 'skipped') => void;
  product: RoutineProduct;
}) {
  const isUsed = product.status === 'used';
  const isSkipped = product.status === 'skipped';
  const isPrescription = product.kind === 'prescription';

  return (
    <View style={styles.productCard}>
      <IconCircle icon={isPrescription ? 'medical-bag' : product.name === 'NellaCalm' ? 'water' : 'spa'} />
      <View style={styles.productCopy}>
        {isPrescription ? <Text style={styles.prescriptionPill}>Prescription</Text> : null}
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productArea}>{product.area}</Text>
        {isUsed ? (
          <View style={styles.statusLine}>
            <Text style={styles.usedAt}>Used {product.usedAt}</Text>
            <Pressable accessibilityRole="button" onPress={() => onStatusChange(product, 'used')} style={({ pressed }) => [styles.inlineStatusButton, pressed && styles.pressed]}>
              <Text style={styles.inlineAction}>Undo</Text>
            </Pressable>
          </View>
        ) : isSkipped ? (
          <Pressable accessibilityRole="button" onPress={() => onStatusChange(product, 'skipped')} style={({ pressed }) => [styles.inlineStatusButton, pressed && styles.pressed]}>
            <Text style={styles.skipped}>Skipped · Undo</Text>
          </Pressable>
        ) : !isPrescription ? (
          <Pressable accessibilityRole="button" onPress={() => onStatusChange(product, 'skipped')} style={({ pressed }) => [styles.inlineStatusButton, pressed && styles.pressed]}>
            <Text style={styles.skipped}>Skip today</Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel={isUsed ? `Undo ${product.name}` : `Mark ${product.name} as used`}
        accessibilityRole="button"
        accessibilityState={{ selected: isUsed }}
        onPress={() => onStatusChange(product, 'used')}
        style={({ pressed }) => [
          isPrescription ? styles.logButton : styles.statusButton,
          isUsed && styles.statusButtonUsed,
          pressed && styles.pressed,
        ]}>
        {isPrescription && !isUsed ? (
          <Text style={styles.logButtonText}>Log use</Text>
        ) : (
          <MaterialCommunityIcons color={isUsed ? colors.onActionPrimary : colors.actionPrimary} name="check" size={22} />
        )}
      </Pressable>
    </View>
  );
}

function EmptyRoutine({ onAdd, onScan }: { onAdd: () => void; onScan: () => void }) {
  return (
    <View style={styles.routineCard}>
      <View style={styles.setupHeading}>
        <IconCircle icon="archive-outline" />
        <View style={styles.setupCopy}>
          <Text style={styles.setupTitle}>Add the products you use</Text>
          <Text style={styles.setupBody}>Add moisturizers, cleansers, or prescriptions to build your personal routine.</Text>
        </View>
      </View>
      <View style={styles.setupActions}>
        <Pressable accessibilityRole="button" onPress={onScan} style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={colors.onActionPrimary} name="qrcode-scan" size={18} />
          <Text style={styles.scanButtonText}>Scan</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.manualButton, pressed && styles.pressed]}>
          <Text style={styles.manualButtonText}>Add manually</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={() => Alert.alert('No routine added', 'You can add products any time from Care.')} style={({ pressed }) => [styles.noProductsButton, pressed && styles.pressed]}>
        <Text style={styles.noProducts}>I don’t use any products yet</Text>
      </Pressable>
    </View>
  );
}

function Routine({ hasSavedProducts, onAdd, onScan, onStatusChange, period, products }: {
  hasSavedProducts: boolean;
  period: Extract<RoutinePeriod, 'morning' | 'evening'>;
  onAdd: () => void;
  onScan: () => void;
  onStatusChange: (product: RoutineProduct, status: 'used' | 'skipped') => void;
  products: RoutineProduct[];
}) {
  const skincare = products.filter((product) => product.kind === 'skincare');
  const prescriptions = products.filter((product) => product.kind === 'prescription');
  const marked = skincare.filter((product) => product.status !== 'due').length;
  const periodLabel = period === 'morning' ? 'Morning' : 'Evening';
  const routineDone = skincare.length > 0 && skincare.every((product) => product.status === 'used');

  if (!products.length) {
    if (!hasSavedProducts) return <EmptyRoutine onAdd={onAdd} onScan={onScan} />;
    return <View style={styles.routineCard}><Text style={styles.morningTitle}>Nothing scheduled for this period</Text><Text style={styles.morningBody}>Your saved products are still in Care. Review their days and time periods whenever you need.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/care/routine')} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}><Text style={styles.editText}>Edit routine</Text></Pressable></View>;
  }

  return (
    <View style={styles.routineCard}>
      <View style={styles.routinePeriodRow}>
        <View style={styles.routinePeriod}>
          <MaterialCommunityIcons color={colors.actionPrimary} name={period === 'morning' ? 'white-balance-sunny' : 'weather-night'} size={18} />
          <Text style={styles.routinePeriodText}>{skincare.length ? (routineDone ? `${periodLabel} · done` : `${periodLabel} · due now`) : `${periodLabel} · prescription only`}</Text>
        </View>
        {skincare.length > 1 ? <Text style={styles.markedText}>{marked} of {skincare.length} marked</Text> : null}
      </View>

      {skincare.map((product) => <ProductCard key={product.id} onStatusChange={onStatusChange} product={product} />)}

      {prescriptions.length ? (
        <>
          <View style={styles.divider} />
          <View style={styles.prescribedHeading}>
            <MaterialCommunityIcons color={colors.textPrimary} name="medical-bag" size={15} />
            <Text style={styles.prescribedHeadingText}>As prescribed</Text>
          </View>
          {prescriptions.map((product) => <ProductCard key={product.id} onStatusChange={onStatusChange} product={product} />)}
        </>
      ) : null}

      <View style={styles.divider} />
      <View style={styles.morningRow}>
        <MaterialCommunityIcons color={colors.textSecondary} name={period === 'morning' ? 'white-balance-sunny' : 'weather-night'} size={18} />
        <View style={styles.morningCopy}>
          <Text style={styles.morningTitle}>{marked ? `${periodLabel} · ${marked} marked` : periodLabel}</Text>
          <Text style={styles.morningBody}>{marked ? 'Your latest activity is saved.' : `Review your ${periodLabel.toLowerCase()} routine when you’re ready.`}</Text>
        </View>
      </View>
      <View style={styles.routineActions}>
        <Pressable accessibilityRole="button" onPress={onAdd} style={({ pressed }) => [styles.inlineButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={colors.actionPrimary} name="plus" size={18} />
          <Text style={styles.inlineButtonText}>Add another product</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push('/care/routine')} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
          <Text style={styles.editText}>Edit routine</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TodayScreen() {
  const { user } = useAuth();
  const { canWrite, error: careError, loading: careLoading, now, profile, setProductStatus, state: careState } = useCare();
  const { beginDraft, beginEdit, canWrite: canWriteCheckIn, error: checkInError, loading: checkInLoading, state: checkInState } = useCheckIn();
  const date = todayLabel(now);
  const period = activeRoutinePeriod(now);
  const products = toRoutineProducts(careState.products, careState.events, period, now);
  const lowProduct = careState.products.find((product) => product.supply === 'low');

  async function openCheckIn(comparison?: CheckInComparison) {
    if (!user) {
      Alert.alert('Sign in to record a check-in', 'Guest mode does not store health observations.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    if (!canWriteCheckIn) {
      Alert.alert('Check-in unavailable', checkInError ?? 'Wait for this profile to finish loading and try again.');
      return;
    }
    try {
      if (!comparison && checkInState.draft) {
        router.push('/check-in');
        return;
      }
      await beginDraft(comparison);
      router.push(comparison ? '/check-in/quick' : '/check-in');
    } catch {
      Alert.alert('Could not open check-in', 'Your draft could not be saved on this device. Reload and try again.');
    }
  }

  async function editCheckIn() {
    try {
      await beginEdit();
      router.push('/check-in');
    } catch {
      Alert.alert('Could not edit check-in', 'Your saved entry could not be opened for editing.');
    }
  }

  function addProduct() {
    router.push('/care/add-product' as Href);
  }

  function scanProduct() {
    router.push('/care/scan' as Href);
  }

  function changeStatus(product: RoutineProduct, status: 'used' | 'skipped') {
    if (!canWrite) {
      if (careError) {
        Alert.alert('Care is unavailable', 'Open Care and reload your records before logging routine activity.');
        return;
      }
      Alert.alert('Sign in to save your routine', 'You can explore the demo cabinet as a guest. Sign in to record product use.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Sign in', onPress: () => router.push('/sign-in') },
      ]);
      return;
    }
    void setProductStatus(product.id, status, period).catch(() => Alert.alert('Could not save', 'Your routine change was not saved. Please try again.'));
  }

  if (careLoading || checkInLoading) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.actionPrimary} />
        <Text style={styles.loadingText}>Preparing today…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.wordmark}>
          <Text style={styles.brand}>MyEczema</Text>
          <Text style={styles.subBrand}>NellaDerm</Text>
        </View>
        <Text accessibilityRole="header" style={styles.headerTitle}>Today</Text>
        <Pressable accessibilityLabel="Open profile" accessibilityRole="button" onPress={() => router.push('/(tabs)/profile')} style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={colors.onActionPrimary} name="account" size={19} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.greetingRow}>
          <View style={styles.greetingCopy}>
            <Text style={styles.date}>{date}</Text>
            <Text style={styles.greeting}>{greetingLabel(now)}, {profile.name}</Text>
          </View>
          <View style={styles.profileMark}><MaterialCommunityIcons color={colors.actionPrimary} name="spa" size={24} /></View>
        </View>
        <ActiveProfileBar detail="Switch before recording health information" />

        {checkInState.entry ? (
          <View style={styles.checkInCard}>
            <Text style={styles.checkInTitle}>Today’s check-in saved</Text>
            <Text style={styles.checkInSavedBody}>{comparisonLabel(checkInState.entry.comparison)} · Your skin entry is in this profile’s local history.</Text>
            <Pressable accessibilityRole="button" onPress={() => void editCheckIn()} style={({ pressed }) => [styles.editCheckInButton, pressed && styles.pressed]}>
              <Text style={styles.editCheckInText}>Edit check-in</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.checkInCard}>
            <Text style={styles.checkInTitle}>How’s your skin today?</Text>
            <Text style={styles.checkInSavedBody}>Compare today with your usual skin.</Text>
            <View accessibilityRole="radiogroup" style={styles.checkInOptions}>
              {checkInOptions.map((option) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: false }}
                  key={option.value}
                  onPress={() => void openCheckIn(option.value)}
                  style={({ pressed }) => [styles.checkInOption, pressed && styles.pressed]}>
                  <View style={styles.checkInIcon}>
                    <MaterialCommunityIcons color={option.value === 'better' ? colors.actionPrimary : colors.textSecondary} name={option.icon} size={20} />
                  </View>
                  <Text style={styles.checkInLabel}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" onPress={() => void openCheckIn()} style={({ pressed }) => [styles.moreDetailButton, pressed && styles.pressed]}>
              <Text style={styles.moreDetailText}>{checkInState.draft ? 'Resume saved draft' : 'Open full check-in'}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Your routine</Text>
            <Text style={styles.sectionMeta}>{products.length ? `${products.length} ${products.length === 1 ? 'product' : 'products'}` : careState.products.length ? 'None this period' : 'Not set up yet'}</Text>
          </View>
          <Routine hasSavedProducts={careState.products.length > 0} onAdd={addProduct} onScan={scanProduct} onStatusChange={changeStatus} period={period} products={products} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>For you</Text>
            <Text style={styles.sectionMeta}>Gentle reminder</Text>
          </View>
          <View style={styles.reminderCard}>
            <View style={styles.reminderTop}>
              <IconCircle icon="archive" muted />
              <View style={styles.reminderCopy}>
                <Text style={styles.reminderTitle}>{lowProduct ? `${lowProduct.name} is marked as getting low.` : 'Your Care cabinet is up to date.'}</Text>
                <Text style={styles.reminderBody}>{lowProduct ? 'Review its supply in Care. No order is placed from this reminder.' : 'Saved product and routine reminders will appear here without inventing account activity.'}</Text>
              </View>
            </View>
            <View style={styles.reminderActions}>
              <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/care')} style={({ pressed }) => [styles.reorderButton, pressed && styles.pressed]}>
                <Text style={styles.reorderText}>{lowProduct ? 'Review supply' : 'Open Care'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.canvas },
  loadingText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14 },
  header: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { width: 92 },
  brand: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 11, lineHeight: 16 },
  subBrand: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 9, lineHeight: 12 },
  headerTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary },
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 36, gap: 24 },
  greetingRow: { minHeight: 61, paddingTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greetingCopy: { flex: 1, gap: 2 },
  date: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 25 },
  greeting: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 22, lineHeight: 30 },
  profileMark: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.borderDefault },
  checkInCard: { padding: 16, gap: 12, borderRadius: 16, backgroundColor: colors.surface },
  checkInTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 26 },
  checkInOptions: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  checkInOption: { flex: 1, height: 90, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.canvas, borderWidth: 1, borderColor: 'transparent' },
  checkInOptionSelected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  checkInIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  checkInIconSelected: { backgroundColor: colors.actionPrimary },
  checkInLabel: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 15, lineHeight: 20 },
  checkInSavedBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  editCheckInButton: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  editCheckInText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 15 },
  moreDetailButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  moreDetailText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  section: { gap: 8 },
  sectionHeading: { height: 26, paddingHorizontal: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  sectionMeta: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 16 },
  routineCard: { padding: 24, gap: 12, borderRadius: 16, backgroundColor: colors.surface },
  setupHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  setupCopy: { flex: 1, gap: 4 },
  setupTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 24 },
  setupBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  setupActions: { flexDirection: 'row', gap: 8 },
  scanButton: { flex: 1, height: 48, borderRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.actionPrimary },
  scanButtonText: { color: colors.onActionPrimary, fontFamily: font.semibold, fontSize: 13 },
  manualButton: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderDefault },
  manualButtonText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  noProducts: { textAlign: 'center', color: colors.textSecondary, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  noProductsButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  routinePeriodRow: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routinePeriod: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routinePeriodText: { color: colors.actionPrimary, fontFamily: font.bold, fontSize: 13, lineHeight: 18 },
  markedText: { color: colors.textSecondary, fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  productCard: { minHeight: 89, padding: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.canvas },
  productIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  productIconMuted: { backgroundColor: colors.surfaceBrandSoft },
  productCopy: { flex: 1, gap: 2 },
  productName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  productArea: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  prescriptionPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, overflow: 'hidden', color: colors.actionPrimary, backgroundColor: '#DDEBFF', fontFamily: font.semibold, fontSize: 11, lineHeight: 16 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  inlineStatusButton: { minHeight: 48, justifyContent: 'center' },
  usedAt: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 12, lineHeight: 16 },
  inlineAction: { color: colors.actionPrimary, fontFamily: font.bold, fontSize: 12, lineHeight: 16 },
  skipped: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  statusButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.actionPrimary },
  statusButtonUsed: { backgroundColor: colors.actionPrimary },
  logButton: { minWidth: 76, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.actionPrimary },
  logButtonText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  divider: { height: 1, backgroundColor: colors.borderDefault },
  prescribedHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  prescribedHeadingText: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  morningRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  morningCopy: { flex: 1 },
  morningTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  morningBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  routineActions: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inlineButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 4 },
  inlineButtonText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  editButton: { minHeight: 48, minWidth: 88, alignItems: 'flex-end', justifyContent: 'center' },
  editText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13 },
  reminderCard: { padding: 24, gap: 18, borderRadius: 16, backgroundColor: colors.surface },
  reminderTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  reminderCopy: { flex: 1, gap: 8 },
  reminderTitle: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 15, lineHeight: 21 },
  reminderBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  reminderActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  reorderButton: { minWidth: 118, height: 48, borderRadius: 24, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  reorderText: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 15 },
  pressed: { opacity: 0.68 },
});
