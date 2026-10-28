import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/button';
import { ErrorBanner, InsightsDetailScreen, ProfileContext } from '@/components/insights-layout';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { useNotifications } from '@/contexts/notification-context';
import { nextReminderLabel, notificationPreferenceRows, quietHourOptions, type NotificationPermissionState } from '@/lib/notifications';
import { colors, font, radius, size } from '@/theme';

const reminderIcons = {
  checkIn: 'clipboard-pulse-outline',
  morning: 'weather-sunset-up',
  evening: 'weather-night',
  prescription: 'medical-bag',
  weeklyReview: 'calendar-week-outline',
  productSupply: 'package-variant-closed',
} as const;

function permissionLabel(permission: NotificationPermissionState) {
  if (permission === 'granted') return 'Allowed on this device';
  if (permission === 'denied') return 'Blocked in device settings';
  if (permission === 'unavailable') return 'Unavailable on this device';
  if (permission === 'checking') return 'Checking device access…';
  return 'Not allowed yet';
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { error: careError, loading: careLoading, profile, setQuietHours, state, toggleReminder } = useCare();
  const { error, permission, plans, requestPermission, retry, scheduledCount, sendTestReminder, syncing } = useNotifications();
  const [savingKey, setSavingKey] = useState<string>();

  async function changePreference(key: keyof typeof state.reminders) {
    if (!user || key === 'quietHours' || key === 'quietHoursLabel') return;
    setSavingKey(key);
    try {
      await toggleReminder(key);
    } catch {
      Alert.alert('Could not save', 'The reminder preference was not saved. Reload Notifications and try again.');
    } finally {
      setSavingKey(undefined);
    }
  }

  async function changeQuietHours(label: string) {
    setSavingKey('quietHours');
    try {
      await setQuietHours(label);
    } catch {
      Alert.alert('Could not save', 'Quiet hours were not changed. Reload Notifications and try again.');
    } finally {
      setSavingKey(undefined);
    }
  }

  async function enableNotifications() {
    const result = await requestPermission();
    if (result === 'denied') Alert.alert('Notifications are blocked', 'You can allow MyEczema notifications later in device settings.');
    if (result === 'unavailable') Alert.alert('Notifications unavailable', 'This device could not provide notification access. Your preferences remain saved.');
  }

  async function sendTest() {
    try {
      await sendTestReminder();
      Alert.alert('Private test scheduled', 'A generic MyEczema reminder will appear in about five seconds. Tap it to return here.');
    } catch {
      Alert.alert('Test reminder unavailable', 'Allow notifications and try again on an iOS or Android device.');
    }
  }

  return (
    <InsightsDetailScreen title="Notifications">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!user ? (
          <View style={styles.gate}>
            <View style={styles.heroIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="bell-off-outline" size={30} /></View>
            <Text accessibilityRole="header" style={styles.gateTitle}>Sign in to save reminders</Text>
            <Text style={styles.body}>Notification preferences belong to a private profile. Guest exploration never creates a device schedule.</Text>
            <PrimaryButton label="Sign in" onPress={() => router.push('/sign-in')} />
          </View>
        ) : (
          <>
            <ProfileContext isDemo={false} name={profile.name} offline={false} onPress={() => router.push('/profile/switch')} />
            {error ? <ErrorBanner message={error} onRetry={retry} /> : null}
            {careError ? <ErrorBanner message={careError} onRetry={retry} /> : null}

            <View style={styles.hero}>
              <View style={styles.heroIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="bell-badge-outline" size={27} /></View>
              <View style={styles.heroCopy}><Text accessibilityRole="header" style={styles.heroTitle}>Reminders without private lock-screen detail</Text><Text style={styles.body}>Choose what helps. Every alert uses generic copy and opens private context only after MyEczema authenticates the account and profile.</Text></View>
            </View>

            <View style={styles.permissionCard}>
              <View style={styles.permissionHeading}><View style={styles.permissionIcon}><MaterialCommunityIcons color={permission === 'granted' ? colors.success : colors.actionPrimary} name={permission === 'granted' ? 'shield-check-outline' : 'shield-lock-outline'} size={22} /></View><View style={styles.permissionCopy}><Text style={styles.cardTitle}>Device permission</Text><Text style={styles.cardDetail}>{permissionLabel(permission)}</Text></View>{syncing || permission === 'checking' ? <ActivityIndicator color={colors.actionPrimary} /> : null}</View>
              {permission === 'undetermined' ? <PrimaryButton disabled={syncing} label="Allow private reminders" onPress={() => void enableNotifications()} /> : null}
              {permission === 'denied' ? <SecondaryButton label="Open device settings" onPress={() => void Linking.openSettings()} /> : null}
              {permission === 'granted' ? <Text style={styles.permissionNote}>{error || syncing ? 'Device schedules are being reconciled or need recovery. Review the status above before relying on them.' : `${scheduledCount} local reminder schedule${scheduledCount === 1 ? '' : 's'} active for ${profile.name}. Changes synchronize automatically.`}</Text> : <Text style={styles.permissionNote}>Preferences can be saved before permission is allowed. No notification is scheduled until access is granted.</Text>}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reminder preferences</Text>
              <View style={styles.preferenceGroup}>
                {notificationPreferenceRows.map((row, index) => (
                  <View key={row.key} style={[styles.preferenceRow, index > 0 && styles.rowBorder]}>
                    <View style={styles.rowIcon}><MaterialCommunityIcons color={colors.actionPrimary} name={reminderIcons[row.key]} size={21} /></View>
                    <View style={styles.rowCopy}><Text style={styles.rowTitle}>{row.title}</Text><Text style={styles.rowSchedule}>{row.scheduleLabel}</Text><Text style={styles.rowDetail}>{row.detail}</Text></View>
                    {savingKey === row.key ? <ActivityIndicator color={colors.actionPrimary} /> : <Switch accessibilityLabel={`${row.title} reminders`} disabled={careLoading || Boolean(savingKey)} ios_backgroundColor={colors.borderDefault} onValueChange={() => void changePreference(row.key)} thumbColor={colors.surface} trackColor={{ false: colors.borderDefault, true: colors.actionPrimary }} value={state.reminders[row.key]} />}
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quiet hours</Text>
              <View style={styles.quietCard}><Text style={styles.cardDetail}>No reminders are scheduled inside the selected window.</Text><View accessibilityRole="radiogroup" style={styles.quietOptions}>{quietHourOptions.map((label) => { const selected = state.reminders.quietHoursLabel === label; return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: Boolean(savingKey) }} disabled={Boolean(savingKey)} key={label} onPress={() => void changeQuietHours(label)} style={({ pressed }) => [styles.quietOption, selected && styles.quietSelected, pressed && styles.pressed]}><MaterialCommunityIcons color={selected ? colors.actionPrimary : colors.textSecondary} name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={20} /><Text style={[styles.quietLabel, selected && styles.quietLabelSelected]}>{label}</Text></Pressable>; })}</View></View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Upcoming on this device</Text>
              <View style={styles.scheduleCard}>
                {plans.length ? plans.map((plan, index) => <View key={plan.key} style={[styles.scheduleRow, index > 0 && styles.rowBorder]}><MaterialCommunityIcons color={colors.actionPrimary} name="clock-outline" size={19} /><View style={styles.scheduleCopy}><Text style={styles.scheduleName}>{notificationPreferenceRows.find((item) => plan.key.startsWith(item.key))?.title ?? 'Prescription routine'}</Text><Text style={styles.cardDetail}>{nextReminderLabel(plan)}</Text></View><Text style={styles.localPill}>Local</Text></View>) : <Text style={styles.empty}>No time-based reminders are enabled for this profile.</Text>}
                {state.reminders.productSupply && state.products.some((product) => product.supply === 'low') ? <View style={[styles.scheduleRow, plans.length > 0 && styles.rowBorder]}><MaterialCommunityIcons color={colors.warning} name="package-variant-closed" size={19} /><View style={styles.scheduleCopy}><Text style={styles.scheduleName}>Supply review available</Text><Text style={styles.cardDetail}>Shown inside MyEczema because a saved product is marked low.</Text></View><Text style={styles.inAppPill}>In app</Text></View> : null}
              </View>
            </View>

            {permission === 'granted' ? <SecondaryButton disabled={syncing} label="Send a private test reminder" onPress={() => void sendTest()} /> : null}
            <View style={styles.boundary}><MaterialCommunityIcons color={colors.actionPrimary} name="server-off" size={20} /><Text style={styles.boundaryText}>Local reminders work on this device. Remote APNs/FCM delivery, cross-device schedules, and AWS EventBridge workers are not connected in this demo.</Text></View>
          </>
        )}
      </ScrollView>
    </InsightsDetailScreen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 44, gap: 20 },
  gate: { minHeight: 390, borderRadius: 16, padding: 26, justifyContent: 'center', gap: 13, backgroundColor: colors.surface },
  gateTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 21, lineHeight: 29 },
  hero: { borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'flex-start', gap: 14, backgroundColor: colors.surface },
  heroIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  heroCopy: { flex: 1, gap: 5 },
  heroTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  permissionCard: { borderRadius: 16, padding: 18, gap: 14, backgroundColor: colors.surface },
  permissionHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  permissionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  permissionCopy: { flex: 1 },
  cardTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  cardDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  permissionNote: { paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDefault, color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  section: { gap: 10 },
  sectionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 17, lineHeight: 24 },
  preferenceGroup: { borderRadius: 16, paddingHorizontal: 16, backgroundColor: colors.surface },
  preferenceRow: { minHeight: 92, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDefault },
  rowIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  rowCopy: { flex: 1 },
  rowTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  rowSchedule: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 11, lineHeight: 16 },
  rowDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 10, lineHeight: 15 },
  quietCard: { borderRadius: 16, padding: 18, gap: 12, backgroundColor: colors.surface },
  quietOptions: { gap: 6 },
  quietOption: { minHeight: 48, borderRadius: radius.control, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.canvas },
  quietSelected: { borderWidth: 1, borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  quietLabel: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 12 },
  quietLabelSelected: { color: colors.textPrimary, fontFamily: font.semibold },
  scheduleCard: { borderRadius: 16, paddingHorizontal: 16, backgroundColor: colors.surface },
  scheduleRow: { minHeight: 66, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 11 },
  scheduleCopy: { flex: 1 },
  scheduleName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 12, lineHeight: 18 },
  localPill: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4, color: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft, fontFamily: font.semibold, fontSize: 9 },
  inAppPill: { overflow: 'hidden', borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 4, color: colors.warning, backgroundColor: '#FFF3D6', fontFamily: font.semibold, fontSize: 9 },
  empty: { paddingVertical: 20, color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  boundary: { borderRadius: radius.card, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surfaceBrandSoft },
  boundaryText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.68 },
});
