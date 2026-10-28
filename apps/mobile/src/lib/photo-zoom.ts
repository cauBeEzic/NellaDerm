export function fittedPhotoSize(width: number, height: number, boxWidth: number, boxHeight: number) {
  if (![width, height, boxWidth, boxHeight].every((value) => Number.isFinite(value) && value > 0)) return undefined;
  const ratio = Math.min(boxWidth / width, boxHeight / height);
  return { width: width * ratio, height: height * ratio };
}

export function boundedPhotoTransform(input: {
  scale: number; x: number; y: number; imageWidth: number; imageHeight: number; boxWidth: number; boxHeight: number;
}) {
  'worklet';
  const scale = Number.isFinite(input.scale) ? Math.min(3, Math.max(1, input.scale)) : 1;
  const limitX = Math.max(0, (input.imageWidth * scale - input.boxWidth) / 2);
  const limitY = Math.max(0, (input.imageHeight * scale - input.boxHeight) / 2);
  return {
    scale,
    x: Number.isFinite(input.x) ? Math.min(limitX, Math.max(-limitX, input.x)) : 0,
    y: Number.isFinite(input.y) ? Math.min(limitY, Math.max(-limitY, input.y)) : 0,
  };
}
