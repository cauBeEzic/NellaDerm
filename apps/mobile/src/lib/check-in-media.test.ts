import { describe, expect, it, vi } from 'vitest';

import { createCheckInDraft, saveCheckInDraft } from './check-in';
import { checkInPhotoUris, deleteAllCheckInPhotos, isManagedCheckInPhotoUri, readCheckInPhotoDataUri, stageCheckInPhoto } from './check-in-media';
import { manipulateAsync } from 'expo-image-manipulator';

const deleteDirectory = vi.fn();
vi.mock('expo-file-system', () => ({
  Directory: class { uri = 'file:///cache/myeczema-private-media/'; exists = true; create() {} delete() { deleteDirectory(); } },
  File: class {
    exists = true;
    constructor(public uri: string) {}
    base64() { return Promise.resolve('encoded'); }
    delete() {}
  },
  Paths: { cache: 'file:///cache' },
}));
vi.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digest: vi.fn(), randomUUID: vi.fn() }));
vi.mock('expo-image-manipulator', () => ({ SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: vi.fn() }));

const photo = {
  id: '59e1a47b-eda9-4d95-b733-76d7d365dc2b',
  localUri: 'file:///cache/myeczema-private-media/59e1a47b-eda9-4d95-b733-76d7d365dc2b.jpg',
  area: 'hands' as const,
  note: '',
  mimeType: 'image/jpeg' as const,
  size: 1,
  width: 1,
  height: 1,
  sha256: 'a'.repeat(64),
  createdAt: '2026-10-12T00:00:00.000Z',
  storage: 'app-private-cache' as const,
  syncStatus: 'local-only' as const,
};

describe('check-in media ownership', () => {
  it('accepts deletion only inside the managed opaque media directory', () => {
    expect(isManagedCheckInPhotoUri(photo.localUri)).toBe(true);
    expect(isManagedCheckInPhotoUri('file:///cache/other/private.jpg')).toBe(false);
    expect(isManagedCheckInPhotoUri('file:///cache/myeczema-private-media/../other/private.jpg')).toBe(false);
    expect(isManagedCheckInPhotoUri('file:///cache/myeczema-private-media/not-opaque.jpg')).toBe(false);
    expect(isManagedCheckInPhotoUri('https://example.test/photo.jpg')).toBe(false);
  });

  it('deduplicates draft, entry, and history references before cleanup', () => {
    const draft = { ...createCheckInDraft(new Date(2026, 9, 12), 'same'), photo };
    const entry = saveCheckInDraft(draft, new Date(2026, 9, 12));
    expect([...checkInPhotoUris({ draft, entry }, [entry])]).toEqual([photo.localUri]);
  });

  it('removes every managed photo on sign-out instead of leaving another profile behind', () => {
    expect(deleteAllCheckInPhotos()).toBe(true);
    expect(deleteDirectory).toHaveBeenCalledOnce();
  });

  it('reports a failed sign-out purge without throwing through the auth transition', () => {
    deleteDirectory.mockImplementationOnce(() => { throw new Error('busy'); });
    expect(deleteAllCheckInPhotos()).toBe(false);
  });

  it('reads only managed local photos for an explicit export', async () => {
    await expect(readCheckInPhotoDataUri(photo.localUri)).resolves.toBe('data:image/jpeg;base64,encoded');
    await expect(readCheckInPhotoDataUri('file:///cache/other/private.jpg')).rejects.toThrow('CheckInPhotoOutsideManagedStorage');
  });

  it('cancels capture awaiting normalization when sign-out cleanup starts', async () => {
    let resolveImage!: (value: Awaited<ReturnType<typeof manipulateAsync>>) => void;
    vi.mocked(manipulateAsync).mockImplementationOnce(() => new Promise((resolve) => { resolveImage = resolve; }));
    const captured = stageCheckInPhoto({ sourceUri: 'file:///picker/source.jpg', sourceWidth: 3000, sourceHeight: 2000, area: 'hands', note: '' });
    deleteAllCheckInPhotos();
    resolveImage({ uri: 'file:///picker/normalized.jpg', width: 2048, height: 1365 });
    await expect(captured).rejects.toThrow('CheckInPhotoCaptureCancelled');
  });
});
