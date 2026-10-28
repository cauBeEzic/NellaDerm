export const privateFileCleanupMessage = 'Some private files could not be removed from this device. Retry cleanup before continuing.';

export class PrivateFileCleanupError extends Error {
  constructor() {
    super(privateFileCleanupMessage);
    this.name = 'PrivateFileCleanupError';
  }
}

export type PrivateFileCleanupFailure = { photos: boolean; pdfs: boolean };

export function privateFileCleanupFailure(photosCleared: boolean, pdfsCleared: boolean): PrivateFileCleanupFailure | undefined {
  return photosCleared && pdfsCleared ? undefined : { photos: !photosCleared, pdfs: !pdfsCleared };
}
