import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, radius, size, spacing } from '@/theme';

export function InsightsHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.wordmark}><Text style={styles.brand}>MyEczema</Text><Text style={styles.subBrand}>NellaDerm</Text></View>
      <Text accessibilityRole="header" style={styles.headerTitle}>Insights</Text>
      <Pressable accessibilityLabel="Open profile" accessibilityRole="button" onPress={() => router.push('/(tabs)/profile')} style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
        <MaterialCommunityIcons color={colors.onActionPrimary} name="account" size={19} />
      </Pressable>
    </View>
  );
}

export function InsightsDetailScreen({ children, title }: PropsWithChildren<{ title: string }>) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.detailHeader}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={colors.textPrimary} name={Platform.OS === 'android' ? 'arrow-left' : 'chevron-left'} size={Platform.OS === 'android' ? 24 : 26} />
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.detailTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      {children}
    </SafeAreaView>
  );
}

export function ProfileContext({ isDemo, name, offline = false, onPress }: { isDemo: boolean; name: string; offline?: boolean; onPress?: () => void }) {
  return (
    <Pressable accessibilityLabel={onPress ? `Active profile: ${name}` : undefined} accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.profileContext, pressed && styles.pressed]}>
      <View style={styles.profileIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="account-outline" size={18} /></View>
      <View style={styles.profileCopy}>
        <Text style={styles.profileName}>{name}</Text>
        <Text style={styles.profileDetail}>{isDemo ? 'Demo data · not saved to an account' : offline ? 'Private local history · offline' : 'Private local history on this device'}</Text>
      </View>
      {isDemo ? <Text style={styles.demoPill}>Demo</Text> : <MaterialCommunityIcons color={colors.actionPrimary} name={onPress ? 'swap-horizontal' : offline ? 'cloud-off-outline' : 'lock-outline'} size={20} />}
    </Pressable>
  );
}

export function SectionHeading({ action, onAction, title }: { action?: string; onAction?: () => void; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.headingAction, pressed && styles.pressed]}><Text style={styles.headingActionLabel}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function NavigationRow({ detail, icon, label, onPress }: { detail: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.navigationRow, pressed && styles.pressed]}>
      <View style={styles.navigationIcon}><MaterialCommunityIcons color={colors.actionPrimary} name={icon} size={21} /></View>
      <View style={styles.navigationCopy}><Text style={styles.navigationLabel}>{label}</Text><Text style={styles.navigationDetail}>{detail}</Text></View>
      <MaterialCommunityIcons color={colors.textSecondary} name="chevron-right" size={22} />
    </Pressable>
  );
}

export function EmptyInsight({ action, body, icon = 'calendar-blank-outline', onAction, title }: { action?: string; body: string; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name']; onAction?: () => void; title: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><MaterialCommunityIcons color={colors.actionPrimary} name={icon} size={26} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}><Text style={styles.emptyActionLabel}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View accessibilityRole="alert" style={styles.errorBanner}>
      <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={20} />
      <View style={styles.errorCopy}><Text style={styles.errorText}>{message}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}><Text style={styles.retryLabel}>Reload history</Text></Pressable></View>
    </View>
  );
}

export function StatusDot({ tone }: { tone: 'better' | 'same' | 'worse' | 'missing' | 'complete' | 'partial' }) {
  return <View style={[styles.statusDot, styles[`statusDot_${tone}`]]} />;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  header: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { width: 92 },
  brand: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 11, lineHeight: 16 },
  subBrand: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 9, lineHeight: 12 },
  headerTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary },
  detailHeader: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', height: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  detailTitle: { flex: 1, textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  headerSpacer: { width: 48 },
  profileContext: { minHeight: 58, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceBrandSoft },
  profileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  profileCopy: { flex: 1 },
  profileName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  profileDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16 },
  demoPill: { borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, color: colors.actionPrimary, backgroundColor: colors.surface, fontFamily: font.semibold, fontSize: 11 },
  sectionHeading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  headingAction: { minWidth: 48, minHeight: 48, paddingHorizontal: 4, alignItems: 'flex-end', justifyContent: 'center' },
  headingActionLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  navigationRow: { minHeight: 76, borderRadius: radius.card, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  navigationIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  navigationCopy: { flex: 1 },
  navigationLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  navigationDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  empty: { minHeight: 210, borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  emptyTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  emptyBody: { maxWidth: 280, color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  emptyAction: { minHeight: 48, marginTop: spacing.xs, borderRadius: radius.pill, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary },
  emptyActionLabel: { color: colors.onActionPrimary, fontFamily: font.semibold, fontSize: 13 },
  errorBanner: { borderRadius: radius.card, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.errorSurface },
  errorCopy: { flex: 1, gap: 6 },
  errorText: { color: colors.error, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  retry: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center' },
  retryLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  statusDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1 },
  statusDot_better: { backgroundColor: '#BDE9D4', borderColor: '#277A58' },
  statusDot_same: { backgroundColor: colors.accentSurface, borderColor: colors.actionPrimary },
  statusDot_worse: { backgroundColor: '#FFD7D2', borderColor: colors.error },
  statusDot_missing: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  statusDot_complete: { backgroundColor: '#BDE9D4', borderColor: '#277A58' },
  statusDot_partial: { backgroundColor: '#FFF0C2', borderColor: colors.warning },
  pressed: { opacity: 0.68 },
});
