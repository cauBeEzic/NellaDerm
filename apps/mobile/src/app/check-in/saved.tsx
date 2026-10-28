import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CheckInAccessGate } from '@/components/check-in-access-gate';
import { CheckInFlowLayout } from '@/components/check-in-flow-layout';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { comparisonLabel } from '@/lib/check-in';
import { colors, font } from '@/theme';

export default function CheckInSavedScreen() {
  const { profile } = useCare();
  const { beginEdit, offline, state } = useCheckIn();
  const entry = state.entry;

  if (!entry) {
    return <CheckInAccessGate missingBody="Return to the check-in flow and save today’s comparison first." missingHeading="No saved check-in was found" title="Check-in saved" />;
  }

  async function edit() {
    await beginEdit();
    router.replace('/check-in');
  }

  return (
    <CheckInFlowLayout title="Check-in saved">
      <View style={styles.successIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="check" size={34} /></View>
      <View style={styles.intro}>
        <Text style={styles.heading}>Your check-in is saved</Text>
        <Text style={styles.body}>Today’s skin entry is in {profile.name}’s history on this device. You can edit it from Today.</Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.savedFor}>Saved for {profile.name}</Text>
        <Text style={styles.summaryTitle}>{comparisonLabel(entry.comparison)}</Text>
        <Text style={styles.body}>{Object.keys(entry.symptoms).length ? `${Object.keys(entry.symptoms).length} symptom ${Object.keys(entry.symptoms).length === 1 ? 'detail' : 'details'} noted` : 'No optional symptom details added'}</Text>
        {entry.photo ? <View style={styles.photoRow}><MaterialCommunityIcons color={colors.actionPrimary} name="image-lock-outline" size={19} /><Text style={styles.photoRowText}>1 private photo record · local file may be unavailable · not uploaded</Text></View> : null}
      </View>
      <View style={styles.localNotice}>
        <MaterialCommunityIcons color={colors.actionPrimary} name={offline ? 'cloud-off-outline' : 'cellphone-lock'} size={22} />
        <Text style={styles.localNoticeText}>{offline ? 'You are offline. This entry remains saved on this device.' : 'AWS history sync is not connected in this demo. This entry is saved on this device only.'}</Text>
      </View>
      <View style={styles.actions}>
        <PrimaryButton label="Return to Today" onPress={() => router.replace('/(tabs)')} />
        <SecondaryButton label="Change answer" onPress={() => void edit()} />
      </View>
    </CheckInFlowLayout>
  );
}

const styles = StyleSheet.create({
  successIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  intro: { gap: 8 },
  heading: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 22, lineHeight: 30 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  summaryCard: { padding: 20, gap: 8, borderRadius: 16, backgroundColor: colors.surface },
  savedFor: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 13, lineHeight: 18 },
  summaryTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 26 },
  photoRow: { minHeight: 44, marginTop: 4, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceBrandSoft },
  photoRowText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  localNotice: { padding: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.surfaceBrandSoft },
  localNoticeText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  actions: { gap: 12 },
});
