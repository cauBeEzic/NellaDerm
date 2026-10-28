import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, size, spacing } from '@/theme';

type AuthLayoutProps = PropsWithChildren<{ subtitle: string; title: string }>;

export function AuthLayout({ children, subtitle, title }: AuthLayoutProps) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, alignSelf: 'center', width: '100%', maxWidth: size.contentMaxWidth, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  heading: { alignItems: 'center', marginBottom: spacing.xl, paddingTop: spacing.xl },
  title: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 26, lineHeight: 34, textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: spacing.xs },
});
