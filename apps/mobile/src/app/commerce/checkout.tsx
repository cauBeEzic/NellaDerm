import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CommerceBoundary, CommerceFlowLayout, CommerceLoading, commerceStyles } from '@/components/commerce-ui';
import { useAuth } from '@/contexts/auth-context';
import { useCommerce } from '@/contexts/commerce-context';
import { calculateCart, formatCad, type CheckoutOutcome } from '@/lib/commerce';
import { colors, font, radius, spacing } from '@/theme';

export default function CheckoutScreen() {
  const { outcome: requestedOutcome } = useLocalSearchParams<{ outcome?: string }>();
  const { user } = useAuth();
  const { busy, completeDemoCheckout, error, loading, state } = useCommerce();
  const [submitted, setSubmitted] = useState(false);
  if (loading) return <CommerceFlowLayout title="Checkout"><CommerceLoading label="Preparing checkout…" /></CommerceFlowLayout>;
  if (!user) return <CommerceFlowLayout title="Checkout"><CommerceBoundary tone="error">An account is required before checkout. Your cart has not been changed.</CommerceBoundary><Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/sign-in', params: { returnTo: '/commerce/cart' } })} style={commerceStyles.primary}><Text style={commerceStyles.primaryLabel}>Sign in</Text></Pressable></CommerceFlowLayout>;
  if (!state.cart.length) return <CommerceFlowLayout title="Checkout"><CommerceBoundary>Your cart is empty. No order has been created.</CommerceBoundary><Pressable accessibilityRole="button" onPress={() => router.replace('/commerce')} style={commerceStyles.primary}><Text style={commerceStyles.primaryLabel}>Browse products</Text></Pressable></CommerceFlowLayout>;
  const summary = calculateCart(state.cart);

  async function placeOrder() {
    setSubmitted(true);
    const outcome: CheckoutOutcome = requestedOutcome === 'failed' || requestedOutcome === 'cancelled' ? requestedOutcome : 'succeeded';
    try {
      const result = await completeDemoCheckout(outcome);
      if (result.outcome === 'succeeded' && result.orderId) router.replace({ pathname: '/commerce/confirmation', params: { orderId: result.orderId } });
      else router.replace({ pathname: '/commerce/payment-not-completed', params: { checkoutId: result.checkoutId } });
    } catch {
      Alert.alert('Demo checkout could not finish', 'Your cart is unchanged. Reload commerce and try again.');
    }
  }

  return (
    <CommerceFlowLayout title="Checkout">
      <View style={commerceStyles.heading}><Text accessibilityRole="header" style={commerceStyles.title}>Shipping and payment</Text><Text style={commerceStyles.subtitle}>Review the illustrative delivery and payment details.</Text></View>
      <View style={commerceStyles.card}><Text style={commerceStyles.cardTitle}>Shipping address</Text><Text style={[commerceStyles.body, styles.cardBody]}>Maya Patel{`\n`}123 Greenway Ave{`\n`}Vancouver, BC V5K 0A1{`\n`}Illustrative address</Text><Pressable accessibilityRole="button" onPress={() => Alert.alert('Illustrative address', 'Address editing will be connected to the verified checkout provider. No address was stored.')} style={({ pressed }) => [styles.cardAction, pressed && commerceStyles.pressed]}><Text style={styles.cardActionLabel}>Edit</Text></Pressable></View>
      <View style={commerceStyles.card}><Text style={commerceStyles.cardTitle}>Payment</Text><Text style={[commerceStyles.body, styles.cardBody]}>•••• 4242 · Stripe test placeholder</Text></View>
      <View style={[commerceStyles.card, styles.review]}><Text style={commerceStyles.cardTitle}>Order review</Text>{summary.lines.map(({ line, product }) => <SummaryRow key={line.productId} label={`${product.shortName} · Qty ${line.quantity}`} value={formatCad(product.unitAmount * line.quantity)} />)}<SummaryRow label="Shipping + tax" value={formatCad(summary.shippingAmount + summary.taxAmount)} /><SummaryRow emphasized label="Estimated total" value={formatCad(summary.totalAmount)} /></View>
      <CommerceBoundary>Demo checkout only. No card is charged, no fulfillment starts, and no paid order is claimed. Production success will require Stripe plus a verified server webhook.</CommerceBoundary>
      {error && submitted ? <CommerceBoundary tone="error">{error}</CommerceBoundary> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ busy }} disabled={busy} onPress={() => void placeOrder()} style={({ pressed }) => [commerceStyles.primary, busy && commerceStyles.primaryDisabled, pressed && commerceStyles.pressed]}><Text style={commerceStyles.primaryLabel}>{busy ? 'Creating demo order…' : 'Create demo order'}</Text></Pressable>
    </CommerceFlowLayout>
  );
}

function SummaryRow({ emphasized = false, label, value }: { emphasized?: boolean; label: string; value: string }) {
  return <View style={styles.row}><Text style={[styles.rowLabel, emphasized && styles.strong]}>{label}</Text><Text style={[styles.rowValue, emphasized && styles.strong]}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  cardBody: { marginTop: spacing.sm },
  cardAction: { minHeight: 48, marginTop: spacing.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  cardActionLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 14 },
  review: { gap: spacing.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  rowLabel: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  rowValue: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 13, lineHeight: 19, textAlign: 'right' },
  strong: { color: colors.textPrimary, fontFamily: font.semibold },
});
