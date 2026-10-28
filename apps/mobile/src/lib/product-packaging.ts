export const MAX_PACKAGING_PHOTO_BYTES = 8 * 1024 * 1024;
export const MAX_PACKAGING_PHOTO_EDGE = 2048;
export const packagingPhotoId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProductPackagingPhoto = {
  purpose: 'product-packaging';
  id: string;
  localUri: string;
  width: number;
  height: number;
  byteSize: number;
  createdAt: string;
};

export type PackagingPhotoOwner = { userId: string; profileId: string; productId: string };

export function parsePackagingPhoto(value: unknown): ProductPackagingPhoto | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const photo = value as Partial<ProductPackagingPhoto>;
  if (photo.purpose !== 'product-packaging' || typeof photo.id !== 'string' || !packagingPhotoId.test(photo.id)
    || typeof photo.localUri !== 'string' || !photo.localUri.startsWith('file://')
    || !Number.isInteger(photo.width) || !photo.width || photo.width < 1 || photo.width > MAX_PACKAGING_PHOTO_EDGE
    || !Number.isInteger(photo.height) || !photo.height || photo.height < 1 || photo.height > MAX_PACKAGING_PHOTO_EDGE
    || !Number.isInteger(photo.byteSize) || !photo.byteSize || photo.byteSize < 1 || photo.byteSize > MAX_PACKAGING_PHOTO_BYTES
    || typeof photo.createdAt !== 'string' || !Number.isFinite(Date.parse(photo.createdAt))) return undefined;
  return photo as ProductPackagingPhoto;
}
