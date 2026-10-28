import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { CareFlowLayout } from '@/components/care-flow-layout';
import { InfoCard, SubmitButton } from '@/components/care-form';
import { useCare } from '@/contexts/care-context';
import { colors, font, radius } from '@/theme';

function CheckRow({ label, text }: { label: string; text: string }) {
  return <View style={styles.checkRow}><View style={styles.checkIcon}><MaterialCommunityIcons color={colors.textSecondary} name="shield-check-outline" size={20} /></View><View style={styles.checkCopy}><Text style={styles.checkLabel}>{label}</Text><Text style={styles.body}>{text}</Text></View></View>;
}

export default function IngredientAwarenessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useCare();
  const product = state.products.find((item) => item.id === id);

  if (!product) {
    return <CareFlowLayout title="Ingredients & product"><InfoCard><Text style={styles.cardTitle}>Product unavailable</Text><Text style={styles.body}>This product is no longer in your cabinet.</Text></InfoCard><SubmitButton label="Return to Care" onPress={() => router.replace('/(tabs)/care')} /></CareFlowLayout>;
  }

  return (
    <CareFlowLayout title="Ingredients & product">
      <View style={styles.status}><MaterialCommunityIcons color={colors.warning} name="alert-circle-outline" size={16} /><Text style={styles.statusLabel}>Ingredient list not verified</Text></View>

      <View style={styles.productCard}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.pending}>Manufacturer description pending</Text>
        <Text style={styles.body}>This product is saved in your Care routine. Its ingredient information has not yet been checked against a current package or manufacturer source.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Full ingredient list</Text>
        <View style={styles.card}><Text style={styles.cardTitle}>Not available yet</Text><Text style={styles.body}>MyEczema cannot show or assess ingredients until a current label or manufacturer list is verified.</Text><View style={styles.divider} /><Text style={styles.source}>Source not provided · Last checked —</Text><Text style={styles.body}>Always compare with your current package; formulas can change.</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your ingredient check</Text>
        <View style={styles.card}><CheckRow label="Confirmed allergies · Not checked" text="A verified ingredient match to a saved confirmed allergy would appear here." /><View style={styles.divider} /><CheckRow label="Possible sensitivities · Not checked" text="Saved possible sensitivities appear separately from confirmed allergies." /></View>
      </View>

      <InfoCard><View style={styles.note}><MaterialCommunityIcons color={colors.actionPrimary} name="information-outline" size={20} /><Text style={styles.noteText}>Ingredient notes are educational, not a diagnosis or a guarantee that a product will or will not cause a reaction.</Text></View></InfoCard>
    </CareFlowLayout>
  );
}

const styles = StyleSheet.create({
  status: { alignSelf: 'flex-start', minHeight: 32, borderRadius: radius.pill, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF1CF' },
  statusLabel: { color: colors.warning, fontFamily: font.semibold, fontSize: 11 },
  productCard: { borderRadius: 16, padding: 18, gap: 6, backgroundColor: colors.surface },
  productName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 20, lineHeight: 27 },
  pending: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 12 },
  section: { gap: 9 },
  sectionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  card: { borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16, gap: 9, backgroundColor: colors.surface },
  cardTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  source: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  divider: { height: 1, backgroundColor: colors.borderDefault },
  checkRow: { minHeight: 76, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  checkCopy: { flex: 1, gap: 3 },
  checkLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 19 },
  note: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noteText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
});
