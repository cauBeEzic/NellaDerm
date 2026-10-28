import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, size } from '@/theme';

type CheckInFlowLayoutProps = PropsWithChildren<{
  title: string;
  status?: string;
  onBack?: () => void;
  onClose?: () => void;
  scroll?: boolean;
}>;

export function CheckInFlowLayout({ children, onBack, onClose, scroll = true, status, title }: CheckInFlowLayoutProps) {
  const body = scroll
    ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{status ? <StatusLine status={status} /> : null}{children}</ScrollView>
    : <View style={styles.fill}>{status ? <StatusLine status={status} /> : null}{children}</View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={8} onPress={onBack ?? router.back} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={colors.textPrimary} name="arrow-left" size={25} />
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Text>
        {onClose ? (
          <Pressable accessibilityLabel="Close check-in" accessibilityRole="button" hitSlop={8} onPress={onClose} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <MaterialCommunityIcons color={colors.textSecondary} name="close" size={25} />
          </Pressable>
        ) : <View style={styles.headerButton} />}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        {body}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StatusLine({ status }: { status: string }) {
  return (
    <View style={styles.statusLine}>
      <View style={styles.statusDot} />
      <Text style={styles.statusText}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  fill: { flex: 1 },
  header: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40, gap: 24 },
  statusLine: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', minHeight: 48, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.actionPrimary },
  statusText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.65 },
});
