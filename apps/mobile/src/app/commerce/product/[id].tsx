import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { CommerceFlowLayout, ProductVisual, commerceStyles } from '@/components/commerce-ui';
import { useCommerce } from '@/contexts/commerce-context';
import { catalogueProduct, formatCad } from '@/lib/commerce';
import { colors, font, radius, spacing } from '@/theme';

export default function StoreProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addToCart, error, loading } = useCommerce();
  const product = catalogueProduct(id);
  if (!product) return <CommerceFlowLayout title="Product"><View style={commerceStyles.card}><Text style={commerceStyles.cardTitle}>Product unavailable</Text><Text style={commerceStyles.body}>This catalogue item is no longer available.</Text></View></CommerceFlowLayout>;

  async function add() {
    try {
      await addToCart({ productId: product!.id });
      router.push('/commerce/cart');
    } catch {
      Alert.alert('Could not update the cart', 'Reload commerce and try again. Nothing was ordered.');
    }
  }

  return (
    <CommerceFlowLayout showCart title={product.shortName}>
      <View style={styles.hero}><ProductVisual /><Text style={styles.verified}>Verified NellaDerm product</Text><Text accessibilityRole="header" style={styles.name}>{product.name}</Text><Text style={styles.price}>{formatCad(product.unitAmount)} · illustrative price</Text><Text style={styles.description}>Product description will come from verified package or manufacturer information.</Text></View>
      <View style={commerceStyles.card}><Text style={commerceStyles.cardTitle}>Product details</Text><View style={styles.details}><Text style={commerceStyles.body}>• {product.size}</Text><Text style={commerceStyles.body}>• Review the current package for ingredients</Text><Text style={commerceStyles.body}>• Delivery estimate shown at checkout</Text></View></View>
      <Pressable accessibilityRole="button" disabled={loading || Boolean(error)} onPress={() => void add()} style={({ pressed }) => [commerceStyles.primary, (loading || error) && commerceStyles.primaryDisabled, pressed && commerceStyles.pressed]}><Text style={commerceStyles.primaryLabel}>Add to cart</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/care')} style={({ pressed }) => [commerceStyles.secondary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.secondaryLabel}>Already use this? View in Care</Text></Pressable>
      <View style={styles.note}><MaterialCommunityIcons color={colors.textSecondary} name="shield-check-outline" size={19} /><Text style={styles.noteText}>This demo does not recommend a product or replace package directions.</Text></View>
    </CommerceFlowLayout>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 16, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  verified: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 12, lineHeight: 17 },
  name: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 25, lineHeight: 33 },
  price: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 18, lineHeight: 25 },
  description: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  details: { marginTop: spacing.sm },
  note: { borderRadius: radius.card, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surfaceBrandSoft },
  noteText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
});
