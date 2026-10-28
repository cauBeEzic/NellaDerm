import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/button';
import { CheckInAccessGate } from '@/components/check-in-access-gate';
import { CheckInFlowLayout } from '@/components/check-in-flow-layout';
import { useCheckIn } from '@/contexts/check-in-context';
import { useProfiles } from '@/contexts/profile-context';
import { areaLabels, type CheckInArea } from '@/lib/check-in';
import { checkInPhotoExists, deleteCheckInPhoto, stageCheckInPhoto } from '@/lib/check-in-media';
import { colors, font, radius, spacing } from '@/theme';

const photoAreas: CheckInArea[] = ['hands', 'inner-elbows', 'face', 'neck', 'other'];

export default function CheckInPhotoScreen() {
  const { canWrite, removePhoto, setPhoto, state } = useCheckIn();
  const { activeProfile } = useProfiles();
  const existing = state.draft?.photo;
  const [pending, setPending] = useState<ImagePicker.ImagePickerAsset>();
  const [area, setArea] = useState<CheckInArea | undefined>(existing?.area);
  const [note, setNote] = useState(existing?.note ?? '');
  const [policyConfirmed, setPolicyConfirmed] = useState(Boolean(existing));
  const [busy, setBusy] = useState(false);
  const [failedPreviewUri, setFailedPreviewUri] = useState<string>();

  if (!canWrite || !state.draft) {
    return <CheckInAccessGate missingBody="Choose how your skin compares with usual before adding a private photo." missingHeading="Start today’s check-in first" title="Check-in photo" />;
  }

  function requirePhotoContext() {
    if (!area) {
      Alert.alert('Choose a body area first', 'A body area is required before MyEczema asks for camera or library access.');
      return false;
    }
    if (!policyConfirmed) {
      Alert.alert('Confirm the photo rule first', 'Private-area photographs are prohibited. Confirm the rule before choosing a photo.');
      return false;
    }
    return true;
  }

  function permissionAlert(kind: 'camera' | 'library') {
    Alert.alert(
      `${kind === 'camera' ? 'Camera' : 'Photo library'} access is off`,
      'MyEczema only requests access when you choose to add a photo. You can continue without one or enable access in system settings.',
      [
        { text: 'Continue without', style: 'cancel' },
        { text: 'Open settings', onPress: () => void Linking.openSettings() },
      ],
    );
  }

  async function choosePhoto(source: 'camera' | 'library') {
    if (!requirePhotoContext()) return;
    setBusy(true);
    try {
      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        permissionAlert(source);
        return;
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, exif: false, quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, allowsMultipleSelection: false, exif: false, quality: 1 });
      if (!result.canceled) setPending(result.assets[0]);
    } catch {
      Alert.alert('Photo could not be opened', 'No photo was added. Try again or continue without one.');
    } finally {
      setBusy(false);
    }
  }

  async function attachPhoto() {
    if (!pending || !area || !policyConfirmed || busy) return;
    setBusy(true);
    let stagedUri: string | undefined;
    try {
      const photo = await stageCheckInPhoto({ sourceUri: pending.uri, sourceWidth: pending.width, sourceHeight: pending.height, area, note });
      stagedUri = photo.localUri;
      await setPhoto(photo);
      setPending(undefined);
      router.replace('/check-in/quick');
    } catch (error) {
      if (stagedUri) deleteCheckInPhoto(stagedUri);
      Alert.alert(
        error instanceof Error && error.message === 'CheckInPhotoTooLarge' ? 'Photo is too large' : 'Photo was not attached',
        'The check-in draft is unchanged. Choose another image or continue without a photo.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveExistingDetails() {
    if (!existing || !area || !policyConfirmed || busy) return;
    setBusy(true);
    try {
      await setPhoto({ ...existing, area, note: note.trim().slice(0, 500) });
      router.replace('/check-in/quick');
    } catch {
      Alert.alert('Photo details were not saved', 'The existing photo is unchanged. Reload the check-in and try again.');
    } finally {
      setBusy(false);
    }
  }

  function confirmRemove() {
    const isSavedPhoto = existing && state.entry?.photo?.localUri === existing.localUri;
    Alert.alert('Remove this photo from the draft?', isSavedPhoto
      ? 'This removes it from the edit draft. The saved photo stays in your record until you save the edited check-in. To delete it immediately, use Photos & uploads in Privacy & data.'
      : 'The app-private local copy will be deleted from this device. The rest of the check-in draft will remain.', [
      { text: 'Keep photo', style: 'cancel' },
      {
        text: 'Remove photo',
        style: 'destructive',
        onPress: () => void removePhoto()
          .then(() => router.replace('/check-in/quick'))
          .catch(() => Alert.alert('Photo was not removed', 'Reload the check-in and try again.')),
      },
    ]);
  }

  const previewUri = pending?.uri ?? existing?.localUri;
  let missingExisting = false;
  try { missingExisting = Boolean(!pending && existing && !checkInPhotoExists(existing.localUri)); } catch { missingExisting = true; }
  const previewUnavailable = missingExisting || Boolean(previewUri && previewUri === failedPreviewUri);
  const actionLabel = pending ? (busy ? 'Preparing private copy…' : 'Attach photo') : existing ? (busy ? 'Saving…' : 'Save photo details') : 'Choose a photo first';

  return (
    <CheckInFlowLayout onClose={() => router.replace('/(tabs)')} status={`${activeProfile.name} · private local photo`} title="Check-in photo">
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.heading}>Add one private skin photo</Text>
        <Text style={styles.body}>It stays in this app’s private device cache for the active profile. Cloud upload and cross-device sync are not connected.</Text>
      </View>

      <View style={styles.preview}>
        {previewUnavailable ? <><MaterialCommunityIcons color={colors.textSecondary} name="image-off-outline" size={42} /><Text accessibilityRole="alert" style={styles.previewTitle}>{pending ? 'Selected image unavailable' : 'Photo record unavailable'}</Text><Text style={styles.previewBody}>{pending ? 'The selected image could not be opened. Choose another image; saved records are unchanged.' : 'The local file could not be opened. The saved reference is unchanged; choose a replacement or explicitly remove it.'}</Text></> : previewUri ? <Image accessibilityLabel="Selected private check-in photo preview" contentFit="cover" onError={() => setFailedPreviewUri(previewUri)} source={{ uri: previewUri }} style={StyleSheet.absoluteFill} /> : <><View style={styles.cameraIcon}><MaterialCommunityIcons color={colors.actionPrimary} name="camera-outline" size={42} /></View><Text style={styles.previewTitle}>Use natural, even light</Text><Text style={styles.previewBody}>Keep distance and angle consistent. Photos are personal records, not diagnostic results.</Text></>}
        {previewUri && !previewUnavailable ? <View style={styles.previewBadge}><MaterialCommunityIcons color={colors.actionPrimary} name="shield-lock-outline" size={17} /><Text style={styles.previewBadgeText}>{pending ? 'Not attached yet' : 'Private local copy'}</Text></View> : null}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}><Text style={styles.cardTitle}>Body area</Text><Text style={styles.required}>Required</Text></View>
        <View accessibilityRole="radiogroup" style={styles.chips}>{photoAreas.map((value) => {
          const selected = area === value;
          return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} key={value} onPress={() => setArea(value)} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}><MaterialCommunityIcons color={selected ? colors.onActionPrimary : colors.textSecondary} name={selected ? 'check' : 'plus'} size={17} /><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{areaLabels[value]}</Text></Pressable>;
        })}</View>
      </View>

      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: policyConfirmed }} onPress={() => setPolicyConfirmed((value) => !value)} style={({ pressed }) => [styles.policy, pressed && styles.pressed]}>
        <View style={[styles.checkbox, policyConfirmed && styles.checkboxSelected]}>{policyConfirmed ? <MaterialCommunityIcons color={colors.onActionPrimary} name="check" size={18} /> : null}</View>
        <View style={styles.policyCopy}><Text style={styles.cardTitle}>This photo does not show a private area</Text><Text style={styles.body}>Genitals, breasts, buttocks, and other intimate areas must not be photographed. MyEczema cannot verify this automatically.</Text></View>
      </Pressable>

      <View style={styles.captureActions}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void choosePhoto('camera')} style={({ pressed }) => [styles.capturePrimary, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.onActionPrimary} name="camera-outline" size={21} /><Text style={styles.capturePrimaryText}>Take photo</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void choosePhoto('library')} style={({ pressed }) => [styles.captureSecondary, pressed && styles.pressed]}><MaterialCommunityIcons color={colors.actionPrimary} name="image-multiple-outline" size={21} /><Text style={styles.captureSecondaryText}>From library</Text></Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.cardTitle}>Photo note <Text style={styles.optional}>(optional)</Text></Text>
        <TextInput accessibilityLabel="Photo note" maxLength={500} multiline onChangeText={setNote} placeholder="Anything you want to remember about this photo?" placeholderTextColor={colors.textSecondary} style={styles.note} value={note} />
      </View>

      <View style={styles.actions}>
        <PrimaryButton disabled={busy || !area || !policyConfirmed || (!pending && !existing)} label={actionLabel} onPress={() => void (pending ? attachPhoto() : saveExistingDetails())} />
        {existing && !pending ? <SecondaryButton label="Remove photo" onPress={confirmRemove} /> : null}
        <SecondaryButton label={existing ? 'Keep current photo' : 'Continue without a photo'} onPress={() => router.replace('/check-in/quick')} quiet />
      </View>

      <View style={styles.boundary}><MaterialCommunityIcons color={colors.textSecondary} name="cloud-off-outline" size={18} /><Text style={styles.boundaryText}>The selected image is re-encoded as a bounded JPEG before attachment. Source metadata is not copied. It is not uploaded or analyzed, and enters a generated PDF only when you explicitly select Photos.</Text></View>
    </CheckInFlowLayout>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 6 },
  heading: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 22, lineHeight: 30 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  preview: { minHeight: 330, padding: 36, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', gap: 12, overflow: 'hidden', backgroundColor: colors.surfaceBrandSoft },
  cameraIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  previewTitle: { textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 25 },
  previewBody: { textAlign: 'center', color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  previewBadge: { position: 'absolute', left: spacing.md, bottom: spacing.md, minHeight: 38, paddingHorizontal: 12, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surface },
  previewBadgeText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 11 },
  section: { padding: 20, borderRadius: radius.card, gap: 14, backgroundColor: colors.surface },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardTitle: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 23 },
  required: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 12 },
  optional: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 48, paddingHorizontal: 14, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surfaceBrandSoft },
  chipSelected: { backgroundColor: colors.actionPrimary },
  chipText: { color: colors.textSecondary, fontFamily: font.medium, fontSize: 13 },
  chipTextSelected: { color: colors.onActionPrimary },
  policy: { minHeight: 132, padding: 18, borderRadius: radius.card, flexDirection: 'row', alignItems: 'flex-start', gap: 13, backgroundColor: colors.errorSurface, borderWidth: 1, borderColor: colors.error },
  checkbox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error },
  checkboxSelected: { backgroundColor: colors.error, borderColor: colors.error },
  policyCopy: { flex: 1, gap: 5 },
  captureActions: { flexDirection: 'row', gap: 10 },
  capturePrimary: { flex: 1, minHeight: 54, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.actionPrimary },
  capturePrimaryText: { color: colors.onActionPrimary, fontFamily: font.semibold, fontSize: 14 },
  captureSecondary: { flex: 1, minHeight: 54, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surfaceBrandSoft },
  captureSecondaryText: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 14 },
  note: { minHeight: 118, borderRadius: 14, padding: 14, color: colors.textPrimary, backgroundColor: colors.canvas, fontFamily: font.regular, fontSize: 14, lineHeight: 21, textAlignVertical: 'top' },
  actions: { gap: 10 },
  boundary: { minHeight: 62, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  boundaryText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },
  pressed: { opacity: 0.68 },
});
