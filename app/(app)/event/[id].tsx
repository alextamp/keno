import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable,
  ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { uploadEventImage } from '@/core/utils/uploadImage';
import { pickImage } from '@/core/utils/imagePicker';
import { SavePhotoModal } from '@/components/ui/SavePhotoModal';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import { addDoc, arrayRemove, arrayUnion, collection, deleteField, doc, getDoc, getDocs, increment, limit, onSnapshot, orderBy, query, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useTabNavigation } from '@/core/tabNavigation';
import { format } from 'date-fns';
import { useTheme } from '@/core/theme';
import { BorderRadius, UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Shadow, Spacing } from '@/core/constants/theme';
import {
  EventEntity, EventCategory, EVENT_CATEGORY_COLORS,
  GenderFilter, isAttending, isEventFull, isOnWaitlist, spotsLeft,
} from '@/features/events/domain/entities/event.entity';

const CATEGORY_KEYS: Record<EventCategory, string> = {
  [EventCategory.Party]: 'catParty',
  [EventCategory.Sports]: 'catSports',
  [EventCategory.Study]: 'catStudy',
  [EventCategory.Chill]: 'catChill',
  [EventCategory.Coffee]: 'catCoffee',
  [EventCategory.Other]: 'catOther',
};
// EventEntity has no stored duration/end time, so "has this event ended?"
// (used to gate the post-event Connect/reconnect button) is a fixed-offset
// guess from the start time, same style as the 30-min-before-start check-in
// window elsewhere in this file.
const ASSUMED_EVENT_DURATION_MS = 3 * 60 * 60 * 1000;
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { addEventToCalendar, isEventInCalendar, removeEventFromCalendar } from '@/core/utils/calendar';
import { isLeft, isRight } from '@/core/utils/either';
import { getCountdown } from '@/core/utils/time';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { notificationsRepository } from '@/features/notifications/notifications.repository';
import { scheduleEventReminder, cancelEventReminder, hasShownNotificationPermissionPrompt, markNotificationPermissionPromptShown } from '@/core/utils/eventReminders';
import { haptics } from '@/core/utils/haptics';
import { sounds } from '@/core/utils/sounds';
import { analytics } from '@/core/utils/analytics';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { DuotoneScene } from '@/components/ui/DuotoneScene';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { InfoRow } from '@/components/ui/InfoRow';
import { AvatarPile } from '@/components/ui/AvatarPile';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { ProgressTrack } from '@/components/ui/ProgressTrack';
import { useTranslation, getDateLocale, useLanguageStore } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';
import { XP_VALUES, HOST_GRACE_PERIOD_MS } from '@/core/constants/gamification';
import { useReviewsStore } from '@/features/reviews/presentation/store/reviews.store';
import { REVIEW_EMOJI, REVIEW_LABEL, ReviewType } from '@/features/reviews/domain/entities/review.entity';
import { swipesRepository } from '@/features/swipes/data/repositories/swipes.repository.impl';
import { queryUsersByNamePrefix } from '@/core/utils/userSearch';

interface InviteUserResult { uid: string; name: string; universityName: string; avatarColor: string; }

async function searchUsersToInvite(q: string): Promise<InviteUserResult[]> {
  const docs = await queryUsersByNamePrefix(q);
  return docs.map((d) => ({ uid: d.id, name: d.data().name ?? '', universityName: d.data().universityName ?? '', avatarColor: d.data().avatarColor ?? '#B8482A' }));
}

function Avatar({ profile, size = 44 }: { profile?: UserProfile; size?: number }) {
  const name = profile?.name ?? '?';
  const initial = name.charAt(0).toUpperCase();
  const bg = profile?.avatarColor ?? '#999';
  if (profile?.photoUri) {
    return <Image source={{ uri: profile.photoUri }} style={[styles.avatarImg, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}


export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { goToTab, setFocusLocation } = useTabNavigation();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const saveEvent = useAuthStore((s) => s.saveEvent);
  const unsaveEvent = useAuthStore((s) => s.unsaveEvent);
  const addJoinedEvent = useAuthStore((s) => s.addJoinedEvent);
  const removeJoinedEvent = useAuthStore((s) => s.removeJoinedEvent);
  const upsertEvent = useEventsStore((s) => s.upsertEvent);
  const removeEvent = useEventsStore((s) => s.removeEvent);
  const t = useTranslation();
  const { language } = useLanguageStore();
  const dateLocale = getDateLocale(language);
  const GENDER_LABELS: Record<GenderFilter, string> = { any: t.eventGenderAny, male: t.eventGenderMaleOnly, female: t.eventGenderFemaleOnly };
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState<EventEntity | null>(null);
  const [reviewedUids, setReviewedUids] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [inCalendar, setInCalendar] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showStakingModal, setShowStakingModal] = useState(false);
  const [stakingXp, setStakingXp] = useState(XP_VALUES.defaultRsvpStake);
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [claimingHost, setClaimingHost] = useState(false);
  const [realCheckedInUids, setRealCheckedInUids] = useState<string[]>([]);
  const [kudos, setKudos] = useState<Record<string, string[]>>({});
  const [checkedInUids, setCheckedInUids] = useState<string[]>([]);
  const [showRecapCard, setShowRecapCard] = useState(false);
  const [checkinSecret, setCheckinSecret] = useState<string | null>(null);
  const [qrBucket, setQrBucket] = useState(() => Math.floor(Date.now() / 30_000));
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [ownFeedback, setOwnFeedback] = useState<'good' | 'bad' | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<InviteUserResult[]>([]);
  const [inviteSearching, setInviteSearching] = useState(false);
  const [invitedFriendUids, setInvitedFriendUids] = useState<Set<string>>(new Set());
  const [swipedCount, setSwipedCount] = useState(0);
  const [wallPhotos, setWallPhotos] = useState<{ id: string; uri: string; uploaderUid: string; uploaderName: string; uploaderAvatarColor: string }[]>([]);
  const [uploadingWallPhoto, setUploadingWallPhoto] = useState(false);
  const [savePhotoUri, setSavePhotoUri] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const shareCardRef = useRef<View>(null);
  const recapCardRef = useRef<View>(null);

  useEffect(() => { if (id) loadEvent(); }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id || !id) return;
      const loadSwipesCount = async () => {
        const result = await swipesRepository.getSwipesForEvent(id, user.id);
        if (isRight(result)) {
          setSwipedCount(result.right.length);
        }
      };
      loadSwipesCount();
    }, [user?.id, id])
  );
  useEffect(() => { if (id) isEventInCalendar(id).then(setInCalendar); }, [id]);

  // Increment view count once per session per event
  useEffect(() => {
    if (!id) return;
    const sessionKey = `viewed_${id}`;
    if ((globalThis as any)[sessionKey]) return;
    (globalThis as any)[sessionKey] = true;
    updateDoc(doc(db, 'events', id), { viewCount: increment(1) }).catch(() => {});
    analytics.track('event_viewed', { eventId: id });
  }, [id]);

  // Subscribe to photo wall
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'events', id, 'photos'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setWallPhotos(snap.docs.map((d) => ({
        id: d.id,
        uri: d.data().uri as string,
        uploaderUid: d.data().uploaderUid as string,
        uploaderName: d.data().uploaderName as string,
        uploaderAvatarColor: d.data().uploaderAvatarColor as string,
      })));
    }, () => {});
    return unsub;
  }, [id]);

  // Organizer's rotating QR check-in code: the secret itself is fetched once
  // (private/checkin, creator-only read per firestore.rules) and never
  // changes; only the 30s bucket rotates, which is what actually invalidates
  // an old screenshot after ~60-90s (see events.repository.impl's
  // checkInWithToken and the firestore.rules window check). Uses
  // ensureCheckinSecret rather than a raw getDoc so events created before
  // this feature existed (no private/checkin doc yet) get one lazily
  // instead of showing a QR that can never validate.
  useEffect(() => {
    if (!id || !user || !event) return;
    if (user.id !== event.creatorId && user.id !== event.standInHostId) return;
    eventsRepository.ensureCheckinSecret(id).then((result) => {
      if (!isLeft(result)) setCheckinSecret(result.right);
    }).catch(() => {});
  }, [id, user?.id, event?.creatorId, event?.standInHostId]);

  useEffect(() => {
    if (!showQr) return;
    // The bucket in state may be stale by the time the organizer actually
    // opens the modal (it was first computed whenever this screen mounted,
    // not now) — refresh immediately, then keep rotating every 30s.
    setQrBucket(Math.floor(Date.now() / 30_000));
    const interval = setInterval(() => setQrBucket(Math.floor(Date.now() / 30000)), 30_000);
    return () => clearInterval(interval);
  }, [showQr]);

  // Whether the current user has already scanned themselves in — drives the
  // bottom CTA (Check In vs. Share Recap) and is the trigger for the
  // shareable recap card that used to fire from the removed self-report modal.
  useEffect(() => {
    if (!id || !user) return;
    const unsub = onSnapshot(doc(db, 'events', id, 'checkIns', user.id), (snap) => {
      setHasCheckedIn(snap.exists());
      setOwnFeedback((snap.data()?.feedback as 'good' | 'bad' | undefined) ?? null);
    }, () => {});
    return unsub;
  }, [id, user?.id]);

  const submitFeedback = async (value: 'good' | 'bad') => {
    if (!id || !user) return;
    setOwnFeedback(value);
    haptics.light();
    try {
      await updateDoc(doc(db, 'events', id, 'checkIns', user.id), { feedback: value });
    } catch {
      setOwnFeedback(null);
    }
  };

  // Plus-one: invite a specific friend straight from the event page (mirrors
  // user/[uid].tsx's own event-invite flow, just triggered from the other
  // direction — picking a person here instead of picking an event there).
  // Accepting doesn't need any special "stake on accept" logic of its own:
  // once they open the event and tap Join, the mandatory-staking rule
  // (handleJoinPress) already kicks in for them exactly like anyone else.
  const handleInviteSearch = async (text: string) => {
    setInviteSearch(text);
    if (text.trim().length < 2) { setInviteResults([]); return; }
    setInviteSearching(true);
    const results = await searchUsersToInvite(text);
    setInviteResults(results.filter((u) => u.uid !== user?.id && !(event?.attendeeIds ?? []).includes(u.uid)));
    setInviteSearching(false);
  };

  const handleInviteFriend = async (target: InviteUserResult) => {
    if (!user || !event) return;
    haptics.light();
    try {
      await notificationsRepository.create({
        toUid: target.uid,
        fromUid: user.id,
        fromName: user.name,
        fromAvatarColor: user.avatarColor,
        fromPhotoUri: user.photoUri,
        type: 'event_invite',
        eventId: event.id,
        eventTitle: event.title,
      });
      // Referral credit — claimReferral (Cloud Function) records referredBy
      // server-side (verifying the caller is actually attending) so that if
      // (and only if) target.uid actually checks in for real, both of you
      // get the Plus One ticket + XP bonus (research doc #17). referredBy
      // isn't client-writable — see firestore.rules.
      eventsRepository.claimReferral(event.id, target.uid).catch(() => {});
      setInvitedFriendUids((prev) => new Set([...prev, target.uid]));
    } catch {
      Alert.alert(t.userInviteErrorTitle, t.userInviteErrorBody);
    }
  };

  // Real check-ins (not RSVPs) — the "Δες ποιοι ήρθαν" button on the check-in
  // success screen used to just land here, and this screen had no way to
  // show who actually showed up vs. who merely joined, so it looked like it
  // was showing the wrong list. This drives the checkmark badge in "Who's
  // going" below.
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(collection(db, 'events', id, 'checkIns'), (snap) => {
      setRealCheckedInUids(snap.docs.map((d) => d.id));
      setKudos(Object.fromEntries(snap.docs.map((d) => [d.id, (d.data().kudos as string[] | undefined) ?? []])));
    }, () => {});
    return unsub;
  }, [id]);

  // Strava-Kudos-style acknowledgment on a checked-in attendee — same
  // mechanic and Firestore shape as the check-in success screen's version,
  // just persisted on the event page too, since the "who's going" grid
  // outlives that one-time celebratory moment.
  const toggleKudos = async (targetUid: string) => {
    if (!user || !id || targetUid === user.id) return;
    const alreadyGiven = (kudos[targetUid] ?? []).includes(user.id);
    try {
      await updateDoc(doc(db, 'events', id, 'checkIns', targetUid), {
        kudos: alreadyGiven ? arrayRemove(user.id) : arrayUnion(user.id),
      });
    } catch {}
  };

  const handleOpenLocation = () => {
    if (!event) return;
    // If we have coordinates, jump to the in-app Map tab centered there
    // instead of leaving the app — falls back to the native maps app when
    // the event has no lat/lng on file.
    if (event.latitude != null && event.longitude != null) {
      haptics.light();
      setFocusLocation({ latitude: event.latitude, longitude: event.longitude });
      router.navigate('/(app)');
      // Same PagerView-not-focused-yet caveat as the "view my own profile"
      // tap above — give navigation a tick to land before switching pages.
      setTimeout(() => goToTab(1), 50);
      return;
    }
    const label = encodeURIComponent(event.title);
    const query = encodeURIComponent(event.location);
    const url = Platform.OS === 'ios'
      ? `maps:0,0?q=${label}@${query}`
      : `geo:0,0?q=${query}(${label})`;
    Linking.openURL(url).catch(() => {});
  };

  const loadEvent = async () => {
    setLoading(true);
    const result = await eventsRepository.getEvent(id);
    if (isLeft(result)) {
      Alert.alert(t.createAlertSaveError, result.left.message, [{ onPress: () => router.back() }]);
    } else {
      const ev = result.right;
      setEvent(ev);
      const allUids = [...new Set([...ev.attendeeIds, ...Object.keys(ev.joinRequests ?? {})])];
      const loaded = await fetchUserProfiles(allUids);
      setProfiles(loaded);
    }
    setLoading(false);
  };

  const maybeShowNotificationPermissionPrompt = async (userId: string) => {
    const alreadyShown = await hasShownNotificationPermissionPrompt(userId);
    if (alreadyShown) return;
    await markNotificationPermissionPromptShown(userId);
    router.push('/(app)/notification-permission');
  };

  const handleJoinLeave = async () => {
    if (!event || !user) return;
    const attending = isAttending(event, user.id);
    if (!attending) analytics.track('event_join_tapped', { eventId: event.id, category: event.category });
    haptics.medium();
    setActionLoading(true);
    const result = attending
      ? await eventsRepository.leaveEvent(event.id, user.id)
      : await eventsRepository.joinEvent(event.id, user.id);
    if (isLeft(result)) {
      Alert.alert(t.createAlertSaveError, result.left.message);
      // A rejected join specifically means our locally-cached attendeeIds
      // was stale (someone else took the last spot first) — refetch so the
      // UI actually shows full/waitlist instead of an enabled Join button
      // that would just fail again.
      if (!attending && result.left.message === t.eventFull) loadEvent();
    }
    else {
      const updated: EventEntity = {
        ...event,
        attendeeIds: attending
          ? event.attendeeIds.filter((uid) => uid !== user.id)
          : [...event.attendeeIds, user.id],
      };
      setEvent(updated);
      upsertEvent(updated);
      if (attending) {
        removeJoinedEvent(event.id);
        cancelEventReminder(event.id).catch(() => {});
        haptics.light();
        // Notify first person on waitlist that a spot opened
        const firstWaiting = event.waitlistIds?.[0];
        if (firstWaiting) {
          notificationsRepository.create({
            toUid: firstWaiting,
            fromUid: user.id,
            fromName: user.name,
            fromAvatarColor: user.avatarColor,
            fromPhotoUri: user.photoUri,
            type: 'event_join',
            eventId: event.id,
            eventTitle: t.eventWaitlistSpotOpened(event.title),
          }).catch(() => {});
        }
      } else {
        const isFirstJoinEver = user.joinedEvents.length === 0;
        addJoinedEvent(event.id);
        scheduleEventReminder(updated).catch(() => {});
        haptics.success();
        sounds.play('success');
        analytics.track('event_joined', { eventId: event.id, category: event.category, isFirstJoinEver });
        if (event.creatorId !== user.id) {
          notificationsRepository.create({
            toUid: event.creatorId,
            fromUid: user.id,
            fromName: user.name,
            fromAvatarColor: user.avatarColor,
            fromPhotoUri: user.photoUri,
            type: 'event_join',
            eventId: event.id,
            eventTitle: event.title,
          }).catch(() => {});
        }
        // Behaviour-triggered "a friend is going" nudge, not a broadcast —
        // only the joiner's own followers who aren't already attending, and
        // capped so a very-followed account can't spam a whole event's worth
        // of pushes off one join.
        (user.followers ?? [])
          .filter((uid) => uid !== event.creatorId && uid !== user.id && !updated.attendeeIds.includes(uid))
          .slice(0, 20)
          .forEach((uid) => {
            notificationsRepository.create({
              toUid: uid,
              fromUid: user.id,
              fromName: user.name,
              fromAvatarColor: user.avatarColor,
              fromPhotoUri: user.photoUri,
              type: 'friend_going',
              eventId: event.id,
              eventTitle: event.title,
            }).catch(() => {});
          });
        if (isFirstJoinEver) maybeShowNotificationPermissionPrompt(user.id);
      }
    }
    setActionLoading(false);
  };

  const handleStakeXp = async () => {
    if (!event || !user || !user.xp || user.xp < stakingXp) {
      Alert.alert(t.eventBtnJoin, t.eventStakeNotEnoughXp(stakingXp));      return;
    }
    haptics.medium();    setActionLoading(true);    const result = await eventsRepository.stakeXpOnRsvp(event.id, user.id, stakingXp);    if (isLeft(result)) {
      Alert.alert(t.createAlertSaveError, result.left.message);    } else {
      setShowStakingModal(false);      haptics.success();      await handleJoinLeave();    }
    setActionLoading(false);  };

  // Join button entry point: staking is mandatory — not a per-event host
  // choice — for anyone who can afford at least the cheapest tier, on every
  // event. Staking is how you join, not a separate optional step, so
  // people who commit to showing up actually have something on the line.
  // Someone who can't afford even the cheapest tier is never blocked from
  // joining — they just join for free, same as a brand-new user with 0 XP
  // always could.
  const handleJoinPress = () => {
    if (canAffordStake) {
      setStakingXp(affordableStakes[affordableStakes.length - 1]);
      setShowStakingModal(true);
      return;
    }
    handleJoinLeave();
  };
  const handleSubmitReview = async (toUid: string) => {
    if (!event || !user || reviewedUids.includes(toUid)) return;
    haptics.medium();
    setReviewedUids((prev) => [...prev, toUid]);
    const submitReview = useReviewsStore.getState().submitReview;
    const success = await submitReview(user.id, toUid, event.id, 'recommend');
    if (success) {
      haptics.success();
      Alert.alert('Recommended!', 'You recommended this person.');
    } else {
      setReviewedUids((prev) => prev.filter((uid) => uid !== toUid));
      Alert.alert('Error', 'Could not submit review.');
    }
  };

  const handleToggleCheckIn = async (uid: string) => {
    haptics.light();
    if (checkedInUids.includes(uid)) {
      setCheckedInUids((prev) => prev.filter((u) => u !== uid));
    } else {
      setCheckedInUids((prev) => [...prev, uid]);
    }
  };

  // Organizer's manual roll-call fallback ("can't find the code") — goes
  // through the same checkInWithToken write path as the QR scanner. The
  // organizer is trusted to check in on someone else's behalf (firestore.rules
  // lets the event creator bypass the secret/bucket check), so the secret we
  // pass along just needs to be A valid one, not one this device just scanned.
  const handleSaveCheckIns = async () => {
    if (!event || !user) return;
    setActionLoading(true);
    try {
      let secret = checkinSecret;
      if (!secret) {
        const result = await eventsRepository.ensureCheckinSecret(event.id);
        secret = isLeft(result) ? '' : result.right;
      }
      const bucket = Math.floor(Date.now() / 30_000);
      for (const uid of checkedInUids) {
        const result = await eventsRepository.checkInWithToken(event.id, uid, secret ?? '', bucket);
        if (isRight(result)) {
          haptics.light();
        }
      }
      haptics.success();
      Alert.alert('Success', `Checked in ${checkedInUids.length} attendees`);
      setShowCheckInModal(false);
      setCheckedInUids([]);
    } catch (e) {
      Alert.alert('Error', 'Failed to save check-ins');
    } finally {
      setActionLoading(false);
    }
  };

  // Fired the first time the creator opens the QR modal or the manual
  // roll-call modal after the event started — the only server-side signal
  // that the host actually showed up (see markHostArrived in the repo /
  // markNoShows in functions). Guarded on !event.hostArrivedAt so it's a
  // one-time write, not one per modal open.
  const markHostArrivedIfNeeded = () => {
    if (!event || event.hostArrivedAt) return;
    eventsRepository.markHostArrived(event.id).catch(() => {});
  };

  const handleClaimStandInHost = async () => {
    if (!event) return;
    setClaimingHost(true);
    haptics.light();
    const result = await eventsRepository.claimStandInHost(event.id);
    setClaimingHost(false);
    if (isLeft(result)) {
      haptics.error();
      const msg = result.left.message ?? '';
      Alert.alert(t.eventClaimHostBtn, msg.includes('too-early') ? t.eventClaimHostTooEarly : t.eventClaimHostError);
      return;
    }
    haptics.success();
    loadEvent();
  };

  const handleUploadWallPhoto = async () => {
    // Server-enforced too (firestore.rules requires a matching checkIns doc)
    // — this is just the friendly client-side version of the same rule, so
    // someone who merely joined/RSVP'd doesn't hit a bare permission error.
    if (!user || !id || !hasCheckedIn) return;
    const localUri = await pickImage({ aspect: [4, 3] });
    if (!localUri) return;
    setUploadingWallPhoto(true);
    try {
      const uri = await uploadEventImage(localUri);
      await addDoc(collection(db, 'events', id, 'photos'), {
        uri,
        uploaderUid: user.id,
        uploaderName: user.name,
        uploaderAvatarColor: user.avatarColor ?? '#999',
        createdAt: Timestamp.now(),
      });
      haptics.success();
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
    setUploadingWallPhoto(false);
  };


  const handleToggleCoHost = async (uid: string) => {
    if (!event || !user || user.id !== event.creatorId) return;
    haptics.medium();
    const isCoHost = (event.coHostIds ?? []).includes(uid);
    const label = isCoHost ? t.eventRemoveCoHost : t.eventMakeCoHost;
    Alert.alert(label, isCoHost ? undefined : undefined, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          const updated: EventEntity = {
            ...event,
            coHostIds: isCoHost
              ? (event.coHostIds ?? []).filter((id) => id !== uid)
              : [...(event.coHostIds ?? []), uid],
          };
          try {
            await updateDoc(doc(db, 'events', id), {
              coHostIds: isCoHost ? arrayRemove(uid) : arrayUnion(uid),
            });
            setEvent(updated);
            upsertEvent(updated);
          } catch {
            Alert.alert(t.createAlertSaveError, t.authErrGeneric);
          }
        },
      },
    ]);
  };

  const [requestingJoin, setRequestingJoin] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');

  const handleSubmitJoinRequest = async () => {
    if (!event || !user || !requestMessage.trim()) return;
    setRequestingJoin(true);
    haptics.medium();
    try {
      await updateDoc(doc(db, 'events', id), {
        [`joinRequests.${user.id}`]: requestMessage.trim(),
      });
      notificationsRepository.create({
        toUid: event.creatorId,
        fromUid: user.id,
        fromName: user.name,
        fromAvatarColor: user.avatarColor,
        fromPhotoUri: user.photoUri,
        type: 'event_join_request',
        eventId: event.id,
        eventTitle: event.title,
      }).catch(() => {});

      setEvent({ ...event, joinRequests: { ...(event.joinRequests ?? {}), [user.id]: requestMessage.trim() } });
      setRequestModalVisible(false);
      setRequestMessage('');
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
    setRequestingJoin(false);
  };

  const handleJoinRequestDecision = async (uid: string, accept: boolean) => {
    if (!event || !user) return;
    haptics.light();
    try {
      const remainingRequests = { ...(event.joinRequests ?? {}) };
      delete remainingRequests[uid];
      await updateDoc(doc(db, 'events', id), {
        [`joinRequests.${uid}`]: deleteField(),
        ...(accept ? { invitedUserIds: arrayUnion(uid) } : {}),
      });
      const updated: EventEntity = {
        ...event,
        joinRequests: remainingRequests,
        invitedUserIds: accept ? [...(event.invitedUserIds ?? []), uid] : event.invitedUserIds,
      };
      setEvent(updated);
      upsertEvent(updated);
      if (accept) {
        notificationsRepository.create({
          toUid: uid,
          fromUid: user.id,
          fromName: user.name,
          fromAvatarColor: user.avatarColor,
          fromPhotoUri: user.photoUri,
          type: 'event_join_accepted',
          eventId: event.id,
          eventTitle: event.title,
        }).catch(() => {});
      }
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
  };

  const handleShareAsImage = async () => {
    if (!shareCardRef.current || !event) return;
    haptics.light();
    try {
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 0.95 });
      // Include a caption with a deep link back into the app — otherwise
      // whoever receives just the image has no way back in.
      const result = await Share.share({
        url: uri,
        title: event.title,
        message: `🎉 ${event.title} — ${t.eventShareCta}\nkeno://event/${event.id}`,
      });
      // Android's share intent always resolves 'sharedAction' regardless of
      // outcome — only iOS actually reports back whether the sheet was
      // dismissed without picking a target.
      if (result.action !== 'dismissedAction') analytics.track('event_shared', { eventId: event.id, method: 'card' });
    } catch {}
  };

  const handleShareRecap = async () => {
    if (!recapCardRef.current || !event) return;
    haptics.light();
    try {
      const uri = await captureRef(recapCardRef, { format: 'png', quality: 0.95 });
      await Share.share({
        url: uri,
        title: event.title,
        message: `🎉 ${event.title}\nkeno://event/${event.id}`,
      });
    } catch {}
  };

  const handleSaveRecap = async () => {
    if (!recapCardRef.current || !event) return;
    haptics.light();
    try {
      const uri = await captureRef(recapCardRef, { format: 'png', quality: 0.95 });
      // No media-library dependency exists in this app (the existing
      // invite-card share feature also only ever calls Share.share) — the
      // native share sheet itself offers "Save Image"/"Save to Photos" as a
      // target on both platforms, so "save to device" reuses the same
      // capture + share path rather than adding expo-media-library.
      await Share.share({ url: uri, title: event.title });
      haptics.success();
    } catch {}
  };

  const handleDelete = () => {
    if (!event || !user) return;
    Alert.alert(t.eventDeleteTitle, t.eventDeleteBody, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: t.eventDeleteBtn, style: 'destructive',
        onPress: async () => {
          const result = await eventsRepository.deleteEvent(event.id, user.id);
          if (isLeft(result)) Alert.alert(t.createAlertSaveError, result.left.message);
          else { removeEvent(event.id); router.back(); }
        },
      },
    ]);
  };


  const handleReport = () => {
    if (!event || !user) return;
    Alert.alert(t.eventReportTitle, undefined, [
      { text: t.eventReportSpam, onPress: () => submitReport('spam') },
      { text: t.eventReportInappropriate, onPress: () => submitReport('inappropriate') },
      { text: t.eventReportMisinformation, onPress: () => submitReport('misinformation') },
      { text: t.settingsBtnCancel, style: 'cancel' },
    ]);
  };

  const submitReport = async (reason: string) => {
    if (!event || !user) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reportedEventId: event.id,
        reportedUid: event.creatorId,
        reporterUid: user.id,
        reason,
        createdAt: new Date(),
      });
      Alert.alert(t.eventReportSubmitted, t.eventReportSubmittedBody);
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
  };

  const handleWaitlist = async () => {
    if (!event || !user) return;
    haptics.medium();
    const onList = isOnWaitlist(event, user.id);
    setActionLoading(true);
    const result = onList
      ? await eventsRepository.leaveWaitlist(event.id, user.id)
      : await eventsRepository.joinWaitlist(event.id, user.id);
    if (isLeft(result)) Alert.alert(t.createAlertSaveError, result.left.message);
    else {
      const updated: EventEntity = {
        ...event,
        waitlistIds: onList
          ? event.waitlistIds.filter((id) => id !== user.id)
          : [...(event.waitlistIds ?? []), user.id],
      };
      setEvent(updated);
      upsertEvent(updated);
      if (!onList) haptics.success();
    }
    setActionLoading(false);
  };

  const handleShare = async () => {
    if (!event) return;
    haptics.light();
    const dateStr = format(event.dateTime, 'EEE d MMM, HH:mm', { locale: dateLocale });
    const result = await Share.share({
      title: event.title,
      message: `🎉 ${event.title}\n📌 ${event.location}\n⏰ ${dateStr}\n\n${t.eventShareCta}\nkeno://event/${event.id}`,
    });
    if (result.action !== 'dismissedAction') analytics.track('event_shared', { eventId: event.id, method: 'text' });
  };

  // Live Mode's "tell a friend where I'm at" (research doc #10) — unlike
  // handleShare (an invite, sent before the event), this fires only once
  // you've actually checked in, framed in the present tense as a safety/
  // status share rather than an invitation to join.
  const handleTellFriend = async () => {
    if (!event) return;
    haptics.light();
    try {
      const dateStr = format(new Date(), 'HH:mm');
      const result = await Share.share({
        message: `📍 ${t.eventLiveTellFriendMessage(event.title, event.location, dateStr)}\nkeno://event/${event.id}`,
      });
      if (result.action !== 'dismissedAction') analytics.track('event_shared', { eventId: event.id, method: 'live_tell_friend' });
    } catch {}
  };

  // Discreet emergency alert (research doc #11) — deliberately low-key UI
  // (small, muted, no red "EMERGENCY" styling) since the whole point is a
  // button that doesn't draw attention if someone else can see the screen.
  // Real SMS-sending requires a backend gateway this app doesn't have, so
  // "silently sends a pin" becomes "opens the message pre-filled, one tap to
  // send" — same platform constraint already noted on tell-a-friend.
  const handleSafetyAlert = () => {
    if (!event) return;
    haptics.light();
    const phone = user?.emergencyContactPhone;
    if (!phone) {
      Alert.alert(t.eventLiveSafetyNoContactTitle, t.eventLiveSafetyNoContactBody, [
        { text: t.eventLiveSafetySetupBtn, onPress: () => router.push('/(app)/settings') },
        { text: t.settingsBtnCancel, style: 'cancel' },
      ]);
      return;
    }
    Alert.alert(t.eventLiveSafetyTitle, undefined, [
      {
        text: t.eventLiveSafetyMessageBtn(user?.emergencyContactName || phone),
        onPress: () => {
          const message = t.eventLiveTellFriendMessage(event.title, event.location, format(new Date(), 'HH:mm'));
          const url = `sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`;
          Linking.openURL(url).catch(() => {});
        },
      },
      { text: t.eventLiveSafetyCall112, onPress: () => { Linking.openURL('tel:112').catch(() => {}); } },
      { text: t.settingsBtnCancel, style: 'cancel' },
    ]);
  };

  // Creator-only early end from the Live Mode panel — flips eventIsOver
  // immediately everywhere instead of waiting for ASSUMED_EVENT_DURATION_MS
  // to elapse.
  const handleEndEvent = () => {
    if (!event || !isCreator) return;
    Alert.alert(t.eventLiveEndEventConfirmTitle, t.eventLiveEndEventConfirmBody, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: t.eventLiveEndEventBtn,
        style: 'destructive',
        onPress: async () => {
          haptics.medium();
          const result = await eventsRepository.endEvent(event.id);
          if (isLeft(result)) { Alert.alert(t.createAlertSaveError, result.left.message); return; }
          const updated: EventEntity = { ...event, endedAt: new Date() };
          setEvent(updated);
          upsertEvent(updated);
          haptics.success();
        },
      },
    ]);
  };

  const handleSave = () => {
    if (!user || !event) return;
    haptics.light();
    const saved = user.savedEventIds?.includes(event.id) ?? false;
    (saved ? unsaveEvent(event.id) : saveEvent(event.id)).catch(() => {});
  };

  const handleCalendar = async () => {
    if (!event) return;
    haptics.light();
    if (inCalendar) {
      const ok = await removeEventFromCalendar(event.id);
      if (ok) setInCalendar(false);
    } else {
      const ok = await addEventToCalendar(event);
      if (ok) setInCalendar(true);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!event) return null;

  const isInvited = !event.isPrivate || user?.id === event.creatorId || (event.invitedUserIds ?? []).includes(user?.id ?? '');

  // Private event lock screen for non-invited users
  if (event.isPrivate && !isInvited) {
    const alreadyRequested = !!user && Object.prototype.hasOwnProperty.call(event.joinRequests ?? {}, user.id);
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }]}>
        <AnimatedPressable onPress={() => router.back()} style={{ position: 'absolute', top: insets.top + 12, left: 20, width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" size={17} color={colors.textPrimary} />
        </AnimatedPressable>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock" size={26} color={colors.accentInk} />
        </View>
        <Text style={{ fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.4, color: colors.textPrimary, textAlign: 'center' }}>{t.eventPrivateTitle}</Text>
        <Text style={{ fontSize: FontSize.lg, color: colors.textSecondary, textAlign: 'center' }}>{t.eventPrivateBody}</Text>
        <Button
          label={alreadyRequested ? t.eventRequestSent : t.eventRequestJoin}
          onPress={() => setRequestModalVisible(true)}
          disabled={alreadyRequested}
          style={{ marginTop: 8, minWidth: 220 }}
        />

        <Modal visible={requestModalVisible} transparent animationType="fade" onRequestClose={() => setRequestModalVisible(false)}>
          <View style={styles.requestModalBackdrop}>
            <View style={[styles.requestModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.requestModalTitle, { color: colors.textPrimary }]}>{t.eventRequestJoin}</Text>
              <Text style={[styles.requestModalHint, { color: colors.textSecondary }]}>{t.eventRequestMessageHint}</Text>
              <TextInput
                style={[styles.requestModalInput, { color: colors.textPrimary, borderColor: colors.border }]}
                value={requestMessage}
                onChangeText={setRequestMessage}
                placeholder={t.eventRequestMessagePlaceholder}
                placeholderTextColor={colors.textHint}
                multiline
                numberOfLines={4}
                maxLength={300}
              />
              <View style={styles.requestModalActions}>
                <Button
                  label={t.settingsBtnCancel}
                  onPress={() => setRequestModalVisible(false)}
                  disabled={requestingJoin}
                  variant="outline"
                  style={{ flex: 1 }}
                />
                <Button
                  label={t.eventRequestSendBtn}
                  onPress={handleSubmitJoinRequest}
                  disabled={requestingJoin || !requestMessage.trim()}
                  loading={requestingJoin}
                  variant="primary"
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  const attending = user ? isAttending(event, user.id) : false;
  const onWaitlist = user ? isOnWaitlist(event, user.id) : false;
  const full = isEventFull(event);
  const spots = spotsLeft(event);
  const isCreator = user?.id === event.creatorId;
  const isStandInHost = !isCreator && !!user && user.id === event.standInHostId;
  const canHostCheckIn = isCreator || isStandInHost;
  // Roll-call candidates: not the host themself (they're obviously there)
  // and not already really checked in (checkIns doc already exists) — so
  // there's nothing left to accidentally re-tap.
  const pendingCheckInAttendees = event.attendeeIds.filter((uid) => uid !== user?.id && !realCheckedInUids.includes(uid));
  const categoryColor = EVENT_CATEGORY_COLORS[event.category];
  const eventHasEnded = event && new Date() > event.dateTime;
  const eventHasStarted = event && new Date() >= event.dateTime;
  // Attendees only see the "take over as host" offer once the grace period
  // has lapsed with zero sign the creator (or a stand-in) ever showed up.
  const canOfferStandIn = !isCreator && !isStandInHost && attending
    && !event.hostArrivedAt && !event.standInHostId
    && Date.now() >= event.dateTime.getTime() + HOST_GRACE_PERIOD_MS;
  // "Fully over" uses the same assumed-duration heuristic as the Connect
  // button below (no stored end time) — once past this point, leaving or
  // checking in no longer makes sense since the event already happened.
  const eventIsOver = !!event && (!!event.endedAt || Date.now() >= event.dateTime.getTime() + ASSUMED_EVENT_DURATION_MS);
  // Live Mode (research doc #10 + creator tools): only for someone who
  // actually checked in, while the event is genuinely ongoing — not just
  // "attending," and not once eventIsOver (including a creator-triggered
  // early end).
  const showLiveMode = hasCheckedIn && eventHasStarted && !eventIsOver;

  const countdown = getCountdown(event.dateTime);

  const hasFilters = (event.genderFilter && event.genderFilter !== 'any') || event.minAge || event.maxAge || (event.allowedUniversities?.length ?? 0) > 0;

  // Waitlist detail card (mockup 13) — position is 1-indexed, progress
  // represents "capacity is full" (attendees vs max), not the user's own
  // place in line, since there's no meaningful "% of the way there" for a
  // waitlist position itself.
  const waitlistPosition = user ? (event.waitlistIds ?? []).indexOf(user.id) + 1 : 0;
  const waitlistProgress = Math.min(1, event.attendeeIds.length / Math.max(1, event.maxAttendees));
  const restrictionSummaryParts = [
    event.genderFilter && event.genderFilter !== 'any' ? GENDER_LABELS[event.genderFilter] : null,
    (event.minAge || event.maxAge) ? `${event.minAge ?? 18}+` : null,
    event.allowedUniversities && event.allowedUniversities.length > 0 ? event.allowedUniversities.join(', ') : null,
  ].filter(Boolean) as string[];

  const ageIneligible = !!user && user.age && ((event.minAge != null && user.age < event.minAge) || (event.maxAge != null && user.age > event.maxAge));
  const universityIneligible = !!user && user.universityName && (event.allowedUniversities?.length ?? 0) > 0 && !event.allowedUniversities!.includes(user.universityName);
  const isEligible = isCreator || (!ageIneligible && !universityIneligible);
  // Someone with less XP than the cheapest stake tier can't gamble XP they
  // don't have (and couldn't absorb a no-show penalty either) — staking
  // requirements never gate joining itself, so they just join for free.
  const affordableStakes = XP_VALUES.rsvpStakeOptions.filter((v) => v <= (user?.xp ?? 0));
  const canAffordStake = affordableStakes.length > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Hero — 232px photo (or duotone placeholder) flush to the top, floating
          circular back button + creator/report actions overlaid on it. */}
      <View style={styles.hero}>
        {event.imageUri ? (
          <Image source={{ uri: event.imageUri }} style={styles.heroImage} resizeMode="cover" />
        ) : (
          <DuotoneScene category={event.category} height={232} />
        )}
        <View style={[styles.heroControls, { top: insets.top + 10 }]}>
          <AnimatedPressable onPress={() => router.back()} style={[styles.circBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="back" size={16} color={colors.textPrimary} />
          </AnimatedPressable>
          {isStandInHost ? (
            <View style={styles.heroCreatorActions}>
              <AnimatedPressable onPress={() => setShowQr(true)} style={[styles.circBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name="qr" size={15} color={colors.textPrimary} />
              </AnimatedPressable>
            </View>
          ) : !isCreator ? (
            <AnimatedPressable onPress={handleReport} style={[styles.circBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name="flag" size={15} color={colors.textPrimary} />
            </AnimatedPressable>
          ) : (
            <View style={styles.heroCreatorActions}>
              <AnimatedPressable onPress={() => { markHostArrivedIfNeeded(); setShowQr(true); }} style={[styles.circBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name="qr" size={15} color={colors.textPrimary} />
              </AnimatedPressable>
              <AnimatedPressable onPress={() => router.push(`/(app)/event/edit/${event.id}`)} style={[styles.circBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name="edit" size={15} color={colors.textPrimary} />
              </AnimatedPressable>
              <AnimatedPressable onPress={handleDelete} style={[styles.circBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name="trash" size={15} color={colors.error} />
              </AnimatedPressable>
            </View>
          )}
        </View>
      </View>

      {/* Non-creator bottom reserve is generous enough for the CTA bar's
          worst case — Leave + Check-in/Share-Recap stacked together — so
          that bar never overlaps the last bit of scrollable content (chat
          row, "who's going" grid, etc.) underneath it. */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: isCreator ? insets.bottom + 40 : insets.bottom + 195 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Category + title + countdown */}
        <View style={styles.chipRow}>
          <CategoryChip category={event.category} customLabel={event.customCategory} variant="inline" />
          {event.soloFriendly && <Tag label={t.eventSoloFriendlyTag} />}
        </View>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textPrimary, flex: 1 }]}>{event.title}</Text>
          <View style={[styles.countdownBadge, {
            backgroundColor: countdown.urgent ? colors.primary : colors.surfaceVariant,
            borderColor: countdown.urgent ? colors.primary : colors.border,
          }]}>
            <Icon name="clock" size={11} color={countdown.urgent ? '#fff' : colors.textSecondary} />
            <Text style={[styles.countdownText, { color: countdown.urgent ? '#fff' : colors.textSecondary }]}>
              {countdown.label}
            </Text>
          </View>
        </View>

        {/* Live Mode (research doc #9/#10) — only for someone who actually
            checked in, while the event is genuinely still going. Distinct
            "different mode" panel: find-your-group repeat, tell-a-friend,
            a quick photo-wall shortcut, and (creator only) an early-end
            button instead of waiting for the assumed-duration heuristic. */}
        {showLiveMode && (
          <View style={[styles.liveCard, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}>
            <View style={styles.liveHeaderRow}>
              <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.liveTitle, { color: colors.accentInk }]}>{t.eventLiveModeTitle}</Text>
            </View>

            {(event.checkInInfo?.text || event.checkInInfo?.photoUri) && (
              <View style={styles.liveFindGroup}>
                {!!event.checkInInfo?.text && (
                  <Text style={[styles.liveFindGroupText, { color: colors.accentInk }]}>{event.checkInInfo.text}</Text>
                )}
                {!!event.checkInInfo?.photoUri && (
                  <Image source={{ uri: event.checkInInfo.photoUri }} style={styles.liveFindGroupPhoto} resizeMode="cover" />
                )}
              </View>
            )}

            <View style={styles.liveActionsRow}>
              <AnimatedPressable onPress={handleTellFriend} style={[styles.liveActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name="share" size={15} color={colors.textPrimary} />
                <Text style={[styles.liveActionText, { color: colors.textPrimary }]}>{t.eventLiveTellFriendBtn}</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={handleUploadWallPhoto} disabled={uploadingWallPhoto} style={[styles.liveActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name="camera" size={15} color={colors.textPrimary} />
                <Text style={[styles.liveActionText, { color: colors.textPrimary }]}>{uploadingWallPhoto ? '…' : t.eventLiveAddPhotoBtn}</Text>
              </AnimatedPressable>
            </View>

            {isCreator && (
              <AnimatedPressable onPress={handleEndEvent} style={[styles.liveEndBtn, { borderColor: colors.primary }]}>
                <Text style={[styles.liveEndBtnText, { color: colors.primary }]}>{t.eventLiveEndEventBtn}</Text>
              </AnimatedPressable>
            )}

            <AnimatedPressable onPress={handleSafetyAlert} style={styles.liveSafetyRow} hitSlop={6}>
              <Icon name="shield" size={11} color={colors.textHint} />
              <Text style={[styles.liveSafetyText, { color: colors.textHint }]}>{t.eventLiveSafetyBtn}</Text>
            </AnimatedPressable>
          </View>
        )}

        {/* "Είσαι μέσα" note (mockup 12) — shown once the viewer has joined */}
        {attending && !isCreator && (
          <View style={[styles.noteBox, { backgroundColor: colors.accentSoft }]}>
            <Icon name="check" size={15} color={colors.accentInk} />
            <Text style={[styles.noteText, { color: colors.accentInk }]}>{t.eventJoinedNote}</Text>
          </View>
        )}

        {/* Waitlist detail (mockup 13) — richer state than a plain toggle:
            position tag, a progress bar showing the event is at capacity,
            auto-promotion copy, and the restriction rows that explain why
            a waitlist exists at all. */}
        {onWaitlist && !isCreator && (
          <>
            <Card padded style={styles.waitlistCard}>
              <View style={styles.waitlistHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.eventWaitlistCardTitle}</Text>
                <Tag label={t.eventWaitlistPositionTag(waitlistPosition)} variant="accent" />
              </View>
              <ProgressTrack progress={waitlistProgress} />
              <Text style={[styles.waitlistCopy, { color: colors.textSecondary }]}>
                {t.eventWaitlistFullCopy(event.attendeeIds.length, event.maxAttendees)}
              </Text>
            </Card>
            <InfoRow
              icon="clock"
              title={format(event.dateTime, 'EEEE, d MMMM yyyy', { locale: dateLocale })}
              subtitle={format(event.dateTime, 'HH:mm')}
            />
            {hasFilters && (
              <InfoRow
                icon="lock"
                title={t.eventWaitlistRestrictionsTitle}
                subtitle={restrictionSummaryParts.join(' · ')}
              />
            )}
          </>
        )}

        {/* Private event invite banner (creator only) */}
        {event.isPrivate && isCreator && (
          <AnimatedPressable
            onPress={() => {
              Alert.alert(
                '🔒 Private Event',
                `Share this event ID with people you want to invite:\n\n${event.id}\n\nThey can enter it in Search to find the event.`,
                [
                  { text: 'Copy & Share', onPress: () => Share.share({ message: `You're invited to "${event.title}" on keno.! Event ID: ${event.id}` }) },
                  { text: 'OK' },
                ],
              );
            }}
            style={[styles.privateBanner, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}
          >
            <Icon name="lock" size={18} color={colors.accentInk} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.privateBannerTitle, { color: colors.accentInk }]}>{t.eventPrivateTitle}</Text>
              <Text style={[styles.privateBannerSub, { color: colors.textSecondary }]}>{t.eventPrivateBannerSub}</Text>
            </View>
            <Icon name="fwd" size={16} color={colors.primary} />
          </AnimatedPressable>
        )}

        {/* Pending join requests (creator only) */}
        {event.isPrivate && isCreator && Object.keys(event.joinRequests ?? {}).length > 0 && (
          <View style={[styles.analyticsCard, { backgroundColor: colors.surface, borderColor: colors.border, gap: Spacing.sm }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.eventJoinRequestsTitle}</Text>
            {Object.entries(event.joinRequests ?? {}).map(([uid, message]) => {
              const profile = profiles[uid];
              return (
                <View key={uid} style={styles.joinRequestRow}>
                  <AnimatedPressable onPress={() => router.push(`/(app)/user/${uid}`)} style={styles.joinRequestUser}>
                    <Avatar profile={profile} size={36} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.joinRequestName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {profile?.name ?? 'User'}
                      </Text>
                      <Text style={[styles.joinRequestMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                        {message}
                      </Text>
                    </View>
                  </AnimatedPressable>
                  <View style={styles.joinRequestActions}>
                    <Button
                      label={t.eventRequestDecline}
                      onPress={() => handleJoinRequestDecision(uid, false)}
                      variant="outline"
                      size="sm"
                      shape="pill"
                    />
                    <Button
                      label={t.eventRequestAccept}
                      onPress={() => handleJoinRequestDecision(uid, true)}
                      variant="primary"
                      size="sm"
                      shape="pill"
                    />
                  </View>
                </View>
              );
            })}
          </View>
        )}


        {/* Creator analytics */}
        {isCreator && (
          <View style={[styles.analyticsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.analyticsSectionTitle, { color: colors.textHint }]}>{t.eventAnalyticsTitle}</Text>
            <View style={styles.analyticsRow}>
              <View style={styles.analyticsStat}>
                <Text style={[styles.analyticsValue, { color: colors.textPrimary }]}>{event.viewCount ?? 0}</Text>
                <Text style={[styles.analyticsLabel, { color: colors.textHint }]}>{t.eventAnalyticsViews}</Text>
              </View>
              <View style={[styles.analyticsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.analyticsStat}>
                <Text style={[styles.analyticsValue, { color: colors.textPrimary }]}>{event.attendeeIds.length}</Text>
                <Text style={[styles.analyticsLabel, { color: colors.textHint }]}>{t.eventGoing(event.attendeeIds.length, event.maxAttendees)}</Text>
              </View>
              <View style={[styles.analyticsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.analyticsStat}>
                <Text style={[styles.analyticsValue, { color: colors.textPrimary }]}>{(event.coHostIds ?? []).length + 1}</Text>
                <Text style={[styles.analyticsLabel, { color: colors.textHint }]}>{t.eventCoHostsTitle}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Host check-in action — creator, or a stand-in who took over */}
        {canHostCheckIn && eventHasStarted && (
          <View style={styles.quickActionsRow}>
            <Button
              label="Check In Attendees"
              onPress={() => { markHostArrivedIfNeeded(); setShowCheckInModal(true); }}
              variant="primary"
              fullWidth
            />
          </View>
        )}

        {/* Stand-in host offer — shown to attendees once the creator's grace
            period lapsed with no sign they showed up. */}
        {canOfferStandIn && (
          <Card padded style={[styles.waitlistCard, { borderColor: colors.primary }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.eventHostMissingTitle}</Text>
            <Text style={[styles.waitlistCopy, { color: colors.textSecondary }]}>{t.eventHostMissingBody}</Text>
            <Button
              label={t.eventClaimHostBtn}
              onPress={handleClaimStandInHost}
              loading={claimingHost}
              disabled={claimingHost}
              variant="primary"
              style={{ marginTop: Spacing.sm }}
            />
          </Card>
        )}

        {/* Informational note once someone else has taken over hosting */}
        {!isCreator && !isStandInHost && !!event.standInHostId && (
          <View style={[styles.noteBox, { backgroundColor: colors.surfaceVariant }]}>
            <Icon name="shield" size={15} color={colors.textSecondary} />
            <Text style={[styles.noteText, { color: colors.textSecondary }]}>
              {t.eventStandInAnnounce(profiles[event.standInHostId]?.name ?? '—')}
            </Text>
          </View>
        )}

        {isStandInHost && (
          <View style={[styles.noteBox, { backgroundColor: colors.accentSoft }]}>
            <Icon name="shield" size={15} color={colors.accentInk} />
            <Text style={[styles.noteText, { color: colors.accentInk }]}>{t.eventStandInBadge}</Text>
          </View>
        )}

        {/* Quick actions row */}
        {user && (
          <View style={styles.quickActionsRow}>
            <AnimatedPressable
              onPress={handleSave}
              style={[styles.quickActionBtn, {
                backgroundColor: (user.savedEventIds?.includes(event.id) ?? false) ? colors.primary : colors.surface,
                borderColor: (user.savedEventIds?.includes(event.id) ?? false) ? colors.primary : colors.border,
              }]}
            >
              <Icon
                name="bookmark"
                size={16}
                filled={user.savedEventIds?.includes(event.id) ?? false}
                color={(user.savedEventIds?.includes(event.id) ?? false) ? '#fff' : colors.textSecondary}
              />
              <Text style={[styles.quickActionText, { color: (user.savedEventIds?.includes(event.id) ?? false) ? '#fff' : colors.textSecondary }]}>
                {(user.savedEventIds?.includes(event.id) ?? false) ? t.eventSaved : t.eventSaveBtn}
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={handleCalendar}
              style={[styles.quickActionBtn, {
                backgroundColor: inCalendar ? colors.primary : colors.surface,
                borderColor: inCalendar ? colors.primary : colors.border,
              }]}
            >
              <Icon name={inCalendar ? 'check' : 'cal'} size={16} color={inCalendar ? '#fff' : colors.textSecondary} />
              <Text style={[styles.quickActionText, { color: inCalendar ? '#fff' : colors.textSecondary }]}>
                {inCalendar ? t.eventInCalendar : t.eventAddToCalendar}
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={handleShare}
              style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Icon name="share" size={16} color={colors.textSecondary} />
              <Text style={[styles.quickActionText, { color: colors.textSecondary }]}>{t.eventShareAction}</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={handleShareAsImage}
              style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Icon name="image" size={16} color={colors.textSecondary} />
              <Text style={[styles.quickActionText, { color: colors.textSecondary }]}>{t.eventShareCard}</Text>
            </AnimatedPressable>
          </View>
        )}

        {/* Info rows — icon + two-line text, no card/dividers (spec §4) */}
        <View style={styles.infoRows}>
          <InfoRow
            icon="clock"
            title={format(event.dateTime, 'EEEE, d MMMM yyyy', { locale: dateLocale })}
            subtitle={format(event.dateTime, 'HH:mm')}
          />
          <Pressable onPress={handleOpenLocation}>
            <InfoRow icon="pin" title={event.location} subtitle={t.eventMetaLocation} />
          </Pressable>
          <InfoRow
            icon="users"
            title={full && !attending ? t.eventFull : t.eventSpotsLeft(spots)}
            subtitle={
              t.eventGoing(event.attendeeIds.length, event.maxAttendees)
              + (full && (event.waitlistIds?.length ?? 0) > 0 ? `  ·  ${t.eventWaitlistCount(event.waitlistIds.length)}` : '')
            }
          />
        </View>

        {/* Avatar pile teaser (spec §4: divider → avatar pile → description,
            between the info rows and the full "who's going" roster below). */}
        {event.attendeeIds.length > 0 && (
          <>
            <View style={[styles.hr, { borderColor: colors.border }]} />
            <AvatarPile
              profiles={event.attendeeIds.slice(0, 4).map((uid) => profiles[uid]).filter(Boolean)}
              totalCount={event.attendeeIds.length}
              caption={t.eventGoing(event.attendeeIds.length, event.maxAttendees)}
            />
          </>
        )}

        {/* Description */}
        {!!event.description && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.eventAbout}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{event.description}</Text>
          </View>
        )}


        {/* Who's going — a green checkmark marks who actually checked in
            (realCheckedInUids, sourced live from the checkIns subcollection)
            vs. everyone here, who just RSVP'd. */}
        <View style={styles.section}>
          <View style={styles.whosGoingHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.eventWhosGoing}</Text>
            <View style={styles.whosGoingHeaderRight}>
              {attending && !eventIsOver && (
                <AnimatedPressable onPress={() => setShowInviteModal(true)} style={styles.inviteFriendBtn} hitSlop={6}>
                  <Icon name="plus" size={12} color={colors.primary} />
                  <Text style={[styles.inviteFriendBtnText, { color: colors.primary }]}>{t.eventInviteFriendBtn}</Text>
                </AnimatedPressable>
              )}
              {eventHasStarted && realCheckedInUids.length > 0 && (
                <Text style={[styles.whosGoingCheckedInCount, { color: colors.textHint }]}>
                  {t.checkinHereNow(realCheckedInUids.length)}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.participantsGrid}>
            {event.attendeeIds.map((uid) => {
              const profile = profiles[uid];
              const name = profile?.name ?? 'User';
              const uni = (profile as any)?.university ?? '';
              const dept = (profile as any)?.department ?? '';
              const uniLine = [uni, dept].filter(Boolean).join(' · ');
              const mutualCount = user && profile?.following
                ? profile.following.filter((fUid) => (user.following ?? []).includes(fUid)).length
                : 0;
              const isMe = uid === user?.id;
              const isCoHostUid = (event.coHostIds ?? []).includes(uid);
              const isCreatorUid = uid === event.creatorId;
              const didCheckIn = realCheckedInUids.includes(uid);
              return (
                <AnimatedPressable
                  key={uid}
                  onPress={() => {
                    if (uid === user?.id) {
                      router.navigate('/(app)');
                      // PagerView.setPage() is unreliable while the tab screen isn't
                      // focused/visible yet — give the navigation a tick to land first.
                      setTimeout(() => goToTab(4), 50);
                    } else router.push(`/(app)/user/${uid}`);
                  }}
                  onLongPress={() => {
                    if (isCreator && !isCreatorUid && !isMe) handleToggleCoHost(uid);
                  }}
                  style={[styles.participantCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <View style={styles.participantTop}>
                    <Avatar profile={profile} size={40} />
                    {didCheckIn && (
                      <View style={[styles.checkedInBadge, { backgroundColor: colors.success, borderColor: colors.surface }]}>
                        <Icon name="check" size={9} color="#fff" />
                      </View>
                    )}
                    {isMe && (
                      <View style={[styles.meBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
                        <Text style={styles.meBadgeText}>{t.eventYou}</Text>
                      </View>
                    )}
                    {!isMe && isCoHostUid && (
                      <View style={[styles.meBadge, { backgroundColor: '#A0702C', borderColor: colors.surface }]}>
                        <Text style={styles.meBadgeText}>{t.eventCoHostBadge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.participantName, { color: colors.textPrimary }]} numberOfLines={1}>{name}</Text>
                  <Text style={[styles.participantUni, { color: colors.textHint }]} numberOfLines={1}>{uniLine}</Text>
                  {!isMe && mutualCount > 0 && (
                    <Text style={[styles.participantMutual, { color: colors.primary }]} numberOfLines={1}>
                      {t.eventMutualConnections(mutualCount)}
                    </Text>
                  )}
                  {!isMe && didCheckIn && (
                    <Pressable
                      onPress={(e) => { e?.stopPropagation?.(); haptics.light(); toggleKudos(uid); }}
                      hitSlop={6}
                      style={styles.kudosRow}
                    >
                      <Icon
                        name="heart"
                        size={12}
                        filled={(kudos[uid] ?? []).includes(user?.id ?? '')}
                        color={(kudos[uid] ?? []).includes(user?.id ?? '') ? colors.primary : colors.textHint}
                      />
                      {(kudos[uid] ?? []).length > 0 && (
                        <Text style={[styles.kudosRowCount, { color: colors.textHint }]}>{(kudos[uid] ?? []).length}</Text>
                      )}
                    </Pressable>
                  )}
                  {eventHasEnded && !isMe && attending && !reviewedUids.includes(uid) && (
                    <Pressable
                      onPress={(e) => { e?.stopPropagation?.(); handleSubmitReview(uid); }}
                      style={{ marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.primary + '20' }}
                    >
                      <Text style={{ fontSize: 11, color: colors.primary, fontWeight: 'bold' }}>Review</Text>
                    </Pressable>
                  )}

                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        {/* Post-event "how was it?" — private quality signal, aggregated
            server-side onto the event + creator (onEventFeedback), never
            shown as a public rating. Only offered to people who actually
            checked in, once the event is assumed over. */}
        {eventIsOver && hasCheckedIn && ownFeedback === null && (
          <View style={styles.section}>
            <View style={[styles.feedbackCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.feedbackQuestion, { color: colors.textPrimary }]}>{t.eventFeedbackQuestion}</Text>
              <View style={styles.feedbackBtns}>
                <Button label={t.eventFeedbackGood} onPress={() => submitFeedback('good')} variant="soft" size="sm" />
                <Button label={t.eventFeedbackBad} onPress={() => submitFeedback('bad')} variant="outline" size="sm" />
              </View>
            </View>
          </View>
        )}

        {/* Restrictions */}
        {hasFilters && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.eventRestrictions}</Text>
            <View style={[styles.filtersCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {event.genderFilter && event.genderFilter !== 'any' && (
                <View style={styles.filterRow}>
                  <Icon name="user" size={16} color={colors.textSecondary} />
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{GENDER_LABELS[event.genderFilter]}</Text>
                </View>
              )}
              {(event.minAge || event.maxAge) && (
                <View style={styles.filterRow}>
                  <Icon name="shield" size={16} color={colors.textSecondary} />
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t.eventFilterAge} {event.minAge ?? 18}–{event.maxAge ?? '∞'}</Text>
                </View>
              )}
              {event.allowedUniversities && event.allowedUniversities.length > 0 && (
                <View style={styles.filterRow}>
                  <View style={{ width: 16 }} />
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{event.allowedUniversities.join(', ')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Chat ── now lives in its own screen (Messages → Events tab)
            instead of buried inside this page; this is just the entry
            point. (only for attendees) */}
        {attending && (
          <View style={styles.section}>
            <AnimatedPressable
              onPress={() => router.push(`/(app)/event-chat/${event.id}`)}
              style={[styles.chatOpenRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Icon name="chat" size={18} color={colors.primary} />
              <Text style={[styles.chatOpenText, { color: colors.textPrimary }]}>{t.eventChatTitle}</Text>
              <Icon name="fwd" size={16} color={colors.textHint} />
            </AnimatedPressable>
          </View>
        )}

        {/* Photo wall */}
        {(wallPhotos.length > 0 || (attending && event.dateTime < new Date())) && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <Icon name="camera" size={16} color={colors.textSecondary} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  {t.eventPhotoWall ?? 'Photo Wall'}{wallPhotos.length > 0 ? ` (${wallPhotos.length})` : ''}
                </Text>
              </View>
              {hasCheckedIn && (
                <AnimatedPressable
                  onPress={handleUploadWallPhoto}
                  disabled={uploadingWallPhoto}
                  style={[styles.photoWallAddBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                >
                  <Text style={styles.photoWallAddText}>{uploadingWallPhoto ? '...' : '+ Add'}</Text>
                </AnimatedPressable>
              )}
            </View>
            {wallPhotos.length === 0 ? (
              <View style={[styles.chatEmpty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name="image" size={26} color={colors.textDecor} />
                <Text style={[styles.chatEmptyText, { color: colors.textHint }]}>
                  {t.eventPhotoWallEmpty ?? 'No photos yet. Be the first to share a moment!'}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.photoGrid}>
                  {wallPhotos.map((p) => (
                    <View key={p.id} style={[styles.photoGridItem, { borderColor: colors.border }]}>
                      <Pressable onPress={() => setSavePhotoUri(p.uri)}>
                        <Image source={{ uri: p.uri }} style={styles.photoGridImg} resizeMode="cover" />
                      </Pressable>
                      <Pressable
                        onPress={() => p.uploaderUid && router.push(`/(app)/user/${p.uploaderUid}`)}
                        style={[styles.photoGridFooter, { backgroundColor: p.uploaderAvatarColor }]}
                      >
                        <Text style={styles.photoGridName} numberOfLines={1}>{p.uploaderName.split(' ')[0]}</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
                <Text style={[styles.photoWallRetentionHint, { color: colors.textHint }]}>
                  {t.eventPhotoWallRetentionHint}
                </Text>
              </>
            )}
          </View>
        )}

        {/* Hidden share card (captured by ViewShot) */}
        <View style={styles.shareCardContainer}>
          <View
            ref={shareCardRef}
            style={[styles.shareCard, { backgroundColor: event.imageUri ? '#000' : categoryColor }]}
            collapsable={false}
          >
            {event.imageUri && (
              <Image source={{ uri: event.imageUri }} style={styles.shareCardBgImage} resizeMode="cover" />
            )}
            <View style={styles.shareCardFloatWrap}>
              <View style={styles.shareCardFloat}>
                <Text style={styles.shareCardTitleHighlight}>{event.title}</Text>
                <Text style={styles.shareCardFloatMeta}>
                  📌 {event.location} · {format(event.dateTime, 'EEE d MMM, HH:mm', { locale: dateLocale })}
                </Text>
              </View>
              <View style={styles.shareCardQrRow}>
                <View style={styles.shareCardQrBox}>
                  <QRCode value={`keno://event/${event.id}`} size={56} />
                </View>
                <Text style={styles.shareCardQrHint}>{t.eventShareCardScanHint}</Text>
              </View>
            </View>
            <Image source={require('../../../assets/images/icon.png')} style={styles.shareCardApp} />
          </View>
        </View>
      </ScrollView>

      {/* QR Check-in modal (creator only) */}
      <Modal visible={showQr} transparent animationType="fade" onRequestClose={() => setShowQr(false)}>
        <AnimatedPressable style={styles.qrOverlay} onPress={() => setShowQr(false)}>
          <AnimatedPressable style={[styles.qrCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => {}}>
            <Text style={[styles.qrTitle, { color: colors.textPrimary }]}>{t.eventQrTitle}</Text>
            <View style={[styles.qrBox, { backgroundColor: '#fff' }]}>
              <QRCode value={`keno:checkin:${event.id}:${checkinSecret ?? ''}:${qrBucket}`} size={200} />
            </View>
            <Text style={[styles.qrHint, { color: colors.textHint }]}>{event.title}</Text>
            <Text style={[styles.qrRotateHint, { color: colors.textDecor }]}>{t.eventQrRotateHint}</Text>
          </AnimatedPressable>
        </AnimatedPressable>
      </Modal>

      {/* XP Staking Modal */}
      <Modal visible={showStakingModal} transparent animationType="fade" onRequestClose={() => setShowStakingModal(false)}>
        <View style={styles.requestModalBackdrop}>
          <View style={[styles.requestModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.requestModalTitle, { color: colors.textPrimary }]}>
              {t.eventStakeModalTitleRequired}
            </Text>
            <Text style={[styles.requestModalHint, { color: colors.textSecondary }]}>
              {t.eventStakeModalHintRequired}
            </Text>

            <View style={{ gap: 12, marginVertical: 16 }}>
              <Text style={[{ color: colors.textPrimary, fontWeight: FontWeight.bold }]}>Your XP: {user?.xp ?? 0}</Text>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {XP_VALUES.rsvpStakeOptions.map((xp) => (
                  <AnimatedPressable
                    key={xp}
                    onPress={() => setStakingXp(xp)}
                    style={[
                      { flex: 1, padding: 12, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center' },
                      stakingXp === xp
                        ? { borderColor: colors.primary, backgroundColor: colors.accentSoft }
                        : { borderColor: colors.border, backgroundColor: colors.surfaceVariant }
                    ]}
                  >
                    <Text style={[{ fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: stakingXp === xp ? colors.accentInk : colors.textPrimary }]}>{xp}</Text>
                  </AnimatedPressable>
                ))}
              </View>
            </View>

            <View style={styles.requestModalActions}>
              <Button
                label={t.settingsBtnCancel}
                onPress={() => setShowStakingModal(false)}
                disabled={actionLoading}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                label={t.eventStakeBtn(stakingXp)}
                onPress={handleStakeXp}
                disabled={actionLoading || !user?.xp || user.xp < stakingXp}
                loading={actionLoading}
                variant="primary"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Plus-one invite modal — search a friend, tap to invite. No "stake
          on accept" logic needed here: when they open the event and tap
          Join, handleJoinPress already makes staking mandatory for them if
          they can afford it, same as anyone else joining. */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowInviteModal(false); setInviteSearch(''); setInviteResults([]); }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalBackdrop} onPress={() => { setShowInviteModal(false); setInviteSearch(''); setInviteResults([]); }}>
            <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => {}}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t.eventInviteFriendTitle}</Text>
              <View style={[styles.inviteInputRow, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                <Icon name="search" size={14} color={colors.textHint} />
                <TextInput
                  style={[styles.inviteInput, { color: colors.textPrimary }]}
                  placeholder={t.groupInviteSearch}
                  placeholderTextColor={colors.textHint}
                  value={inviteSearch}
                  onChangeText={handleInviteSearch}
                  autoFocus
                />
                {inviteSearching && <ActivityIndicator size="small" color={colors.textHint} />}
              </View>
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {inviteResults.map((u) => {
                  const alreadyInvited = invitedFriendUids.has(u.uid);
                  return (
                    <View key={u.uid} style={[styles.inviteRow, { borderColor: colors.border }]}>
                      <View style={[styles.inviteAvatar, { backgroundColor: u.avatarColor }]}>
                        <Text style={styles.inviteAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.inviteInfo}>
                        <Text style={[styles.inviteName, { color: colors.textPrimary }]} numberOfLines={1}>{u.name}</Text>
                        {u.universityName ? <Text style={[styles.inviteUni, { color: colors.textHint }]} numberOfLines={1}>🎓 {universityLabel(u.universityName, language)}</Text> : null}
                      </View>
                      <AnimatedPressable
                        onPress={() => handleInviteFriend(u)}
                        disabled={alreadyInvited}
                        style={[styles.inviteBtn, { backgroundColor: alreadyInvited ? colors.surfaceVariant : colors.primary, borderColor: colors.border }]}
                      >
                        <Text style={[styles.inviteBtnText, { color: alreadyInvited ? colors.textHint : '#fff' }]}>
                          {alreadyInvited ? t.groupInviteSent : t.groupInviteBtn}
                        </Text>
                      </AnimatedPressable>
                    </View>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <SavePhotoModal uri={savePhotoUri} onClose={() => setSavePhotoUri(null)} />

      {/* Check-In Modal (for creators) */}
      <Modal visible={showCheckInModal} transparent animationType="fade" onRequestClose={() => setShowCheckInModal(false)}>
        <View style={styles.requestModalBackdrop}>
          <View style={[styles.requestModalCard, { backgroundColor: colors.surface, borderColor: colors.border, maxHeight: '80%' }]}>
            <Text style={[styles.requestModalTitle, { color: colors.textPrimary }]}>{t.rollCallModalTitle}</Text>
            <Text style={[styles.requestModalHint, { color: colors.textSecondary }]}>
              {t.rollCallModalHint}
            </Text>

            <ScrollView style={{ marginVertical: 12, maxHeight: 300 }} showsVerticalScrollIndicator>
              {pendingCheckInAttendees.length === 0 && (
                <Text style={[styles.requestModalHint, { color: colors.textHint, textAlign: 'center', paddingVertical: 16 }]}>
                  {t.rollCallModalAllDone}
                </Text>
              )}
              {pendingCheckInAttendees.map((uid) => {
                const profile = profiles[uid];
                const isChecked = checkedInUids.includes(uid);
                return (
                  <AnimatedPressable
                    key={uid}
                    onPress={() => handleToggleCheckIn(uid)}
                    style={[
                      { padding: 12, marginVertical: 6, borderRadius: BorderRadius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
                      isChecked
                        ? { borderColor: colors.primary, backgroundColor: colors.accentSoft }
                        : { borderColor: colors.border, backgroundColor: colors.surfaceVariant }
                    ]}
                  >
                    {isChecked ? (
                      <Icon name="check" size={18} color={colors.primary} />
                    ) : (
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.textDecor }} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[{ fontWeight: FontWeight.bold, color: colors.textPrimary }]}>{profile?.name ?? 'User'}</Text>
                      <Text style={[{ fontSize: 12, color: colors.textHint }]}>{profile?.universityEmail ?? ''}</Text>
                    </View>
                  </AnimatedPressable>
                );
              })}
            </ScrollView>

            <View style={styles.requestModalActions}>
              <Button
                label={t.settingsBtnCancel}
                onPress={() => setShowCheckInModal(false)}
                disabled={actionLoading}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                label={t.rollCallModalCheckInBtn(checkedInUids.length)}
                onPress={handleSaveCheckIns}
                disabled={actionLoading || checkedInUids.length === 0}
                loading={actionLoading}
                variant="primary"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Post-check-in shareable recap card (mockup 20) — the growth loop:
          same captureRef mechanism as the invite card above, but framed
          around the memory (duotone cover, attendee pile, XP earned)
          instead of the QR invite. */}
      <Modal visible={showRecapCard} animationType="slide" onRequestClose={() => setShowRecapCard(false)}>
        <View style={[styles.recapContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.recapHeader, { paddingTop: insets.top + 10 }]}>
            <AnimatedPressable onPress={() => setShowRecapCard(false)} style={[styles.circBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name="x" size={16} color={colors.textPrimary} />
            </AnimatedPressable>
            <Text style={[styles.recapHeaderTitle, { color: colors.textPrimary }]}>{t.eventRecapShareTitle}</Text>
            <View style={{ width: 32 }} />
          </View>

          <View style={styles.recapBody}>
            <View ref={recapCardRef} collapsable={false} style={[styles.recapCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {event.imageUri ? (
                <Image source={{ uri: event.imageUri }} style={styles.recapCardImage} resizeMode="cover" />
              ) : (
                <DuotoneScene category={event.category} height={196} />
              )}
              <View style={styles.recapCardBody}>
                <View style={styles.recapCardTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recapDateLabel, { color: colors.textHint }]}>
                      {format(event.dateTime, 'd MMMM yyyy', { locale: dateLocale }).toUpperCase()}
                    </Text>
                    <Text style={[styles.recapTitle, { color: colors.textPrimary }]}>{event.title}</Text>
                  </View>
                  <Text style={[styles.recapWordmark, { color: colors.textPrimary }]}>
                    keno<Text style={{ color: colors.primary }}>.</Text>
                  </Text>
                </View>
                <View style={[styles.recapDivider, { borderColor: colors.border }]} />
                <View style={styles.recapCardBottomRow}>
                  <AvatarPile
                    profiles={event.attendeeIds.slice(0, 3).map((uid) => profiles[uid]).filter(Boolean)}
                    totalCount={event.attendeeIds.length}
                    caption={t.eventGoing(event.attendeeIds.length, event.maxAttendees)}
                  />
                  <Tag label={`+${XP_VALUES.checkinBonus} XP`} variant="accent" />
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.recapActions, { paddingBottom: insets.bottom + 16 }]}>
            <Button
              label={t.eventRecapShareStory}
              onPress={handleShareRecap}
              variant="primary"
              fullWidth
            />
            <Button
              label={t.eventRecapSaveDevice}
              onPress={handleSaveRecap}
              variant="outline"
              fullWidth
            />
          </View>
        </View>
      </Modal>

      {attending && event.attendeeIds.length > 1 && swipedCount < event.attendeeIds.length - 1 && (
        <View style={[styles.cta, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          {/* ctaStack (not bare siblings) so Leave + Check-in/Share-Recap get
              breathing room between them instead of sitting flush against
              each other when both are shown at once. */}
          <View style={styles.ctaStack}>
            {/* "Θα ξαναβρεθείτε" (mockup 28) is explicitly a post-event flow —
                there's no stored event duration, so this uses the same kind of
                fixed-offset heuristic as the check-in window below (30 min
                before start), just on the other side: assume the event is
                over ASSUMED_EVENT_DURATION_MS after it started. */}
            {eventIsOver && (
              <Button label="Connect" onPress={() => router.push(`/(app)/swipes/${event.id}`)} variant="primary" fullWidth />
            )}
            {!isCreator && !eventIsOver && (
              <Button label={t.eventBtnLeave} onPress={handleJoinLeave} variant="outline" loading={actionLoading} fullWidth />
            )}
            {!isCreator && event && new Date() >= new Date(event.dateTime.getTime() - 30 * 60000) && (
              hasCheckedIn ? (
                <Button label={t.eventShareRecapBtn} onPress={() => setShowRecapCard(true)} variant="outline" fullWidth />
              ) : !eventIsOver ? (
                <Button label={t.checkinTitle} onPress={() => router.push(`/(app)/checkin/${event.id}`)} variant="primary" fullWidth />
              ) : null
            )}
          </View>
        </View>
      )}

      {!isCreator && !attending && (
        <View style={[styles.cta, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
          {!isEligible ? (
            <View style={styles.ctaStack}>
              <Button label={t.eventBtnJoin} onPress={() => {}} variant="primary" disabled fullWidth />
              <Text style={[styles.waitlistHint, { color: colors.error }]}>
                {ageIneligible ? t.eventNotEligibleAge : t.eventNotEligibleUniversity}
              </Text>
            </View>
          ) : full ? (
            <View style={styles.ctaStack}>
              <Button
                label={onWaitlist ? t.eventWaitlistCancelBtn : t.eventBtnWaitlist(event.waitlistIds.length)}
                onPress={handleWaitlist}
                variant={onWaitlist ? 'outline' : 'primary'}
                loading={actionLoading}
                fullWidth
              />
              {!onWaitlist && (
                <Text style={[styles.waitlistHint, { color: colors.textHint }]}>
                  {t.eventWaitlistHint}
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.ctaStack}>
              <View style={styles.ctaRow}>
                <Text style={[styles.ctaStatus, { color: colors.textPrimary }]}>{t.eventSpotsLeft(spots)}</Text>
                {/* Staking is mandatory for anyone who can afford it — tapping
                    Join opens the staking modal instead of joining outright.
                    Joining itself is never blocked by XP — someone who can't
                    afford the cheapest tier just joins for free, same as a
                    brand-new user with 0 XP always could. */}
                <Button label={t.eventBtnJoin} onPress={handleJoinPress} variant="primary" loading={actionLoading} />
              </View>
              {canAffordStake && (
                <Text style={[styles.waitlistHint, { color: colors.textHint, alignSelf: 'center' }]}>
                  {t.eventStakeRequiredHint(XP_VALUES.rsvpStakeOptions[0])}
                </Text>
              )}
            </View>
          )}
        </View>
      )}


    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { width: '100%', height: 232 },
  heroImage: { width: '100%', height: '100%' },
  heroControls: {
    position: 'absolute', left: Spacing.gutter, right: Spacing.gutter,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  heroCreatorActions: { flexDirection: 'row', gap: 8 },
  circBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  content: { padding: Spacing.gutter, gap: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: 6 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, lineHeight: 27, fontFamily: TitleFont, letterSpacing: -0.4 },
  countdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full, borderWidth: 1, marginTop: 4 },
  countdownText: { fontSize: 12, fontWeight: FontWeight.bold, fontFamily: UIFont },
  // Quick actions
  quickActionsRow: { flexDirection: 'row', gap: Spacing.sm },
  quickActionBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 3, paddingVertical: 10, borderRadius: BorderRadius.lg, borderWidth: 1},
  quickActionEmoji: { fontSize: 18 },
  quickActionText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, textAlign: 'center' },
  // Reactions
  reactionsCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm},
  reactionsHint: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  reactionsRow: { flexDirection: 'row', gap: Spacing.sm },
  reactionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1 },
  reactionBtnEmoji: { fontSize: 18 },
  reactionBtnLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  reactionCount: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 },
  reactionCountText: { fontSize: 11, fontWeight: FontWeight.bold },
  // Live Mode
  liveCard: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  liveHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.2, textTransform: 'uppercase' },
  liveFindGroup: { gap: Spacing.sm },
  liveFindGroupText: { fontSize: FontSize.base, lineHeight: 20 },
  liveFindGroupPhoto: { width: '100%', height: 130, borderRadius: BorderRadius.sm },
  liveActionsRow: { flexDirection: 'row', gap: Spacing.sm },
  liveActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1 },
  liveActionText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  liveEndBtn: { alignItems: 'center', paddingVertical: 9, borderRadius: BorderRadius.md, borderWidth: 1 },
  liveEndBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  liveSafetyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 4, alignSelf: 'center' },
  liveSafetyText: { fontSize: 11, fontWeight: FontWeight.medium, fontFamily: UIFont },
  // Info rows (spec §4) — borderless, no card
  infoRows: {},
  hr: { borderTopWidth: 1 },
  // Sections
  section: { gap: Spacing.sm },
  feedbackCard: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  feedbackQuestion: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  feedbackBtns: { flexDirection: 'row', gap: Spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoWallAddBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: BorderRadius.full, borderWidth: 1 },
  photoWallAddText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.extrabold },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photoWallRetentionHint: { fontSize: 11, fontFamily: UIFontLight, textAlign: 'center', marginTop: 8 },
  photoGridItem: { width: '47%', borderRadius: BorderRadius.md, overflow: 'hidden', borderWidth: 1 },
  photoGridImg: { width: '100%', aspectRatio: 4 / 3 },
  photoGridFooter: { paddingHorizontal: 8, paddingVertical: 4 },
  photoGridName: { color: '#fff', fontSize: 11, fontWeight: FontWeight.bold },
  // Warm Paper "note" box (spec §4): accent.soft bg, no border, icon + text.
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, borderRadius: BorderRadius.md, padding: Spacing.md },
  noteText: { flex: 1, fontSize: FontSize.sm, lineHeight: 18, fontWeight: FontWeight.semibold },
  // Waitlist detail card (mockup 13)
  waitlistCard: { gap: 9 },
  waitlistHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  waitlistCopy: { fontSize: FontSize.sm, lineHeight: 18 },
  privateBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md },
  privateBannerEmoji: { fontSize: 22 },
  privateBannerTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  privateBannerSub: { fontSize: 11 },
  actionCard: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', justifyContent: 'center'},
  description: { fontSize: FontSize.md, lineHeight: 22 },
  // Participants
  participantsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  participantCard: { width: '30%', borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.sm, alignItems: 'center', gap: 4},
  participantTop: { position: 'relative' },
  meBadge: { position: 'absolute', bottom: -4, right: -8, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1.5 },
  meBadgeText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold },
  checkedInBadge: {
    position: 'absolute', top: -3, left: -3, width: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  whosGoingHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 0 },
  whosGoingHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  whosGoingCheckedInCount: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  inviteFriendBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  inviteFriendBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  participantName: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textAlign: 'center', fontFamily: UIFont },
  participantUni: { fontSize: 10, textAlign: 'center' },
  participantMutual: { fontSize: 9, fontWeight: FontWeight.bold, textAlign: 'center' },
  kudosRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2, paddingVertical: 2 },
  kudosRowCount: { fontSize: 9, fontWeight: FontWeight.bold },
  // Filters
  filtersCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm},
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  filterIcon: { fontSize: 16 },
  filterLabel: { fontSize: FontSize.sm },
  // Chat (moved to its own screen — this is just the empty state shared
  // with the photo wall, and the entry-point row into that screen)
  chatEmpty: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  chatEmptyEmoji: { fontSize: 32 },
  chatEmptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  chatOpenRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md },
  chatOpenText: { flex: 1, fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  // Avatars
  avatarCircle: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontWeight: FontWeight.bold },
  avatarImg: {},
  // CTA
  cta: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.gutter, paddingTop: Spacing.md, borderTopWidth: 1 },
  ctaStack: { gap: 6 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  ctaStatus: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  waitlistHint: { fontSize: FontSize.xs, textAlign: 'center' },
  // QR modal
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  qrCard: { width: '100%', maxWidth: 300, borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md },
  qrTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  qrBox: { padding: Spacing.md, borderRadius: BorderRadius.md },
  qrHint: { fontSize: FontSize.sm, textAlign: 'center' },
  qrRotateHint: { fontSize: FontSize.xs, textAlign: 'center', marginTop: -4 },
  // Analytics
  analyticsCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md},
  joinRequestRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  joinRequestUser: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  joinRequestName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flexShrink: 1 },
  joinRequestActions: { flexDirection: 'row', gap: 6 },
  joinRequestBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1 },
  joinRequestBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  joinRequestMessage: { fontSize: FontSize.xs, marginTop: 1 },
  requestModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  requestModalCard: { width: '100%', maxWidth: 380, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: 10},
  requestModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  requestModalHint: { fontSize: FontSize.sm, lineHeight: 20 },
  requestModalInput: { borderWidth: 1.5, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.sm, minHeight: 90, textAlignVertical: 'top' },
  requestModalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  requestModalBtn: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.full, paddingVertical: 10, alignItems: 'center' },
  requestModalBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  analyticsSectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  analyticsRow: { flexDirection: 'row', alignItems: 'center' },
  analyticsStat: { flex: 1, alignItems: 'center', gap: 2 },
  analyticsValue: { fontSize: 22, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  analyticsLabel: { fontSize: FontSize.xs, textAlign: 'center' },
  analyticsDivider: { width: 1.5, height: 40, marginHorizontal: 8 },
  // Share card
  shareCardContainer: { position: 'absolute', top: -9999, left: 0, right: 0 },
  // 360x640 @3x device pixel ratio = 1080x1920, Instagram Story's exact recommended size
  shareCard: { width: 360, height: 640, borderRadius: 24, overflow: 'hidden' },
  shareCardBgImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  shareCardFloatWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 36 },
  shareCardFloat: {
    backgroundColor: '#FFFDF7',
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  shareCardTitleHighlight: {
    alignSelf: 'flex-start',
    fontSize: 16,
    fontWeight: FontWeight.bold,
    fontFamily: UIFont,
    color: '#5b2a04',
    backgroundColor: '#FCE96A',
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  shareCardFloatMeta: { fontSize: 14, fontWeight: FontWeight.semibold, color: '#666', marginTop: 6 },
  shareCardQrRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  shareCardQrBox: { backgroundColor: '#fff', padding: 4, borderRadius: 8 },
  shareCardQrHint: { fontSize: 11, fontWeight: FontWeight.semibold, color: '#FFFDF7', flex: 1 },
  shareCardApp: {
    position: 'absolute', top: 20, left: 20,
    width: 36, height: 36, borderRadius: 10,
  },
  // Recap card modal (mockup 20)
  recapContainer: { flex: 1 },
  recapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.gutter, paddingBottom: 10 },
  recapHeaderTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  recapBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.gutter },
  recapCard: { width: '100%', maxWidth: 340, borderWidth: 1, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  recapCardImage: { width: '100%', height: 196 },
  recapCardBody: { padding: 15, gap: 10 },
  recapCardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  recapDateLabel: { fontSize: 10.5, fontWeight: FontWeight.bold, letterSpacing: 1.2, fontFamily: UIFont },
  recapTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: TitleFont, marginTop: 5, letterSpacing: -0.25 },
  recapWordmark: { fontSize: 17, fontWeight: FontWeight.bold, fontFamily: TitleFont },
  recapDivider: { borderTopWidth: 1, borderStyle: 'dashed' },
  recapCardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recapActions: { paddingHorizontal: Spacing.gutter, gap: Spacing.sm },
  // Staking modal
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, borderWidth: 1, borderBottomWidth: 0, padding: Spacing.lg, gap: Spacing.md },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  // Plus-one invite modal
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.xl, paddingBottom: 40, gap: Spacing.md, maxHeight: '70%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.sm },
  modalList: { flexGrow: 0 },
  inviteInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.full, borderWidth: 1.5, paddingHorizontal: Spacing.md, height: 40, gap: 8 },
  inviteInput: { flex: 1, fontSize: FontSize.sm },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1 },
  inviteAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inviteAvatarText: { color: '#fff', fontSize: 15, fontWeight: FontWeight.bold },
  inviteInfo: { flex: 1, gap: 1 },
  inviteName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  inviteUni: { fontSize: FontSize.xs },
  inviteBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1 },
  inviteBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  modalDesc: { fontSize: FontSize.sm, lineHeight: 18 },
  stakingInfo: { gap: Spacing.sm, paddingVertical: Spacing.md },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.sm },
  xpLabel: { fontSize: FontSize.sm },
  xpValue: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  xpOptions: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'space-around', marginVertical: Spacing.md },
  xpOption: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: '#ccc' },
  xpOptionText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  modalButtons: { gap: Spacing.sm, marginTop: Spacing.md },
});
