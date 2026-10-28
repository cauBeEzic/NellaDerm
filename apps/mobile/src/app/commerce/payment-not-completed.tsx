import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CommerceBoundary, CommerceFlowLayout, CommerceLoading, commerceStyles } from '@/components/commerce-ui';
import { useAuth } from '@/contexts/auth-context';
import { useCommerce } from '@/contexts/commerce-context';
import { checkoutRecoveryReceipt, checkoutRecoveryReference } from '@/lib/commerce';
import { colors, font, radius, spacing } from '@/theme';

export default function PaymentNotCompletedScreen() {
  const { checkoutId } = useLocalSearchParams<{ checkoutId?: string | string[] }>();
  const { user } = useAuth();
  const { loading, state } = useCommerce();
  if (loading) return <CommerceFlowLayout title="Checkout recovery"><CommerceLoading label="Checking the saved checkout result…" /></CommerceFlowLayout>;
  if (!user) return <CommerceFlowLayout title="Checkout recovery"><CommerceBoundary tone="error">Sign in to review an account-owned checkout attempt. Guest activity cannot create an order.</CommerceBoundary><Pressable accessibilityRole="button" onPress={() => router.replace('/sign-in')} style={commerceStyles.primary}><Text style={commerceStyles.primaryLabel}>Sign in</Text></Pressable></CommerceFlowLayout>;

  const receipt = checkoutRecoveryReceipt(state.checkoutReceipts, checkoutId);
  if (!receipt) {
    return (
      <CommerceFlowLayout title="Checkout recovery">
        <View style={commerceStyles.heading}><Text accessibilityRole="header" style={commerceStyles.title}>No saved checkout result</Text><Text style={commerceStyles.subtitle}>This screen is not attached to a failed or cancelled checkout.</Text></View>
        <CommerceBoundary tone="error">No payment or order status is being inferred from navigation alone. Review the current cart before trying again.</CommerceBoundary>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/commerce/cart')} style={commerceStyles.primary}><Text style={commerceStyles.primaryLabel}>Return to cart</Text></Pressable>
      </CommerceFlowLayout>
    );
  }

  const cancelled = receipt.outcome === 'cancelled';
  const cartPreserved = state.cart.length > 0;
  const reference = checkoutRecoveryReference(receipt);
  return (
    <CommerceFlowLayout title="Checkout not completed">
      <View style={commerceStyles.heading}><Text accessibilityRole="header" style={commerceStyles.title}>{cancelled ? 'Checkout cancelled' : 'Payment not completed'}</Text><Text style={commerceStyles.subtitle}>No duplicate order, with a clear recovery path.</Text></View>
      <View accessibilityRole="alert" style={styles.errorCard}><Text style={styles.errorTitle}>Your card was not charged</Text><Text style={styles.errorBody}>{cancelled ? 'You left the checkout before confirming.' : 'The demo checkout did not complete.'} {cartPreserved ? 'The items are still in your cart.' : 'No order was created, and the cart no longer contains those items.'}</Text></View>
      <CommerceBoundary>Production recovery will use Stripe&apos;s verified checkout status. Client navigation alone never creates an order.</CommerceBoundary>
      {cartPreserved ? <Pressable accessibilityRole="button" onPress={() => router.replace('/commerce/checkout')} style={({ pressed }) => [commerceStyles.primary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.primaryLabel}>Review payment</Text></Pressable> : null}
      <Pressable accessibilityRole="button" onPress={() => router.replace('/commerce/cart')} style={({ pressed }) => [commerceStyles.secondary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.secondaryLabel}>Return to cart</Text></Pressable>
      {reference ? <Text style={styles.reference}>Checkout reference · {reference}</Text> : null}
    </CommerceFlowLayout>
  );
}

const styles = StyleSheet.create({
  errorCard: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.error, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  errorTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  errorBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 15, lineHeight: 23 },
  reference: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 12, lineHeight: 17 },
});
