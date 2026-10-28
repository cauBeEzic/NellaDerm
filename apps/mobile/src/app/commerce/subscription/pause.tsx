import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CommerceBoundary, CommerceFlowLayout, commerceStyles } from '@/components/commerce-ui';
import { useCommerce } from '@/contexts/commerce-context';
import { colors, font, radius, spacing } from '@/theme';

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' }).format(new Date(value));
}

export default function PauseSubscriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, updateSubscription } = useCommerce();
  const subscription = state.subscriptions.find((item) => item.id === id);
  if (!subscription) return <CommerceFlowLayout title="Pause subscription"><CommerceBoundary tone="error">This subscription is unavailable.</CommerceBoundary></CommerceFlowLayout>;

  async function pause() {
    try {
      await updateSubscription(subscription!.id, { status: 'paused' });
      router.replace(`/commerce/subscription/${subscription!.id}`);
    } catch {
      Alert.alert('Could not pause subscription', 'The demo state was not changed. Try again.');
    }
  }

  return (
    <CommerceFlowLayout title="Pause subscription">
      <View style={commerceStyles.heading}><Text accessibilityRole="header" style={commerceStyles.title}>Pause subscription</Text><Text style={commerceStyles.subtitle}>Nothing ships or bills while paused.</Text></View>
      <View style={styles.detail}><Text style={styles.detailTitle}>Pause after {dateLabel(subscription.nextDeliveryAt)} delivery</Text><Text style={styles.detailBody}>You can restart from Orders at any time. We’ll keep the illustrative frequency and address.</Text></View>
      <View style={commerceStyles.card}><Text style={styles.fieldLabel}>Pause until</Text><Text style={styles.fieldValue}>I restart it</Text></View>
      <CommerceBoundary>No real billing or shipment will change in this demo.</CommerceBoundary>
      <Pressable accessibilityRole="button" onPress={() => void pause()} style={({ pressed }) => [commerceStyles.primary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.primaryLabel}>Confirm pause</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [commerceStyles.secondary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.secondaryLabel}>Keep subscription active</Text></Pressable>
    </CommerceFlowLayout>
  );
}

const styles = StyleSheet.create({
  detail: { borderRadius: radius.card, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surfaceBrandSoft },
  detailTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  detailBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 22 },
  fieldLabel: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
  fieldValue: { marginTop: spacing.xs, color: colors.textPrimary, fontFamily: font.medium, fontSize: 17, lineHeight: 24 },
});
