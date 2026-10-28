import { Directory, File, Paths } from 'expo-file-system';

import { isGeneratedPdfUri } from './pdf-export';

// Expo SDK 57 Print writes opaque UUID PDFs here on both native platforms.
const printDirectory = () => new Directory(Paths.cache, 'Print');
let cleanupGeneration = 0;
let activeExports = 0;

export function invalidatePdfExports() {
  cleanupGeneration += 1;
}

export function pdfCleanupGeneration() {
  return cleanupGeneration;
}

export function beginPdfExport() {
  activeExports += 1;
  return cleanupGeneration;
}

export function deleteGeneratedPdf(uri: string) {
  if (!isGeneratedPdfUri(uri, printDirectory().uri)) return false;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
    return !file.exists;
  } catch {
    return false;
  }
}

export function deleteAllGeneratedPdfs() {
  invalidatePdfExports();
  try {
    const directory = printDirectory();
    if (!directory.exists) return true;
    let cleared = true;
    for (const file of directory.list()) {
      if (file instanceof File && isGeneratedPdfUri(file.uri, directory.uri) && !deleteGeneratedPdf(file.uri)) cleared = false;
    }
    return cleared;
  } catch {
    return false;
  }
}

export function finishPdfExport(uri?: string) {
  const ownFileCleared = uri ? deleteGeneratedPdf(uri) : true;
  activeExports -= 1;
  // A renderer may reject after creating its UUID file without returning a URI.
  // Never sweep while another operation/recipient may still be using its file.
  const remainingCleared = activeExports === 0 ? deleteAllGeneratedPdfs() : true;
  return ownFileCleared && remainingCleared;
}
