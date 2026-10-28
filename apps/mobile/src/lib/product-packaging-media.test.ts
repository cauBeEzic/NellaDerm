import { beforeEach, describe, expect, it, vi } from 'vitest';
import { digestStringAsync, randomUUID } from 'expo-crypto';
import { manipulateAsync, type ImageResult } from 'expo-image-manipulator';

import type { CareProduct } from './care';
import { MAX_PACKAGING_PHOTO_BYTES } from './product-packaging';
import { deleteAllPackagingPhotos, deletePackagingPhoto, PackagingCleanupError, packagingPhotoAvailable, reconcilePackagingPhotos, requirePackagingPhoto, stagePackagingPhoto } from './product-packaging-media';

const fs = vi.hoisted(() => ({
  files: new Map<string, { size: number; contents: string }>(),
  directories: new Set<string>(),
  locked: new Set<string>(),
  digests: new Map<string, string>(),
  ids: 0,
  images: 0,
  moves: 0,
  moveFailure: false,
  moveGate: undefined as Promise<void> | undefined,
}));
function pathOf(parts: (string | { uri: string })[]) {
  return parts.map((part, index) => (typeof part === 'string' ? part : part.uri).replace(index ? /^\/+|\/+$/g : /\/+$/g, '')).join('/');
}
// Distinct deterministic native-digest tokens exercise owner policy, not Expo's cryptography.
function digestToken(value: string) {
  if (!fs.digests.has(value)) fs.digests.set(value, (fs.digests.size + 1).toString(16).padStart(64, '0'));
  return fs.digests.get(value)!;
}
vi.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = pathOf(parts); }
    get name() { return this.uri.slice(this.uri.lastIndexOf('/') + 1); }
    get exists() { return fs.files.has(this.uri); }
    get size() { return fs.files.get(this.uri)?.size ?? 0; }
    delete() { if (fs.locked.has(this.uri)) throw new Error('Synthetic locked file'); fs.files.delete(this.uri); }
    async move(destination: File) {
      fs.moves += 1;
      if (fs.moveGate) await fs.moveGate;
      const data = fs.files.get(this.uri);
      if (!data || destination.exists) throw new Error('Synthetic invalid move');
      fs.files.set(destination.uri, data);
      fs.files.delete(this.uri);
      this.uri = destination.uri;
      if (fs.moveFailure) throw new Error('Synthetic interrupted move');
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = pathOf(parts); }
    get name() { return this.uri.slice(this.uri.lastIndexOf('/') + 1); }
    get exists() { return fs.directories.has(this.uri) || [...fs.files.keys()].some((uri) => uri.startsWith(`${this.uri}/`)); }
    create() {
      let parent = this.uri;
      while (parent.startsWith('file:///cache')) { fs.directories.add(parent); parent = parent.slice(0, parent.lastIndexOf('/')); }
    }
    list(): (Directory | File)[] {
      const prefix = `${this.uri}/`;
      const children = new Map<string, Directory | File>();
      for (const uri of [...fs.directories, ...fs.files.keys()]) {
        if (!uri.startsWith(prefix)) continue;
        const relative = uri.slice(prefix.length);
        const name = relative.split('/')[0];
        if (!name) continue;
        const child = `${prefix}${name}`;
        children.set(child, relative.includes('/') || fs.directories.has(child) ? new Directory(child) : new File(child));
      }
      return [...children.values()];
    }
    delete() {
      const prefix = `${this.uri}/`;
      if ([...fs.locked].some((uri) => uri === this.uri || uri.startsWith(prefix))) throw new Error('Synthetic directory lock');
      for (const uri of fs.files.keys()) if (uri.startsWith(prefix)) fs.files.delete(uri);
      for (const uri of fs.directories) if (uri === this.uri || uri.startsWith(prefix)) fs.directories.delete(uri);
    }
  }
  return { File, Directory, Paths: { cache: 'file:///cache/' } };
});
vi.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digestStringAsync: vi.fn(), randomUUID: vi.fn() }));
vi.mock('expo-image-manipulator', () => ({ SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: vi.fn() }));

const owner = { userId: 'synthetic-account-a', profileId: 'self', productId: 'synthetic-product' };
const source = 'file:///picker/synthetic-packaging.jpg';
const health = 'file:///cache/myeczema-private-media/00000000-0000-4000-8000-000000000099.jpg';
function image(size = 2048, width = 2048, height = 1365): ImageResult {
  const uri = `file:///normalizer/synthetic-${++fs.images}.jpg`;
  fs.files.set(uri, { size, contents: 'synthetic normalized packaging bytes' });
  return { uri, width, height };
}
function product(packagingPhoto?: CareProduct['packagingPhoto']): CareProduct {
  return { id: owner.productId, name: 'Synthetic carton', category: 'Other', kind: 'skincare', schedule: ['morning'], startedOn: '2026-10-17', supply: 'plenty', area: 'Not recorded', verified: false, packagingPhoto };
}
beforeEach(() => {
  fs.files.clear(); fs.directories.clear(); fs.locked.clear(); fs.digests.clear(); fs.ids = 0; fs.images = 0; fs.moveFailure = false; fs.moves = 0; fs.moveGate = undefined;
  deleteAllPackagingPhotos();
  vi.mocked(digestStringAsync).mockImplementation(async (_algorithm, value) => digestToken(value));
  vi.mocked(randomUUID).mockImplementation(() => `00000000-0000-4000-8000-${(++fs.ids).toString(16).padStart(12, '0')}`);
  vi.mocked(manipulateAsync).mockImplementation(async () => image());
  fs.files.set(source, { size: 6000, contents: 'synthetic original library asset' });
  fs.files.set(health, { size: 1000, contents: 'synthetic separate health photo' });
});

describe('bounded product-packaging storage', () => {
  it('makes a verifiable owned copy without moving the original and detects subsequent file loss or mutation', async () => {
    const photo = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    expect(await packagingPhotoAvailable(owner, photo)).toBe(true);
    expect(fs.files.get(source)).toEqual({ size: 6000, contents: 'synthetic original library asset' });
    fs.files.set(photo.localUri, { size: 1, contents: 'synthetic truncated copy' });
    expect(await packagingPhotoAvailable(owner, photo)).toBe(false);
    await expect(requirePackagingPhoto(owner, photo)).rejects.toThrow();
    fs.files.delete(photo.localUri);
    expect(await packagingPhotoAvailable(owner, photo)).toBe(false);
  });

  it.each([
    { ...owner, userId: 'synthetic-account-b' },
    { ...owner, profileId: 'dependent' },
    { ...owner, productId: 'different-product' },
  ])('rejects read and deletion by a different owner tuple: %o', async (other) => {
    const photo = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    const before = new Map(fs.files);
    expect(await packagingPhotoAvailable(other, photo)).toBe(false);
    await expect(requirePackagingPhoto(other, photo)).rejects.toThrow();
    await deletePackagingPhoto(other, photo);
    expect(fs.files).toEqual(before);
    expect(await packagingPhotoAvailable(owner, photo)).toBe(true);
  });

  it('does not reinterpret a health-photo URI or path traversal as product packaging', async () => {
    const photo = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    const before = new Map(fs.files);
    for (const localUri of [health, `${photo.localUri}/../other.jpg`, photo.localUri.replace('/cache/', '/other-cache/')]) {
      expect(await packagingPhotoAvailable(owner, { ...photo, localUri })).toBe(false);
      await deletePackagingPhoto(owner, { ...photo, localUri });
    }
    expect(fs.files).toEqual(before);
  });

  it('accepts a copy exactly at both storage limits', async () => {
    vi.mocked(manipulateAsync).mockImplementationOnce(async () => image(MAX_PACKAGING_PHOTO_BYTES, 2048, 1));
    const photo = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2 }, () => true);
    expect(await packagingPhotoAvailable(owner, photo)).toBe(true);
    await requirePackagingPhoto(owner, photo);
    await deletePackagingPhoto(owner, photo);
    expect(fs.files.has(photo.localUri)).toBe(false);
    expect(fs.files.get(source)?.contents).toBe('synthetic original library asset');
  });

  it.each([
    [MAX_PACKAGING_PHOTO_BYTES + 1, 2048, 1365],
    [2048, 2049, 1365],
    [2048, 2048, 0],
    [0, 2048, 1365],
  ])('rejects an out-of-bound normalized result and removes its temporary file (%i,%i,%i)', async (bytes, width, height) => {
    const before = new Map(fs.files);
    vi.mocked(manipulateAsync).mockImplementationOnce(async () => image(bytes, width, height));
    await expect(stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true)).rejects.toThrow();
    expect(fs.files).toEqual(before);
  });

  it('never moves or deletes the source when a normalizer unexpectedly returns it', async () => {
    const before = new Map(fs.files);
    vi.mocked(manipulateAsync).mockResolvedValueOnce({ uri: source, width: 300, height: 200 });
    await expect(stagePackagingPhoto(owner, { sourceUri: source, width: 300, height: 200 }, () => true)).rejects.toThrow();
    expect(fs.files).toEqual(before);
  });

  it('waits for the native move before returning an attachment', async () => {
    let release!: () => void;
    fs.moveGate = new Promise<void>((resolve) => { release = resolve; });
    let settled = false;
    const preparation = stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true)
      .then((photo) => { settled = true; return photo; });
    await vi.waitFor(() => expect(fs.moves).toBe(1));
    const returnedBeforeMove = settled;
    release();
    const photo = await preparation;
    expect(returnedBeforeMove).toBe(false);
    expect(await packagingPhotoAvailable(owner, photo)).toBe(true);
  });

  it('keeps departure cleanup pending until an interrupted move settles', async () => {
    let release!: () => void;
    fs.moveGate = new Promise<void>((resolve) => { release = resolve; });
    const preparation = stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    const rejected = expect(preparation).rejects.toThrow();
    await vi.waitFor(() => expect(fs.moves).toBe(1));
    const departureComplete = deleteAllPackagingPhotos();
    release();
    await rejected;
    expect(departureComplete).toBe(false);
    expect([...fs.files.keys()]).toEqual([source, health]);
    expect(deleteAllPackagingPhotos()).toBe(true);
  });

  it('cleans an interrupted destination move without deleting unrelated files', async () => {
    const before = new Map(fs.files);
    fs.moveFailure = true;
    await expect(stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true)).rejects.toThrow();
    expect(fs.files).toEqual(before);
  });

  it('preserves an existing image on an unexpected UUID collision', async () => {
    const existing = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    const before = new Map(fs.files);
    vi.mocked(randomUUID).mockReturnValueOnce(existing.id);
    await expect(stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true)).rejects.toThrow();
    expect(fs.files).toEqual(before);
    expect(await packagingPhotoAvailable(owner, existing)).toBe(true);
  });

  it('exposes failed preparation cleanup as a retryable capability, not an accepted attachment', async () => {
    const before = new Map(fs.files);
    const normalized = image(MAX_PACKAGING_PHOTO_BYTES + 1);
    fs.locked.add(normalized.uri);
    vi.mocked(manipulateAsync).mockResolvedValueOnce(normalized);
    const error = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true).catch((failure: unknown) => failure);
    expect(error).toBeInstanceOf(PackagingCleanupError);
    fs.locked.clear();
    (error as PackagingCleanupError).retry();
    expect(fs.files).toEqual(before);
    expect(deleteAllPackagingPhotos()).toBe(true);
  });

  it('does not claim a completed purge while normalization is pending and cancels its late result', async () => {
    const preparing = Promise.withResolvers<void>();
    const normalized = Promise.withResolvers<ImageResult>();
    vi.mocked(manipulateAsync).mockImplementationOnce(() => { preparing.resolve(); return normalized.promise; });
    const capture = stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    await preparing.promise;
    expect(deleteAllPackagingPhotos()).toBe(false);
    normalized.resolve(image());
    await expect(capture).rejects.toThrow();
    expect(deleteAllPackagingPhotos()).toBe(true);
    expect(fs.files).toEqual(new Map([[source, { size: 6000, contents: 'synthetic original library asset' }], [health, { size: 1000, contents: 'synthetic separate health photo' }]]));
  });

  it('discards a late owner-invalidated capture without removing a prior accepted photo', async () => {
    const previous = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    let current = true;
    vi.mocked(manipulateAsync).mockImplementationOnce(async () => { current = false; return image(); });
    const before = new Map(fs.files);
    await expect(stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => current)).rejects.toThrow();
    expect(fs.files).toEqual(before);
    expect(await packagingPhotoAvailable(owner, previous)).toBe(true);
  });

  it('retains cleanup authority for an invalidated late result without purging a saved attachment', async () => {
    const saved = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    const before = new Map(fs.files);
    const late = image();
    fs.locked.add(late.uri);
    let current = true;
    vi.mocked(manipulateAsync).mockImplementationOnce(async () => { current = false; return late; });
    const failure = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => current).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(PackagingCleanupError);
    expect(fs.files.has(late.uri)).toBe(true);
    expect(await packagingPhotoAvailable(owner, saved)).toBe(true);
    fs.locked.clear();
    (failure as PackagingCleanupError).retry();
    expect(fs.files).toEqual(before);
  });

  it('reconciles only this profile’s abandoned copies, retaining missing/invalid recorded references unchanged', async () => {
    const saved = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    const abandoned = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    const otherProfile = await stagePackagingPhoto({ ...owner, profileId: 'dependent' }, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    const otherAccount = await stagePackagingPhoto({ ...owner, userId: 'synthetic-account-b' }, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    const invalid = { ...saved, width: 0 };
    const records = [product(invalid), { ...product({ ...saved, localUri: saved.localUri.replace(saved.id, '00000000-0000-4000-8000-000000000088') }), id: 'missing-file-product' }];
    const snapshot = JSON.stringify(records);
    await reconcilePackagingPhotos(owner.userId, owner.profileId, records, () => true);
    expect(fs.files.has(abandoned.localUri)).toBe(false);
    expect(fs.files.has(saved.localUri)).toBe(true);
    expect(await packagingPhotoAvailable({ ...owner, profileId: 'dependent' }, otherProfile)).toBe(true);
    expect(await packagingPhotoAvailable({ ...owner, userId: 'synthetic-account-b' }, otherAccount)).toBe(true);
    expect(JSON.stringify(records)).toBe(snapshot);
    expect(fs.files.get(health)?.contents).toBe('synthetic separate health photo');
  });

  it('rejects a stale reconciliation after its owner/hash await', async () => {
    const currentPhoto = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    const hashing = Promise.withResolvers<string>();
    vi.mocked(digestStringAsync).mockImplementationOnce(() => hashing.promise);
    let current = true;
    const reconcile = reconcilePackagingPhotos(owner.userId, owner.profileId, [], () => current);
    current = false;
    hashing.resolve(digestToken(JSON.stringify(['product-packaging', owner.userId, owner.profileId])));
    await reconcile;
    expect(await packagingPhotoAvailable(owner, currentPhoto)).toBe(true);
  });

  it('keeps committed bytes on failed orphan cleanup and recovers on retry', async () => {
    const saved = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    const abandoned = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    fs.locked.add(abandoned.localUri);
    await expect(reconcilePackagingPhotos(owner.userId, owner.profileId, [product(saved)], () => true)).rejects.toThrow();
    expect(await packagingPhotoAvailable(owner, saved)).toBe(true);
    fs.locked.clear();
    await reconcilePackagingPhotos(owner.userId, owner.profileId, [product(saved)], () => true);
    expect(fs.files.has(abandoned.localUri)).toBe(false);
    expect(await packagingPhotoAvailable(owner, saved)).toBe(true);
  });

  it('reports failed session-loss deletion and retries only its own packaging namespace', async () => {
    const photo = await stagePackagingPhoto(owner, { sourceUri: source, width: 3000, height: 2000 }, () => true);
    fs.locked.add(photo.localUri);
    expect(deleteAllPackagingPhotos()).toBe(false);
    fs.locked.clear();
    expect(deleteAllPackagingPhotos()).toBe(true);
    expect(fs.files.has(photo.localUri)).toBe(false);
    expect(fs.files.get(source)?.contents).toBe('synthetic original library asset');
    expect(fs.files.get(health)?.contents).toBe('synthetic separate health photo');
  });
});
