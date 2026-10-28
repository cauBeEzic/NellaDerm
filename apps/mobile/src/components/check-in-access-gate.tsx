import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CheckInFlowLayout } from '@/components/check-in-flow-layout';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { colors, font, radius, spacing } from '@/theme';

type Props = {
  title: string;
  missingHeading: string;
  missingBody: string;
};

export function CheckInAccessGate({ missingBody, missingHeading, title }: Props) {
  const { loading: authLoading, user } = useAuth();
  const { loading: careLoading, profile } = useCare();
  const { error, loading, retry } = useCheckIn();

  if (authLoading || careLoading || loading) {
    return <View style={styles.center}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.body}>Opening your check-in…</Text></View>;
  }

  if (!user || profile.isDemo) {
    return (
      <CheckInFlowLayout title={title}>
        <View style={styles.gateIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="account-lock-outline" size={32} /></View>
        <Text style={styles.heading}>Sign in to record a check-in</Text>
        <Text style={styles.body}>Guest mode does not store health observations. Sign in to keep each profile’s check-ins separate.</Text>
        <PrimaryButton label="Sign in" onPress={() => router.push('/sign-in')} />
        <SecondaryButton label="Return to Today" onPress={() => router.replace('/(tabs)')} quiet />
      </CheckInFlowLayout>
    );
  }

  if (error) {
    return (
      <CheckInFlowLayout title={title}>
        <View style={styles.gateIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="cloud-alert-outline" size={32} /></View>
        <Text style={styles.heading}>Check-in data is unavailable</Text>
        <Text style={styles.body}>{error}</Text>
        <PrimaryButton label="Reload check-in" onPress={retry} />
        <SecondaryButton label="Return to Today" onPress={() => router.replace('/(tabs)')} quiet />
      </CheckInFlowLayout>
    );
  }

  return (
    <CheckInFlowLayout title={title}>
      <Text style={styles.heading}>{missingHeading}</Text>
      <Text style={styles.body}>{missingBody}</Text>
      <PrimaryButton label="Return to check-in" onPress={() => router.replace('/check-in')} />
    </CheckInFlowLayout>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.canvas },
  gateIcon: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  heading: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 22, lineHeight: 30 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
});
