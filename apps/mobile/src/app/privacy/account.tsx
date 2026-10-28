import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ProfileDetailScreen } from '@/components/profile-ui';
import { PrivacyCard, PrivacyNotice, PrivacySignInGate } from '@/components/privacy-ui';
import { useAuth } from '@/contexts/auth-context';
import { colors, font, size } from '@/theme';

export default function AccountSettingsScreen() {
  const { configured, user } = useAuth();

  if (!user) {
    return (
      <ProfileDetailScreen title="Account settings">
        <PrivacySignInGate
          body="Sign in before reviewing identity methods or beginning a verified account-deletion request. Guest activity does not create a mobile account."
          icon="account-lock-outline"
          title="Sign in to manage your account"
        />
      </ProfileDetailScreen>
    );
  }

  return (
    <ProfileDetailScreen title="Account settings">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="account-lock-outline" size={29} /></View>
          <View style={styles.heroCopy}><Text accessibilityRole="header" style={styles.title}>Mobile account</Text><Text style={styles.body}>{user.username}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sign-in methods</Text>
          <View style={styles.methodGroup}>
            <View style={styles.method}><MaterialCommunityIcons color={colors.actionPrimary} name="email-lock-outline" size={22} /><View style={styles.methodCopy}><Text style={styles.methodTitle}>Email and password</Text><Text style={styles.methodDetail}>{configured ? 'Connected through the MyEczema Cognito user pool' : 'Not connected on this build'}</Text></View><MaterialCommunityIcons color={configured ? colors.success : colors.textSecondary} name={configured ? 'check-circle' : 'minus-circle-outline'} size={21} /></View>
            <View style={[styles.method, styles.methodBorder]}><MaterialCommunityIcons color={colors.textSecondary} name="google" size={22} /><View style={styles.methodCopy}><Text style={styles.methodTitle}>Google</Text><Text style={styles.methodDetail}>OAuth credentials are not connected yet</Text></View><Text style={styles.pending}>Pending</Text></View>
            <View style={[styles.method, styles.methodBorder]}><MaterialCommunityIcons color={colors.textSecondary} name="apple" size={22} /><View style={styles.methodCopy}><Text style={styles.methodTitle}>Apple</Text><Text style={styles.methodDetail}>Sign in with Apple is not connected yet</Text></View><Text style={styles.pending}>Pending</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & deletion</Text>
          <PrivacyCard danger detail="Review consequences and start a verified support request" icon="account-remove-outline" onPress={() => router.push({ pathname: '/privacy/delete', params: { target: 'account' } })} title="Request account deletion" />
        </View>

        <PrivacyNotice>Existing website or Firebase identities are not migrated. This mobile account is separate. Google and Apple sign-in remain visible as honest setup boundaries until their platform credentials are configured.</PrivacyNotice>
      </ScrollView>
    </ProfileDetailScreen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40, gap: 22 },
  hero: { minHeight: 96, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface },
  heroIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  heroCopy: { flex: 1, gap: 3 },
  title: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 19, lineHeight: 26 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  section: { gap: 10 },
  sectionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  methodGroup: { overflow: 'hidden', borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  method: { minHeight: 74, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDefault },
  methodCopy: { flex: 1 },
  methodTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  methodDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  pending: { color: colors.textSecondary, fontFamily: font.semibold, fontSize: 11 },
});
