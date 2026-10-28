import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { PrivateFileCleanupBoundary } from '@/components/private-file-cleanup-boundary';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AskNellaProvider } from '@/contexts/ask-nella-context';
import { CareProvider } from '@/contexts/care-context';
import { CheckInProvider } from '@/contexts/check-in-context';
import { CommerceProvider } from '@/contexts/commerce-context';
import { PdfExportProvider } from '@/contexts/pdf-export-context';
import { NotificationProvider } from '@/contexts/notification-context';
import { ProfileProvider } from '@/contexts/profile-context';
import '@/lib/amplify';
import { colors } from '@/theme';

function SyntheticDemoBanner() {
  const { syntheticDemo } = useAuth();
  if (!syntheticDemo) return null;
  return <SafeAreaView edges={['top']} style={demoStyles.banner}><Text style={demoStyles.text}>SYNTHETIC DEMO · Local data · No live services</Text></SafeAreaView>;
}

const demoStyles = StyleSheet.create({
  banner: { backgroundColor: colors.surfaceBrandSoft },
  text: { color: colors.textPrimary, fontSize: 12, textAlign: 'center', padding: 6 },
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [error, loaded]);

  if (!loaded && !error) return null;

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <SyntheticDemoBanner />
      <PrivateFileCleanupBoundary>
      <ProfileProvider>
        <CareProvider>
          <NotificationProvider>
            <CommerceProvider>
              <CheckInProvider>
                <PdfExportProvider>
                  <AskNellaProvider>
                  <Stack
                    screenOptions={{
                      contentStyle: { backgroundColor: colors.canvas },
                      headerBackTitle: 'Back',
                      headerShadowVisible: false,
                      headerStyle: { backgroundColor: colors.canvas },
                      headerTintColor: colors.textPrimary,
                      headerTitleStyle: { fontFamily: 'Manrope_600SemiBold' },
                    }}>
                    <Stack.Screen name="index" options={{ headerShown: false }} />
                    <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
                    <Stack.Screen name="create-account" options={{ title: 'Create account' }} />
                    <Stack.Screen name="verify-email" options={{ title: 'Verify email' }} />
                    <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
                    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                    <Stack.Screen name="guest" options={{ headerShown: false }} />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen name="care" options={{ headerShown: false }} />
                    <Stack.Screen name="check-in" options={{ headerShown: false }} />
                    <Stack.Screen name="insights" options={{ headerShown: false }} />
                    <Stack.Screen name="profile" options={{ headerShown: false }} />
                    <Stack.Screen name="ask" options={{ headerShown: false }} />
                    <Stack.Screen name="export" options={{ headerShown: false }} />
                    <Stack.Screen name="notifications" options={{ headerShown: false }} />
                    <Stack.Screen name="commerce" options={{ headerShown: false }} />
                    <Stack.Screen name="privacy" options={{ headerShown: false }} />
                  </Stack>
                  </AskNellaProvider>
                </PdfExportProvider>
              </CheckInProvider>
            </CommerceProvider>
          </NotificationProvider>
        </CareProvider>
      </ProfileProvider>
      </PrivateFileCleanupBoundary>
    </AuthProvider>
  );
}
