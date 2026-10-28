import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AuthLayout } from '@/components/auth-layout';
import { PrimaryButton, SecondaryButton } from '@/components/button';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/contexts/auth-context';
import { authErrorMessage } from '@/lib/auth-errors';
import { validateEmail, validatePassword } from '@/lib/auth-validation';
import { spacing } from '@/theme';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const { finishPasswordReset, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestCode() {
    const error = validateEmail(email);
    if (error) {
      Alert.alert('Check your email', error);
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setRequested(true);
    } catch (requestError) {
      Alert.alert('Could not request a reset', authErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!/^\d{6}$/.test(code.trim())) {
      Alert.alert('Enter the code', 'Use the 6-digit code from your email.');
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert('Check your password', passwordError);
      return;
    }
    setBusy(true);
    try {
      await finishPasswordReset(email, code, password);
      Alert.alert('Password updated', 'You can now sign in with your new password.', [
        { text: 'Continue', onPress: () => router.replace({ pathname: '/sign-in', params: { email } }) },
      ]);
    } catch (resetError) {
      Alert.alert('Could not reset password', authErrorMessage(resetError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      subtitle={requested ? `Enter the code sent to ${email}.` : 'We will email you a secure reset code.'}
      title={requested ? 'Create a new password' : 'Forgot your password?'}>
      <View style={styles.form}>
        <TextField autoCapitalize="none" autoComplete="email" editable={!requested} keyboardType="email-address" label="Email address" onChangeText={setEmail} value={email} />
        {requested ? (
          <>
            <TextField autoComplete="one-time-code" keyboardType="number-pad" label="Reset code" maxLength={6} onChangeText={setCode} placeholder="000000" value={code} />
            <TextField autoComplete="new-password" label="New password" onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry value={password} />
            <PrimaryButton disabled={busy} label={busy ? 'Updating…' : 'Update password'} onPress={reset} />
            <SecondaryButton label="Request a new code" onPress={requestCode} quiet />
          </>
        ) : (
          <PrimaryButton disabled={busy} label={busy ? 'Sending…' : 'Send reset code'} onPress={requestCode} />
        )}
        <SecondaryButton label="Back to sign in" onPress={() => router.replace('/sign-in')} quiet />
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({ form: { gap: spacing.md } });
