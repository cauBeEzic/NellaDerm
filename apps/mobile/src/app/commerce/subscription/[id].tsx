import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CommerceBoundary, CommerceFlowLayout, CommerceLoading, commerceStyles } from '@/components/commerce-ui';
import { useCommerce } from '@/contexts/commerce-context';
import { formatCad, type SubscriptionInterval } from '@/lib/commerce';
import { colors, font, radius, spacing } from '@/theme';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function addWeeks(value: string, weeks: number) {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString();
}

export default function ManageSubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, state, updateSubscription } = useCommerce();
  if (loading) return <CommerceFlowLayout title="Manage subscription"><CommerceLoading label="Opening subscription…" /></CommerceFlowLayout>;
  const subscription = state.subscriptions.find((item) => item.id === id);
  if (!subscription) return <CommerceFlowLayout title="Manage subscription"><CommerceBoundary tone="error">This physical-shipment subscription is unavailable.</CommerceBoundary><Pressable accessibilityRole="button" onPress={() => router.replace('/commerce/orders')} style={commerceStyles.primary}><Text style={commerceStyles.primaryLabel}>Return to orders</Text></Pressable></CommerceFlowLayout>;

  async function changeFrequency() {
    const intervals: SubscriptionInterval[] = [4, 6, 8];
    const next = intervals[(intervals.indexOf(subscription!.intervalWeeks) + 1) % intervals.length];
    await updateSubscription(subscription!.id, { intervalWeeks: next });
  }

  async function skipNext() {
    await updateSubscription(subscription!.id, { nextDeliveryAt: addWeeks(subscription!.nextDeliveryAt, subscription!.intervalWeeks) });
    Alert.alert('Next demo delivery skipped', 'The illustrative delivery date moved forward. No real shipment was changed.');
  }

  function cancel() {
    Alert.alert('Cancel physical shipments?', 'The demo subscription will end. This does not change access to any MyEczema feature.', [
      { text: 'Keep active', style: 'cancel' },
      { text: 'Cancel subscription', style: 'destructive', onPress: () => void updateSubscription(subscription!.id, { status: 'cancelled' }) },
    ]);
  }

  return (
    <CommerceFlowLayout title="Manage subscription">
      <View style={commerceStyles.heading}><Text accessibilityRole="header" style={commerceStyles.title}>Manage subscription</Text><Text style={commerceStyles.subtitle}>Changes are reversible and show their illustrative effective date.</Text></View>
      <View style={styles.next}><Text style={styles.nextTitle}>{subscription.status === 'paused' ? 'Shipments paused' : subscription.status === 'cancelled' ? 'Subscription cancelled' : `Next delivery · ${dateLabel(subscription.nextDeliveryAt)}`}</Text><Text style={styles.nextMeta}>{subscription.productName} · {formatCad(subscription.unitAmount)}</Text></View>
      {subscription.status === 'cancelled' ? <CommerceBoundary>This subscription has ended. Add the product to your cart again if you want to start a new shipment schedule.</CommerceBoundary> : <View style={styles.actionList}>
        <Action description={`Every ${subscription.intervalWeeks} weeks`} label="Change frequency" onPress={() => void changeFrequency().catch(() => Alert.alert('Could not save change', 'Try again.'))} />
        <Action description="Keeps the subscription active" label="Skip next delivery" onPress={() => void skipNext().catch(() => Alert.alert('Could not save change', 'Try again.'))} />
        <Action description="Restart whenever you’re ready" label={subscription.status === 'paused' ? 'Resume subscription' : 'Pause subscription'} onPress={() => subscription.status === 'paused' ? void updateSubscription(subscription.id, { status: 'active' }) : router.push({ pathname: '/commerce/subscription/pause', params: { id: subscription.id } })} />
        <Action destructive description="Ends future physical shipments" label="Cancel subscription" onPress={cancel} />
      </View>}
      <CommerceBoundary>Physical skincare shipments only. Subscription state never unlocks digital content or app features.</CommerceBoundary>
    </CommerceFlowLayout>
  );
}

function Action({ description, destructive = false, label, onPress }: { description: string; destructive?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.action, pressed && commerceStyles.pressed]}><Text style={[styles.actionLabel, destructive && styles.destructive]}>{label}</Text><Text style={styles.actionDescription}>{description}</Text></Pressable>;
}

const styles = StyleSheet.create({
  next: { borderRadius: radius.card, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surfaceBrandSoft },
  nextTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  nextMeta: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  actionList: { gap: spacing.sm },
  action: { minHeight: 92, borderRadius: radius.card, padding: spacing.md, justifyContent: 'center', gap: 4, backgroundColor: colors.surface },
  actionLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  destructive: { color: colors.error },
  actionDescription: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
});
