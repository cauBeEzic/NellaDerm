import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AuthLayout } from '@/components/auth-layout';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { authErrorMessage } from '@/lib/auth-errors';
import { safeReturnTo } from '@/lib/return-to';
import { colors, font, spacing } from '@/theme';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string; returnTo?: string }>();
  const email = params.email ?? '';
  const returnTo = safeReturnTo(params.returnTo);
  const { verifyAccount } = useAuth();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert('Enter the code', 'Use the 6-digit code from your email.');
      return;
    }

    setBusy(true);
    try {
      await verifyAccount(email, code);
      Alert.alert('Email verified', 'Your account is ready. Sign in to continue.', [
        { text: 'Continue', onPress: () => router.replace({ pathname: '/sign-in', params: { email, ...(returnTo ? { returnTo } : {}) } }) },
      ]);
    } catch (error) {
      Alert.alert('Could not verify email', authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout subtitle={`We sent a 6-digit code to ${email || 'your email address'}.`} title="Check your email">
      <View style={styles.form}>
        <TextField autoComplete="one-time-code" keyboardType="number-pad" label="Verification code" maxLength={6} onChangeText={setCode} placeholder="000000" value={code} />
        <PrimaryButton disabled={busy} label={busy ? 'Verifying…' : 'Verify email'} onPress={submit} />
        <SecondaryButton label="Back to sign in" onPress={() => router.replace({ pathname: '/sign-in', params: returnTo ? { returnTo } : undefined })} quiet />
        <Text style={styles.help}>The code expires after 24 hours. Check spam or junk folders if it does not arrive.</Text>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  help: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
