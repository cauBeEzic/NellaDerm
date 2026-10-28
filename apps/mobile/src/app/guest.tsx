import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, SecondaryButton } from '@/components/button';
import { colors, font, radius, size, spacing } from '@/theme';

export default function GuestScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <SecondaryButton label="Back" onPress={() => router.back()} quiet />
          <Text style={styles.brand}>Ask Nella</Text>
          <View style={styles.spacer} />
        </View>
        <View style={styles.hero}>
          <View style={styles.icon}><MaterialCommunityIcons color={colors.actionPrimary} name="message-text-outline" size={34} /></View>
          <Text accessibilityRole="header" style={styles.title}>How can I help today?</Text>
          <Text style={styles.body}>Ask general eczema and skincare questions. Guest conversations disappear from your device when this session ends.</Text>
        </View>
        <View style={styles.promptCard}>
          <Text style={styles.prompt}>“What can make eczema feel worse?”</Text>
          <Text style={styles.prompt}>“How should I build a gentle routine?”</Text>
          <Text style={styles.prompt}>“When should I speak with a clinician?”</Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton label="Start a guest conversation" onPress={() => router.replace('/(tabs)/ask')} />
          <SecondaryButton label="Create an account to save data" onPress={() => router.push('/create-account')} />
        </View>
        <Text style={styles.safety}>MyEczema provides general educational support. Locally approved medical and emergency guidance will be added before launch.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, width: '100%', maxWidth: size.contentMaxWidth, alignSelf: 'center', padding: spacing.xl },
  topBar: { minHeight: 48, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flex: 1, minWidth: '60%', textAlign: 'center', color: colors.textPrimary, fontFamily: font.semibold, fontSize: 16 },
  spacer: { width: 50 },
  hero: { alignItems: 'center', marginTop: 54 },
  icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceBrandSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.textPrimary, fontFamily: font.bold, fontSize: 27, marginTop: spacing.lg, textAlign: 'center' },
  body: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: spacing.sm },
  promptCard: { gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.md, marginTop: spacing.xl },
  prompt: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  actions: { gap: spacing.sm, marginTop: 'auto' },
  safety: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: spacing.md },
});
