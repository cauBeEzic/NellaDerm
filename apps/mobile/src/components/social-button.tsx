import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, font, radius, size, spacing } from '@/theme';

type SocialButtonProps = { disabled?: boolean; label: string; provider: 'apple' | 'google'; onPress: () => void };

export function SocialButton({ disabled = false, label, onPress, provider }: SocialButtonProps) {
  const source = provider === 'google' ? require('../../assets/brand/google.svg') : require('../../assets/brand/apple.svg');
  return (
    <Pressable accessibilityHint={disabled ? 'Provider setup is pending for this demo' : undefined} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}>
      <Image contentFit="contain" source={source} style={styles.icon} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: size.fieldHeight, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.control, backgroundColor: colors.surface, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  pressed: { backgroundColor: colors.surfaceBrandSoft },
  disabled: { opacity: 0.52 },
  icon: { width: 22, height: 22 },
  label: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15 },
});
