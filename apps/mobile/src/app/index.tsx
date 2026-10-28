import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '@/components/button';
import { useAuth } from '@/contexts/auth-context';
import { colors, font, radius, size, spacing } from '@/theme';

const benefits = [
  { icon: 'timer-outline', color: colors.actionPrimary, title: 'Quick check-ins', body: 'Record how your skin is doing in a few taps.' },
  { icon: 'spa-outline', color: colors.actionPrimary, title: 'Products & routines', body: 'Keep your products and daily routine organized.' },
  { icon: 'calendar-blank-outline', color: colors.textSecondary, title: 'Progress over time', body: 'Review your observations, photos, and history over time.' },
] as const;

export default function WelcomeScreen() {
  const { loading, user, syntheticDemo } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace('/onboarding');
  }, [loading, user]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Image accessibilityLabel="Nella Derm" contentFit="contain" source={require('../../assets/brand/nella-logo.png')} style={styles.logo} />
          <Text accessibilityRole="header" style={styles.title}>Your eczema companion</Text>
          <Text style={styles.subtitle}>Track how your skin changes, keep your routine organized, and build a useful history over time.</Text>
        </View>

        <View accessibilityLabel="MyEczema benefits" style={styles.benefitList}>
          {benefits.map((benefit) => (
            <View key={benefit.title} style={styles.card}>
              <View style={styles.iconTile}>
                <MaterialCommunityIcons accessible={false} color={benefit.color} name={benefit.icon} size={24} />
              </View>
              <View style={styles.cardCopy}>
                <Text style={styles.cardTitle}>{benefit.title}</Text>
                <Text style={styles.cardBody}>{benefit.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <PrimaryButton label="Get started" labelStyle={styles.primaryLabel} onPress={() => router.push(syntheticDemo ? '/sign-in' : '/create-account')} trailingIcon={<MaterialCommunityIcons accessible={false} color={colors.onActionPrimary} name="arrow-right" size={18} />} />
          <SecondaryButton label="I already have an account" labelStyle={styles.accountLabel} onPress={() => router.push('/sign-in')} quiet />
          <SecondaryButton label="Continue as guest" onPress={() => router.push('/guest')} quiet />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, alignSelf: 'center', width: '100%', maxWidth: size.contentMaxWidth, paddingHorizontal: spacing.lg, paddingBottom: 33 },
  hero: { alignItems: 'center', paddingTop: 14 },
  logo: { width: 142, height: 142 },
  title: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 22, lineHeight: 30, textAlign: 'center', marginTop: spacing.md },
  subtitle: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: spacing.xxs, maxWidth: 315 },
  benefitList: { gap: spacing.xs, marginTop: spacing.section },
  card: { minHeight: 96, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.md },
  iconTile: { width: 44, height: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceBrandSoft },
  cardCopy: { flex: 1, paddingRight: spacing.xxs },
  cardTitle: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 16, lineHeight: 22 },
  cardBody: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, lineHeight: 20, marginTop: 6 },
  actions: { gap: spacing.xs, marginTop: spacing.section },
  primaryLabel: { fontFamily: font.bold, fontSize: 16, lineHeight: 22 },
  accountLabel: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
});
