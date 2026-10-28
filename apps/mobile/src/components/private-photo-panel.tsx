import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SecondaryButton } from '@/components/button';
import { areaLabels } from '@/lib/check-in';
import type { PhotoRecord } from '@/lib/photo-progress';
import { colors, font, radius } from '@/theme';

export const photoDateLabel = (dayKey: string) => new Intl.DateTimeFormat('en-CA', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${dayKey}T12:00:00Z`));

export function PrivatePhotoPanel({ record, label, onReload }: { record: PhotoRecord; label: string; onReload: () => void }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={styles.panel}>
      {failed ? <View style={styles.unavailable}><Text accessibilityRole="alert" style={styles.body}>This local photo could not be opened.</Text><SecondaryButton label="Reload photos" onPress={onReload} /></View> : <Pressable
        accessibilityLabel={`Open ${label.toLowerCase()} photo, ${photoDateLabel(record.dayKey)}, ${areaLabels[record.photo.area]}`}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/insights/photo/[id]', params: { id: record.photo.id } })}
        style={({ pressed }) => [styles.imageBox, pressed && styles.pressed]}>
        <Image cachePolicy="none" contentFit="contain" onError={() => setFailed(true)} onLoad={() => setLoaded(true)} source={{ uri: record.photo.localUri }} style={StyleSheet.absoluteFill} />
        {!loaded ? <ActivityIndicator color={colors.actionPrimary} /> : null}
      </Pressable>}
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.date}>{photoDateLabel(record.dayKey)}</Text>
      <Text style={styles.body}>{areaLabels[record.photo.area]} · local copy</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, gap: 4 },
  imageBox: { width: '100%', aspectRatio: 0.8, borderRadius: radius.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  unavailable: { minHeight: 180, gap: 12, justifyContent: 'center' },
  label: { marginTop: 8, color: colors.actionPrimary, fontFamily: font.medium, fontSize: 12, lineHeight: 18 },
  date: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 16, lineHeight: 23 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
