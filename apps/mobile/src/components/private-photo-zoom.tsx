import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { SecondaryButton } from '@/components/button';
import type { CheckInPhoto } from '@/lib/check-in';
import { boundedPhotoTransform, fittedPhotoSize } from '@/lib/photo-zoom';
import { colors, font, radius } from '@/theme';

export function PrivatePhotoZoom({ photo, onReload }: { photo: CheckInPhoto; onReload: () => void }) {
  return <GestureHandlerRootView style={styles.root}>
    <ZoomStage key={photo.id} onReload={onReload} photo={photo} />
  </GestureHandlerRootView>;
}

function ZoomStage({ onReload, photo }: { onReload: () => void; photo: CheckInPhoto }) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const fitted = fittedPhotoSize(photo.width, photo.height, box.width, box.height);
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dimensions = { imageWidth: fitted?.width ?? 0, imageHeight: fitted?.height ?? 0, boxWidth: box.width, boxHeight: box.height };
  useEffect(() => { scale.set(1); x.set(0); y.set(0); }, [box.width, box.height, scale, x, y]);
  const pinch = Gesture.Pinch().enabled(Boolean(fitted && loaded)).onStart(() => { startScale.set(scale.get()); })
    .onUpdate((event) => {
      const next = boundedPhotoTransform({ ...dimensions, scale: startScale.get() * event.scale, x: x.get(), y: y.get() });
      scale.set(next.scale); x.set(next.x); y.set(next.y);
    });
  const pan = Gesture.Pan().enabled(Boolean(fitted && loaded)).minDistance(8).maxPointers(1)
    .onStart(() => { startX.set(x.get()); startY.set(y.get()); })
    .onUpdate((event) => {
      const next = boundedPhotoTransform({ ...dimensions, scale: scale.get(), x: startX.get() + event.translationX, y: startY.get() + event.translationY });
      x.set(next.x); y.set(next.y);
    });
  const imageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }] }));
  function zoom(delta: number) {
    const next = boundedPhotoTransform({ ...dimensions, scale: scale.get() + delta, x: x.get(), y: y.get() });
    scale.set(next.scale); x.set(next.x); y.set(next.y);
  }
  function reset() { scale.set(1); x.set(0); y.set(0); }
  function move(deltaX: number, deltaY: number) {
    const next = boundedPhotoTransform({ ...dimensions, scale: scale.get(), x: x.get() + deltaX, y: y.get() + deltaY });
    x.set(next.x); y.set(next.y);
  }
  if (failed) return <View style={styles.failure}><Text accessibilityRole="alert" style={styles.body}>The stored photo could not be opened. Reload to check whether its local copy is still available.</Text><SecondaryButton label="Reload photo" onPress={onReload} /></View>;
  return <View style={styles.frame}>
    <GestureDetector gesture={Gesture.Simultaneous(pinch, pan)}>
      <Animated.View onLayout={({ nativeEvent }) => setBox({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })} style={styles.gestureArea}>
        {fitted ? <Animated.View style={[{ width: fitted.width, height: fitted.height }, imageStyle]}>
          <Image accessibilityLabel="Private stored photo. Use the zoom controls to inspect it." accessible allowDownscaling={false} cachePolicy="none" contentFit="contain" onError={() => setFailed(true)} onLoad={() => setLoaded(true)} source={{ uri: photo.localUri }} style={StyleSheet.absoluteFill} />
        </Animated.View> : null}
        {!loaded ? <ActivityIndicator color={colors.actionPrimary} style={styles.spinner} /> : null}
      </Animated.View>
    </GestureDetector>
    <View style={styles.controls}>
      <Pressable accessibilityRole="button" onPress={() => zoom(-0.5)} style={({ pressed }) => [styles.control, pressed && styles.pressed]}><Text style={styles.controlText}>Zoom out</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={reset} style={({ pressed }) => [styles.control, pressed && styles.pressed]}><Text style={styles.controlText}>Reset</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => zoom(0.5)} style={({ pressed }) => [styles.control, pressed && styles.pressed]}><Text style={styles.controlText}>Zoom in</Text></Pressable>
    </View>
    <View style={styles.controls}>
      {([
        ['Pan left', 80, 0], ['Pan right', -80, 0], ['Pan up', 0, 80], ['Pan down', 0, -80],
      ] as const).map(([label, deltaX, deltaY]) => <Pressable accessibilityRole="button" key={label} onPress={() => move(deltaX, deltaY)} style={({ pressed }) => [styles.control, pressed && styles.pressed]}><Text style={styles.controlText}>{label}</Text></Pressable>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { height: 460 },
  frame: { flex: 1, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface },
  gestureArea: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  controls: { minHeight: 56, padding: 4, flexDirection: 'row', gap: 8, backgroundColor: colors.surfaceBrandSoft },
  control: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 4, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surface },
  controlText: { width: '100%', flexShrink: 1, color: colors.actionPrimary, fontFamily: font.semibold, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  failure: { flex: 1, padding: 20, justifyContent: 'center', gap: 12 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
  spinner: { position: 'absolute' },
  pressed: { opacity: 0.7 },
});
