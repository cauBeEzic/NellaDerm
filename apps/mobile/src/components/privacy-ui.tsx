import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/button';
import { colors, font, radius } from '@/theme';

type PrivacyCardProps = {
  danger?: boolean;
  detail: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress?: () => void;
  title: string;
};

export function PrivacyCard({ danger = false, detail, icon, onPress, title }: PrivacyCardProps) {
  return (
    <Pressable
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.icon, danger && styles.dangerIcon]}>
        <MaterialCommunityIcons color={danger ? colors.error : colors.actionPrimary} name={icon} size={22} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, danger && styles.dangerTitle]}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      {onPress ? <MaterialCommunityIcons color={danger ? colors.error : colors.textSecondary} name="chevron-right" size={22} /> : null}
    </Pressable>
  );
}

export function PrivacySignInGate({
  body,
  danger = false,
  icon = 'shield-account-outline',
  title,
}: {
  body: string;
  danger?: boolean;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
}) {
  return (
    <View style={styles.gate}>
      <View style={[styles.gateIcon, danger && styles.dangerIcon]}>
        <MaterialCommunityIcons color={danger ? colors.error : colors.actionPrimary} name={icon} size={30} />
      </View>
      <Text accessibilityRole="header" style={styles.gateTitle}>{title}</Text>
      <Text style={styles.gateBody}>{body}</Text>
      <PrimaryButton label="Sign in" onPress={() => router.push('/sign-in')} />
    </View>
  );
}

export function PrivacyNotice({ children, danger = false, icon = 'shield-lock-outline' }: PropsWithChildren<{ danger?: boolean; icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }>) {
  return (
    <View style={[styles.notice, danger && styles.dangerNotice]}>
      <MaterialCommunityIcons color={danger ? colors.error : colors.actionPrimary} name={icon} size={21} />
      <Text style={[styles.noticeText, danger && styles.dangerNoticeText]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 88, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  dangerIcon: { backgroundColor: colors.errorSurface },
  copy: { flex: 1, gap: 3 },
  title: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  dangerTitle: { color: colors.error },
  detail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  notice: { borderRadius: radius.card, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surfaceBrandSoft },
  dangerNotice: { backgroundColor: colors.errorSurface },
  noticeText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  dangerNoticeText: { color: colors.error },
  gate: { minHeight: 390, marginHorizontal: 20, borderRadius: 18, padding: 26, justifyContent: 'center', gap: 12, backgroundColor: colors.surface },
  gateIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  gateTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 21, lineHeight: 29 },
  gateBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.68 },
});
