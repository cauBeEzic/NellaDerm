import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, font, radius, size } from '@/theme';

export function ProfileDetailScreen({ children, title }: PropsWithChildren<{ title: string }>) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Go back" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <MaterialCommunityIcons color={colors.textPrimary} name={Platform.OS === 'android' ? 'arrow-left' : 'chevron-left'} size={Platform.OS === 'android' ? 24 : 28} />
        </Pressable>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Text>
        <View style={styles.spacer} />
      </View>
      {children}
    </SafeAreaView>
  );
}

export function ProfileAvatar({ name, size = 56 }: { name: string; size?: number }) {
  return (
    <View accessibilityLabel={`${name} profile`} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initial, { fontSize: Math.max(16, size * 0.42) }]}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  header: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25, textAlign: 'center' },
  spacer: { width: 48 },
  avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  initial: { color: colors.actionPrimary, fontFamily: font.medium },
  pressed: { opacity: 0.68 },
});
