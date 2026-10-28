import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthLayout } from '@/components/auth-layout';
import { PrimaryButton } from '@/components/button';
import { DemoNotice } from '@/components/demo-notice';
import { SocialButton } from '@/components/social-button';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { authErrorMessage } from '@/lib/auth-errors';
import { validateEmail, validatePassword, validatePasswordConfirmation } from '@/lib/auth-validation';
import { safeReturnTo } from '@/lib/return-to';
import { colors, font, size, spacing } from '@/theme';

export default function CreateAccountScreen() {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo = safeReturnTo(params.returnTo);
  const { configured, createAccount } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const emailError = submitted ? validateEmail(email) : undefined;
  const passwordError = submitted ? validatePassword(password) : undefined;
  const confirmationError = submitted ? validatePasswordConfirmation(password, confirmation) : undefined;

  async function submit() {
    setSubmitted(true);
    if (!accepted) return;
    if (validateEmail(email) || validatePassword(password) || validatePasswordConfirmation(password, confirmation)) return;

    setBusy(true);
    try {
      const result = await createAccount(email, password);
      if (result === 'signed-in') router.replace({ pathname: '/onboarding', params: returnTo ? { returnTo } : undefined });
      else router.push({ pathname: '/verify-email', params: { email: email.trim().toLowerCase(), ...(returnTo ? { returnTo } : {}) } });
    } catch (error) {
      Alert.alert('Could not create account', authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout subtitle="A private place to track your skin and find support." title="Create your account">
      <View style={styles.form}>
        {!configured ? <DemoNotice /> : null}
        <TextField autoCapitalize="none" autoComplete="email" error={emailError} keyboardType="email-address" label="Email address" onChangeText={setEmail} placeholder="you@example.com" value={email} />
        <TextField autoCapitalize="none" autoComplete="new-password" error={passwordError} label="Create a password" onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry value={password} />
        <TextField autoCapitalize="none" autoComplete="new-password" error={confirmationError} label="Confirm password" onChangeText={setConfirmation} placeholder="Enter it again" secureTextEntry value={confirmation} />
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted((value) => !value)} style={styles.consent}>
          <View style={[styles.checkbox, accepted && styles.checkboxChecked]}>
            {accepted ? <MaterialCommunityIcons color={colors.onActionPrimary} name="check" size={17} /> : null}
          </View>
          <Text style={styles.consentText}>I confirm I’m 16 or older and agree to the Terms and Privacy Policy.</Text>
        </Pressable>
        {submitted && !accepted ? <Text accessibilityRole="alert" style={styles.error}>Please confirm your age and agreement before continuing.</Text> : null}
        <PrimaryButton disabled={busy} label={busy ? 'Creating account…' : 'Create account'} onPress={submit} />
        <View style={styles.divider}><View style={styles.line} /><Text style={styles.or}>or</Text><View style={styles.line} /></View>
        <Text style={styles.providerPending}>Google and Apple sign-in are coming soon.</Text>
        <SocialButton disabled label="Continue with Google" onPress={() => undefined} provider="google" />
        <SocialButton disabled label="Continue with Apple" onPress={() => undefined} provider="apple" />
        <Text style={styles.legalPending}>Demo Terms and Privacy Policy links will be replaced with the approved documents before release.</Text>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  consent: { minHeight: size.androidTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { borderColor: colors.actionPrimary, backgroundColor: colors.actionPrimary },
  consentText: { flex: 1, color: colors.textSecondary, fontFamily: font.regular, fontSize: 13, lineHeight: 19 },
  error: { color: colors.error, fontFamily: font.regular, fontSize: 12, marginTop: -spacing.sm },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.borderDefault },
  or: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 13 },
  legalPending: { color: colors.textSecondary, fontFamily: font.regular, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  providerPending: { color: colors.textSecondary, fontFamily: font.semibold, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});
