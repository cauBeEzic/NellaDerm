import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CommerceBoundary, CommerceFlowLayout, ProductVisual, commerceStyles } from '@/components/commerce-ui';
import { useCommerce } from '@/contexts/commerce-context';
import { catalogueProduct, formatCad, type PurchaseOption, type SubscriptionInterval } from '@/lib/commerce';
import { colors, font, radius, spacing } from '@/theme';

const product = catalogueProduct('nella-calm-barrier-cream')!;

export default function ReorderScreen() {
  const { addToCart } = useCommerce();
  const [option, setOption] = useState<PurchaseOption>('one-time');
  const [interval, setInterval] = useState<SubscriptionInterval>(6);

  async function continueToCart() {
    try {
      await addToCart({ productId: product.id, purchaseOption: option, intervalWeeks: option === 'subscription' ? interval : undefined });
      router.push('/commerce/cart');
    } catch {
      Alert.alert('Could not prepare reorder', 'Reload commerce and try again. Nothing was ordered.');
    }
  }

  return (
    <CommerceFlowLayout title="Reorder or subscribe">
      <View style={commerceStyles.heading}><Text accessibilityRole="header" style={commerceStyles.title}>Ready to reorder?</Text><Text style={commerceStyles.subtitle}>Choose a one-time purchase or an optional recurring physical shipment.</Text></View>
      <View style={styles.product}><ProductVisual /><Text style={styles.name}>{product.name}</Text><Text style={styles.price}>{formatCad(product.unitAmount)} · illustrative price</Text></View>
      <View accessibilityRole="radiogroup" style={styles.options}>
        <Option description={`${formatCad(product.unitAmount)} once`} label="Buy once" onPress={() => setOption('one-time')} selected={option === 'one-time'} />
        <Option description="10% illustrative demo discount · cancel anytime" label="Subscribe & save" onPress={() => setOption('subscription')} selected={option === 'subscription'} />
      </View>
      {option === 'subscription' ? <View style={commerceStyles.card}><Text style={commerceStyles.cardTitle}>Delivery frequency</Text><View accessibilityRole="radiogroup" style={styles.intervals}>{product.subscriptionIntervals.map((weeks) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: interval === weeks }} key={weeks} onPress={() => setInterval(weeks)} style={({ pressed }) => [styles.interval, interval === weeks && styles.intervalSelected, pressed && commerceStyles.pressed]}><Text style={[styles.intervalText, interval === weeks && styles.intervalTextSelected]}>{weeks} weeks</Text></Pressable>)}</View><Text style={[commerceStyles.body, styles.intervalNote]}>Recurring billing represents physical shipments only. It does not unlock app features.</Text></View> : null}
      <CommerceBoundary>No subscription is preselected. Prices and frequencies remain illustrative until the server-authoritative catalogue and Stripe test environment are connected.</CommerceBoundary>
      <Pressable accessibilityRole="button" onPress={() => void continueToCart()} style={({ pressed }) => [commerceStyles.primary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.primaryLabel}>{option === 'subscription' ? `Subscribe every ${interval} weeks` : `Reorder for ${formatCad(product.unitAmount)}`}</Text></Pressable>
    </CommerceFlowLayout>
  );
}

function Option({ description, label, onPress, selected }: { description: string; label: string; onPress: () => void; selected: boolean }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={onPress} style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && commerceStyles.pressed]}><View style={styles.optionCopy}><Text style={styles.optionLabel}>{label}</Text><Text style={styles.optionDescription}>{description}</Text></View><MaterialCommunityIcons color={selected ? colors.actionPrimary : colors.borderStrong} name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={25} /></Pressable>;
}

const styles = StyleSheet.create({
  product: { borderRadius: 16, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  name: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 20, lineHeight: 27 },
  price: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 16, lineHeight: 22 },
  options: { gap: spacing.sm },
  option: { minHeight: 78, borderRadius: radius.card, borderWidth: 1, borderColor: colors.borderDefault, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface },
  optionSelected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  optionCopy: { flex: 1, gap: 3 },
  optionLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  optionDescription: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  intervals: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  interval: { minHeight: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderDefault, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  intervalSelected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  intervalText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13 },
  intervalTextSelected: { color: colors.actionPrimary, fontFamily: font.semibold },
  intervalNote: { marginTop: spacing.md },
});
