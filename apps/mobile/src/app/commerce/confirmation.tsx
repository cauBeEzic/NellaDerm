import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CommerceBoundary, CommerceFlowLayout, CommerceLoading, commerceStyles } from '@/components/commerce-ui';
import { useCommerce } from '@/contexts/commerce-context';
import { formatCad } from '@/lib/commerce';
import { colors, font, radius, spacing } from '@/theme';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(new Date(value));
}

export default function OrderConfirmationScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { loading, state } = useCommerce();
  if (loading) return <CommerceFlowLayout title="Demo order"><CommerceLoading label="Opening demo order…" /></CommerceFlowLayout>;
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) return <CommerceFlowLayout title="Demo order"><CommerceBoundary tone="error">This demo order is unavailable.</CommerceBoundary><Pressable accessibilityRole="button" onPress={() => router.replace('/commerce/orders')} style={commerceStyles.primary}><Text style={commerceStyles.primaryLabel}>View orders</Text></Pressable></CommerceFlowLayout>;
  return (
    <CommerceFlowLayout title="Demo order created">
      <View style={styles.success}><View style={styles.successIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="check" size={48} /></View><Text accessibilityRole="header" style={styles.thanks}>Demo order ready</Text><Text style={styles.subtitle}>The flow completed without charging a card or starting fulfillment.</Text></View>
      <View style={[commerceStyles.card, styles.orderCard]}><Text style={commerceStyles.cardTitle}>Order #{order.id}</Text>{order.lines.map((line) => <Text key={line.productId} style={commerceStyles.body}>{line.name} · Qty {line.quantity}</Text>)}<Text style={commerceStyles.body}>Illustrative total {formatCad(order.totalAmount)}</Text><Text style={commerceStyles.body}>Illustrative arrival {dateLabel(order.estimatedArrival)}</Text></View>
      <CommerceBoundary tone="success">Saved as an account-owned demo record. It is not a paid order and will not ship.</CommerceBoundary>
      <Pressable accessibilityRole="button" onPress={() => router.replace(`/commerce/order/${order.id}`)} style={({ pressed }) => [commerceStyles.primary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.primaryLabel}>View demo order</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/care')} style={({ pressed }) => [commerceStyles.secondary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.secondaryLabel}>Return to Care</Text></Pressable>
    </CommerceFlowLayout>
  );
}

const styles = StyleSheet.create({
  success: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  thanks: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 28, lineHeight: 36, textAlign: 'center' },
  subtitle: { maxWidth: 300, color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  orderCard: { gap: spacing.sm, borderRadius: radius.card },
});
