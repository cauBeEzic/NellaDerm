import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { SubmitButton } from '@/components/care-form';
import { useProductPackagingDraft, type PackagingDraft } from '@/components/use-product-packaging-draft';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import type { CareProduct } from '@/lib/care';
import { packagingPhotoAvailable } from '@/lib/product-packaging-media';
import type { PackagingPhotoOwner, ProductPackagingPhoto } from '@/lib/product-packaging';
import { colors, font, radius } from '@/theme';

function PhotoAction({ disabled = false, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, disabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.actionLabel}>{label}</Text></Pressable>;
}

function PackagingPreview({ owner, photo, readScope }: { owner: PackagingPhotoOwner; photo: ProductPackagingPhoto; readScope: string }) {
  const [status, setStatus] = useState<{ photo: ProductPackagingPhoto; readScope: string; available: boolean }>();
  const [failedPhoto, setFailedPhoto] = useState<ProductPackagingPhoto>();
  useFocusEffect(useCallback(() => {
    let active = true;
    let request = 0;
    function refresh() {
      const ticket = ++request;
      const isCurrent = () => active && request === ticket;
      void packagingPhotoAvailable(owner, photo, isCurrent)
        .then((available) => { if (isCurrent()) setStatus({ photo, readScope, available }); })
        .catch(() => { if (isCurrent()) setStatus({ photo, readScope, available: false }); });
    }
    if (readScope) refresh();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active' && readScope) refresh(); });
    return () => { active = false; subscription.remove(); };
  }, [owner, photo, readScope]));
  const available = status?.photo === photo && status.readScope === readScope ? status.available : undefined;
  return <View style={styles.preview}>
    {available && failedPhoto !== photo
      ? <Image accessibilityLabel="Product packaging photo preview" accessible cachePolicy="none" contentFit="contain" onError={() => setFailedPhoto(photo)} source={{ uri: photo.localUri }} style={StyleSheet.absoluteFill} />
      : <View style={styles.placeholder}><MaterialCommunityIcons accessible={false} color={colors.textSecondary} name="image-off-outline" size={30} /><Text style={styles.body}>{available === undefined ? 'Checking packaging photo…' : 'Packaging photo unavailable'}</Text><Text style={styles.note}>The reference is retained. Choose a replacement or remove the attachment; no image is substituted.</Text></View>}
  </View>;
}

export function PackagingPhotoField({ disabled = false, draft }: { disabled?: boolean; draft: PackagingDraft }) {
  const [choosing, setChoosing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [settingsError, setSettingsError] = useState<string>();
  const unavailable = disabled || draft.busy || draft.cleanupPending;
  async function choose(source: 'camera' | 'library') {
    if (!confirmed || unavailable) return;
    if (await draft.choose(source)) { setChoosing(false); setConfirmed(false); }
  }
  return <View style={styles.group}>
    <Text style={styles.label}>Product packaging photo · optional</Text>
    <Text style={styles.body}>Packaging only—not skin, faces, people or private areas. Kept in this profile’s app-private device cache; not uploaded or included in skin history or patient PDFs.</Text>
    {draft.photo ? <PackagingPreview owner={draft.owner} photo={draft.photo} readScope={draft.readScope} /> : null}
    {draft.canCapture ? <>
      <PhotoAction disabled={unavailable} label={draft.photo ? 'Replace packaging photo' : 'Add product photo'} onPress={() => setChoosing(true)} />
      {draft.photo ? <PhotoAction disabled={disabled || draft.busy} label="Remove packaging photo" onPress={() => void draft.remove()} /> : null}
      {choosing ? <View style={styles.chooser}>
        <Pressable accessibilityLabel="I confirm this image shows product packaging only. MyEczema cannot verify the image content automatically." accessibilityRole="checkbox" accessibilityState={{ checked: confirmed, disabled: unavailable }} disabled={unavailable} onPress={() => setConfirmed((value) => !value)} style={({ pressed }) => [styles.policy, pressed && styles.pressed]}>
          <MaterialCommunityIcons accessible={false} color={colors.actionPrimary} name={confirmed ? 'checkbox-marked-outline' : 'checkbox-blank-outline'} size={24} />
          <Text style={styles.policyLabel}>I confirm this image shows product packaging only. MyEczema cannot verify the image content automatically.</Text>
        </Pressable>
        <PhotoAction disabled={!confirmed || unavailable} label="Take packaging photo" onPress={() => void choose('camera')} />
        <PhotoAction disabled={!confirmed || unavailable} label="Choose packaging image from library" onPress={() => void choose('library')} />
        <PhotoAction disabled={disabled || draft.busy} label="Cancel photo selection" onPress={() => { setChoosing(false); setConfirmed(false); }} />
      </View> : null}
    </> : <><Text style={styles.note}>Sign in to attach packaging photos. Guest mode does not capture or keep an image.</Text><PhotoAction label="Sign in for packaging photos" onPress={() => router.push('/sign-in')} /></>}
    <Text style={styles.note}>{draft.busy ? 'Preparing or saving the packaging photo…' : 'JPEG copy · up to 2048 pixels on the long edge and 8 MB. Cached files may become unavailable.'}</Text>
    {draft.cameraDenied ? <View style={styles.group}><Text accessibilityRole="alert" style={styles.body}>Camera access is off. Choose an image from the library, continue without a photo, or enable Camera in Settings and try again.</Text><PhotoAction disabled={unavailable} label="Open camera settings" onPress={() => { void Linking.openSettings().catch(() => setSettingsError('Settings could not be opened. Use device Settings or continue without a photo.')); }} /></View> : null}
    {draft.error || settingsError ? <Text accessibilityRole="alert" style={styles.error}>{draft.error ?? settingsError}</Text> : null}
    {draft.cleanupPending ? <PhotoAction disabled={disabled || draft.busy} label="Retry packaging-photo cleanup" onPress={() => void draft.retryCleanup()} /> : null}
  </View>;
}

function PackagingEditor({ initialPhoto, onClose, productId }: { initialPhoto?: ProductPackagingPhoto; onClose: () => void; productId: string }) {
  const { setProductPackagingPhoto } = useCare();
  const draft = useProductPackagingDraft(productId, initialPhoto);
  async function save() {
    if (AppState.currentState !== 'active') return;
    const commit = draft.beginCommit();
    if (!commit) return;
    try {
      const saved = await setProductPackagingPhoto(productId, initialPhoto?.id, commit.photo);
      if (await draft.commitSucceeded(saved.packagingPhoto)) onClose();
    } catch {
      draft.commitUncertain('The photo change could not be confirmed. Reload Care before trying again; possibly committed files are preserved.');
    }
  }
  return <View style={styles.group}>
    <PackagingPhotoField draft={draft} />
    <SubmitButton disabled={draft.busy || draft.cleanupPending || draft.photo === initialPhoto} label="Save packaging photo" onPress={() => void save()} />
    <PhotoAction disabled={draft.busy} label="Cancel photo changes" onPress={() => { void draft.cancel().then((complete) => { if (complete) onClose(); }); }} />
  </View>;
}

export function ProductPackagingPhotoSection({ product }: { product: CareProduct }) {
  const { user } = useAuth();
  const { canWrite, profile, readScope } = useCare();
  const owner = useMemo(() => ({ userId: user?.userId ?? '', profileId: profile.id, productId: product.id }), [profile.id, product.id, user?.userId]);
  const [editing, setEditing] = useState(false);
  const [original, setOriginal] = useState<ProductPackagingPhoto>();
  if (!user || profile.isDemo || !readScope) return null;
  return <View style={styles.section}>
    <Text accessibilityRole="header" style={styles.heading}>Packaging photo</Text>
    {editing ? <PackagingEditor initialPhoto={original} onClose={() => setEditing(false)} productId={product.id} /> : <View style={styles.group}>
      {product.packagingPhoto ? <PackagingPreview owner={owner} photo={product.packagingPhoto} readScope={readScope} /> : <Text style={styles.body}>No packaging photo is attached to this product.</Text>}
      <Text style={styles.note}>Product packaging only · local device cache. Not a skin observation, verified product information or cloud upload.</Text>
      <PhotoAction disabled={!canWrite} label={product.packagingPhoto ? 'Edit packaging photo' : 'Add packaging photo'} onPress={() => { setOriginal(product.packagingPhoto); setEditing(true); }} />
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: 10 },
  section: { gap: 14 },
  heading: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 20, lineHeight: 28 },
  label: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 21 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  note: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  error: { color: colors.error, fontFamily: font.medium, fontSize: 14, lineHeight: 21 },
  action: { minHeight: 48, borderRadius: radius.control, borderWidth: 1, borderColor: colors.borderDefault, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  chooser: { gap: 10, paddingVertical: 8 },
  policy: { minHeight: 48, flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8 },
  policyLabel: { flex: 1, color: colors.textPrimary, fontFamily: font.medium, fontSize: 14, lineHeight: 21 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.control, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.surface, overflow: 'hidden' },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.68 },
});
