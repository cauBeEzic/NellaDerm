import { CryptoDigestAlgorithm, digest, randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

import type { CheckInArea, CheckInPhoto } from './check-in';

export { checkInPhotoUris } from './check-in-photo-references';

export const MAX_CHECK_IN_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_CHECK_IN_PHOTO_EDGE = 2048;
const mediaDirectory = () => new Directory(Paths.cache, 'myeczema-private-media');
const mediaDirectoryPrefix = () => `${mediaDirectory().uri.replace(/\/+$/, '')}/`;
const opaqueJpegName = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/i;
let cleanupGeneration = 0;

function digestHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isManagedCheckInPhotoUri(uri: string) {
  const prefix = mediaDirectoryPrefix();
  return uri.startsWith(prefix) && opaqueJpegName.test(uri.slice(prefix.length));
}

export async function stageCheckInPhoto(input: {
  sourceUri: string;
  sourceWidth: number;
  sourceHeight: number;
  area: CheckInArea;
  note: string;
  now?: Date;
}): Promise<CheckInPhoto> {
  const generation = cleanupGeneration;
  const ensureCaptureCurrent = () => {
    if (generation !== cleanupGeneration) throw new Error('CheckInPhotoCaptureCancelled');
  };
  const actions = Math.max(input.sourceWidth, input.sourceHeight) > MAX_CHECK_IN_PHOTO_EDGE
    ? [{ resize: input.sourceWidth >= input.sourceHeight ? { width: MAX_CHECK_IN_PHOTO_EDGE } : { height: MAX_CHECK_IN_PHOTO_EDGE } }]
    : [];
  const normalized = await manipulateAsync(input.sourceUri, actions, { compress: 0.82, format: SaveFormat.JPEG });
  if (generation !== cleanupGeneration) {
    try { const temporary = new File(normalized.uri); if (temporary.exists) temporary.delete(); } catch { /* OS-owned transient output. */ }
    throw new Error('CheckInPhotoCaptureCancelled');
  }
  const directory = mediaDirectory();
  directory.create({ idempotent: true, intermediates: true });
  const id = randomUUID();
  const destination = new File(directory, `${id}.jpg`);
  const temporary = new File(normalized.uri);
  try {
    await temporary.move(destination);
    ensureCaptureCurrent();
    const info = destination.info();
    const size = info.size ?? 0;
    if (!size || size > MAX_CHECK_IN_PHOTO_BYTES) throw new Error('CheckInPhotoTooLarge');
    const sha256 = digestHex(await digest(CryptoDigestAlgorithm.SHA256, await destination.bytes()));
    ensureCaptureCurrent();
    return {
      id,
      localUri: destination.uri,
      area: input.area,
      note: input.note.trim().slice(0, 500),
      mimeType: 'image/jpeg',
      size,
      width: normalized.width,
      height: normalized.height,
      sha256,
      createdAt: (input.now ?? new Date()).toISOString(),
      storage: 'app-private-cache',
      syncStatus: 'local-only',
    };
  } catch (error) {
    deleteCheckInPhoto(destination.uri);
    try {
      if (temporary.exists) temporary.delete();
    } catch {
      // The OS owns the transient manipulator output and may already have removed it.
    }
    throw error;
  }
}

export function deleteCheckInPhoto(uri: string) {
  if (!isManagedCheckInPhotoUri(uri)) return false;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
    return true;
  } catch {
    return false;
  }
}

export function deleteAllCheckInPhotos() {
  // Invalidate normalizations awaiting native work before deleting the directory.
  cleanupGeneration += 1;
  try {
    const directory = mediaDirectory();
    if (directory.exists) directory.delete();
    return true;
  } catch {
    return false;
  }
}

export async function readCheckInPhotoDataUri(uri: string) {
  if (!isManagedCheckInPhotoUri(uri)) throw new Error('CheckInPhotoOutsideManagedStorage');
  const file = new File(uri);
  if (!file.exists) throw new Error('CheckInPhotoMissing');
  return `data:image/jpeg;base64,${await file.base64()}`;
}

export function checkInPhotoExists(uri: string) {
  return isManagedCheckInPhotoUri(uri) && new File(uri).exists;
}
