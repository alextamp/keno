import { create } from 'zustand';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification as firebaseSendVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { getTranslations } from '@/core/i18n';
import { UserEntity } from '../../domain/entities/user.entity';
import { notificationsRepository } from '@/features/notifications/notifications.repository';
import { getExpoPushToken } from '@/core/utils/eventReminders';
import { getLevel } from '@/core/constants/gamification';
import { sounds } from '@/core/utils/sounds';

interface AuthState {
  user: UserEntity | null;
  isLoading: boolean;
  isEmailVerified: boolean;
  error: string | null;
  initializeAuth: () => () => void;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  signUp: (params: { name: string; email: string; password: string; universityName: string; department: string }) => Promise<boolean>;
  sendEmailVerification: () => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  reloadAndCheckVerification: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserEntity, 'bio' | 'avatarColor' | 'name' | 'photoUri' | 'interests'>>) => Promise<void>;
  completeOnboarding: (params: { interests: string[]; bio: string; avatarColor: string }) => Promise<void>;
  addJoinedEvent: (eventId: string) => void;
  removeJoinedEvent: (eventId: string) => void;
  followUser: (targetUid: string, targetName: string, targetAvatarColor?: string) => Promise<void>;
  unfollowUser: (targetUid: string) => Promise<void>;
  saveEvent: (eventId: string) => Promise<void>;
  unsaveEvent: (eventId: string) => Promise<void>;
  awardXP: (amount: number) => Promise<void>;
  updateStreak: () => Promise<void>;
  clearError: () => void;
}

function mapFirebaseError(code: string): string {
  const t = getTranslations();
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return t.authErrWrongCredentials;
    case 'auth/email-already-in-use':
      return t.authErrEmailInUse;
    case 'auth/weak-password':
      return t.authErrWeakPassword;
    case 'auth/invalid-email':
      return t.authErrInvalidEmail;
    case 'auth/too-many-requests':
      return t.authErrTooManyRequests;
    case 'auth/network-request-failed':
      return t.authErrNetwork;
    default:
      return t.authErrGeneric;
  }
}

async function loadUserFromFirestore(uid: string): Promise<UserEntity | null> {
  try {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    id: uid,
    name: d.name,
    universityEmail: d.universityEmail,
    universityName: d.universityName,
    department: d.department,
    joinedEvents: d.joinedEvents ?? [],
    createdEvents: d.createdEvents ?? [],
    following: d.following ?? [],
    followers: d.followers ?? [],
    bio: d.bio,
    avatarColor: d.avatarColor,
    photoUri: d.photoUri,
    interests: d.interests ?? [],
    onboardingDone: d.onboardingDone ?? false,
    savedEventIds: d.savedEventIds ?? [],
    xp: d.xp ?? 0,
    currentStreak: d.currentStreak ?? 0,
    longestStreak: d.longestStreak ?? 0,
    lastAttendedDate: d.lastAttendedDate,
  };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isEmailVerified: false,
  error: null,

  initializeAuth: () => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        set({ user: null, isLoading: false, isEmailVerified: false });
        return;
      }
      if (!fbUser.emailVerified) {
        set({ user: null, isLoading: false, isEmailVerified: false });
        return;
      }
      try {
        await fbUser.getIdToken();
        const user = await loadUserFromFirestore(fbUser.uid);
        set({ user, isLoading: false, isEmailVerified: fbUser.emailVerified });
      } catch {
        set({ isLoading: false });
      }
      // Save Expo push token for FCM (best-effort, non-blocking)
      getExpoPushToken().then((token) => {
        if (token) updateDoc(doc(db, 'users', fbUser.uid), { pushToken: token }).catch(() => {});
      }).catch(() => {});
    });
    return unsubscribe;
  },

  signIn: async ({ email, password }) => {
    set({ isLoading: true, error: null });
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged handles setting user + isLoading: false
    } catch (e: any) {
      set({ error: mapFirebaseError(e.code), isLoading: false });
    }
  },

  signUp: async ({ name, email, password, universityName, department }) => {
    set({ isLoading: true, error: null });
    try {
      const { user: fbUser } = await createUserWithEmailAndPassword(auth, email, password);
      await firebaseUpdateProfile(fbUser, { displayName: name });
      await firebaseSendVerification(fbUser);
      await setDoc(doc(db, 'users', fbUser.uid), {
        name,
        nameLower: name.toLowerCase(),
        universityEmail: email,
        universityName,
        department,
        joinedEvents: [],
        createdEvents: [],
        following: [],
        followers: [],
        bio: '',
        avatarColor: '#C94D0A',
        interests: [],
        onboardingDone: false,
      });
      set({ isLoading: false, isEmailVerified: false });
      return true;
    } catch (e: any) {
      set({ error: mapFirebaseError(e.code), isLoading: false });
      return false;
    }
  },

  sendEmailVerification: async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return false;
    try {
      await firebaseSendVerification(fbUser);
      return true;
    } catch {
      // e.g. rate-limited by Firebase — caller decides how to surface this
      return false;
    }
  },

  sendPasswordReset: async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  },

  reloadAndCheckVerification: async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    await reload(fbUser);
    if (fbUser.emailVerified) {
      const user = await loadUserFromFirestore(fbUser.uid);
      set({ user, isEmailVerified: true });
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
    set({ user: null, isEmailVerified: false });
  },

  updateProfile: async (patch) => {
    const { user } = get();
    if (!user) return;
    const firestorePatch: Record<string, unknown> = {};
    if (patch.name !== undefined) firestorePatch.name = patch.name;
    if (patch.bio !== undefined) firestorePatch.bio = patch.bio;
    if (patch.avatarColor !== undefined) firestorePatch.avatarColor = patch.avatarColor;
    if (patch.photoUri !== undefined) firestorePatch.photoUri = patch.photoUri;
    if (patch.interests !== undefined) firestorePatch.interests = patch.interests;
    await updateDoc(doc(db, 'users', user.id), firestorePatch);
    set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user }));
  },

  addJoinedEvent: (eventId) =>
    set((s) => ({
      user: s.user ? { ...s.user, joinedEvents: [...s.user.joinedEvents, eventId] } : s.user,
    })),

  removeJoinedEvent: (eventId) =>
    set((s) => ({
      user: s.user
        ? { ...s.user, joinedEvents: s.user.joinedEvents.filter((id) => id !== eventId) }
        : s.user,
    })),

  followUser: async (targetUid, targetName, targetAvatarColor) => {
    const { user } = get();
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id), { following: arrayUnion(targetUid) });
    await updateDoc(doc(db, 'users', targetUid), { followers: arrayUnion(user.id) });
    notificationsRepository.create({
      toUid: targetUid,
      fromUid: user.id,
      fromName: user.name,
      fromAvatarColor: user.avatarColor,
      type: 'follow',
    }).catch(() => {});
    set((s) => ({
      user: s.user ? { ...s.user, following: [...s.user.following, targetUid] } : s.user,
    }));
  },

  unfollowUser: async (targetUid) => {
    const { user } = get();
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id), { following: arrayRemove(targetUid) });
    await updateDoc(doc(db, 'users', targetUid), { followers: arrayRemove(user.id) });
    set((s) => ({
      user: s.user
        ? { ...s.user, following: s.user.following.filter((id) => id !== targetUid) }
        : s.user,
    }));
  },

  saveEvent: async (eventId) => {
    const { user } = get();
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id), { savedEventIds: arrayUnion(eventId) });
    set((s) => ({
      user: s.user ? { ...s.user, savedEventIds: [...(s.user.savedEventIds ?? []), eventId] } : s.user,
    }));
  },

  unsaveEvent: async (eventId) => {
    const { user } = get();
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id), { savedEventIds: arrayRemove(eventId) });
    set((s) => ({
      user: s.user ? { ...s.user, savedEventIds: (s.user.savedEventIds ?? []).filter((id) => id !== eventId) } : s.user,
    }));
  },

  completeOnboarding: async ({ interests, bio, avatarColor }) => {
    const { user } = get();
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id), {
      interests,
      bio,
      avatarColor,
      onboardingDone: true,
    });
    set((s) => ({
      user: s.user ? { ...s.user, interests, bio, avatarColor, onboardingDone: true } : s.user,
    }));
  },

  awardXP: async (amount) => {
    const { user } = get();
    if (!user) return;
    const previousLevel = getLevel(user.xp ?? 0).name;
    // Use Firestore increment to avoid race conditions with concurrent XP updates
    await updateDoc(doc(db, 'users', user.id), { xp: increment(amount) });
    const newXp = (user.xp ?? 0) + amount;
    set((s) => ({ user: s.user ? { ...s.user, xp: newXp } : s.user }));
    if (getLevel(newXp).name !== previousLevel) sounds.play('levelUp');
  },

  updateStreak: async () => {
    const { user } = get();
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const last = user.lastAttendedDate;
    if (last === today) return;
    let newStreak = 1;
    if (last) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (last === yesterday) newStreak = (user.currentStreak ?? 0) + 1;
    }
    const newLongest = Math.max(newStreak, user.longestStreak ?? 0);
    const bonusXP = newStreak === 3 ? 15 : newStreak === 7 ? 30 : 0;
    await updateDoc(doc(db, 'users', user.id), {
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastAttendedDate: today,
      ...(bonusXP > 0 ? { xp: increment(bonusXP) } : {}),
    });
    set((s) => ({
      user: s.user ? {
        ...s.user,
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastAttendedDate: today,
        ...(bonusXP > 0 ? { xp: (s.user.xp ?? 0) + bonusXP } : {}),
      } : s.user,
    }));
  },

  clearError: () => set({ error: null }),
}));
