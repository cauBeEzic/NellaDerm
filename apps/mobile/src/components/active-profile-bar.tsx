import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';
import { useProfiles } from '@/contexts/profile-context';
import { colors, font, radius } from '@/theme';

export function ActiveProfileBar({ detail = 'Health records follow this profile' }: { detail?: string }) {
  const { user } = useAuth();
  const { activeProfile } = useProfiles();
  const switchable = Boolean(user && !activeProfile.isDemo);
  return (
    <Pressable
      accessibilityHint={switchable ? 'Opens the profile switcher' : undefined}
      accessibilityLabel={`Active profile: ${activeProfile.name}`}
      accessibilityRole={switchable ? 'button' : undefined}
      disabled={!switchable}
      onPress={() => router.push('/profile/switch')}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}>
      <View style={styles.icon}><MaterialCommunityIcons color={colors.actionPrimary} name="account-outline" size={18} /></View>
      <View style={styles.copy}><Text style={styles.name}>{activeProfile.name}</Text><Text style={styles.detail}>{activeProfile.isDemo ? 'Synthetic demo data · not saved' : detail}</Text></View>
      {switchable ? <MaterialCommunityIcons color={colors.actionPrimary} name="swap-horizontal" size={22} /> : <Text style={styles.demo}>Demo</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 58, borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surfaceBrandSoft },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  copy: { flex: 1 },
  name: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  detail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16 },
  demo: { borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, color: colors.actionPrimary, backgroundColor: colors.surface, fontFamily: font.semibold, fontSize: 11 },
  pressed: { opacity: 0.68 },
});
