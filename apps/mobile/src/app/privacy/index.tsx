import { router } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/button';
import { ProfileDetailScreen } from '@/components/profile-ui';
import { PrivacyCard, PrivacyNotice, PrivacySignInGate } from '@/components/privacy-ui';
import { useAuth } from '@/contexts/auth-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { useProfiles } from '@/contexts/profile-context';
import { colors, font, size } from '@/theme';

export default function PrivacyDataScreen() {
  const { user } = useAuth();
  const { history } = useCheckIn();
  const { activeProfile, error, loading, retry } = useProfiles();
  const localPhotoCount = history.filter((entry) => entry.photo).length;

  if (!user) {
    return (
      <ProfileDetailScreen title="Privacy & data">
        <PrivacySignInGate
          body="Guest activity is temporary and does not create a retained health profile, export, or account-deletion request."
          title="Sign in to manage private data"
        />
      </ProfileDetailScreen>
    );
  }

  return (
    <ProfileDetailScreen title="Privacy & data">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text accessibilityRole="header" style={styles.title}>Understand, export, and remove personal information.</Text>
          <Text style={styles.body}>These controls belong to the currently selected profile. Switch before exporting or requesting profile removal.</Text>
        </View>

        <PrivacyCard
          detail={`For ${activeProfile.name} · switch profile`}
          icon="account-switch-outline"
          onPress={() => router.push('/profile/switch')}
          title={activeProfile.name}
        />

        {loading ? <View style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.loadingText}>Opening privacy controls…</Text></View> : null}
        {error ? <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text><PrimaryButton label="Reload profiles" onPress={retry} /></View> : null}

        {!loading && !error ? (
          <>
            <View style={styles.cardGroup}>
              <PrivacyCard detail={`${localPhotoCount} skin-photo ${localPhotoCount === 1 ? 'record' : 'records'} · packaging photos managed in Care · no uploads`} icon="image-lock-outline" onPress={() => router.push('/privacy/photos')} title="Photos & uploads" />
              <PrivacyCard detail="Prepare a portable patient-generated PDF" icon="file-export-outline" onPress={() => router.push('/export')} title={`Download ${activeProfile.name}’s data`} />
              <PrivacyCard
                detail="No provider or care-team portal is connected"
                icon="account-group-outline"
                onPress={() => Alert.alert('No connected care team', 'MyEczema does not provide a provider portal in this demo. No clinician or care team has access through the app.')}
                title="Connected care team"
              />
              <PrivacyCard detail="Review identity and account deletion" icon="account-cog-outline" onPress={() => router.push('/privacy/account')} title="Account settings" />
              <PrivacyCard
                danger
                detail={activeProfile.type === 'dependent' ? `Start a support-mediated request for ${activeProfile.name}` : 'Start a verified support-mediated account request'}
                icon="account-remove-outline"
                onPress={() => router.push({ pathname: '/privacy/delete', params: { target: activeProfile.type === 'dependent' ? 'profile' : 'account' } })}
                title={activeProfile.type === 'dependent' ? 'Request profile removal' : 'Request account deletion'}
              />
            </View>

            <PrivacyNotice>Private-area photographs are prohibited. Local photos remain in the app-private device cache; provider access, cloud media, cloud export, and server deletion are not connected.</PrivacyNotice>
          </>
        ) : null}
      </ScrollView>
    </ProfileDetailScreen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  intro: { gap: 8, paddingVertical: 4 },
  title: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 24, lineHeight: 32 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  cardGroup: { gap: 12 },
  loading: { minHeight: 120, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  error: { borderRadius: 16, padding: 16, gap: 12, backgroundColor: colors.errorSurface },
  errorText: { color: colors.error, fontFamily: font.medium, fontSize: 13, lineHeight: 19 },
});
