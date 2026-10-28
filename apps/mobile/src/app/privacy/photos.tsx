import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SecondaryButton } from '@/components/button';
import { ProfileDetailScreen } from '@/components/profile-ui';
import { PrivacyNotice, PrivacySignInGate } from '@/components/privacy-ui';
import { useAuth } from '@/contexts/auth-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { useProfiles } from '@/contexts/profile-context';
import { areaLabels } from '@/lib/check-in';
import { checkInPhotoExists } from '@/lib/check-in-media';
import { photoRecords } from '@/lib/photo-progress';
import { colors, font, radius, size } from '@/theme';

const rules = [
  ['Private areas are prohibited', 'Do not photograph genitals, breasts, buttocks, or other intimate areas.'],
  ['Private device cache only', 'Recorded references may outlast their cached local copies. No photo is uploaded or synchronized.'],
  ['Deletion is immediate locally', 'Removing a photo deletes its managed app-private file and removes it from the saved check-in metadata.'],
  ['No secondary use', 'Photos are not analyzed, used for model training, or included in research without a separate future consent flow.'],
] as const;

export default function PhotosPrivacyScreen() {
  const { user } = useAuth();
  const { canWrite, deleteSavedPhoto, error, history, loading, retry } = useCheckIn();
  const { activeProfile } = useProfiles();
  const [deletingDay, setDeletingDay] = useState<string>();

  if (!user) {
    return (
      <ProfileDetailScreen title="Photos & uploads">
        <PrivacySignInGate
          body="Guest activity does not create a retained photo library. Sign in before reviewing a profile’s photo settings and upload rules."
          icon="image-lock-outline"
          title="Sign in to review photo privacy"
        />
      </ProfileDetailScreen>
    );
  }

  const entries = history.filter((entry) => entry.photo);
  const availableIds = new Set(photoRecords(history, (photo) => checkInPhotoExists(photo.localUri)).map((record) => record.photo.id));

  function confirmDelete(dayKey: string) {
    Alert.alert('Delete this local photo?', 'The managed app-private file will be deleted from this device. The check-in’s non-photo details will remain.', [
      { text: 'Keep photo', style: 'cancel' },
      {
        text: 'Delete photo',
        style: 'destructive',
        onPress: () => {
          setDeletingDay(dayKey);
          void deleteSavedPhoto(dayKey)
            .catch(() => Alert.alert('Photo was not deleted', 'Reload Photos & uploads and try again.'))
            .finally(() => setDeletingDay(undefined));
        },
      },
    ]);
  }

  return (
    <ProfileDetailScreen title="Photos & uploads">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <View accessibilityLiveRegion="polite" style={styles.hero}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.body}>Opening this profile’s local photos…</Text></View> : error ? <View style={styles.section}><PrivacyNotice danger>{error}</PrivacyNotice><SecondaryButton label="Reload photos" onPress={retry} /></View> : <View style={styles.hero}>
          <View style={styles.heroIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="image-lock-outline" size={30} /></View>
          <Text accessibilityRole="header" style={styles.title}>{entries.length ? `${entries.length} skin-photo ${entries.length === 1 ? 'record' : 'records'} for ${activeProfile.name}` : `No skin-photo records for ${activeProfile.name}`}</Text>
          <Text style={styles.body}>{entries.length ? 'Photo references stay recorded if a cached local file disappears. Missing or ambiguous files cannot be opened; explicit deletion removes the reference. Photos enter a PDF only when you select Photos, with unavailable-image disclosure.' : 'Add an optional photo from a daily check-in after confirming the body area and private-area rule.'}</Text>
        </View>}

        <View style={styles.section}><Text style={styles.body}>This inventory contains skin photos from check-ins. Product-packaging photos are separate, belong to this profile’s products, and are not counted here or included in skin history or patient PDFs. Preview, replace or remove them in Care.</Text><SecondaryButton label="Manage packaging photos in Care" onPress={() => router.push('/(tabs)/care')} /></View>

        {!loading && !error && entries.length ? <View style={styles.section}><Text style={styles.sectionTitle}>Private skin-photo records</Text><View style={styles.photos}>{entries.map((entry) => {
          const photo = entry.photo;
          if (!photo) return null;
          const available = availableIds.has(photo.id);
          return <View key={entry.dayKey} style={styles.photoRow}>
            <Pressable accessibilityLabel={`Open photo record from ${entry.dayKey}`} accessibilityRole="button" onPress={() => router.push({ pathname: '/insights/photo/[id]', params: { id: photo.id } })} style={({ pressed }) => pressed && styles.pressed}>
              {available ? <Image cachePolicy="none" contentFit="cover" source={{ uri: photo.localUri }} style={styles.thumbnail} /> : <View style={[styles.thumbnail, styles.unavailablePhoto]}><MaterialCommunityIcons color={colors.textSecondary} name="image-off-outline" size={24} /></View>}
            </Pressable>
            <View style={styles.photoCopy}><Text style={styles.photoDate}>{entry.dayKey}</Text><Text style={styles.photoDetail}>{areaLabels[photo.area]} · {available ? 'local copy' : 'file unavailable or ambiguous'}</Text>{photo.note ? <Text numberOfLines={2} style={styles.photoNote}>{photo.note}</Text> : null}</View>
            <Pressable accessibilityLabel={`Delete photo record from ${entry.dayKey}`} accessibilityRole="button" accessibilityState={{ disabled: !canWrite || Boolean(deletingDay) }} disabled={!canWrite || Boolean(deletingDay)} onPress={() => confirmDelete(entry.dayKey)} style={({ pressed }) => [styles.delete, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.error} name="delete-outline" size={22} /></Pressable>
          </View>;
        })}</View><SecondaryButton label="Compare recorded photos" onPress={() => router.push('/insights/photos')} /></View> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo privacy rules</Text>
          <View style={styles.rules}>
            {rules.map(([title, detail], index) => (
              <View key={title} style={[styles.rule, index > 0 && styles.ruleBorder]}>
                <MaterialCommunityIcons color={index === 0 ? colors.error : colors.actionPrimary} name={index === 0 ? 'alert-octagon-outline' : 'shield-check-outline'} size={22} />
                <View style={styles.ruleCopy}><Text style={[styles.ruleTitle, index === 0 && styles.danger]}>{title}</Text><Text style={styles.ruleDetail}>{detail}</Text></View>
              </View>
            ))}
          </View>
        </View>

        <PrivacyNotice icon="information-outline">App-private cache is a bounded demo stage, not the production media vault. The OS may clear cached files, and signing out removes all managed local copies. Local comparison does not analyze images. AWS upload, signed reads, validation and cloud deletion remain disabled.</PrivacyNotice>
      </ScrollView>
    </ProfileDetailScreen>
  );
}

const styles = StyleSheet.create({
  unavailablePhoto: { alignItems: 'center', justifyContent: 'center' },
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, paddingBottom: 40, gap: 22 },
  hero: { minHeight: 220, borderRadius: 18, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.surface },
  heroIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  title: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 20, lineHeight: 28, textAlign: 'center' },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  section: { gap: 10 },
  sectionTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  photos: { overflow: 'hidden', borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  photoRow: { minHeight: 112, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderDefault },
  thumbnail: { width: 82, height: 82, borderRadius: 14, backgroundColor: colors.surfaceBrandSoft },
  photoCopy: { flex: 1, gap: 3 },
  photoDate: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13, lineHeight: 19 },
  photoDetail: { color: colors.actionPrimary, fontFamily: font.medium, fontSize: 11, lineHeight: 17 },
  photoNote: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16 },
  delete: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.errorSurface },
  rules: { overflow: 'hidden', borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderDefault },
  rule: { minHeight: 90, padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  ruleBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderDefault },
  ruleCopy: { flex: 1, gap: 3 },
  ruleTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 20 },
  ruleDetail: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  danger: { color: colors.error },
  pressed: { opacity: 0.68 },
});
