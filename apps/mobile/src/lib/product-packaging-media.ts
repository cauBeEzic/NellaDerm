import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat, type ImageResult } from 'expo-image-manipulator';

import type { CareProduct } from './care';
import { MAX_PACKAGING_PHOTO_BYTES, MAX_PACKAGING_PHOTO_EDGE, packagingPhotoId, parsePackagingPhoto, type PackagingPhotoOwner, type ProductPackagingPhoto } from './product-packaging';

export type PackagingCleanupRetry = () => Promise<boolean>;

const root = () => new Directory(Paths.cache, 'myeczema-product-packaging');
const bucketName = /^[a-f0-9]{64}$/;
const temporaryFiles = new Set<string>();
let cleanupGeneration = 0;
let pendingNormalizations = 0;

export class PackagingCleanupError extends Error {
  constructor(readonly retry: () => void) {
    super('Local packaging-photo cleanup could not finish. Retry cleanup before continuing.');
    this.name = 'PackagingCleanupError';
  }
}

function removeFile(uri: string) {
  const file = new File(uri);
  if (file.exists) file.delete();
}

async function profileDirectory(userId: string, profileId: string) {
  if (!userId || !profileId) throw new Error('A signed-in account and care profile are required.');
  const bucket = await digestStringAsync(CryptoDigestAlgorithm.SHA256, JSON.stringify(['product-packaging', userId, profileId]));
  return new Directory(root(), bucket);
}

async function productDirectory(owner: PackagingPhotoOwner) {
  if (!owner.productId) throw new Error('A product identifier is required.');
  const [profile, product] = await Promise.all([
    profileDirectory(owner.userId, owner.profileId),
    digestStringAsync(CryptoDigestAlgorithm.SHA256, owner.productId),
  ]);
  return new Directory(profile, product);
}

async function ownedPhotoFile(owner: PackagingPhotoOwner, value: unknown) {
  const photo = parsePackagingPhoto(value);
  if (!photo) return undefined;
  const expected = new File(await productDirectory(owner), `${photo.id}.jpg`);
  return photo.localUri === expected.uri ? expected : undefined;
}

export async function packagingPhotoAvailable(owner: PackagingPhotoOwner, value: unknown, isCurrent = () => true) {
  const photo = parsePackagingPhoto(value);
  if (!photo || !isCurrent()) return false;
  const file = await ownedPhotoFile(owner, photo);
  return Boolean(isCurrent() && file?.exists && file.size === photo.byteSize);
}

export async function requirePackagingPhoto(owner: PackagingPhotoOwner, value: unknown) {
  if (!await packagingPhotoAvailable(owner, value)) throw new Error('The packaging photo is unavailable for this product. Choose another image or remove it.');
}

export async function deletePackagingPhoto(owner: PackagingPhotoOwner, value: unknown) {
  const file = await ownedPhotoFile(owner, value);
  if (file?.exists) file.delete();
}

export async function stagePackagingPhoto(owner: PackagingPhotoOwner, input: { sourceUri: string; width: number; height: number }, isCurrent: () => boolean): Promise<ProductPackagingPhoto> {
  const generation = cleanupGeneration;
  const ensureCurrent = () => {
    if (generation !== cleanupGeneration || !isCurrent()) throw new Error('Packaging photo selection was cancelled.');
  };
  ensureCurrent();
  if (!input.sourceUri || !Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width <= 0 || input.height <= 0) throw new Error('The selected image could not be read.');
  const directory = await productDirectory(owner);
  ensureCurrent();
  const actions = Math.max(input.width, input.height) > MAX_PACKAGING_PHOTO_EDGE
    ? [{ resize: input.width >= input.height ? { width: MAX_PACKAGING_PHOTO_EDGE } : { height: MAX_PACKAGING_PHOTO_EDGE } }]
    : [];
  pendingNormalizations += 1;
  let normalized: ImageResult;
  try { normalized = await manipulateAsync(input.sourceUri, actions, { compress: 0.82, format: SaveFormat.JPEG }); }
  finally { pendingNormalizations -= 1; }
  const temporaryUri = normalized.uri === input.sourceUri ? undefined : normalized.uri;
  if (temporaryUri) temporaryFiles.add(temporaryUri);
  let destination: File | undefined;
  const cleanup = () => {
    let failed = false;
    for (const uri of [temporaryUri, destination?.uri]) {
      if (!uri) continue;
      try { removeFile(uri); temporaryFiles.delete(uri); } catch { failed = true; }
    }
    if (failed) throw new PackagingCleanupError(cleanup);
  };
  try {
    ensureCurrent();
    // A normalizer must produce a new file; never move or delete the user's source asset.
    if (!temporaryUri) throw new Error('The selected image could not be prepared safely.');
    const temporary = new File(temporaryUri);
    const byteSize = temporary.size;
    if (!temporary.exists || byteSize < 1 || byteSize > MAX_PACKAGING_PHOTO_BYTES
      || !Number.isInteger(normalized.width) || !Number.isInteger(normalized.height)
      || normalized.width < 1 || normalized.height < 1
      || Math.max(normalized.width, normalized.height) > MAX_PACKAGING_PHOTO_EDGE) throw new Error('Choose an image that can be prepared within 2048 pixels and 8 MB.');
    directory.create({ intermediates: true, idempotent: true });
    const id = randomUUID();
    const candidate = new File(directory, `${id}.jpg`);
    if (candidate.exists) throw new Error('The image could not be assigned a new local file. Try again.');
    destination = candidate;
    // SDK 57 moves asynchronously; keep departure cleanup pending until it settles.
    pendingNormalizations += 1;
    try { await temporary.move(destination); }
    finally { pendingNormalizations -= 1; }
    temporaryFiles.delete(temporaryUri);
    ensureCurrent();
    return { purpose: 'product-packaging', id, localUri: destination.uri, width: normalized.width, height: normalized.height, byteSize, createdAt: new Date().toISOString() };
  } catch (error) {
    cleanup();
    throw error;
  }
}

// Called only after the Care write queue settles and before this owner becomes writable.
export async function reconcilePackagingPhotos(userId: string, profileId: string, products: readonly CareProduct[], isCurrent: () => boolean) {
  const generation = cleanupGeneration;
  const directory = await profileDirectory(userId, profileId);
  if (generation !== cleanupGeneration || !isCurrent() || !directory.exists) return;
  // Retain recorded references even when their metadata/file cannot currently be read.
  const retained = new Set(products.map((product) => product.packagingPhoto?.localUri).filter((uri): uri is string => typeof uri === 'string'));
  for (const bucket of directory.list()) {
    if (!(bucket instanceof Directory) || !bucketName.test(bucket.name)) continue;
    for (const file of bucket.list()) {
      if (file instanceof File && file.name.endsWith('.jpg') && packagingPhotoId.test(file.name.slice(0, -4)) && !retained.has(file.uri)) file.delete();
    }
    if (bucket.list().length === 0) bucket.delete();
  }
}

export function deleteAllPackagingPhotos() {
  cleanupGeneration += 1;
  let complete = pendingNormalizations === 0;
  for (const uri of temporaryFiles) {
    try { removeFile(uri); temporaryFiles.delete(uri); } catch { complete = false; }
  }
  try { const directory = root(); if (directory.exists) directory.delete(); } catch { complete = false; }
  return complete;
}
