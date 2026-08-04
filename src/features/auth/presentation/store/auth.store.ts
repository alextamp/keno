import { create } from 'zustand';
import * as Sentry from '@sentry/react-native';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification as firebaseSendVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
  verifyBeforeUpdateEmail,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, increment, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth, db } from '@/lib/firebase';
import { getTranslations } from '@/core/i18n';
import { UserEntity } from '../../domain/entities/user.entity';
import { notificationsRepository } from '@/features/notifications/notifications.repository';
import { getExpoPushToken } from '@/core/utils/eventReminders';
import { getLevel, calculateReliabilityScore } from '@/core/constants/gamification';
import { MAX_STREAK_FREEZE_TOKENS, WEEKLY_QUESTS } from '@/core/constants/quests';
import { getISOWeekId, getSemesterId, MAX_STREAK_PAUSES_PER_SEMESTER } from '@/core/utils/weekId';
import { sounds } from '@/core/utils/sounds';
import { uploadVerificationPhoto } from '@/core/utils/uploadImage';
import { analytics } from '@/core/utils/analytics';

// TEMPORARILY back on Firebase's own default verification email —
// functions/src/index.ts's branded Resend version 403s for every real
// recipient until a custom domain is verified in the Resend dashboard (the
// onboarding@resend.dev sandbox sender can only deliver to the Resend
// account's own address). Re-enable the httpsCallable('sendVerificationEmail')
// path once that's done.
//
// Deliberately lets failures throw instead of swallowing them (the previous
// version's fallback was wrapped in .catch(() => {}), so if Firebase's send
// also failed — rate limit, network blip — the whole thing silently
// resolved as if an email went out, with nothing telling the user or
// signup flow otherwise). Both call sites below (signUp, sendEmailVerification)
// already have proper error handling for a thrown failure — sendEmailVerification
// returns false and the UI shows verifyResendError — so surfacing the error
// here just lets that existing path actually do its job.
async function sendVerificationEmail(fbUser: User): Promise<void> {
  await firebaseSendVerification(fbUser);
}

interface AuthState {
  user: UserEntity | null;
  // Only true until the very first onAuthStateChanged callback resolves on
  // cold boot — this is what's allowed to block the whole app behind the
  // splash screen. `isLoading` below is action-level (sign-in/up button
  // spinners) and must never gate the root layout, or a hung network call
  // freezes the entire app instead of just the button that triggered it.
  isInitializing: boolean;
  isLoading: boolean;
  isEmailVerified: boolean;
  error: string | null;
  initializeAuth: () => () => void;
  signIn: (params: { email: string; password: string }) => Promise<void>;
  signUp: (params: { name: string; email: string; password: string; universityName?: string; department?: string; age?: number; idPhotoUri?: string }) => Promise<boolean>;
  sendEmailVerification: () => Promise<boolean>;
  sendPasswordReset: (email: string) => Promise<void>;
  reloadAndCheckVerification: () => Promise<void>;
  /** Escape hatch for signed-up-but-never-verified users whose university mail
   * server never delivers Firebase's verification email at all — switches
   * them onto the same personal-email + admin-reviewed-ID-photo path signup
   * already offers, without needing a brand new account. */
  switchToFallbackVerification: (newEmail: string, idPhotoUri: string) => Promise<boolean>;
  /** Lets a user whose ID photo was rejected submit a new one — otherwise
   * "rejected" was a dead end with only a sign-out button. */
  resubmitIdVerification: (idPhotoUri: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserEntity, 'bio' | 'avatarColor' | 'name' | 'photoUri' | 'interests' | 'profileVisibility' | 'notificationPrefs'>>) => Promise<void>;
  completeOnboarding: (params: { interests: string[]; bio: string; avatarColor: string; photoUri?: string }) => Promise<void>;
  addJoinedEvent: (eventId: string) => void;
  removeJoinedEvent: (eventId: string) => void;
  followUser: (targetUid: string, targetName: string, targetAvatarColor?: string) => Promise<void>;
  unfollowUser: (targetUid: string) => Promise<void>;
  blockUser: (targetUid: string, reason: string) => Promise<void>;
  unblockUser: (targetUid: string) => Promise<void>;
  saveEvent: (eventId: string) => Promise<void>;
  unsaveEvent: (eventId: string) => Promise<void>;
  awardXP: (amount: number) => Promise<void>;
  updateStreak: () => Promise<void>;
  /** Returns false (no-op) if there's nothing to protect this week or the
   *  semester's pause cap is already used up — the caller shows the right
   *  disabled state instead of a silent failure. */
  pauseStreak: () => Promise<boolean>;
  updateReliabilityScore: () => Promise<void>;
  incrementQuestProgress: (questId: string, amount?: number) => Promise<void>;
  claimChallenge: (challengeId: string, xp: number) => Promise<void>;
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

// Campus wifi can silently drop a request instead of erroring it — without a
// timeout, an awaited Firebase call just never settles, and since `isLoading`
// used to gate the whole app's root render, that meant the entire app froze
// on the splash logo forever. Race every auth network call against this so a
// hung connection always resolves to a normal, retryable error.
const AUTH_NETWORK_TIMEOUT_MS = 20_000;
// Photo uploads are bigger and legitimately slower on the same flaky
// connections this is meant to protect against — give them more rope than a
// plain auth API call before treating them as hung.
const UPLOAD_TIMEOUT_MS = 60_000;

// `label` identifies which call hung in Sentry — without it, every timeout
// across sign-in/up/resend/upload/etc. would report as one indistinguishable
// event, making it impossible to tell which flow is actually affected.
function withTimeout<T>(promise: Promise<T>, ms = AUTH_NETWORK_TIMEOUT_MS, label?: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => {
        Sentry.captureMessage(`auth: network call timed out after ${ms}ms${label ? ` (${label})` : ''}`, 'warning');
        reject({ code: 'auth/network-request-failed' });
      }, ms),
    ),
  ]);
}

const PENDING_PROFILE_KEY = 'pendingProfile:';

interface PendingProfile {
  name: string;
  email: string;
  universityName?: string;
  department?: string;
  age?: number;
  idPhotoUri?: string;
}

// The Firestore user doc is only written once the email is confirmed, so an
// abandoned or fake signup (wrong/typo'd address that never gets verified)
// never leaves a permanent row in the users collection.
async function ensureUserProfileExists(fbUser: { uid: string; displayName: string | null; email: string | null }): Promise<void> {
  const uid = fbUser.uid;
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  // Try to find pending profile from signup (recovery path if verification lagged out)
  const raw = await AsyncStorage.getItem(`${PENDING_PROFILE_KEY}${uid}`);
  // If the draft was lost (app reinstalled/data cleared between signup and
  // verification), fall back to whatever Firebase Auth itself still has —
  // otherwise this verified account is left permanently profile-less, which
  // nothing else in the app knows how to route anywhere.
  const fallbackDraft: PendingProfile | null = raw
    ? null
    : (fbUser.displayName && fbUser.email ? { name: fbUser.displayName, email: fbUser.email } : null);
  if (!raw && !fallbackDraft) {
    // Genuinely nothing to recover from (no draft, no Auth profile data).
    return;
  }

  try {
    const draft: PendingProfile = raw ? JSON.parse(raw) : fallbackDraft!;
    const profileData: any = {
      name: draft.name,
      nameLower: draft.name.toLowerCase(),
      universityEmail: draft.email,
      joinedEvents: [],
      createdEvents: [],
      following: [],
      followers: [],
      bio: '',
      avatarColor: '#B8482A',
      interests: [],
      onboardingDone: false,
      createdAt: serverTimestamp(),
    };
    // Only include optional fields if they have values (Firestore rejects undefined)
    if (draft.universityName) profileData.universityName = draft.universityName;
    if (draft.department) profileData.department = draft.department;
    if (draft.age) profileData.age = draft.age;

    await setDoc(ref, profileData);
    if (draft.idPhotoUri) {
      try {
        const photoUrl = await withTimeout(uploadVerificationPhoto(uid, draft.idPhotoUri), UPLOAD_TIMEOUT_MS, 'ensureUserProfileExists:uploadIdPhoto');
        // The photo URL is a sensitive document image — it lives in a private
        // subcollection doc (owner + admin read only), never on the public
        // users/{uid} document, since a Storage download URL's token bypasses
        // storage.rules once it's out — anywhere it's readable is anywhere
        // it's viewable.
        await withTimeout(setDoc(doc(db, 'users', uid, 'private', 'verification'), { photoUri: photoUrl }), AUTH_NETWORK_TIMEOUT_MS, 'ensureUserProfileExists:uploadIdPhoto:writePrivateDoc');
        await withTimeout(updateDoc(ref, { idVerificationStatus: 'pending' }), AUTH_NETWORK_TIMEOUT_MS, 'ensureUserProfileExists:setIdStatus');
      } catch {}
    }
    await AsyncStorage.removeItem(`${PENDING_PROFILE_KEY}${uid}`);
  } catch (error) {
    // If profile creation fails (malformed JSON, Firestore error, etc),
    // at least don't leave the pending profile hanging — let onboarding retry
    console.error('Failed to create profile from pending data:', error);
  }
}

async function loadUserFromFirestore(uid: string, attempt = 0): Promise<UserEntity | null> {
  try {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) {
    // Right after sign-up, the profile-creating write can still be in
    // flight when this fires (it's a separate listener racing the signUp
    // call) — retry briefly before concluding the profile is really gone.
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      return loadUserFromFirestore(uid, attempt + 1);
    }
    return null;
  }
  const d = snap.data();
  return {
    id: uid,
    name: d.name,
    universityEmail: d.universityEmail,
    universityName: d.universityName,
    department: d.department,
    age: d.age ?? 0,
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
    idVerificationStatus: d.idVerificationStatus,
    isBetaTester: d.isBetaTester,
    createdAt: d.createdAt?.toDate?.() ?? undefined,
    blockedUserIds: d.blockedUserIds ?? [],
    profileVisibility: d.profileVisibility,
    notificationPrefs: d.notificationPrefs,
    attendanceHistory: d.attendanceHistory ?? {},
    reliabilityScore: d.reliabilityScore ?? 0,
    checkInCount: d.checkInCount ?? 0,
    weeklyQuests: d.weeklyQuests ?? {},
    streakFreezeTokens: d.streakFreezeTokens ?? 0,
    claimedChallengeIds: d.claimedChallengeIds ?? [],
    organiserFeedback: d.organiserFeedback ?? { good: 0, bad: 0 },
    firstSoloAttendanceEventId: d.firstSoloAttendanceEventId,
    emergencyContactName: d.emergencyContactName,
    emergencyContactPhone: d.emergencyContactPhone,
    streakPauses: d.streakPauses,
  };
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isInitializing: true,
  isLoading: false,
  isEmailVerified: false,
  error: null,

  initializeAuth: () => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        set({ user: null, isInitializing: false, isEmailVerified: false });
        return;
      }
      if (!fbUser.emailVerified) {
        set({ user: null, isInitializing: false, isEmailVerified: false });
        return;
      }
      try {
        await fbUser.getIdToken();
        await ensureUserProfileExists(fbUser);
        const user = await loadUserFromFirestore(fbUser.uid);
        set({ user, isInitializing: false, isEmailVerified: fbUser.emailVerified });
        // Fires once per JS environment lifetime (onAuthStateChanged resolves
        // once on launch, then again only on actual sign-in/out) — the right
        // spot for "app opened" toward D1/D7/D30 retention, without needing
        // a separate listener for app foreground/background.
        // isTestAccount tags every dev-build session (your own device while
        // building, any simulator/emulator, future ambassadors testing
        // builds) so the "Internal and test accounts" filter in PostHog
        // catches all of them without needing to hardcode a specific uid.
        analytics.identify(fbUser.uid, { universityName: user?.universityName, isTestAccount: __DEV__ });
        analytics.track('app_opened');
      } catch {
        set({ isInitializing: false });
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
      await withTimeout(signInWithEmailAndPassword(auth, email, password), AUTH_NETWORK_TIMEOUT_MS, 'signIn');
      // onAuthStateChanged updates user/isEmailVerified, but don't rely on it
      // alone for isLoading — set it directly so the button spinner can never
      // outlive this call.
      set({ isLoading: false });
    } catch (e: any) {
      set({ error: mapFirebaseError(e.code), isLoading: false });
    }
  },

  signUp: async ({ name, email, password, universityName, department, age, idPhotoUri }) => {
    set({ isLoading: true, error: null });
    try {
      const { user: fbUser } = await withTimeout(createUserWithEmailAndPassword(auth, email, password), AUTH_NETWORK_TIMEOUT_MS, 'signUp:createUser');
      await withTimeout(firebaseUpdateProfile(fbUser, { displayName: name }), AUTH_NETWORK_TIMEOUT_MS, 'signUp:updateProfile');
      await withTimeout(sendVerificationEmail(fbUser), AUTH_NETWORK_TIMEOUT_MS, 'signUp:sendVerification');
      // The Firestore profile doc isn't created yet — only once the email is
      // verified (see ensureUserProfileExists) — so a fake/typo'd address
      // that never gets confirmed doesn't leave a permanent row behind.
      const draft: PendingProfile = { name, email, universityName, department, age, idPhotoUri };
      await AsyncStorage.setItem(`${PENDING_PROFILE_KEY}${fbUser.uid}`, JSON.stringify(draft));
      set({ isLoading: false, isEmailVerified: false });
      analytics.track('sign_up_completed', { universityName, hasIdPhoto: !!idPhotoUri });
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
      await withTimeout(sendVerificationEmail(fbUser), AUTH_NETWORK_TIMEOUT_MS, 'resendVerification');
      return true;
    } catch {
      // e.g. rate-limited by Firebase, or a hung request — caller decides how to surface this
      return false;
    }
  },

  sendPasswordReset: async (email: string) => {
    await withTimeout(sendPasswordResetEmail(auth, email.trim().toLowerCase()), AUTH_NETWORK_TIMEOUT_MS, 'sendPasswordReset');
  },

  switchToFallbackVerification: async (newEmail: string, idPhotoUri: string) => {
    const fbUser = auth.currentUser;
    if (!fbUser) return false;
    set({ error: null });
    try {
      // Sends the verification link to newEmail — fbUser.email only actually
      // changes once that link is clicked, so this stays safe to retry.
      await withTimeout(verifyBeforeUpdateEmail(fbUser, newEmail), AUTH_NETWORK_TIMEOUT_MS, 'switchToFallbackVerification');
      const raw = await AsyncStorage.getItem(`${PENDING_PROFILE_KEY}${fbUser.uid}`);
      const draft: PendingProfile = raw
        ? JSON.parse(raw)
        : { name: fbUser.displayName ?? '', email: newEmail };
      // Domain only (not the address) — enough to see which university mail
      // servers are actually the ones silently dropping this, without
      // logging anyone's personal email.
      const originalDomain = draft.email?.split('@')[1] ?? 'unknown';
      draft.email = newEmail;
      draft.idPhotoUri = idPhotoUri;
      await AsyncStorage.setItem(`${PENDING_PROFILE_KEY}${fbUser.uid}`, JSON.stringify(draft));
      Sentry.captureMessage(`auth: user switched to fallback ID verification (was @${originalDomain})`, 'info');
      return true;
    } catch (e: any) {
      set({ error: mapFirebaseError(e.code) });
      return false;
    }
  },

  resubmitIdVerification: async (idPhotoUri: string) => {
    const { user } = get();
    if (!user) return false;
    try {
      const photoUrl = await withTimeout(uploadVerificationPhoto(user.id, idPhotoUri), UPLOAD_TIMEOUT_MS, 'resubmitIdVerification:upload');
      // See ensureUserProfileExists — the photo goes in the private
      // subcollection doc, never on the public users/{uid} document.
      await withTimeout(setDoc(doc(db, 'users', user.id, 'private', 'verification'), { photoUri: photoUrl }), AUTH_NETWORK_TIMEOUT_MS, 'resubmitIdVerification:writePrivateDoc');
      await withTimeout(updateDoc(doc(db, 'users', user.id), {
        idVerificationStatus: 'pending',
      }), AUTH_NETWORK_TIMEOUT_MS, 'resubmitIdVerification:setStatus');
      set((s) => (s.user ? { user: { ...s.user, idVerificationStatus: 'pending' } } : {}));
      return true;
    } catch {
      return false;
    }
  },

  reloadAndCheckVerification: async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;
    try {
      await withTimeout(reload(fbUser), AUTH_NETWORK_TIMEOUT_MS, 'reloadAndCheckVerification');
    } catch {
      // A hung/failed reload just means "still not verified" from the
      // caller's perspective — don't leave its loading state stuck on this.
      return;
    }
    if (fbUser.emailVerified) {
      await ensureUserProfileExists(fbUser);
      const user = await loadUserFromFirestore(fbUser.uid);
      set({ user, isEmailVerified: true });
    }
  },

  signOut: async () => {
    try {
      await withTimeout(firebaseSignOut(auth), AUTH_NETWORK_TIMEOUT_MS, 'signOut');
    } catch {
      // Even if the network round-trip hangs/fails, still drop local state —
      // "Sign out" must never be a button that can get stuck.
    }
    set({ user: null, isEmailVerified: false });
    analytics.reset();
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
    if (patch.profileVisibility !== undefined) firestorePatch.profileVisibility = patch.profileVisibility;
    if (patch.notificationPrefs !== undefined) firestorePatch.notificationPrefs = patch.notificationPrefs;
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
    const { user, incrementQuestProgress } = get();
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id), { following: arrayUnion(targetUid) });
    await updateDoc(doc(db, 'users', targetUid), { followers: arrayUnion(user.id) });
    notificationsRepository.create({
      toUid: targetUid,
      fromUid: user.id,
      fromName: user.name,
      fromAvatarColor: user.avatarColor,
      fromPhotoUri: user.photoUri,
      type: 'follow',
    }).catch(() => {});
    set((s) => ({
      user: s.user ? { ...s.user, following: [...s.user.following, targetUid] } : s.user,
    }));
    incrementQuestProgress('follow_people').catch(() => {});
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

  // Blocking hides the target's content everywhere (feed, chat) and severs
  // the follow relationship both ways. It also files a report so the admin
  // is notified of the underlying behavior — required by Apple's UGC
  // guideline 1.2 ("blocking should also notify the developer... and remove
  // it from the user's feed instantly").
  blockUser: async (targetUid, reason) => {
    const { user } = get();
    if (!user || user.id === targetUid) return;
    await updateDoc(doc(db, 'users', user.id), {
      blockedUserIds: arrayUnion(targetUid),
      following: arrayRemove(targetUid),
    });
    await updateDoc(doc(db, 'users', targetUid), { followers: arrayRemove(user.id) }).catch(() => {});
    addDoc(collection(db, 'reports'), {
      reportedUid: targetUid,
      reporterUid: user.id,
      reason: `blocked: ${reason}`,
      createdAt: new Date(),
    }).catch(() => {});
    set((s) => ({
      user: s.user
        ? {
            ...s.user,
            blockedUserIds: [...(s.user.blockedUserIds ?? []), targetUid],
            following: s.user.following.filter((id) => id !== targetUid),
          }
        : s.user,
    }));
  },

  unblockUser: async (targetUid) => {
    const { user } = get();
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id), { blockedUserIds: arrayRemove(targetUid) });
    set((s) => ({
      user: s.user
        ? { ...s.user, blockedUserIds: (s.user.blockedUserIds ?? []).filter((id) => id !== targetUid) }
        : s.user,
    }));
  },

  saveEvent: async (eventId) => {
    const { user, incrementQuestProgress } = get();
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id), { savedEventIds: arrayUnion(eventId) });
    set((s) => ({
      user: s.user ? { ...s.user, savedEventIds: [...(s.user.savedEventIds ?? []), eventId] } : s.user,
    }));
    incrementQuestProgress('save_events').catch(() => {});
  },

  unsaveEvent: async (eventId) => {
    const { user } = get();
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id), { savedEventIds: arrayRemove(eventId) });
    set((s) => ({
      user: s.user ? { ...s.user, savedEventIds: (s.user.savedEventIds ?? []).filter((id) => id !== eventId) } : s.user,
    }));
  },

  completeOnboarding: async ({ interests, bio, avatarColor, photoUri }) => {
    const { user } = get();
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id), {
      interests,
      bio,
      avatarColor,
      onboardingDone: true,
      ...(photoUri ? { photoUri } : {}),
    });
    set((s) => ({
      user: s.user ? { ...s.user, interests, bio, avatarColor, onboardingDone: true, ...(photoUri ? { photoUri } : {}) } : s.user,
    }));
  },

  awardXP: async (amount) => {
    const { user } = get();
    if (!user) return;
    const previousLevel = getLevel(user.xp ?? 0, user.id).name;
    // Use Firestore increment to avoid race conditions with concurrent XP updates
    await updateDoc(doc(db, 'users', user.id), { xp: increment(amount) });
    const newXp = (user.xp ?? 0) + amount;
    set((s) => ({ user: s.user ? { ...s.user, xp: newXp } : s.user }));
    const newLevel = getLevel(newXp, user.id).name;
    if (newLevel !== previousLevel) {
      sounds.play('levelUp');
      // Self-notification: eventTitle carries the level name (same pattern
      // other self-notifs use to pass through a display string).
      notificationsRepository.create({
        toUid: user.id,
        fromUid: user.id,
        fromName: user.name,
        fromAvatarColor: user.avatarColor,
        fromPhotoUri: user.photoUri,
        type: 'level_up',
        eventTitle: newLevel,
      }).catch(() => {});
      // Level-ups bank a streak-freeze token (mockup screen 25), capped so
      // it can't be stockpiled indefinitely.
      const newTokens = Math.min(MAX_STREAK_FREEZE_TOKENS, (user.streakFreezeTokens ?? 0) + 1);
      if (newTokens !== (user.streakFreezeTokens ?? 0)) {
        updateDoc(doc(db, 'users', user.id), { streakFreezeTokens: newTokens }).catch(() => {});
        set((s) => ({ user: s.user ? { ...s.user, streakFreezeTokens: newTokens } : s.user }));
      }
    }
  },

  // Weekly cadence: "N weeks in a row with at least one check-in," not
  // consecutive calendar days. A daily streak is structurally dishonest for
  // an events app — students don't have something to attend every day, so
  // it would just punish people for living a normal life (see the Keno
  // feature-research doc's critique of BeReal/Snapchat-style daily streaks).
  // `lastAttendedDate` keeps its field name for schema stability but now
  // holds an ISO-week id (getISOWeekId) rather than a calendar date.
  updateStreak: async () => {
    const { user } = get();
    if (!user) return;
    const thisWeek = getISOWeekId(new Date());
    const last = user.lastAttendedDate;
    if (last === thisWeek) return;
    const lastWeek = getISOWeekId(new Date(Date.now() - 7 * 86400000));
    let newStreak: number;
    let tokenConsumed = false;
    if (!last) {
      newStreak = 1;
    } else if (last === lastWeek) {
      newStreak = (user.currentStreak ?? 0) + 1;
    } else if ((user.streakFreezeTokens ?? 0) > 0) {
      // Missed a week, but a banked freeze token covers it — the streak
      // continues instead of resetting to 1.
      newStreak = (user.currentStreak ?? 0) + 1;
      tokenConsumed = true;
    } else {
      newStreak = 1;
    }
    const newLongest = Math.max(newStreak, user.longestStreak ?? 0);
    const bonusXP = newStreak === 3 ? 15 : newStreak === 7 ? 30 : 0;
    await updateDoc(doc(db, 'users', user.id), {
      currentStreak: newStreak,
      longestStreak: newLongest,
      lastAttendedDate: thisWeek,
      ...(bonusXP > 0 ? { xp: increment(bonusXP) } : {}),
      ...(tokenConsumed ? { streakFreezeTokens: increment(-1) } : {}),
    });
    set((s) => ({
      user: s.user ? {
        ...s.user,
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastAttendedDate: thisWeek,
        ...(bonusXP > 0 ? { xp: (s.user.xp ?? 0) + bonusXP } : {}),
        ...(tokenConsumed ? { streakFreezeTokens: Math.max(0, (s.user.streakFreezeTokens ?? 0) - 1) } : {}),
      } : s.user,
    }));
  },

  // User-initiated version of the same protection updateStreak's freeze
  // token grants automatically — for a student who already knows this
  // week's exams mean no events, not a reaction to having already missed one.
  pauseStreak: async () => {
    const { user } = get();
    if (!user) return false;
    const thisWeek = getISOWeekId(new Date());
    if (user.lastAttendedDate === thisWeek) return false; // already protected (checked in or paused already)
    const semesterId = getSemesterId(new Date());
    const usedThisSemester = user.streakPauses?.semesterId === semesterId ? user.streakPauses.count : 0;
    if (usedThisSemester >= MAX_STREAK_PAUSES_PER_SEMESTER) return false;
    const newPauses = { semesterId, count: usedThisSemester + 1 };
    await updateDoc(doc(db, 'users', user.id), {
      lastAttendedDate: thisWeek,
      streakPauses: newPauses,
    });
    set((s) => (s.user ? { user: { ...s.user, lastAttendedDate: thisWeek, streakPauses: newPauses } } : {}));
    return true;
  },

  incrementQuestProgress: async (questId, amount = 1) => {
    const { user, awardXP } = get();
    if (!user) return;
    const weekId = getISOWeekId(new Date());
    const existing = user.weeklyQuests?.[questId];
    const prevProgress = existing && existing.weekId === weekId ? existing.progress : 0;
    const newProgress = prevProgress + amount;
    const updated = { progress: newProgress, weekId };
    await updateDoc(doc(db, 'users', user.id), { [`weeklyQuests.${questId}`]: updated });
    set((s) => ({
      user: s.user ? { ...s.user, weeklyQuests: { ...(s.user.weeklyQuests ?? {}), [questId]: updated } } : s.user,
    }));
    // Award the quest's XP exactly once, the moment progress first crosses
    // its target this week — previously this only ever recorded progress
    // and the "+XP" shown on the quest card was never actually granted.
    const quest = WEEKLY_QUESTS.find((q) => q.id === questId);
    if (quest && prevProgress < quest.target && newProgress >= quest.target) {
      awardXP(quest.xp).catch(() => {});
    }
  },

  // Lifetime Profile "Challenges" (join_1, streak_7, etc.) — unlike weekly
  // quests these never reset, so completion is tracked as a simple claimed-once
  // list rather than a progress+weekId pair.
  claimChallenge: async (challengeId, xp) => {
    const { user, awardXP } = get();
    if (!user || user.claimedChallengeIds?.includes(challengeId)) return;
    await updateDoc(doc(db, 'users', user.id), { claimedChallengeIds: arrayUnion(challengeId) });
    set((s) => ({
      user: s.user ? { ...s.user, claimedChallengeIds: [...(s.user.claimedChallengeIds ?? []), challengeId] } : s.user,
    }));
    awardXP(xp).catch(() => {});
  },

  updateReliabilityScore: async () => {
    const { user } = get();
    if (!user) return;
    const newScore = calculateReliabilityScore(user.attendanceHistory);
    await updateDoc(doc(db, 'users', user.id), { reliabilityScore: newScore });
    set((s) => ({
      user: s.user ? { ...s.user, reliabilityScore: newScore } : s.user,
    }));
  },

  clearError: () => set({ error: null }),
}));
