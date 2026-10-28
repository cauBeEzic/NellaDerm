import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { colors, font, radius, size, spacing } from '@/theme';

type TextFieldProps = TextInputProps & { error?: string; label: string };

export function TextField({ error, label, secureTextEntry, ...props }: TextFieldProps) {
  const [obscured, setObscured] = useState(Boolean(secureTextEntry));

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputFrame, error && styles.inputError]}>
        <TextInput accessibilityLabel={label} placeholderTextColor={colors.textSecondary} secureTextEntry={secureTextEntry ? obscured : false} style={styles.input} {...props} />
        {secureTextEntry ? (
          <Pressable accessibilityLabel={`${obscured ? 'Show' : 'Hide'} ${label.toLowerCase()}`} accessibilityRole="button" hitSlop={8} onPress={() => setObscured((value) => !value)} style={styles.reveal}>
            <Text style={styles.revealLabel}>{obscured ? 'Show' : 'Hide'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14 },
  inputFrame: { minHeight: size.fieldHeight, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.control, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: size.fieldHeight, paddingHorizontal: spacing.md, color: colors.textPrimary, fontFamily: font.regular, fontSize: 16 },
  inputError: { borderColor: colors.error },
  reveal: { minHeight: size.androidTouchTarget, minWidth: 56, alignItems: 'center', justifyContent: 'center', paddingRight: spacing.sm },
  revealLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  error: { color: colors.error, fontFamily: font.regular, fontSize: 12, lineHeight: 17 },
});
