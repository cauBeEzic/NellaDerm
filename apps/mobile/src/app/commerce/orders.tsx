import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CommerceBoundary, CommerceFlowLayout, CommerceLoading, commerceStyles } from '@/components/commerce-ui';
import { useAuth } from '@/contexts/auth-context';
import { useCommerce } from '@/contexts/commerce-context';
import { formatCad } from '@/lib/commerce';
import { colors, font, radius, spacing } from '@/theme';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export default function OrdersScreen() {
  const { user } = useAuth();
  const { error, loading, retry, state } = useCommerce();
  if (!user) return <CommerceFlowLayout title="Orders & subscriptions"><CommerceBoundary>Orders belong to an account, not a care profile. Sign in to view them.</CommerceBoundary><Pressable accessibilityRole="button" onPress={() => router.replace('/sign-in')} style={commerceStyles.primary}><Text style={commerceStyles.primaryLabel}>Sign in</Text></Pressable></CommerceFlowLayout>;
  if (loading) return <CommerceFlowLayout title="Orders & subscriptions"><CommerceLoading label="Opening account orders…" /></CommerceFlowLayout>;
  if (error) return <CommerceFlowLayout title="Orders & subscriptions"><CommerceBoundary tone="error">{error}</CommerceBoundary><Pressable accessibilityRole="button" onPress={retry} style={commerceStyles.primary}><Text style={commerceStyles.primaryLabel}>Reload orders</Text></Pressable></CommerceFlowLayout>;
  return (
    <CommerceFlowLayout title="Orders & subscriptions">
      <View style={commerceStyles.heading}><Text accessibilityRole="header" style={commerceStyles.title}>Your orders</Text><Text style={commerceStyles.subtitle}>Purchases belong to your account, not an individual care profile.</Text></View>
      {!state.orders.length && !state.subscriptions.length ? <View style={styles.empty}><MaterialCommunityIcons color={colors.actionPrimary} name="receipt-text-outline" size={32} /><Text style={styles.emptyTitle}>No demo orders yet</Text><Text style={commerceStyles.body}>Create a demo order to review tracking, reorder, and physical-shipment subscription states.</Text></View> : null}
      {state.orders.map((order) => <Pressable accessibilityRole="button" key={order.id} onPress={() => router.push(`/commerce/order/${order.id}`)} style={({ pressed }) => [styles.record, pressed && commerceStyles.pressed]}><View style={styles.recordHeading}><Text style={styles.recordTitle}>Order #{order.id}</Text><Text style={styles.status}>{order.status === 'preparing' ? 'Preparing' : order.status === 'shipped' ? 'Shipped' : 'Delivered'}</Text></View><Text style={styles.recordBody}>{order.lines.map((line) => `${line.name} · Qty ${line.quantity}`).join(', ')}</Text><Text style={styles.recordMeta}>{formatCad(order.totalAmount)} · illustrative total</Text><Text style={styles.recordMeta}>{dateLabel(order.createdAt)} · demo record</Text></Pressable>)}
      {state.subscriptions.map((subscription) => <Pressable accessibilityRole="button" key={subscription.id} onPress={() => router.push(`/commerce/subscription/${subscription.id}`)} style={({ pressed }) => [styles.record, pressed && commerceStyles.pressed]}><View style={styles.recordHeading}><Text style={styles.recordTitle}>Physical shipment</Text><Text style={styles.status}>{subscription.status === 'active' ? 'Active' : subscription.status === 'paused' ? 'Paused' : 'Cancelled'}</Text></View><Text style={styles.recordBody}>{subscription.productName} · Qty {subscription.quantity}</Text><Text style={styles.recordMeta}>{formatCad(subscription.unitAmount)} · every {subscription.intervalWeeks} weeks</Text><Text style={styles.recordMeta}>No digital feature entitlement</Text></Pressable>)}
      <Pressable accessibilityRole="button" onPress={() => router.push('/commerce')} style={({ pressed }) => [commerceStyles.secondary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.secondaryLabel}>Shop NellaDerm</Text></Pressable>
    </CommerceFlowLayout>
  );
}

const styles = StyleSheet.create({
  empty: { minHeight: 230, borderRadius: radius.card, padding: spacing.xl, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.surface },
  emptyTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 19, lineHeight: 26 },
  record: { minHeight: 150, borderRadius: radius.card, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  recordHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  recordTitle: { flex: 1, color: colors.textPrimary, fontFamily: font.semibold, fontSize: 17, lineHeight: 24 },
  status: { borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, color: colors.actionPrimary, fontFamily: font.medium, fontSize: 12, overflow: 'hidden', backgroundColor: colors.surfaceBrandSoft },
  recordBody: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 14, lineHeight: 21 },
  recordMeta: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
});
