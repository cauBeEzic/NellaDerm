import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';

import { useAuth } from '@/contexts/auth-context';
import {
  createDependentProfile,
  demoCareProfile,
  profilesFromOnboarding,
  resolveCareProfile,
  isHelpPreference,
  selectActiveProfile,
  type CareProfile,
  type DependentProfileInput,
  type HelpPreference,
} from '@/lib/care-profile';
import { loadCompletedOnboarding } from '@/lib/onboarding-storage';
import { loadActiveProfileId, loadProfiles, saveActiveProfileId, saveProfiles } from '@/lib/profile-storage';
import { applyProfileDetails, type ProfileDetailsEdit } from '@/lib/profile-details';

export class ProfileUnavailableError extends Error {
  constructor() {
    super('Profiles are unavailable. Reload before making changes.');
    this.name = 'ProfileUnavailableError';
  }
}

type ProfileContextValue = {
  profiles: CareProfile[];
  activeProfile: CareProfile;
  loading: boolean;
  error?: string;
  readScope?: string;
  retry: () => void;
  switchProfile: (profileId: string) => Promise<void>;
  addDependent: (input: DependentProfileInput) => Promise<CareProfile>;
  saveHelpPreference: (profileId: string, preference: HelpPreference) => Promise<void>;
  saveTrackingPreferences: (profileId: string, preferences: Pick<CareProfile, 'areas' | 'symptoms'>) => Promise<void>;
  savePersonalDetails: (profileId: string, edit: ProfileDetailsEdit) => Promise<CareProfile>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);
// A private-file boundary can unmount profiles while an issued native write is still pending.
let profileMutationQueue: Promise<void> = Promise.resolve();

function uniqueSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ProfileProvider({ children }: PropsWithChildren) {
  const { loading: authLoading, user } = useAuth();
  const [profiles, setProfiles] = useState<CareProfile[]>([demoCareProfile]);
  const [activeProfile, setActiveProfile] = useState<CareProfile>(demoCareProfile);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [readScope, setReadScope] = useState<string>();
  const scopeRef = useRef<string | undefined>(undefined);
  const profilesRef = useRef<CareProfile[]>([demoCareProfile]);
  const activeProfileRef = useRef<CareProfile>(demoCareProfile);
  const readyRef = useRef(false);
  const ownerRef = useRef<string | null>(null);
  const generationRef = useRef(0);

  const publishProfiles = useCallback((next: CareProfile[]) => {
    profilesRef.current = next;
    setProfiles(next);
  }, []);

  const publishActive = useCallback((next: CareProfile) => {
    activeProfileRef.current = next;
    setActiveProfile(next);
  }, []);

  const publishScope = useCallback((scope: string | undefined) => {
    scopeRef.current = scope;
    setReadScope(scope);
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    readyRef.current = false;
    ownerRef.current = null;
    scopeRef.current = undefined;
    if (authLoading) return;
    let active = true;
    void (async () => {
      if (!user) {
        if (active) {
          publishProfiles([demoCareProfile]);
          publishActive(demoCareProfile);
          setLoadedUserId(null);
          readyRef.current = true;
          ownerRef.current = null;
          setError(undefined);
          setLoading(false);
        }
        return;
      }

      if (active) {
        setLoading(true);
        readyRef.current = false;
        ownerRef.current = null;
        setError(undefined);
      }
      try {
        await profileMutationQueue;
        if (!active) return;
        const onboarding = await loadCompletedOnboarding(user.userId);
        let storedProfiles = await loadProfiles(user.userId);
        if (!active) return;
        if (!storedProfiles) {
          storedProfiles = profilesFromOnboarding(user.username, onboarding);
          await saveProfiles(user.userId, storedProfiles);
        }
        const requestedId = await loadActiveProfileId(user.userId);
        if (!active) return;
        const fallbackId = resolveCareProfile(user.username, onboarding).id;
        const selected = selectActiveProfile(storedProfiles, requestedId, fallbackId);
        if (!selected) throw new Error('No profile is available.');
        if (requestedId !== selected.id) await saveActiveProfileId(user.userId, selected.id);
        if (active) {
          publishProfiles(storedProfiles);
          publishActive(selected);
          readyRef.current = true;
          ownerRef.current = user.userId;
          publishScope(randomUUID());
        }
      } catch {
        if (active) {
          publishProfiles([]);
          publishActive(resolveCareProfile(user.username));
          readyRef.current = false;
          ownerRef.current = null;
          setError('Your profiles could not be opened on this device. Reload before viewing or saving health records.');
        }
      } finally {
        if (active) {
          setLoadedUserId(user.userId);
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
      generationRef.current += 1;
      readyRef.current = false;
      ownerRef.current = null;
      scopeRef.current = undefined;
    };
  }, [authLoading, loadAttempt, publishActive, publishProfiles, publishScope, user]);

  const queueMutation = useCallback(<Result,>(operation: (userId: string, assertOwner: () => void) => Promise<Result>) => {
    if (!user || !readyRef.current || ownerRef.current !== user.userId) throw new ProfileUnavailableError();
    const userId = user.userId;
    const expectedGeneration = generationRef.current;
    const assertOwner = () => {
      if (!readyRef.current || ownerRef.current !== userId || generationRef.current !== expectedGeneration) {
        throw new ProfileUnavailableError();
      }
    };
    const result = profileMutationQueue.then(() => {
      assertOwner();
      return operation(userId, assertOwner);
    });
    profileMutationQueue = result.then(() => undefined, () => undefined);
    return result;
  }, [user]);

  const transitioning = authLoading || loadedUserId !== (user?.userId ?? null);
  const visibleProfiles = useMemo(() => transitioning ? [] : profiles, [profiles, transitioning]);
  const visibleActiveProfile = transitioning ? resolveCareProfile(user?.username) : activeProfile;
  const visibleScope = user && !visibleActiveProfile.isDemo && !loading && !transitioning && !error ? readScope : undefined;

  const value = useMemo<ProfileContextValue>(() => ({
    profiles: visibleProfiles,
    activeProfile: visibleActiveProfile,
    loading: loading || transitioning,
    error,
    readScope: visibleScope,
    retry() {
      publishScope(undefined);
      setLoading(true);
      readyRef.current = false;
      ownerRef.current = null;
      setError(undefined);
      setLoadAttempt((attempt) => attempt + 1);
    },
    async switchProfile(profileId) {
      publishScope(undefined);
      const expectedGeneration = generationRef.current;
      const pending = queueMutation(async (userId, assertOwner) => {
        const next = profilesRef.current.find((profile) => profile.id === profileId);
        if (!next || next.isDemo) throw new ProfileUnavailableError();
        await saveActiveProfileId(userId, next.id);
        assertOwner();
        publishActive(next);
        publishScope(randomUUID());
      });
      setLoading(true);
      try {
        await pending;
        if (generationRef.current === expectedGeneration) setError(undefined);
      } catch (caught) {
        if (generationRef.current === expectedGeneration) {
          readyRef.current = false;
          ownerRef.current = null;
          setError('The active profile could not be changed. Your previous profile is still selected.');
        }
        throw caught;
      } finally {
        if (generationRef.current === expectedGeneration) setLoading(false);
      }
    },
    async saveHelpPreference(profileId, preference) {
      if (!isHelpPreference(preference)) throw new ProfileUnavailableError();
      await queueMutation(async (userId, assertOwner) => {
        const current = profilesRef.current.find((profile) => profile.id === profileId);
        if (!current || current.isDemo || activeProfileRef.current.id !== profileId) throw new ProfileUnavailableError();
        if (current.helpPreference === preference) return;
        const next = { ...current, helpPreference: preference };
        const nextProfiles = profilesRef.current.map((profile) => profile.id === profileId ? next : profile);
        try {
          await saveProfiles(userId, nextProfiles);
        } catch {
          assertOwner();
          readyRef.current = false;
          ownerRef.current = null;
          setError('Your care goal could not be saved. Reload profiles before trying again.');
          throw new ProfileUnavailableError();
        }
        assertOwner();
        if (activeProfileRef.current.id !== profileId) throw new ProfileUnavailableError();
        publishProfiles(nextProfiles);
        publishActive(next);
      });
    },
    async saveTrackingPreferences(profileId, preferences) {
      const areas = [...preferences.areas];
      const symptoms = [...preferences.symptoms];
      await queueMutation(async (userId, assertOwner) => {
        const current = profilesRef.current.find((profile) => profile.id === profileId);
        if (!current || current.isDemo || activeProfileRef.current.id !== profileId) throw new ProfileUnavailableError();
        if (current.areas.length === areas.length && current.areas.every((value, index) => value === areas[index])
          && current.symptoms.length === symptoms.length && current.symptoms.every((value, index) => value === symptoms[index])) return;
        const next = { ...current, areas, symptoms };
        const nextProfiles = profilesRef.current.map((profile) => profile.id === profileId ? next : profile);
        try {
          await saveProfiles(userId, nextProfiles);
        } catch {
          assertOwner();
          readyRef.current = false;
          ownerRef.current = null;
          setError('Your tracking preferences could not be saved. Reload profiles before trying again.');
          throw new ProfileUnavailableError();
        }
        assertOwner();
        if (activeProfileRef.current.id !== profileId) throw new ProfileUnavailableError();
        publishProfiles(nextProfiles);
        publishActive(next);
      });
    },
    async savePersonalDetails(profileId, edit) {
      const expectedScope = visibleScope;
      const assertScope = () => {
        if (!expectedScope || scopeRef.current !== expectedScope || activeProfileRef.current.id !== profileId) throw new ProfileUnavailableError();
      };
      assertScope();
      const requested: ProfileDetailsEdit = { name: edit.name, relationship: edit.relationship, ageRange: edit.ageRange };
      return queueMutation(async (userId, assertOwner) => {
        assertScope();
        const current = profilesRef.current.find((profile) => profile.id === profileId);
        if (!current || current.isDemo) throw new ProfileUnavailableError();
        const next = applyProfileDetails(current, requested);
        if (next === current) return current;
        const nextProfiles = profilesRef.current.map((profile) => profile.id === profileId ? next : profile);
        try {
          await saveProfiles(userId, nextProfiles);
        } catch {
          assertOwner();
          readyRef.current = false;
          ownerRef.current = null;
          publishScope(undefined);
          setError('Your profile-detail change could not be confirmed. Reload profiles before trying again.');
          throw new ProfileUnavailableError();
        }
        assertOwner();
        // Keep a committed original-account update for the next queued switch/edit, even if its editor left.
        publishProfiles(nextProfiles);
        if (activeProfileRef.current.id === profileId) publishActive(next);
        assertScope();
        return next;
      });
    },
    async addDependent(input) {
      publishScope(undefined);
      const expectedGeneration = generationRef.current;
      const pending = queueMutation(async (userId, assertOwner) => {
        const next = createDependentProfile(input, profilesRef.current.map((profile) => profile.id), uniqueSuffix());
        const nextProfiles = [...profilesRef.current, next];
        await saveProfiles(userId, nextProfiles);
        assertOwner();
        await saveActiveProfileId(userId, next.id);
        assertOwner();
        publishProfiles(nextProfiles);
        publishActive(next);
        publishScope(randomUUID());
        return next;
      });
      setLoading(true);
      try {
        const created = await pending;
        if (generationRef.current === expectedGeneration) setError(undefined);
        return created;
      } catch (caught) {
        if (generationRef.current === expectedGeneration) {
          readyRef.current = false;
          ownerRef.current = null;
          setError('The dependent profile could not be finished. Reload profiles before trying again so a partial device save is not duplicated.');
        }
        throw caught;
      } finally {
        if (generationRef.current === expectedGeneration) setLoading(false);
      }
    },
  }), [error, loading, publishActive, publishProfiles, publishScope, queueMutation, transitioning, visibleActiveProfile, visibleProfiles, visibleScope]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfiles() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error('useProfiles must be used inside ProfileProvider');
  return value;
}
