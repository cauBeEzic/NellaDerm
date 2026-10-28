import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, type Href } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileAvatar } from '@/components/profile-ui';
import { useAuth } from '@/contexts/auth-context';
import { useProfiles } from '@/contexts/profile-context';
import { PrivateFileCleanupError } from '@/lib/private-file-cleanup';
import { colors, font, radius, size, spacing } from '@/theme';

type Row = {
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress: () => void;
};


function ProfileHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.wordmark}><Text style={styles.brand}>MyEczema</Text><Text style={styles.subBrand}>NellaDerm</Text></View>
      <Text accessibilityRole="header" style={styles.headerTitle}>Profile</Text>
      <View style={styles.headerAvatar}><MaterialCommunityIcons color={colors.onActionPrimary} name="account" size={20} /></View>
    </View>
  );
}

function SettingsSection({ rows, title }: { rows: Row[]; title: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      <View style={styles.rowGroup}>
        {rows.map((row, index) => (
          <Pressable accessibilityRole="button" key={row.label} onPress={row.onPress} style={({ pressed }) => [styles.row, index > 0 && styles.rowBorder, pressed && styles.pressed]}>
            <View style={styles.rowIcon}><MaterialCommunityIcons color={colors.actionPrimary} name={row.icon} size={20} /></View>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <MaterialCommunityIcons color={colors.borderDefault} name="chevron-right" size={24} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const { configured, signOutUser, user, syntheticDemo } = useAuth();
  const { activeProfile, error, loading, profiles, retry } = useProfiles();
  const otherProfile = profiles.find((profile) => profile.id !== activeProfile.id);

  async function signOut() {
    try {
      await signOutUser();
      router.replace(syntheticDemo ? '/sign-in' : '/');
    } catch (error) {
      Alert.alert('Could not sign out', error instanceof PrivateFileCleanupError ? error.message : 'Check your connection and try again.');
    }
  }

  const eczemaRows: Row[] = [
    { label: 'Common areas', icon: 'human-male', onPress: () => router.push('/profile/tracking') },
    { label: 'Typical symptoms', icon: 'blur', onPress: () => router.push('/profile/tracking') },
    { label: 'Eczema history', icon: 'history', onPress: () => router.push('/insights/history' as Href) },
    { label: 'Care goals', icon: 'flag-outline', onPress: () => router.push('/profile/goals') },
  ];
  const careRows: Row[] = [
    { label: 'Clinician information', icon: 'medical-bag', onPress: () => router.push('/export' as Href) },
    { label: 'Care-team summary preferences', icon: 'clipboard-check-outline', onPress: () => router.push('/export' as Href) },
  ];
  const preferenceRows: Row[] = [
    { label: 'Notifications', icon: 'bell', onPress: () => router.push('/notifications' as Href) },
    { label: 'Privacy & data', icon: 'lock', onPress: () => router.push('/privacy' as Href) },
    { label: 'Permissions', icon: 'tune-variant', onPress: () => router.push('/privacy' as Href) },
  ];
  const accountRows: Row[] = [
    { label: 'Personal information', icon: 'badge-account-horizontal-outline', onPress: () => router.push('/profile/personal') },
    { label: 'Account settings', icon: 'account-cog-outline', onPress: () => router.push('/privacy/account' as Href) },
    { label: 'Orders', icon: 'receipt-text-outline', onPress: () => router.push('/commerce/orders') },
  ];

  if (loading && user) return <SafeAreaView style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.loadingText}>Opening your profile…</Text></SafeAreaView>;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ProfileHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><Text style={styles.retryText}>Reload profiles</Text></Pressable></View> : null}
        <View style={styles.hero}>
          <View style={styles.avatarWrap}><ProfileAvatar name={activeProfile.name} size={56} />{!activeProfile.isDemo ? <View style={styles.verified}><MaterialCommunityIcons color={colors.onActionPrimary} name="check" size={13} /></View> : null}</View>
          <View style={styles.heroCopy}><Text style={styles.heroName}>{activeProfile.name}</Text><Text style={styles.heroDetail}>{activeProfile.isDemo ? 'Guest preview' : activeProfile.type === 'self' ? 'Managing my eczema' : `${activeProfile.relationship ?? 'Dependent'} profile`}</Text></View>
          {user ? <Pressable accessibilityLabel="Manage profiles" accessibilityRole="button" onPress={() => router.push('/profile/switch')} style={({ pressed }) => [styles.edit, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.textSecondary} name="pencil" size={21} /></Pressable> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WHO I’M MANAGING</Text>
          <View style={styles.manageGroup}>
            <View style={styles.manageRow}><ProfileAvatar name={activeProfile.name} size={36} /><View style={styles.manageCopy}><Text style={styles.manageName}>{activeProfile.name}</Text><Text style={styles.manageDetail}>{activeProfile.type === 'self' ? 'Me' : 'Managed profile'} · Current profile</Text></View><MaterialCommunityIcons color={colors.actionPrimary} name="check-circle" size={21} /></View>
            {user ? <Pressable accessibilityRole="button" onPress={() => router.push('/profile/switch')} style={({ pressed }) => [styles.manageRow, styles.manageBorder, pressed && styles.pressed]}><View style={styles.manageIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="account-switch-outline" size={19} /></View><View style={styles.manageCopy}><Text style={styles.manageName}>Switch or add a profile</Text><Text style={styles.manageDetail}>{otherProfile ? `${otherProfile.name} · available` : 'Keep each person’s records separate'}</Text></View><MaterialCommunityIcons color={colors.actionPrimary} name="chevron-right" size={22} /></Pressable> : <Pressable accessibilityRole="button" onPress={() => router.push('/sign-in')} style={({ pressed }) => [styles.manageRow, styles.manageBorder, pressed && styles.pressed]}><View style={styles.manageIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="login" size={19} /></View><View style={styles.manageCopy}><Text style={styles.manageName}>Sign in to save profiles</Text><Text style={styles.manageDetail}>Guest data is synthetic and is not retained</Text></View><MaterialCommunityIcons color={colors.actionPrimary} name="chevron-right" size={22} /></Pressable>}
          </View>
        </View>

        {user ? <>
          <SettingsSection rows={eczemaRows} title="MY ECZEMA" />
          <View style={styles.section}><Text style={styles.sectionLabel}>MY CARE</Text><View style={styles.rowGroup}>{careRows.map((row, index) => <Pressable accessibilityRole="button" key={row.label} onPress={row.onPress} style={({ pressed }) => [styles.row, index > 0 && styles.rowBorder, pressed && styles.pressed]}><View style={styles.rowIcon}><MaterialCommunityIcons color={colors.actionPrimary} name={row.icon} size={20} /></View><Text style={styles.rowLabel}>{row.label}</Text><MaterialCommunityIcons color={colors.borderDefault} name="chevron-right" size={24} /></Pressable>)}</View><Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/care')} style={({ pressed }) => [styles.careLink, pressed && styles.pressed]}><View style={styles.rowIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="bottle-tonic-plus-outline" size={20} /></View><Text style={styles.careLinkLabel}>Products are managed in Care</Text><View style={styles.carePill}><Text style={styles.carePillText}>Open Care</Text><MaterialCommunityIcons color={colors.actionPrimary} name="arrow-right" size={17} /></View></Pressable></View>
          <SettingsSection rows={preferenceRows} title="APP PREFERENCES" />
          <SettingsSection rows={accountRows} title="ACCOUNT" />
          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.textSecondary} name="logout" size={21} /><Text style={styles.signOutText}>Sign out</Text></Pressable>
        </> : configured ? <Pressable accessibilityRole="button" onPress={() => router.push('/sign-in')} style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}><Text style={styles.signInText}>Sign in</Text></Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.canvas },
  loadingText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14 },
  header: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { width: 92 }, brand: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 11, lineHeight: 16 }, subBrand: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 9, lineHeight: 12 },
  headerTitle: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  headerAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary },
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 42, gap: 24 },
  hero: { minHeight: 96, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.surface },
  avatarWrap: { position: 'relative' }, verified: { position: 'absolute', right: -2, bottom: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary, borderWidth: 2, borderColor: colors.surface },
  heroCopy: { flex: 1 }, heroName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 }, heroDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  edit: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  section: { gap: 8 }, sectionLabel: { paddingHorizontal: 8, color: colors.textSecondary, fontFamily: font.semibold, fontSize: 11, lineHeight: 16 },
  manageGroup: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface },
  manageRow: { minHeight: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, manageBorder: { borderTopWidth: 1, borderTopColor: colors.borderDefault },
  manageIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft }, manageCopy: { flex: 1 }, manageName: { color: colors.textPrimary, fontFamily: font.medium, fontSize: 14, lineHeight: 20 }, manageDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16 },
  rowGroup: { borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface }, row: { minHeight: 62, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, rowBorder: { borderTopWidth: 1, borderTopColor: colors.borderDefault },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft }, rowLabel: { flex: 1, color: colors.textPrimary, fontFamily: font.medium, fontSize: 15, lineHeight: 21 },
  careLink: { minHeight: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, careLinkLabel: { flex: 1, color: colors.textPrimary, fontFamily: font.medium, fontSize: 15, lineHeight: 21 }, carePill: { minHeight: 40, borderRadius: radius.pill, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.borderDefault }, carePillText: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 12 },
  signOut: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }, signOutText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 15 },
  signIn: { minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary }, signInText: { color: colors.onActionPrimary, fontFamily: font.semibold, fontSize: 15 },
  error: { borderRadius: radius.card, padding: 14, gap: 8, backgroundColor: colors.errorSurface }, errorText: { color: colors.error, fontFamily: font.medium, fontSize: 13, lineHeight: 19 }, retry: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center' }, retryText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  pressed: { opacity: 0.68 },
});
