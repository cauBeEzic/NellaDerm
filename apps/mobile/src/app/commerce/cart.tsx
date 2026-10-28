import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CommerceBoundary, CommerceFlowLayout, CommerceLoading, ProductVisual, commerceStyles } from '@/components/commerce-ui';
import { useAuth } from '@/contexts/auth-context';
import { useCommerce } from '@/contexts/commerce-context';
import { calculateCart, formatCad } from '@/lib/commerce';
import { colors, font, radius, spacing } from '@/theme';

export default function CartScreen() {
  const { user } = useAuth();
  const { error, loading, removeFromCart, retry, state } = useCommerce();
  if (loading) return <CommerceFlowLayout title="Cart"><CommerceLoading label="Opening your cart…" /></CommerceFlowLayout>;
  if (error) return <CommerceFlowLayout title="Cart"><CommerceBoundary tone="error">{error}</CommerceBoundary><Pressable accessibilityRole="button" onPress={retry} style={commerceStyles.primary}><Text style={commerceStyles.primaryLabel}>Reload cart</Text></Pressable></CommerceFlowLayout>;
  if (!state.cart.length) return <CommerceFlowLayout title="Cart"><View style={styles.empty}><MaterialCommunityIcons color={colors.actionPrimary} name="shopping-outline" size={34} /><Text style={styles.emptyTitle}>Your cart is empty</Text><Text style={commerceStyles.body}>Browse the demo catalogue to add a physical skincare product.</Text></View><Pressable accessibilityRole="button" onPress={() => router.replace('/commerce')} style={commerceStyles.primary}><Text style={commerceStyles.primaryLabel}>Browse products</Text></Pressable></CommerceFlowLayout>;
  const summary = calculateCart(state.cart);

  function continueCheckout() {
    if (user) {
      router.push('/commerce/checkout');
      return;
    }
    Alert.alert('Sign in before checkout', 'You can browse and keep this cart as a guest. An account is required before an order can be created.', [
      { text: 'Keep shopping', style: 'cancel' },
      { text: 'Sign in', onPress: () => router.push({ pathname: '/sign-in', params: { returnTo: '/commerce/cart' } }) },
    ]);
  }

  return (
    <CommerceFlowLayout title="Cart">
      <View style={commerceStyles.heading}><Text accessibilityRole="header" style={commerceStyles.title}>Your cart</Text><Text style={commerceStyles.subtitle}>Review the physical products and purchase option before checkout.</Text></View>
      {summary.lines.map(({ line, product }) => <View key={line.productId} style={styles.line}><ProductVisual compact /><View style={styles.lineCopy}><Text style={styles.lineName}>{product.name}</Text><Text style={styles.lineMeta}>{formatCad(product.unitAmount)} · illustrative</Text><Text style={styles.lineOption}>{line.purchaseOption === 'subscription' ? `Ships every ${line.intervalWeeks} weeks` : 'Buy once'} · Qty {line.quantity}</Text></View><Pressable accessibilityLabel={`Remove ${product.name} from cart`} accessibilityRole="button" onPress={() => void removeFromCart(product.id).catch(() => Alert.alert('Could not update cart', 'Try again.'))} style={({ pressed }) => [styles.remove, pressed && commerceStyles.pressed]}><MaterialCommunityIcons color={colors.textSecondary} name="delete-outline" size={23} /></Pressable></View>)}
      <View style={styles.summary}>
        <SummaryRow label="Subtotal" value={formatCad(summary.subtotalAmount)} />
        <SummaryRow label="Shipping" value={formatCad(summary.shippingAmount)} />
        <SummaryRow label="Estimated tax" value={formatCad(summary.taxAmount)} />
        <SummaryRow emphasized label="Estimated total" value={formatCad(summary.totalAmount)} />
      </View>
      {!user ? <CommerceBoundary>Your cart is available for this session. Sign in to continue to checkout and retain order history.</CommerceBoundary> : null}
      <Pressable accessibilityRole="button" onPress={continueCheckout} style={({ pressed }) => [commerceStyles.primary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.primaryLabel}>{user ? 'Continue to checkout' : 'Sign in to checkout'}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/commerce')} style={({ pressed }) => [commerceStyles.secondary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.secondaryLabel}>Keep shopping</Text></Pressable>
    </CommerceFlowLayout>
  );
}

function SummaryRow({ emphasized = false, label, value }: { emphasized?: boolean; label: string; value: string }) {
  return <View style={styles.summaryRow}><Text style={[styles.summaryText, emphasized && styles.summaryStrong]}>{label}</Text><Text style={[styles.summaryValue, emphasized && styles.summaryStrong]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  empty: { minHeight: 230, borderRadius: radius.card, padding: 28, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface },
  emptyTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 19, lineHeight: 26 },
  line: { minHeight: 116, borderRadius: radius.card, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface },
  lineCopy: { flex: 1, gap: 3 },
  lineName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  lineMeta: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  lineOption: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  remove: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  summary: { borderRadius: radius.card, padding: spacing.md, gap: spacing.md, backgroundColor: colors.surface },
  summaryRow: { minHeight: 24, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  summaryText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  summaryValue: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 14, lineHeight: 21, textAlign: 'right' },
  summaryStrong: { color: colors.textPrimary, fontFamily: font.semibold },
});
