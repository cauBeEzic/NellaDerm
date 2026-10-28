import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, radius, size, spacing } from '@/theme';

type FeatureScreenProps = {
  body: string;
  eyebrow: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  children?: ReactNode;
};

export function FeatureScreen({ body, children, eyebrow, icon, title }: FeatureScreenProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <View style={styles.card}>
          <View style={styles.icon}><MaterialCommunityIcons color={colors.actionPrimary} name={icon} size={30} /></View>
          <Text style={styles.body}>{body}</Text>
          <Text style={styles.status}>Foundation preview</Text>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  eyebrow: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 30, lineHeight: 39, marginTop: spacing.xs },
  card: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.xl, marginTop: spacing.xxl },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: spacing.md },
  status: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 12, marginTop: spacing.lg },
});
