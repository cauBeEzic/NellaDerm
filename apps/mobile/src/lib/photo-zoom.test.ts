import { describe, expect, it } from 'vitest';

import { boundedPhotoTransform, fittedPhotoSize } from './photo-zoom';

describe('private photo zoom geometry', () => {
  it('fits portrait and landscape images without cropping or distortion', () => {
    expect(fittedPhotoSize(800, 600, 300, 300)).toEqual({ width: 300, height: 225 });
    expect(fittedPhotoSize(600, 800, 300, 300)).toEqual({ width: 225, height: 300 });
    expect(fittedPhotoSize(0, 800, 300, 300)).toBeUndefined();
    expect(fittedPhotoSize(600, Infinity, 300, 300)).toBeUndefined();
  });

  it('clamps scale and pan to the actual contained image, not the outer frame', () => {
    const dimensions = { imageWidth: 300, imageHeight: 225, boxWidth: 300, boxHeight: 300 };
    expect(boundedPhotoTransform({ ...dimensions, scale: 2, x: 999, y: -999 })).toEqual({ scale: 2, x: 150, y: -75 });
    expect(boundedPhotoTransform({ ...dimensions, scale: 5, x: 0, y: 0 }).scale).toBe(3);
    expect(boundedPhotoTransform({ ...dimensions, scale: 0, x: 200, y: 100 })).toEqual({ scale: 1, x: 0, y: 0 });
    expect(boundedPhotoTransform({ ...dimensions, scale: NaN, x: Infinity, y: NaN })).toEqual({ scale: 1, x: 0, y: 0 });
  });
});
