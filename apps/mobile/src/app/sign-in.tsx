import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { AuthLayout } from '@/components/auth-layout';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { DemoNotice } from '@/components/demo-notice';
import { SocialButton } from '@/components/social-button';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { authErrorMessage } from '@/lib/auth-errors';
import { validateEmail, validatePassword } from '@/lib/auth-validation';
import { safeReturnTo } from '@/lib/return-to';
import { colors, font, spacing } from '@/theme';

export default function SignInScreen() {
  const params = useLocalSearchParams<{ email?: string; returnTo?: string }>();
  const returnTo = safeReturnTo(params.returnTo);
  const { configured, signInWithPassword, syntheticDemo, startSyntheticDemo, user, loading } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const emailError = submitted ? validateEmail(email) : undefined;
  const passwordError = submitted ? validatePassword(password) : undefined;

  async function submit() {
    setSubmitted(true);
    if (validateEmail(email) || validatePassword(password)) return;

    setBusy(true);
    try {
      const result = await signInWithPassword(email, password);
      if (result === 'confirm-sign-up') {
        router.push({ pathname: '/verify-email', params: { email: email.trim().toLowerCase(), ...(returnTo ? { returnTo } : {}) } });
        return;
      }
      if (result === 'reset-password') {
        router.push({ pathname: '/forgot-password', params: { email: email.trim().toLowerCase() } });
        return;
      }
      router.replace({ pathname: '/onboarding', params: returnTo ? { returnTo } : undefined });
    } catch (error) {
      Alert.alert('Could not sign in', authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function startDemo(scenario: 'new' | 'two-months') {
    if (busy || loading || user) return;
    setBusy(true);
    try {
      await startSyntheticDemo(scenario);
      router.replace('/onboarding');
    } catch {
      Alert.alert('Could not prepare demo', 'No demo was opened. Please try again.');
    } finally { setBusy(false); }
  }

  if (syntheticDemo) return (
    <AuthLayout subtitle="Fictional adults. Local data only. No password or verification code needed." title="Choose a demo account">
      <View style={styles.form}>
        <Text style={styles.providerPending}>Each start creates a fresh scenario. Closing and reopening the app resumes the current one. Sign out to choose again.</Text>
        <Text style={styles.footer}>Alex Demo · New user</Text>
        <Text style={styles.providerPending}>Starts at onboarding, with no products or check-ins.</Text>
        <PrimaryButton disabled={busy || loading || Boolean(user)} label={busy ? 'Preparing demo…' : 'Start new-user demo'} onPress={() => startDemo('new')} />
        <Text style={styles.footer}>Jordan Demo · Two months</Text>
        <Text style={styles.providerPending}>Completed setup, two fictional products and 60 days of mixed activity. Today is ready for a live check-in.</Text>
        <SecondaryButton disabled={busy || loading || Boolean(user)} label="Start two-month demo" onPress={() => startDemo('two-months')} />
        {user ? <SecondaryButton label="Resume current demo" onPress={() => router.replace('/onboarding')} /> : null}
      </View>
    </AuthLayout>
  );

  return (
    <AuthLayout subtitle="Welcome back. Continue your skin-care journey." title="Sign in to MyEczema">
      <View style={styles.form}>
        {!configured ? <DemoNotice /> : null}
        <TextField autoCapitalize="none" autoComplete="email" error={emailError} keyboardType="email-address" label="Email address" onChangeText={setEmail} placeholder="you@example.com" value={email} />
        <TextField autoCapitalize="none" autoComplete="current-password" error={passwordError} label="Password" onChangeText={setPassword} placeholder="Enter your password" secureTextEntry value={password} />
        <SecondaryButton label="Forgot password?" onPress={() => router.push({ pathname: '/forgot-password', params: email ? { email } : undefined })} quiet />
        <PrimaryButton disabled={busy} label={busy ? 'Signing in…' : 'Sign in'} onPress={submit} />
        <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>or</Text><View style={styles.line} /></View>
        <Text style={styles.providerPending}>Google and Apple sign-in are coming soon.</Text>
        <SocialButton disabled label="Continue with Google" onPress={() => undefined} provider="google" />
        <SocialButton disabled label="Continue with Apple" onPress={() => undefined} provider="apple" />
        <Text style={styles.footer}>New to MyEczema?</Text>
        <SecondaryButton label="Create an account" onPress={() => router.replace({ pathname: '/create-account', params: returnTo ? { returnTo } : undefined })} quiet />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.borderDefault },
  or: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  footer: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 14, textAlign: 'center', marginTop: spacing.xs },
  providerPending: { color: colors.textSecondary, fontFamily: font.semibold, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
