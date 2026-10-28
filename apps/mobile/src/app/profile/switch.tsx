import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileAvatar, ProfileDetailScreen } from '@/components/profile-ui';
import { useAuth } from '@/contexts/auth-context';
import { useProfiles } from '@/contexts/profile-context';
import type { CareProfile } from '@/lib/care-profile';
import { colors, font, radius, size, spacing } from '@/theme';

function profileDetail(profile: CareProfile) {
  if (profile.type === 'self') return 'Me';
  return profile.relationship ? `${profile.relationship} · managed profile` : 'Managed profile';
}

export default function ProfileSwitchScreen() {
  const { loading: authLoading, user } = useAuth();
  const { activeProfile, error, loading, profiles, retry, switchProfile } = useProfiles();
  const [switchingId, setSwitchingId] = useState<string>();

  useEffect(() => {
    if (!authLoading && !user) router.replace('/sign-in');
  }, [authLoading, user]);

  async function choose(profile: CareProfile) {
    if (profile.id === activeProfile.id) {
      router.replace('/(tabs)');
      return;
    }
    setSwitchingId(profile.id);
    try {
      await switchProfile(profile.id);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Could not switch profiles', 'The previous profile is still active. Reload profiles and try again.');
    } finally {
      setSwitchingId(undefined);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ProfileDetailScreen title="Who I’m managing">
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heading}><Text accessibilityRole="header" style={styles.headingTitle}>Choose a profile</Text><Text style={styles.headingBody}>Health records and tracking stay separate for each person.</Text></View>
          {error ? <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><Text style={styles.retryText}>Reload profiles</Text></Pressable></View> : null}
          {loading && !profiles.length ? <View style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.loadingText}>Opening profiles…</Text></View> : null}
          <View style={styles.profileList}>
            {profiles.map((profile) => {
              const current = profile.id === activeProfile.id;
              const switching = switchingId === profile.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: current, busy: switching }}
                  disabled={Boolean(switchingId)}
                  key={profile.id}
                  onPress={() => void choose(profile)}
                  style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}>
                  <ProfileAvatar name={profile.name} />
                  <View style={styles.profileCopy}><Text style={styles.profileName}>{profile.name}</Text><Text style={styles.profileDetail}>{profileDetail(profile)}{current ? ' · Currently active' : ''}</Text></View>
                  {switching ? <ActivityIndicator color={colors.actionPrimary} /> : <MaterialCommunityIcons color={current ? colors.actionPrimary : colors.textSecondary} name={current ? 'check-circle' : 'chevron-right'} size={current ? 24 : 28} />}
                </Pressable>
              );
            })}
          </View>
          <Pressable accessibilityRole="button" disabled={loading || Boolean(switchingId)} onPress={() => router.push('/profile/add-dependent')} style={({ pressed }) => [styles.addButton, (loading || switchingId) && styles.addButtonDisabled, pressed && styles.pressed]}><Text style={styles.addButtonText}>Add dependent</Text></Pressable>
          <View style={styles.disclosure}><Text style={styles.disclosureTitle}>Account-level items</Text><Text style={styles.disclosureBody}>Shop and orders stay with your account. Tracking data follows the selected profile.</Text></View>
        </ScrollView>
      </ProfileDetailScreen>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, gap: 16 },
  heading: { gap: 6, marginBottom: 2 },
  headingTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 28, lineHeight: 36 },
  headingBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 15, lineHeight: 22 },
  profileList: { gap: 16 },
  profileCard: { minHeight: 86, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface },
  profileCopy: { flex: 1, gap: 2 },
  profileName: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 17, lineHeight: 24 },
  profileDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  addButton: { minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.borderDefault },
  addButtonDisabled: { opacity: 0.55 },
  addButtonText: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 15, lineHeight: 21 },
  disclosure: { borderRadius: 16, padding: 16, gap: 6, backgroundColor: colors.surface },
  disclosureTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 15, lineHeight: 21 },
  disclosureBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  loadingText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  error: { borderRadius: radius.card, padding: 14, gap: 8, backgroundColor: colors.errorSurface },
  errorText: { color: colors.error, fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
  retry: { minHeight: 48, alignSelf: 'flex-start', justifyContent: 'center' },
  retryText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 13 },
  pressed: { opacity: 0.68 },
});
