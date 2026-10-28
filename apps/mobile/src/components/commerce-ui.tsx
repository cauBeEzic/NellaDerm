import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCommerce } from '@/contexts/commerce-context';
import { colors, font, radius, size, spacing } from '@/theme';

export function CommerceFlowLayout({ children, title, showCart = false, scroll = true }: PropsWithChildren<{ title: string; showCart?: boolean; scroll?: boolean }>) {
  const { state } = useCommerce();
  const count = state.cart.reduce((total, line) => total + line.quantity, 0);
  const body = scroll
    ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
    : <View style={styles.fill}>{children}</View>;
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={colors.textPrimary} name={Platform.OS === 'ios' ? 'chevron-left' : 'arrow-left'} size={Platform.OS === 'ios' ? 29 : 23} />
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>{title}</Text>
        {showCart ? <Pressable accessibilityLabel={`Open cart${count ? `, ${count} item${count === 1 ? '' : 's'}` : ', empty'}`} accessibilityRole="button" onPress={() => router.push('/commerce/cart')} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={colors.textPrimary} name="shopping-outline" size={24} />
          {count ? <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{count}</Text></View> : null}
        </Pressable> : <View style={styles.headerAction} />}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>{body}</KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function ProductVisual({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.productVisual, compact && styles.productVisualCompact]}>
      <View style={[styles.productMark, compact && styles.productMarkCompact]}>
        <MaterialCommunityIcons color={colors.actionPrimary} name="spa" size={compact ? 28 : 38} />
        {!compact ? <Text style={styles.productWordmark}>NELLADERM</Text> : null}
      </View>
    </View>
  );
}

export function CommerceBoundary({ children, tone = 'info' }: PropsWithChildren<{ tone?: 'info' | 'error' | 'success' }>) {
  const icon = tone === 'error' ? 'alert-circle-outline' : tone === 'success' ? 'check-circle-outline' : 'information-outline';
  return <View accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[styles.boundary, tone === 'error' && styles.boundaryError, tone === 'success' && styles.boundarySuccess]}><MaterialCommunityIcons color={tone === 'error' ? colors.error : tone === 'success' ? colors.success : colors.actionPrimary} name={icon} size={20} /><Text style={[styles.boundaryText, tone === 'error' && styles.boundaryErrorText]}>{children}</Text></View>;
}

export function CommerceLoading({ label }: { label: string }) {
  return <View style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.loadingText}>{label}</Text></View>;
}

export const commerceStyles = StyleSheet.create({
  heading: { gap: 8 },
  title: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 28, lineHeight: 36 },
  subtitle: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  card: { borderRadius: radius.card, padding: spacing.md, backgroundColor: colors.surface },
  cardTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 17, lineHeight: 24 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  primary: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, backgroundColor: colors.actionPrimary },
  primaryDisabled: { backgroundColor: colors.actionDisabled },
  primaryLabel: { color: colors.onActionPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 22, textAlign: 'center' },
  secondary: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, backgroundColor: colors.borderDefault },
  secondaryLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  pressed: { opacity: 0.68 },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  fill: { flex: 1 },
  header: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerAction: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  cartBadge: { position: 'absolute', right: 3, top: 3, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary },
  cartBadgeText: { color: colors.onActionPrimary, fontFamily: font.bold, fontSize: 10, lineHeight: 13 },
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40, gap: 20 },
  productVisual: { minHeight: 178, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  productVisualCompact: { width: 68, minHeight: 68, borderRadius: radius.card },
  productMark: { width: 112, height: 112, borderRadius: 28, alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: colors.surface },
  productMarkCompact: { width: 52, height: 52, borderRadius: 18 },
  productWordmark: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 10, lineHeight: 14 },
  boundary: { minHeight: 54, borderRadius: radius.card, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.borderDefault },
  boundaryError: { borderWidth: 1, borderColor: colors.error, backgroundColor: colors.errorSurface },
  boundarySuccess: { backgroundColor: colors.surfaceBrandSoft },
  boundaryText: { flex: 1, color: colors.textSecondary, fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
  boundaryErrorText: { color: colors.error },
  loading: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14 },
  pressed: { opacity: 0.65 },
});
