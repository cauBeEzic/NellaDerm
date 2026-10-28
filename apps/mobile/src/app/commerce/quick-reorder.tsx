import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CommerceBoundary, CommerceFlowLayout, CommerceLoading, commerceStyles } from '@/components/commerce-ui';
import { useCommerce } from '@/contexts/commerce-context';
import { formatCad } from '@/lib/commerce';
import { colors, font, radius, spacing } from '@/theme';

export default function QuickReorderScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { buyAgain, loading, state } = useCommerce();
  if (loading) return <CommerceFlowLayout title="Quick reorder"><CommerceLoading label="Preparing reorder…" /></CommerceFlowLayout>;
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return <CommerceFlowLayout title="Quick reorder"><CommerceBoundary tone="error">The previous order is unavailable.</CommerceBoundary><Pressable accessibilityRole="button" onPress={() => router.replace('/commerce/orders')} style={commerceStyles.primary}><Text style={commerceStyles.primaryLabel}>Return to orders</Text></Pressable></CommerceFlowLayout>;

  async function reviewReorder() {
    try {
      await buyAgain(order!.id);
      router.push('/commerce/checkout');
    } catch {
      Alert.alert('Could not prepare reorder', 'The current catalogue may have changed. Nothing was ordered.');
    }
  }

  return (
    <CommerceFlowLayout title="Quick reorder">
      <View style={commerceStyles.heading}><Text accessibilityRole="header" style={commerceStyles.title}>Reorder in one tap</Text><Text style={commerceStyles.subtitle}>Uses the last illustrative delivery details, with a review step before confirmation.</Text></View>
      <View style={commerceStyles.card}>{order.lines.map((line) => <View key={line.productId} style={styles.line}><Text style={commerceStyles.cardTitle}>{line.name}</Text><Text style={commerceStyles.body}>{line.quantity} item{line.quantity === 1 ? '' : 's'} · repriced at {formatCad(line.unitAmount * line.quantity)}</Text></View>)}</View>
      <View style={styles.delivery}><MaterialCommunityIcons color={colors.actionPrimary} name="home-outline" size={22} /><View style={styles.deliveryCopy}><Text style={styles.deliveryTitle}>Ships to the saved illustrative address</Text><Text style={commerceStyles.body}>Vancouver, BC · delivery estimate shown at checkout</Text></View></View>
      <CommerceBoundary>Preparing this reorder only updates your cart. No payment or shipment starts until the demo checkout is confirmed.</CommerceBoundary>
      <Pressable accessibilityRole="button" onPress={() => void reviewReorder()} style={({ pressed }) => [commerceStyles.primary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.primaryLabel}>Review reorder for {formatCad(order.subtotalAmount)}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.replace(`/commerce/order/${order.id}`)} style={({ pressed }) => [commerceStyles.secondary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.secondaryLabel}>Review previous order</Text></Pressable>
    </CommerceFlowLayout>
  );
}

const styles = StyleSheet.create({
  line: { gap: spacing.xs },
  delivery: { borderRadius: radius.card, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, backgroundColor: colors.surfaceBrandSoft },
  deliveryCopy: { flex: 1, gap: spacing.xs },
  deliveryTitle: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
});
