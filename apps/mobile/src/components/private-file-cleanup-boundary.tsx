import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/button';
import { useAuth } from '@/contexts/auth-context';
import { colors, font, radius, size } from '@/theme';

export function PrivateFileCleanupBoundary({ children }: PropsWithChildren) {
  const { privateFileCleanupError, retryPrivateFileCleanup, user } = useAuth();
  if (!privateFileCleanupError) return children;

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>Local private-file cleanup needs attention</Text>
    <Text accessibilityRole="alert" style={styles.body}>{privateFileCleanupError}</Text>
    {user ? <Text style={styles.body}>You are still signed in. Retry cleanup before continuing.</Text> : null}
    <PrimaryButton label="Retry cleanup" onPress={retryPrivateFileCleanup} />
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', justifyContent: 'center', padding: 24, gap: 20 },
  title: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 22, lineHeight: 30 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21, borderRadius: radius.card },
});
