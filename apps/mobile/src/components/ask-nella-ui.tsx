import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { useProfiles } from '@/contexts/profile-context';
import { colors, font, radius, size, spacing } from '@/theme';

export function AskNellaScreen({ children, contentStyle }: PropsWithChildren<{ contentStyle?: object }>) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={[styles.content, contentStyle]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function AskNellaTopBar({ back = false }: { back?: boolean }) {
  const { activeProfile } = useProfiles();
  return (
    <View style={styles.topBar}>
      <View style={styles.topLeft}>
        {back ? (
          <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
            <MaterialCommunityIcons color={colors.textPrimary} name={Platform.OS === 'android' ? 'arrow-left' : 'chevron-left'} size={Platform.OS === 'android' ? 23 : 25} />
          </Pressable>
        ) : null}
        <Text style={styles.brand}>MyEczema</Text>
      </View>
      {back ? <View style={styles.profileTag}><Text numberOfLines={1} style={styles.profileTagText}>{activeProfile.name}</Text></View> : null}
    </View>
  );
}

export function AskNellaHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.subtitle}>{subtitle}</Text></View>;
}

export function AskNellaProfilePill() {
  const { user } = useAuth();
  const { activeProfile } = useProfiles();
  const switchable = Boolean(user && !activeProfile.isDemo);
  return (
    <Pressable accessibilityLabel={`Active profile: ${activeProfile.name}`} accessibilityRole={switchable ? 'button' : undefined} disabled={!switchable} onPress={() => router.push('/profile/switch')} style={({ pressed }) => [styles.profilePill, pressed && styles.pressed]}>
      <View style={styles.profileDot}><MaterialCommunityIcons color={colors.onActionPrimary} name="account-outline" size={18} /></View>
      <Text style={styles.profilePillText}>For {activeProfile.name}{switchable ? ' · switch' : ' · guest'}</Text>
    </Pressable>
  );
}

export function AskNellaAction({ disabled, label, loading: busy = false, onPress, secondary = false }: { disabled?: boolean; label: string; loading?: boolean; onPress: () => void; secondary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={onPress} style={({ pressed }) => [styles.action, secondary ? styles.actionSecondary : styles.actionPrimary, pressed && styles.actionPressed, (disabled || busy) && styles.actionDisabled]}>
      {busy ? <ActivityIndicator color={colors.onActionPrimary} /> : <Text style={styles.actionLabel}>{label}</Text>}
    </Pressable>
  );
}

export function AskNellaError({ children, onRetry }: PropsWithChildren<{ onRetry?: () => void }>) {
  return (
    <View accessibilityRole="alert" style={styles.error}>
      <MaterialCommunityIcons color={colors.error} name="alert-circle-outline" size={20} />
      <View style={styles.errorCopy}><Text style={styles.errorText}>{children}</Text>{onRetry ? <Pressable accessibilityRole="button" onPress={onRetry} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}><Text style={styles.retryLabel}>Try again</Text></Pressable> : null}</View>
    </View>
  );
}

export function AskNellaInfoCard({ children, tone = 'white' }: PropsWithChildren<{ tone?: 'white' | 'soft' | 'danger' }>) {
  return <View style={[styles.card, tone === 'soft' && styles.cardSoft, tone === 'danger' && styles.cardDanger]}>{children}</View>;
}

export function AskNellaBullet({ children, icon = 'circle-small', tone = 'brand' }: PropsWithChildren<{ icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name']; tone?: 'brand' | 'danger' }>) {
  return <View style={styles.bullet}><MaterialCommunityIcons color={tone === 'danger' ? colors.error : colors.actionPrimary} name={icon} size={20} /><Text style={styles.bulletText}>{children}</Text></View>;
}

export function AskNellaLoading({ label = 'Opening Ask Nella…' }: { label?: string }) {
  return <View style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.loadingText}>{label}</Text></View>;
}

export const askNellaTextStyles = StyleSheet.create({
  cardTitle: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 20, lineHeight: 28 },
  cardBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  label: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  disclosure: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 12, lineHeight: 17 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 24, paddingBottom: 44, gap: spacing.md },
  topBar: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLeft: { minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: 2 },
  back: { width: 48, height: 48, marginLeft: -14, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  brand: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  profileTag: { maxWidth: 112, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  profileTagText: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 13 },
  heading: { gap: spacing.xs, marginBottom: 2 },
  title: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 28, lineHeight: 36 },
  subtitle: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 16, lineHeight: 24 },
  profilePill: { minHeight: 52, alignSelf: 'flex-start', maxWidth: '100%', borderRadius: radius.pill, padding: 10, paddingRight: 18, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceBrandSoft },
  profileDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary },
  profilePillText: { flexShrink: 1, color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  action: { minHeight: 52, borderRadius: 16, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  actionPrimary: { backgroundColor: colors.actionPrimary },
  actionSecondary: { backgroundColor: '#4F83DF', borderWidth: 1.5, borderColor: colors.actionPrimary },
  actionPressed: { opacity: 0.72 },
  actionDisabled: { opacity: 0.5 },
  actionLabel: { color: colors.onActionPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  error: { borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#FFF1F0' },
  errorCopy: { flex: 1, gap: 4 },
  errorText: { color: colors.error, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  retry: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  retryLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  card: { borderRadius: 18, padding: 18, gap: 10, backgroundColor: colors.surface },
  cardSoft: { backgroundColor: colors.surfaceBrandSoft },
  cardDanger: { borderWidth: 1, borderColor: colors.error, backgroundColor: colors.surface },
  bullet: { minHeight: 28, flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bulletText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  loading: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  pressed: { opacity: 0.68 },
});
