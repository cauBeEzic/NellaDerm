import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, spacing } from '@/theme';

export function DemoNotice() {
  return (
    <View accessibilityRole="summary" style={styles.notice}>
      <MaterialCommunityIcons color={colors.actionPrimary} name="information-outline" size={20} />
      <Text style={styles.text}>Demo mode: secure account services are not connected yet.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceBrandSoft, borderRadius: radius.control, padding: spacing.sm },
  text: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
});
