import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CommerceBoundary, CommerceFlowLayout, CommerceLoading, commerceStyles } from '@/components/commerce-ui';
import { useCommerce } from '@/contexts/commerce-context';
import { formatCad } from '@/lib/commerce';
import { colors, font, radius, spacing } from '@/theme';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(new Date(value));
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, state } = useCommerce();
  if (loading) return <CommerceFlowLayout title="Order"><CommerceLoading label="Opening order…" /></CommerceFlowLayout>;
  const order = state.orders.find((item) => item.id === id);
  if (!order) return <CommerceFlowLayout title="Order"><CommerceBoundary tone="error">This order is unavailable.</CommerceBoundary><Pressable accessibilityRole="button" onPress={() => router.replace('/commerce/orders')} style={commerceStyles.primary}><Text style={commerceStyles.primaryLabel}>Return to orders</Text></Pressable></CommerceFlowLayout>;

  return (
    <CommerceFlowLayout title={`Order #${order.id}`}>
      <View style={styles.progressCard}><Text accessibilityRole="header" style={styles.status}>Preparing</Text><Text style={styles.progressMeta}>Preparing · illustrative arrival {dateLabel(order.estimatedArrival)}</Text><View accessibilityLabel="Order progress: preparing" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 4, now: 1 }} style={styles.track}><View style={styles.progress} /></View></View>
      <View style={commerceStyles.card}><Text style={commerceStyles.cardTitle}>Tracking</Text><View style={styles.steps}><Text style={styles.stepActive}>● Order placed · {dateLabel(order.createdAt)}</Text><Text style={styles.step}>○ Preparing</Text><Text style={styles.step}>○ Shipped</Text><Text style={styles.step}>○ Delivered</Text></View></View>
      <View style={commerceStyles.card}>{order.lines.map((line) => <View key={line.productId} style={styles.line}><Text style={commerceStyles.cardTitle}>{line.name} · Qty {line.quantity}</Text><Text style={commerceStyles.body}>Total {formatCad(order.totalAmount)} · illustrative</Text><Text style={commerceStyles.body}>Ships to the illustrative saved address</Text></View>)}</View>
      <CommerceBoundary>This is a local demo record. It does not represent payment, inventory allocation, shipment, or tracking from a carrier.</CommerceBoundary>
      <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/care')} style={({ pressed }) => [commerceStyles.secondary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.secondaryLabel}>View product in Care</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/commerce/quick-reorder', params: { orderId: order.id } })} style={({ pressed }) => [commerceStyles.primary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.primaryLabel}>Buy again</Text></Pressable>
    </CommerceFlowLayout>
  );
}

const styles = StyleSheet.create({
  progressCard: { borderRadius: radius.card, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  status: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 23, lineHeight: 31 },
  progressMeta: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.borderDefault },
  progress: { width: '38%', height: 8, borderRadius: 4, backgroundColor: colors.actionPrimary },
  steps: { marginTop: spacing.sm, gap: 3 },
  stepActive: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 14, lineHeight: 21 },
  step: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  line: { gap: spacing.sm },
});
