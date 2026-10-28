import { describe, expect, it } from 'vitest';

import { privateFileCleanupFailure } from './private-file-cleanup';

describe('private-file recovery scope', () => {
  it('does not request removal of healthy saved photos after an export-only failure', () => {
    expect(privateFileCleanupFailure(true, false)).toEqual({ photos: false, pdfs: true });
  });

  it('keeps a failed photo purge pending after PDF cleanup succeeded', () => {
    expect(privateFileCleanupFailure(false, true)).toEqual({ photos: true, pdfs: false });
  });

  it('retries both resources when neither purge succeeded', () => {
    expect(privateFileCleanupFailure(false, false)).toEqual({ photos: true, pdfs: true });
  });

  it('releases the gate only when every requested resource was cleared', () => {
    expect(privateFileCleanupFailure(true, true)).toBeUndefined();
  });
});
