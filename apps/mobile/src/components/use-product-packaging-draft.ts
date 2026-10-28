import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { deletePackagingPhoto, PackagingCleanupError, stagePackagingPhoto } from '@/lib/product-packaging-media';
import type { PackagingPhotoOwner, ProductPackagingPhoto } from '@/lib/product-packaging';

export type PackagingCommit = { photo: ProductPackagingPhoto | undefined };
export type PackagingDraft = {
  owner: PackagingPhotoOwner;
  photo?: ProductPackagingPhoto;
  readScope: string;
  canCapture: boolean;
  busy: boolean;
  cleanupPending: boolean;
  cameraDenied: boolean;
  error?: string;
  choose: (source: 'camera' | 'library') => Promise<boolean>;
  remove: () => Promise<void>;
  cancel: () => Promise<boolean>;
  retryCleanup: () => Promise<boolean>;
  beginCommit: () => PackagingCommit | undefined;
  commitSucceeded: (photo: ProductPackagingPhoto | undefined) => Promise<boolean>;
  commitUncertain: (message?: string) => void;
};

type Lease = {
  mounted: boolean;
  focused: boolean;
  generation: number;
  busy: boolean;
  committing: boolean;
  cleanupCount: number;
  cleanupFailed: boolean;
  photo?: ProductPackagingPhoto;
  files: Map<string, ProductPackagingPhoto>;
  cleanupTail?: Promise<void>;
  preparationCleanup?: () => void;
};

export function useProductPackagingDraft(productId: string, initialPhoto?: ProductPackagingPhoto): PackagingDraft {
  const { reportPackagingCleanupFailure, user } = useAuth();
  const { canWrite, profile, readScope } = useCare();
  const owner = useMemo(() => ({ userId: user?.userId ?? '', profileId: profile.id, productId }), [profile.id, productId, user?.userId]);
  const [photo, setPhoto] = useState(initialPhoto);
  const [busy, setBusy] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [error, setError] = useState<string>();
  const [cleanupError, setCleanupError] = useState<string>();
  const [cameraDenied, setCameraDenied] = useState(false);
  const leaseRef = useRef<Lease | null>(null);
  if (leaseRef.current === null) leaseRef.current = { mounted: false, focused: false, generation: 0, busy: false, committing: false, cleanupCount: 0, cleanupFailed: false, photo: initialPhoto, files: new Map() };

  const cleanupCreated = useCallback(function cleanupCreated(keepUri?: string): Promise<boolean> {
    const lease = leaseRef.current!;
    const candidates = [...lease.files.values()].filter((item) => item.localUri !== keepUri);
    const preparationCleanup = lease.preparationCleanup;
    if (!candidates.length && !preparationCleanup) return Promise.resolve(!lease.cleanupFailed);
    lease.cleanupCount += 1;
    if (lease.mounted) setCleanupPending(true);
    const work = (lease.cleanupTail ?? Promise.resolve()).then(async () => {
      let complete = true;
      for (const item of candidates) {
        try { await deletePackagingPhoto(owner, item); lease.files.delete(item.localUri); }
        catch { complete = false; }
      }
      if (preparationCleanup) {
        try { preparationCleanup(); if (lease.preparationCleanup === preparationCleanup) lease.preparationCleanup = undefined; }
        catch { complete = false; }
      }
      lease.cleanupCount -= 1;
      lease.cleanupFailed = !complete;
      if (lease.mounted) {
        setCleanupPending(lease.cleanupCount > 0 || lease.cleanupFailed);
        setCleanupError(complete ? undefined : 'Some unsaved packaging-photo files could not be removed. Retry cleanup before choosing or saving a photo.');
      }
      if (!complete && (!lease.mounted || !lease.focused)) reportPackagingCleanupFailure(cleanupCreated);
      return complete;
    });
    lease.cleanupTail = work.then(() => undefined);
    return work;
  }, [owner, reportPackagingCleanupFailure]);

  useLayoutEffect(() => {
    const lease = leaseRef.current!;
    lease.mounted = true;
    return () => {
      lease.mounted = false;
      lease.focused = false;
      lease.generation += 1;
      if (!lease.committing) void cleanupCreated();
    };
  }, [cleanupCreated]);
  useFocusEffect(useCallback(() => {
    const lease = leaseRef.current!;
    lease.focused = true;
    lease.generation += 1;
    return () => {
      lease.focused = false;
      lease.generation += 1;
      if (!lease.committing) {
        lease.photo = initialPhoto;
        if (lease.mounted) setPhoto(initialPhoto);
        void cleanupCreated();
      }
    };
  }, [cleanupCreated, initialPhoto]));

  async function choose(source: 'camera' | 'library') {
    const lease = leaseRef.current!;
    if (!canWrite || !readScope || !lease.mounted || !lease.focused || lease.busy || lease.committing || lease.cleanupCount || lease.cleanupFailed) return false;
    const generation = lease.generation;
    const isCurrent = () => lease.mounted && lease.focused && lease.generation === generation;
    lease.busy = true;
    setBusy(true);
    setError(undefined);
    setCameraDenied(false);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!isCurrent()) return false;
        if (!permission.granted) { setCameraDenied(true); return false; }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], allowsEditing: false, exif: false, quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, allowsMultipleSelection: false, exif: false, quality: 1 });
      if (!isCurrent() || result.canceled || !result.assets[0]) return false;
      const asset = result.assets[0];
      const next = await stagePackagingPhoto(owner, { sourceUri: asset.uri, width: asset.width, height: asset.height }, isCurrent);
      lease.files.set(next.localUri, next);
      if (!isCurrent()) { await cleanupCreated(); return false; }
      lease.photo = next;
      setPhoto(next);
      await cleanupCreated(next.localUri);
      return isCurrent();
    } catch (failure) {
      if (failure instanceof PackagingCleanupError) {
        lease.preparationCleanup = failure.retry;
        lease.cleanupFailed = true;
        if (lease.mounted) { setCleanupPending(true); setCleanupError(failure.message); }
        if (!isCurrent()) await cleanupCreated();
      } else if (isCurrent()) setError('The packaging photo could not be prepared. Your previous selection is unchanged. Try another image or continue without one.');
      return false;
    } finally {
      lease.busy = false;
      if (lease.mounted) setBusy(false);
    }
  }

  async function remove() {
    const lease = leaseRef.current!;
    if (!lease.mounted || !lease.focused || lease.busy || lease.committing) return;
    lease.photo = undefined;
    setPhoto(undefined);
    setError(undefined);
    await cleanupCreated();
  }

  async function cancel() {
    const lease = leaseRef.current!;
    if (lease.busy || lease.committing) return false;
    lease.photo = initialPhoto;
    if (lease.mounted) { setPhoto(initialPhoto); setError(undefined); }
    return cleanupCreated();
  }

  function beginCommit() {
    const lease = leaseRef.current!;
    if (!canWrite || !readScope || !lease.mounted || !lease.focused || lease.busy || lease.committing || lease.cleanupCount || lease.cleanupFailed) return undefined;
    lease.committing = true;
    setBusy(true);
    return { photo: lease.photo };
  }

  async function commitSucceeded(savedPhoto: ProductPackagingPhoto | undefined) {
    const lease = leaseRef.current!;
    // The actual stored record may be a preserved barcode duplicate, not this draft product.
    if (savedPhoto) lease.files.delete(savedPhoto.localUri);
    lease.committing = false;
    lease.photo = savedPhoto;
    if (lease.mounted) { setPhoto(savedPhoto); setBusy(false); }
    return cleanupCreated();
  }

  function commitUncertain(message?: string) {
    const lease = leaseRef.current!;
    // A native write can commit and then lose its UI owner. Only durable-owner reload can sweep it.
    lease.files.clear();
    lease.committing = false;
    if (lease.mounted) { setBusy(false); setError(message); }
  }

  return { owner, photo, readScope: readScope ?? '', canCapture: Boolean(canWrite && readScope), busy, cleanupPending, cameraDenied, error: cleanupError ?? error, choose, remove, cancel, retryCleanup: () => cleanupCreated(leaseRef.current?.photo?.localUri), beginCommit, commitSucceeded, commitUncertain };
}
