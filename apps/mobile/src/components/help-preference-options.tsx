import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CareProfile, HelpPreference } from '@/lib/care-profile';
import { colors, font } from '@/theme';

type Props = {
  profile: Pick<CareProfile, 'name' | 'type'>;
  value?: HelpPreference;
  onChange: (value: HelpPreference) => void;
  disabled?: boolean;
};

export function HelpPreferenceOptions({ disabled = false, onChange, profile, value }: Props) {
  const self = profile.type === 'self';
  const options: { value: HelpPreference; label: string; detail: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
    { value: 'SKIN_CHANGES', label: self ? 'Understand how my skin changes' : `Understand how ${profile.name}’s skin changes`, detail: 'Compare each check-in with the one before.', icon: 'chart-line' },
    { value: 'ROUTINE', label: self ? 'Keep my routine organized' : `Keep ${profile.name}’s routine organized`, detail: self ? 'Your products and reminders in one place.' : `${profile.name}’s products and reminders in one place.`, icon: 'format-list-checks' },
    { value: 'DOCTOR_VISIT', label: self ? 'Prepare for a doctor visit' : `Prepare for ${profile.name}’s doctor visits`, detail: 'A clear summary of what you recorded, ready to share.', icon: 'clipboard-text-outline' },
  ];

  return (
    <View accessibilityLabel="Care goal" accessibilityRole="radiogroup" style={styles.options}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityLabel={`${option.label}. ${option.detail}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, disabled }}
            disabled={disabled}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [styles.option, selected && styles.selected, disabled && styles.disabled, pressed && styles.pressed]}>
            <View style={[styles.icon, selected && styles.selectedIcon]}>
              <MaterialCommunityIcons accessible={false} color={selected ? colors.onActionPrimary : colors.actionPrimary} name={option.icon} size={22} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.label}>{option.label}</Text>
              <Text style={styles.detail}>{option.detail}</Text>
            </View>
            <MaterialCommunityIcons accessible={false} color={selected ? colors.actionPrimary : colors.textSecondary} name={selected ? 'radiobox-marked' : 'radiobox-blank'} size={24} />
          </Pressable>
        );
      })}
      <Pressable
        accessibilityLabel="Not sure yet"
        accessibilityRole="radio"
        accessibilityState={{ checked: value === 'NOT_SURE', disabled }}
        disabled={disabled}
        onPress={() => onChange('NOT_SURE')}
        style={({ pressed }) => [styles.notSure, disabled && styles.disabled, pressed && styles.pressed]}>
        {value === 'NOT_SURE' ? <MaterialCommunityIcons accessible={false} color={colors.actionPrimary} name="check-circle" size={20} /> : null}
        <Text style={styles.notSureText}>Not sure yet</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  options: { gap: 12 },
  option: { minHeight: 104, padding: 16, borderRadius: 18, borderWidth: 2, borderColor: colors.borderDefault, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selected: { borderColor: colors.actionPrimary, backgroundColor: colors.surfaceBrandSoft },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  selectedIcon: { backgroundColor: colors.actionPrimary },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  label: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 16, lineHeight: 24 },
  detail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  notSure: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  notSureText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.68 },
});
