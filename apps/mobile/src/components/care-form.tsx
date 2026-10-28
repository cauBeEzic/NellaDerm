import type { ComponentProps, PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, font, radius, size } from '@/theme';

export function Field({ label, style, ...props }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.textSecondary} {...props} style={[styles.input, style]} />
    </View>
  );
}

export function ChoiceRow<T extends string>({ choices, labelFor, onChange, value }: { choices: readonly T[]; labelFor?: (choice: T) => string; onChange: (value: T) => void; value: T }) {
  return (
    <View style={styles.choiceRow}>
      {choices.map((choice) => {
        const selected = choice === value;
        return (
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={choice} onPress={() => onChange(choice)} style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}>
            <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{labelFor?.(choice) ?? choice}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MultiChoiceRow<T extends string>({ choices, disabled = false, labelFor, onChange, values }: { choices: readonly T[]; disabled?: boolean; labelFor?: (choice: T) => string; onChange: (values: T[]) => void; values: T[] }) {
  return (
    <View style={styles.choiceRow}>
      {choices.map((choice) => {
        const selected = values.includes(choice);
        return (
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled }} disabled={disabled} key={choice} onPress={() => onChange(selected ? values.filter((item) => item !== choice) : [...values, choice])} style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.pressed]}>
            <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{labelFor?.(choice) ?? choice}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function InfoCard({ children }: PropsWithChildren) {
  return <View style={styles.info}>{children}</View>;
}

export function SubmitButton({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.submit, disabled && styles.submitDisabled, pressed && styles.pressed]}>
      <Text style={styles.submitLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { gap: 7 },
  label: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  input: { minHeight: size.fieldHeight, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.control, paddingHorizontal: 14, color: colors.textPrimary, backgroundColor: colors.surface, fontFamily: font.regular, fontSize: 15 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 48, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 24, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  choiceSelected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  choiceLabel: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13 },
  choiceLabelSelected: { color: colors.actionPrimary, fontFamily: font.semibold },
  info: { borderRadius: radius.control, padding: 16, gap: 6, backgroundColor: colors.surfaceBrandSoft },
  submit: { minHeight: size.primaryButtonHeight, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, backgroundColor: colors.actionPrimary },
  submitDisabled: { backgroundColor: colors.actionDisabled },
  submitLabel: { color: colors.onActionPrimary, fontFamily: font.semibold, fontSize: 15 },
  pressed: { opacity: 0.68 },
});
