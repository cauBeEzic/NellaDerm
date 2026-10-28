import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, size } from '@/theme';

type CareFlowLayoutProps = PropsWithChildren<{
  title: string;
  scroll?: boolean;
}>;

export function CareFlowLayout({ children, scroll = true, title }: CareFlowLayoutProps) {
  const content = scroll
    ? <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
    : <View style={styles.fill}>{children}</View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={colors.textPrimary} name="arrow-left" size={23} />
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Text>
        <View style={styles.back} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  fill: { flex: 1 },
  header: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 36, gap: 20 },
  pressed: { opacity: 0.65 },
});
