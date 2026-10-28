import * as SecureStore from 'expo-secure-store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { emptyCareState, insertCareProduct, setCareProductPackagingPhoto, setCareProductSupply, type CareProduct, type CareState } from './care';
import { loadCareState, saveCareState } from './care-storage';
import { buildHistoryItems } from './insights';
import { MAX_PACKAGING_PHOTO_BYTES, parsePackagingPhoto, type ProductPackagingPhoto } from './product-packaging';
import { productPeriodSummary } from './product-period';

vi.mock('expo-secure-store', () => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn() }));
const photo: ProductPackagingPhoto = {
  purpose: 'product-packaging', id: '00000000-0000-4000-8000-000000000001',
  localUri: 'file:///cache/myeczema-product-packaging/synthetic-owner/synthetic-product/00000000-0000-4000-8000-000000000001.jpg',
  width: 1200, height: 900, byteSize: 4096, createdAt: '2026-10-17T12:00:00.000Z',
};
const replacement: ProductPackagingPhoto = { ...photo, id: '00000000-0000-4000-8000-000000000002', localUri: photo.localUri.replace('000000000001.jpg', '000000000002.jpg') };
const originalProduct: CareProduct = {
  id: 'synthetic-carton', name: 'Synthetic carton', manufacturer: 'Synthetic QA label', barcode: ' 9990000000001 ', category: 'Moisturizer', kind: 'skincare',
  schedule: ['evening'], weekdays: ['mon', 'fri'], scheduleHistory: [{ beforeDay: '2026-10-15', schedule: ['morning'], weekdays: ['sun'] }],
  supply: 'low', startedOn: '2026-10-15', area: 'Historical area text', personalInstructions: 'Synthetic personal instructions', directions: 'Synthetic label directions', verified: false,
};
const original: CareState = {
  ...emptyCareState,
  products: [{ ...originalProduct, packagingPhoto: photo }, { ...originalProduct, id: 'unrelated-product', name: 'Other synthetic product' }],
  events: [{ id: 'original-event', productId: originalProduct.id, dayKey: '2026-10-16', period: 'evening', status: 'used', recordedAt: '2026-10-16T21:00:00.000Z', displayTime: '9:00 PM' }],
};
const records = new Map<string, string>();
let failWrite = false;
beforeEach(() => {
  records.clear(); failWrite = false;
  vi.mocked(SecureStore.getItemAsync).mockImplementation(async (key) => records.get(key) ?? null);
  vi.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { if (failWrite) throw new Error('Synthetic storage unavailable'); records.set(key, value); });
});

describe('packaging metadata and Care compatibility', () => {
  it.each([
    { ...photo, purpose: 'private-skin' },
    { ...photo, id: '../photo' },
    { ...photo, localUri: 'https://example.test/not-a-local-copy.jpg' },
    { ...photo, byteSize: MAX_PACKAGING_PHOTO_BYTES + 1 },
    { ...photo, width: 2049 },
    { ...photo, height: 1.5 },
    { ...photo, createdAt: 'not-a-date' },
  ])('rejects a malformed or wrong-purpose attachment without repairing its metadata: %o', (value) => {
    const snapshot = JSON.stringify(value);
    expect(parsePackagingPhoto(value)).toBeUndefined();
    expect(JSON.stringify(value)).toBe(snapshot);
  });

  it('patches only the named attachment against current product fields and preserves historical events', () => {
    const concurrent = setCareProductSupply(original, originalProduct.id, 'plenty');
    const updated = setCareProductPackagingPhoto(concurrent, originalProduct.id, photo.id, replacement);
    expect(updated).toEqual({ ...concurrent, products: [{ ...concurrent.products[0], packagingPhoto: replacement }, concurrent.products[1]] });
    expect(original.products[0].packagingPhoto).toEqual(photo);
    const removed = setCareProductPackagingPhoto(updated, originalProduct.id, replacement.id, undefined);
    expect(removed.products[0]).toEqual({ ...concurrent.products[0], packagingPhoto: undefined });
    expect(removed.events).toEqual(original.events);
    expect(removed.products[1]).toEqual(original.products[1]);
  });

  it('rejects stale photo or unavailable-product edits instead of replacing a newer attachment', () => {
    const current = setCareProductPackagingPhoto(original, originalProduct.id, photo.id, replacement);
    const snapshot = JSON.stringify(current);
    expect(() => setCareProductPackagingPhoto(current, originalProduct.id, photo.id, undefined)).toThrow();
    expect(() => setCareProductPackagingPhoto(current, 'no-longer-in-cabinet', undefined, photo)).toThrow();
    expect(JSON.stringify(current)).toBe(snapshot);
  });

  it('preserves existing packaging and all personal fields when a manual barcode candidate is ignored', () => {
    const candidate = { ...originalProduct, id: 'new-manual-draft', barcode: '9990000000001', name: 'Changed draft name', schedule: ['morning' as const], packagingPhoto: replacement };
    expect(insertCareProduct(original.products, candidate)).toEqual(original.products);
    expect(original.products[0]).toEqual({ ...originalProduct, packagingPhoto: photo });
  });

  it('reloads older products without inventing an attachment and keeps missing-file references recorded', async () => {
    await saveCareState('synthetic-a', 'self', { ...original, products: [originalProduct] });
    expect((await loadCareState('synthetic-a', 'self')).products[0]).toEqual(originalProduct);
    await saveCareState('synthetic-a', 'self', original);
    const before = new Map(records);
    expect((await loadCareState('synthetic-a', 'self')).products[0].packagingPhoto).toEqual(photo);
    expect(records).toEqual(before);
  });

  it('round-trips a selected owner’s replacement/removal without rewriting other owners or history keys', async () => {
    for (const [account, profile] of [['synthetic-a', 'self'], ['synthetic-a', 'dependent'], ['synthetic-b', 'self']]) await saveCareState(account, profile, original);
    records.set('synthetic-private-history', JSON.stringify({ note: 'Synthetic retained history; no packaging association' }));
    const before = new Map(records);
    const changed = setCareProductPackagingPhoto(await loadCareState('synthetic-a', 'self'), originalProduct.id, photo.id, replacement);
    await saveCareState('synthetic-a', 'self', changed);
    expect(await loadCareState('synthetic-a', 'self')).toEqual(changed);
    expect(await loadCareState('synthetic-a', 'dependent')).toEqual(original);
    expect(await loadCareState('synthetic-b', 'self')).toEqual(original);
    expect(records.get('synthetic-private-history')).toBe(before.get('synthetic-private-history'));
    const removed = setCareProductPackagingPhoto(changed, originalProduct.id, replacement.id, undefined);
    await saveCareState('synthetic-a', 'self', removed);
    expect((await loadCareState('synthetic-a', 'self')).products[0].packagingPhoto).toBeUndefined();
    for (const [key, value] of before) if (key !== 'myeczema.care.synthetic-a.self') expect(records.get(key)).toBe(value);
  });

  it('retains durable metadata and unrelated records when replacement persistence fails', async () => {
    await saveCareState('synthetic-a', 'self', original);
    await saveCareState('synthetic-a', 'dependent', original);
    const before = new Map(records);
    failWrite = true;
    const changed = setCareProductPackagingPhoto(await loadCareState('synthetic-a', 'self'), originalProduct.id, photo.id, replacement);
    await expect(saveCareState('synthetic-a', 'self', changed)).rejects.toThrow();
    expect(records).toEqual(before);
    expect(await loadCareState('synthetic-a', 'self')).toEqual(original);
  });

  it('never counts packaging attachments as skin photos or check-ins in History or product-period evidence', () => {
    const summary = productPeriodSummary(original.products[0], '2026-10-17', [], original.events, original.products, () => true)!;
    expect(summary.usedEvents).toBe(1);
    expect({ checkIns: summary.checkInDays, available: summary.availablePhotos, unavailable: summary.unavailablePhotos }).toEqual({ checkIns: 0, available: 0, unavailable: 0 });
    expect(buildHistoryItems([], original.events, original.products).map((item) => ({ type: item.type, productId: item.productId }))).toEqual([{ type: 'product', productId: originalProduct.id }]);
  });
});
