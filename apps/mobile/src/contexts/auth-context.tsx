import {
  confirmResetPassword,
  confirmSignUp,
  getCurrentUser,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from 'aws-amplify/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { randomUUID } from 'expo-crypto';

import { authConfigured } from '@/lib/amplify';
import { deleteAllCheckInPhotos } from '@/lib/check-in-media';
import { deleteAllGeneratedPdfs, invalidatePdfExports } from '@/lib/pdf-export-files';
import { PrivateFileCleanupError, privateFileCleanupFailure, privateFileCleanupMessage, type PrivateFileCleanupFailure } from '@/lib/private-file-cleanup';
import { deleteAllPackagingPhotos, type PackagingCleanupRetry } from '@/lib/product-packaging-media';
import { syntheticDemoEnabled } from '@/lib/synthetic-demo-config';
import { clearDemoSession, prepareDemoSession, restoreDemoSession } from '@/lib/synthetic-demo-storage';
import type { DemoScenario } from '@/lib/synthetic-demo';

type AuthUser = { userId: string; username: string };

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: AuthUser | null;
  syntheticDemo: boolean;
  startSyntheticDemo: (scenario: DemoScenario) => Promise<void>;
  privateFileCleanupError?: string;
  retryPrivateFileCleanup: () => void;
  reportPdfCleanupFailure: () => void;
  reportPackagingCleanupFailure: (retry: PackagingCleanupRetry) => void;
  refreshUser: () => Promise<AuthUser | null>;
  signInWithPassword: (email: string, password: string) => Promise<'signed-in' | 'confirm-sign-up' | 'reset-password'>;
  createAccount: (email: string, password: string) => Promise<'confirm-sign-up' | 'signed-in'>;
  verifyAccount: (email: string, code: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  finishPasswordReset: (email: string, code: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function ensureConfigured() {
  if (syntheticDemoEnabled) throw new Error('Use the synthetic demo account buttons. Live account services are disabled in local demo mode.');
  if (!authConfigured) {
    const error = new Error('The Cognito resource identifiers are missing');
    error.name = 'AuthNotConfigured';
    throw error;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const demoStarting = useRef(false);
  const currentUser = useRef(user);
  useEffect(() => { currentUser.current = user; }, [user]);
  const [fileCleanupFailure, setFileCleanupFailure] = useState<PrivateFileCleanupFailure>();
  const fileCleanupFailureRef = useRef<PrivateFileCleanupFailure | undefined>(undefined);
  const packagingCleanupRetries = useRef<Set<PackagingCleanupRetry> | null>(null);
  if (packagingCleanupRetries.current === null) packagingCleanupRetries.current = new Set();
  const packagingCleanupRetrying = useRef(false);
  const [packagingCleanupFailed, setPackagingCleanupFailed] = useState(false);
  const reportPackagingCleanupFailure = useCallback((retry: PackagingCleanupRetry) => {
    packagingCleanupRetries.current!.add(retry);
    setPackagingCleanupFailed(true);
  }, []);
  const publishFileCleanupFailure = useCallback((failure: PrivateFileCleanupFailure | undefined) => {
    fileCleanupFailureRef.current = failure;
    setFileCleanupFailure(failure);
  }, []);

  const cleanPrivateCache = useCallback(() => {
    const skinPhotosCleared = deleteAllCheckInPhotos();
    const packagingPhotosCleared = deleteAllPackagingPhotos();
    const failure = privateFileCleanupFailure(skinPhotosCleared && packagingPhotosCleared, deleteAllGeneratedPdfs());
    publishFileCleanupFailure(failure);
    if (failure) throw new PrivateFileCleanupError();
  }, [publishFileCleanupFailure]);

  const cleanupAfterSessionLoss = useCallback(() => {
    setUser(null);
    try { cleanPrivateCache(); } catch { /* The root boundary exposes cleanup failure and retry. */ }
  }, [cleanPrivateCache]);

  const refreshUser = useCallback(async () => {
    if (syntheticDemoEnabled) {
      try {
        const restored = await restoreDemoSession();
        setUser(restored);
        return restored;
      } catch {
        cleanupAfterSessionLoss();
        return null;
      } finally { setLoading(false); }
    }
    if (!authConfigured) {
      cleanupAfterSessionLoss();
      setLoading(false);
      return null;
    }

    try {
      const current = await getCurrentUser();
      const next = { userId: current.userId, username: current.username };
      setUser(next);
      return next;
    } catch {
      cleanupAfterSessionLoss();
      return null;
    } finally {
      setLoading(false);
    }
  }, [cleanupAfterSessionLoss]);

  useEffect(() => {
    if (!deleteAllGeneratedPdfs()) {
      publishFileCleanupFailure({ photos: fileCleanupFailureRef.current?.photos ?? false, pdfs: true });
    }
    const restore = syntheticDemoEnabled ? restoreDemoSession() : authConfigured ? getCurrentUser() : Promise.reject(new Error('AuthNotConfigured'));
    void restore
      .then((current) => setUser(current ? { userId: current.userId, username: current.username } : null))
      .catch(cleanupAfterSessionLoss)
      .finally(() => setLoading(false));
  }, [cleanupAfterSessionLoss, publishFileCleanupFailure]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: authConfigured && !syntheticDemoEnabled,
    syntheticDemo: syntheticDemoEnabled,
    async startSyntheticDemo(scenario) {
      if (!syntheticDemoEnabled || loading || user || currentUser.current || demoStarting.current) throw new Error('Sign out before starting a fresh synthetic demo.');
      demoStarting.current = true;
      try {
        cleanPrivateCache();
        const session = await prepareDemoSession(scenario, randomUUID());
        currentUser.current = session;
        setUser(session);
      } finally { demoStarting.current = false; }
    },
    loading,
    user,
    privateFileCleanupError: fileCleanupFailure || packagingCleanupFailed ? privateFileCleanupMessage : undefined,
    reportPackagingCleanupFailure,
    retryPrivateFileCleanup() {
      if (packagingCleanupRetrying.current) return;
      const failure = fileCleanupFailureRef.current;
      const skinPhotosCleared = !failure?.photos || deleteAllCheckInPhotos();
      const packagingPhotosCleared = !failure?.photos || deleteAllPackagingPhotos();
      const photosCleared = skinPhotosCleared && packagingPhotosCleared;
      const pdfsCleared = !failure?.pdfs || deleteAllGeneratedPdfs();
      publishFileCleanupFailure(privateFileCleanupFailure(photosCleared, pdfsCleared));
      const pending = packagingCleanupRetries.current!;
      if (!pending.size) { setPackagingCleanupFailed(false); return; }
      packagingCleanupRetrying.current = true;
      // Retry abandoned-editor capabilities only; do not purge other saved packaging photos.
      void (async () => {
        for (const cleanup of pending) {
          try { if (await cleanup()) pending.delete(cleanup); }
          catch { /* Keep the original owner's capability for the next explicit retry. */ }
        }
        setPackagingCleanupFailed(pending.size > 0);
      })().finally(() => { packagingCleanupRetrying.current = false; });
    },
    reportPdfCleanupFailure() {
      invalidatePdfExports();
      publishFileCleanupFailure({ photos: fileCleanupFailureRef.current?.photos ?? false, pdfs: true });
    },
    refreshUser,
    async createAccount(email, password) {
      ensureConfigured();
      if (!user) cleanPrivateCache();
      const result = await signUp({
        username: email.trim().toLowerCase(),
        password,
        options: { userAttributes: { email: email.trim().toLowerCase() } },
      });
      if (result.isSignUpComplete) {
        await refreshUser();
        return 'signed-in';
      }
      return 'confirm-sign-up';
    },
    async verifyAccount(email, code) {
      ensureConfigured();
      await confirmSignUp({ username: email.trim().toLowerCase(), confirmationCode: code.trim() });
    },
    async signInWithPassword(email, password) {
      ensureConfigured();
      if (!user) cleanPrivateCache();
      const result = await signIn({ username: email.trim().toLowerCase(), password });
      if (result.isSignedIn) {
        await refreshUser();
        return 'signed-in';
      }
      if (result.nextStep.signInStep === 'CONFIRM_SIGN_UP') return 'confirm-sign-up';
      if (result.nextStep.signInStep === 'RESET_PASSWORD') return 'reset-password';
      throw new Error('UnsupportedSignInStep');
    },
    async requestPasswordReset(email) {
      ensureConfigured();
      await resetPassword({ username: email.trim().toLowerCase() });
    },
    async finishPasswordReset(email, code, password) {
      ensureConfigured();
      await confirmResetPassword({
        username: email.trim().toLowerCase(),
        confirmationCode: code.trim(),
        newPassword: password,
      });
    },
    async signOutUser() {
      if (syntheticDemoEnabled) {
        cleanPrivateCache();
        await clearDemoSession();
        currentUser.current = null;
        setUser(null);
        return;
      }
      ensureConfigured();
      cleanPrivateCache();
      try {
        await signOut();
      } catch (error) {
        // Refresh the still-current identity; missing-file references remain recorded.
        await refreshUser();
        throw error;
      }
      cleanupAfterSessionLoss();
    },
  }), [cleanPrivateCache, cleanupAfterSessionLoss, fileCleanupFailure, loading, packagingCleanupFailed, publishFileCleanupFailure, refreshUser, reportPackagingCleanupFailure, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
