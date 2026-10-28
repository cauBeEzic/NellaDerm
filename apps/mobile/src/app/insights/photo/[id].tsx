import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SecondaryButton } from '@/components/button';
import { EmptyInsight, ErrorBanner, InsightsDetailScreen, ProfileContext } from '@/components/insights-layout';
import { photoDateLabel } from '@/components/private-photo-panel';
import { PrivatePhotoZoom } from '@/components/private-photo-zoom';
import { useAuth } from '@/contexts/auth-context';
import { useCare } from '@/contexts/care-context';
import { useCheckIn } from '@/contexts/check-in-context';
import { areaLabels } from '@/lib/check-in';
import { checkInPhotoExists } from '@/lib/check-in-media';
import { findPhotoRecord, photoRecords } from '@/lib/photo-progress';
import { colors, font, size } from '@/theme';

export default function PrivatePhotoViewer() {
  const { id, periodScope } = useLocalSearchParams<{ id: string | string[]; periodScope?: string | string[] }>();
  const { loading: authLoading, user } = useAuth();
  const { error: careError, loading: careLoading, profile, readScope, retry: retryCare } = useCare();
  const { error, history, loading: historyLoading, offline, retry } = useCheckIn();
  const insets = useSafeAreaInsets();
  const expiredPeriod = periodScope !== undefined && (typeof periodScope !== 'string' || !readScope || periodScope !== readScope);
  const records = useMemo(() => expiredPeriod ? [] : photoRecords(history, (photo) => checkInPhotoExists(photo.localUri)), [expiredPeriod, history]);
  const record = findPhotoRecord(records, id);
  const loading = authLoading || careLoading || historyLoading;
  function reload() { retry(); if (careError) retryCare(); }
  return <InsightsDetailScreen title="Private photo">
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(40, insets.bottom + 24) }]} showsVerticalScrollIndicator={false}>
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.actionPrimary} /><Text style={styles.body}>Opening this profile’s photo…</Text></View> : !user || profile.isDemo ? <EmptyInsight action="Sign in" body="Guest mode cannot open retained health photos." icon="image-lock-outline" onAction={() => router.push('/sign-in')} title="Sign in to view a photo" /> : <>
        <ProfileContext isDemo={false} name={profile.name} offline={offline} onPress={() => router.push('/profile/switch')} />
        {error || careError ? <ErrorBanner message={error ?? careError!} onRetry={reload} /> : expiredPeriod ? <EmptyInsight action="Return to Care" body="This product-period photo link expired. Reopen the period from the current profile’s Product details; no other profile’s photo is substituted." icon="image-off-outline" onAction={() => router.replace('/(tabs)/care')} title="Photo period unavailable" /> : record ? <>
          <View style={styles.caption}><Text accessibilityRole="header" style={styles.title}>{photoDateLabel(record.dayKey)}</Text><Text style={styles.body}>{areaLabels[record.photo.area]} · private local copy</Text></View>
          <PrivatePhotoZoom key={`${user.userId}:${profile.id}:${record.photo.id}`} onReload={reload} photo={record.photo} />
          <Text style={styles.body}>Pinch to zoom up to 3×, then drag within the photo. Zoom and pan buttons provide an alternative; Reset returns to the complete image.</Text>
          {record.photo.note ? <View style={styles.caption}><Text style={styles.noteHeading}>Photo note</Text><Text style={styles.body}>{record.photo.note}</Text></View> : null}
          <Text style={styles.body}>This is the normalized stored copy, not the camera original. Lighting and angle can change appearance. It is not analyzed, uploaded or synchronized.</Text>
          <SecondaryButton label="Compare recorded photos" onPress={() => router.push('/insights/photos')} />
        </> : <><EmptyInsight body="This photo is not in the current profile’s available local history. It may have been removed or its cached file cleared. No other profile’s photo will be substituted." icon="image-off-outline" title="Photo unavailable" /><SecondaryButton label="Reload photos" onPress={reload} /><SecondaryButton label="View photo history" onPress={() => router.replace('/insights/history')} quiet /></>}
      </>}
    </ScrollView>
  </InsightsDetailScreen>;
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', paddingHorizontal: 20, gap: 20 },
  loading: { minHeight: 200, gap: 12, alignItems: 'center', justifyContent: 'center' },
  caption: { gap: 4 },
  title: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 18, lineHeight: 26 },
  noteHeading: { color: colors.textPrimary, fontFamily: font.semibold, fontSize: 14, lineHeight: 21 },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 20 },
});
