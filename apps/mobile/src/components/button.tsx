import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle } from 'react-native';

import { colors, font, radius, size } from '@/theme';

type ButtonProps = Pick<PressableProps, 'disabled' | 'onPress'> & { label: string; labelStyle?: StyleProp<TextStyle>; quiet?: boolean };
type PrimaryButtonProps = ButtonProps & { trailingIcon?: ReactNode };

export function PrimaryButton({ disabled, label, labelStyle, onPress, trailingIcon }: PrimaryButtonProps) {
  const text = <Text style={labelStyle || trailingIcon ? [styles.primaryLabel, trailingIcon ? styles.labelWithIcon : undefined, labelStyle] : styles.primaryLabel}>{label}</Text>;
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.base, styles.primary, pressed && styles.primaryPressed, disabled && styles.disabled]}>
      {trailingIcon ? <View style={styles.primaryContent}>{text}{trailingIcon}</View> : text}
    </Pressable>
  );
}

export function SecondaryButton({ disabled, label, labelStyle, onPress, quiet = false }: ButtonProps) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.base, !quiet && styles.secondary, pressed && styles.secondaryPressed]}>
      <Text style={[styles.secondaryLabel, quiet && styles.quietLabel, labelStyle]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: size.primaryButtonHeight, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primary: { backgroundColor: colors.actionPrimary },
  primaryPressed: { backgroundColor: colors.actionPrimaryPressed },
  disabled: { backgroundColor: colors.actionDisabled },
  primaryContent: { maxWidth: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  labelWithIcon: { flexShrink: 1 },
  primaryLabel: { color: colors.onActionPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  secondary: { backgroundColor: colors.surface, borderColor: colors.borderDefault, borderWidth: 1 },
  secondaryPressed: { backgroundColor: colors.surfaceBrandSoft },
  secondaryLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  quietLabel: { color: colors.actionPrimary },
});
