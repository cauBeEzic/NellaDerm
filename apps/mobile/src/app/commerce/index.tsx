import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CommerceBoundary, CommerceFlowLayout, ProductVisual, commerceStyles } from '@/components/commerce-ui';
import { demoCatalogue, formatCad } from '@/lib/commerce';
import { colors, font, radius, spacing } from '@/theme';

export default function ShopScreen() {
  return (
    <CommerceFlowLayout showCart title="Shop NellaDerm">
      <View style={commerceStyles.heading}><Text accessibilityRole="header" style={commerceStyles.title}>Gentle care from NellaDerm</Text><Text style={commerceStyles.subtitle}>Browse verified NellaDerm products. Prices are shown in CAD.</Text></View>
      <CommerceBoundary>Demo catalogue · illustrative products and pricing</CommerceBoundary>
      {demoCatalogue.map((product) => product.available ? (
        <View key={product.id} style={styles.productCard}>
          <ProductVisual />
          <View style={styles.productCopy}><Text style={styles.productName}>{product.name}</Text><Text style={styles.description}>{product.description}</Text><Text style={styles.price}>{formatCad(product.unitAmount)} · illustrative price</Text></View>
          <Pressable accessibilityRole="button" onPress={() => router.push(`/commerce/product/${product.id}`)} style={({ pressed }) => [commerceStyles.secondary, pressed && commerceStyles.pressed]}><Text style={commerceStyles.secondaryLabel}>View product</Text></Pressable>
        </View>
      ) : (
        <View key={product.id} style={styles.unavailableCard}><View style={styles.unavailableHeading}><MaterialCommunityIcons color={colors.textSecondary} name="package-variant-closed" size={22} /><Text style={styles.unavailableName}>{product.name}</Text></View><Text style={styles.price}>{formatCad(product.unitAmount)} · illustrative price</Text><Text style={styles.description}>Coming soon · not yet available for purchase.</Text></View>
      ))}
    </CommerceFlowLayout>
  );
}

const styles = StyleSheet.create({
  productCard: { borderRadius: 16, padding: spacing.md, gap: spacing.md, backgroundColor: colors.surface },
  productCopy: { gap: 5 },
  productName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 20, lineHeight: 27 },
  description: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  price: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 15, lineHeight: 21 },
  unavailableCard: { borderRadius: radius.card, padding: spacing.md, gap: spacing.xs, backgroundColor: colors.surface },
  unavailableHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  unavailableName: { flex: 1, color: colors.textPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 23 },
});
