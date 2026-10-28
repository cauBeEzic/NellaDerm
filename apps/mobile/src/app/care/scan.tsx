import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CareFlowLayout } from '@/components/care-flow-layout';
import { SubmitButton } from '@/components/care-form';
import { findCareProductByBarcode, SAMPLE_CARE_BARCODE } from '@/lib/care';
import { colors, font, radius } from '@/theme';

export default function ScanProductScreen() {
  const [barcode, setBarcode] = useState('');
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const [scanId, setScanId] = useState<number | null>(null);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [cameraError, setCameraError] = useState<string>();
  const generationRef = useRef(0);
  const cameraActionLabel = !permission ? 'Checking camera access…'
    : requesting ? 'Requesting camera access…'
    : permission.granted ? 'Start scanning'
    : permission.canAskAgain ? 'Allow camera access' : 'Open camera settings';

  const stopCamera = useCallback(() => {
    generationRef.current += 1;
    setScanId(null);
    setReady(false);
    setTorch(false);
    setRequesting(false);
  }, []);

  useFocusEffect(useCallback(() => stopCamera, [stopCamera]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      if (state !== 'active') {
        stopCamera();
        return;
      }
      void refreshPermission().catch(() => {
        setCameraError('Camera access could not be checked. You can enter the barcode manually.');
      });
    });
    return () => subscription.remove();
  }, [refreshPermission, stopCamera]);

  async function startCamera() {
    if (!permission || requesting) return;
    if (!permission.granted && !permission.canAskAgain) {
      try {
        await Linking.openSettings();
      } catch {
        setCameraError('Settings could not be opened. You can enter the barcode manually.');
      }
      return;
    }
    const attempt = ++generationRef.current;
    setRequesting(true);
    setCameraError(undefined);
    try {
      if (!permission.granted) {
        // Authorization never queues a preview that could start after a backgrounded permission dialog.
        await requestPermission();
        return;
      }
      if (generationRef.current === attempt && AppState.currentState === 'active') {
        setReady(false);
        setScanId(attempt);
      }
    } catch {
      if (generationRef.current === attempt) setCameraError('The camera could not open. You can enter the barcode manually.');
    } finally {
      if (generationRef.current === attempt) setRequesting(false);
    }
  }

  function openMatch(input: string) {
    const value = input.trim();
    if (!value) return;
    stopCamera();
    if (!findCareProductByBarcode(value)) {
      Alert.alert('Product not found', 'This demo only recognizes the sample barcode. You can add the product manually instead.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add manually', onPress: () => router.push('/care/add-product' as Href) },
      ]);
      return;
    }
    router.push(`/care/product-found?barcode=${encodeURIComponent(value)}` as Href);
  }

  return (
    <CareFlowLayout title="Scan product">
      <View style={styles.content}>
        <View style={styles.toolbar}>
          <Pressable accessibilityLabel={torch ? 'Turn flashlight off' : 'Turn flashlight on'} accessibilityRole="switch" accessibilityState={{ checked: torch, disabled: !ready }} disabled={!ready} onPress={() => setTorch((value) => !value)} style={({ pressed }) => [styles.tool, !ready && styles.disabled, pressed && styles.pressed]}>
            <MaterialCommunityIcons color={colors.actionPrimary} name={torch ? 'flash' : 'flash-off'} size={22} />
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={styles.toolbarLabel}>{scanId === null ? 'Camera is off' : ready ? 'Align code to scan' : 'Starting camera…'}</Text>
          <Pressable accessibilityLabel="Stop camera" accessibilityRole="button" accessibilityState={{ disabled: scanId === null }} disabled={scanId === null} onPress={stopCamera} style={({ pressed }) => [styles.tool, scanId === null && styles.disabled, pressed && styles.pressed]}>
            <MaterialCommunityIcons color={colors.actionPrimary} name="close" size={22} />
          </Pressable>
        </View>
        <View style={styles.heading}><Text accessibilityRole="header" style={styles.title}>Scan the barcode or QR code on your product.</Text><Text style={styles.subtitle}>This demo recognizes only the synthetic sample barcode. Other products can be added manually.</Text></View>
        <View style={styles.scanner}>
          {scanId !== null && foreground && permission?.granted ? (
            <CameraView
              barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
              enableTorch={torch}
              facing="back"
              onBarcodeScanned={({ data }) => {
                if (generationRef.current !== scanId) return;
                openMatch(data);
              }}
              onCameraReady={() => { if (generationRef.current === scanId) setReady(true); }}
              onMountError={() => {
                if (generationRef.current !== scanId) return;
                stopCamera();
                setCameraError('The camera could not start. You can enter the barcode manually.');
              }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={styles.cameraConsent}>
              <MaterialCommunityIcons accessible={false} color={colors.actionPrimary} name="barcode-scan" size={64} />
              <SubmitButton disabled={!permission || requesting} label={cameraActionLabel} onPress={() => void startCamera()} />
              <Text style={styles.subtitle}>{permission?.granted ? 'The camera starts only when you choose Start scanning.' : 'Camera access is optional. After allowing access, choose Start scanning.'}</Text>
            </View>
          )}
          <View pointerEvents="none" style={styles.frame}><View style={[styles.corner, styles.topLeft]} /><View style={[styles.corner, styles.topRight]} /><View style={[styles.corner, styles.bottomLeft]} /><View style={[styles.corner, styles.bottomRight]} /></View>
        </View>
        <View style={styles.cameraActions}>
          <Text style={styles.subtitle}>Scan product packaging only. No photos are saved.</Text>
          {cameraError ? <Text accessibilityRole="alert" style={styles.error}>{cameraError}</Text> : null}
          {scanId !== null ? <Text style={styles.scanHint}>Hold the code inside the frame</Text> : <Text style={styles.subtitle}>You can also enter the barcode below without using the camera.</Text>}
        </View>
        <View style={styles.manual}>
          <Text style={styles.manualLabel}>Enter barcode manually</Text>
          <View style={styles.manualRow}><TextInput accessibilityLabel="Barcode" keyboardType="number-pad" onFocus={stopCamera} onChangeText={setBarcode} placeholder="Barcode number" placeholderTextColor={colors.textSecondary} style={styles.input} value={barcode} /><Pressable accessibilityRole="button" accessibilityState={{ disabled: !barcode.trim() }} disabled={!barcode.trim()} onPress={() => openMatch(barcode)} style={({ pressed }) => [styles.find, !barcode.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.findLabel}>Find</Text></Pressable></View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => { stopCamera(); router.push('/care/add-product'); }} style={({ pressed }) => [styles.sample, pressed && styles.pressed]}><Text style={styles.sampleLabel}>Add product manually</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => openMatch(SAMPLE_CARE_BARCODE)} style={({ pressed }) => [styles.sample, pressed && styles.pressed]}><Text style={styles.sampleLabel}>Try the sample barcode</Text></Pressable>
        <Text selectable style={styles.subtitle}>Synthetic sample: {SAMPLE_CARE_BARCODE} · not a manufacturer code</Text>
        <Pressable accessibilityRole="button" onPress={() => { stopCamera(); router.push('/care/prescription'); }} style={({ pressed }) => [styles.sample, pressed && styles.pressed]}><Text style={styles.sampleLabel}>Try the prescription example</Text></Pressable>
      </View>
    </CareFlowLayout>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', gap: 20 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tool: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  toolbarLabel: { flex: 1, textAlign: 'center', color: colors.textSecondary, fontFamily: font.medium, fontSize: 13, lineHeight: 20 },
  heading: { gap: 8 },
  title: { textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 26 },
  subtitle: { textAlign: 'center', color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  scanner: { height: 430, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: colors.surfaceBrandSoft },
  frame: { position: 'absolute', width: '78%', aspectRatio: 1, maxWidth: 256 },
  corner: { position: 'absolute', width: 44, height: 44, borderColor: colors.actionPrimary },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 14 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 14 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 14 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 14 },
  cameraActions: { gap: 12 },
  cameraConsent: { width: '82%', maxWidth: 280, gap: 16, alignItems: 'center' },
  scanHint: { textAlign: 'center', color: colors.textPrimary, fontFamily: font.medium, fontSize: 13, lineHeight: 20 },
  error: { color: colors.error, fontFamily: font.regular, fontSize: 14, lineHeight: 21 },
  manual: { gap: 8 },
  manualLabel: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 13 },
  manualRow: { flexDirection: 'row', gap: 8 },
  input: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: colors.borderDefault, borderRadius: radius.control, paddingHorizontal: 14, color: colors.textPrimary, backgroundColor: colors.surface, fontFamily: font.regular, fontSize: 15 },
  find: { width: 78, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary },
  findLabel: { color: colors.onActionPrimary, fontFamily: font.semibold, fontSize: 14 },
  sample: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  sampleLabel: { color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 14 },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.68 },
});
