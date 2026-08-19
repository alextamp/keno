import * as admin from 'firebase-admin';
import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { ImageAnnotatorClient } from '@google-cloud/vision';

admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();
const visionClient = new ImageAnnotatorClient();

const RESEND_API_KEY = defineSecret('RESEND_API_KEY');

// Simple per-user, per-action rate limiter for the callable functions below
// — none of them had any cooldown before, so a scripted client could hammer
// sendVerificationEmail (costs real money per call) or spam claimReferral/
// claimStandInHost with no cost to the caller. Stored under
// users/{uid}/private/rateLimits, written via the Admin SDK like everything
// else in this file (bypasses firestore.rules, no client access needed).
// Resets the window once windowMs has elapsed since it started; otherwise
// increments and rejects once maxCalls is hit within the window.
async function checkRateLimit(uid: string, action: string, maxCalls: number, windowMs: number): Promise<void> {
  const ref = db.collection('users').doc(uid).collection('private').doc('rateLimits');
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() ?? {}) : {};
    const entry = data[action] as { count: number; windowStart: number } | undefined;
    const now = Date.now();
    if (!entry || now - entry.windowStart > windowMs) {
      tx.set(ref, { [action]: { count: 1, windowStart: now } }, { merge: true });
      return;
    }
    if (entry.count >= maxCalls) {
      throw new HttpsError('resource-exhausted', 'Too many requests — please try again in a bit.');
    }
    tx.set(ref, { [action]: { count: entry.count + 1, windowStart: entry.windowStart } }, { merge: true });
  });
}

// Mirrors src/core/utils/weekId.ts (Functions can't import from src/, and
// this is the only place server-side code needs an ISO-week id). Keep the
// two in sync if the algorithm ever changes.
function getISOWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// Mirrors src/core/constants/quests.ts WEEKLY_QUESTS (target + xp only —
// Functions can't import from src/). Keep in sync if quests change there.
const WEEKLY_QUEST_REWARDS: Record<string, { target: number; xp: number }> = {
  join_events: { target: 2, xp: 30 },
  meet_people: { target: 3, xp: 25 },
  host_event: { target: 1, xp: 50 },
  checkin_event: { target: 1, xp: 20 },
  save_events: { target: 2, xp: 15 },
  follow_people: { target: 2, xp: 20 },
};

// Mirrors src/core/constants/gamification.ts XP_VALUES.noShowPenalty and
// app/(app)/event/[id].tsx's ASSUMED_EVENT_DURATION_MS (Functions can't
// import from src/ or app/). Keep in sync if either changes.
const NO_SHOW_PENALTY_XP = 15;
const ASSUMED_EVENT_DURATION_MS = 3 * 60 * 60 * 1000;
// How far back markNoShows looks for events that just ended — bounds the
// query instead of rescanning the entire events collection every run.
// Anything that somehow slips past this window (function was down, etc.)
// just never gets a no-show sweep, which is an acceptable gap at this scale.
const NO_SHOW_SCAN_WINDOW_MS = 24 * 60 * 60 * 1000;

// Mirrors src/core/constants/gamification.ts hostNoShowPenalty /
// standInHostBonus / HOST_GRACE_PERIOD_MS (Functions can't import from src/).
// Keep in sync if any of those change.
const HOST_NO_SHOW_PENALTY_XP = 30;
const STAND_IN_HOST_BONUS_XP = 20;
const HOST_GRACE_PERIOD_MS = 20 * 60 * 1000;

// Mirrors src/core/constants/gamification.ts calculateReliabilityScore —
// duplicated here because nothing client-side ever actually calls the
// original (updateReliabilityScore has no caller), so this sweep is the
// only place the score gets computed from real attendance data.
function calculateReliabilityScore(attendanceHistory: Record<string, { checkedIn: boolean }> | undefined): number {
  if (!attendanceHistory || Object.keys(attendanceHistory).length === 0) return 0;
  const recent = Object.values(attendanceHistory).slice(-10);
  const checkedIn = recent.filter((e) => e.checkedIn).length;
  return Math.round((checkedIn / recent.length) * 100);
}

// Lazy-reset increment for weeklyQuests.{questId}.progress: mirrors the
// client-side logic in auth.store.ts's incrementQuestProgress, since
// Cloud Functions has no scheduled job to zero these out at week boundaries.
// Also awards the quest's XP exactly once, the moment progress first
// crosses its target for the current week.
async function incrementWeeklyQuestServerSide(uid: string, questId: string, amount = 1): Promise<void> {
  const weekId = getISOWeekId(new Date());
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const existing = snap.data()?.weeklyQuests?.[questId];
  const prevProgress = existing && existing.weekId === weekId ? (existing.progress ?? 0) : 0;
  const newProgress = prevProgress + amount;
  const update: Record<string, unknown> = { [`weeklyQuests.${questId}`]: { progress: newProgress, weekId } };
  const reward = WEEKLY_QUEST_REWARDS[questId];
  if (reward && prevProgress < reward.target && newProgress >= reward.target) {
    update.xp = admin.firestore.FieldValue.increment(reward.xp);
  }
  await ref.update(update);
}

type NotifType =
  | 'follow'
  | 'event_join'
  | 'event_message'
  | 'event_invite'
  | 'waitlist_promoted'
  | 'event_cancelled'
  | 'event_reminder'
  | 'group_invite'
  | 'event_join_request'
  | 'event_join_accepted'
  | 'group_join_request'
  | 'group_join_accepted'
  | 'group_message'
  | 'dm_message'
  | 'buddy_match'
  | 'mutual_match'
  | 'level_up'
  | 'friend_going'
  | 'referral_reward';

function buildPushMessage(type: NotifType, fromName: string, eventTitle?: string): { title: string; body: string } {
  switch (type) {
    case 'follow':
      return { title: '👤 New follower', body: `${fromName} started following you` };
    case 'event_join':
      return {
        title: '🎉 Someone joined!',
        body: eventTitle ? `${fromName} joined "${eventTitle}"` : `${fromName} joined your event`,
      };
    case 'event_message':
      return {
        title: '💬 New message',
        body: eventTitle ? `${fromName} sent a message in "${eventTitle}"` : `${fromName} sent you a message`,
      };
    case 'event_invite':
      return {
        title: "📩 You're invited!",
        body: eventTitle ? `${fromName} invited you to "${eventTitle}"` : `${fromName} invited you to an event`,
      };
    case 'waitlist_promoted':
      return {
        title: '🎊 You\'re in!',
        body: eventTitle ? `A spot opened up — you\'re now attending "${eventTitle}"` : 'A spot opened up and you\'re now attending!',
      };
    case 'event_cancelled':
      return {
        title: '❌ Event cancelled',
        body: eventTitle ? `"${eventTitle}" has been cancelled` : 'An event you joined has been cancelled',
      };
    case 'event_reminder':
      return {
        title: '⏰ Starting soon',
        body: eventTitle ? `"${eventTitle}" starts in 1 hour` : 'An event you joined starts in 1 hour',
      };
    case 'group_invite':
      return {
        title: '👥 Group invite',
        body: eventTitle ? `${fromName} invited you to "${eventTitle}"` : `${fromName} invited you to a group`,
      };
    case 'event_join_request':
      return {
        title: '🙋 Join request',
        body: eventTitle ? `${fromName} wants to join "${eventTitle}"` : `${fromName} wants to join your event`,
      };
    case 'event_join_accepted':
      return {
        title: '✅ Request approved',
        body: eventTitle ? `You've been added to "${eventTitle}"` : 'Your join request was approved!',
      };
    case 'group_join_request':
      return {
        title: '🙋 Group join request',
        body: eventTitle ? `${fromName} wants to join "${eventTitle}"` : `${fromName} wants to join your group`,
      };
    case 'group_join_accepted':
      return {
        title: '✅ Group approved',
        body: eventTitle ? `You've joined "${eventTitle}"` : 'Your group join request was approved!',
      };
    case 'group_message':
      return {
        title: '💬 Group message',
        body: eventTitle ? `${fromName} sent a message in "${eventTitle}"` : `${fromName} sent a group message`,
      };
    case 'dm_message':
      return {
        title: '💬 New message',
        body: `${fromName} sent you a message`,
      };
    case 'buddy_match':
      return {
        title: '👥 Buddy matched!',
        body: `${fromName} is also solo at this event. You got matched!`,
      };
    case 'mutual_match':
      return {
        title: '❤️ It\'s a match!',
        body: `You and ${fromName} swiped on each other!`,
      };
    case 'level_up':
      return {
        title: '🎉 Level up!',
        body: eventTitle ? `You reached Level ${eventTitle}. Keep your streak going!` : 'You reached a new level!',
      };
    case 'friend_going':
      return {
        title: '👋 A friend is going',
        body: eventTitle ? `${fromName} is going to "${eventTitle}"` : `${fromName} joined an event`,
      };
    case 'referral_reward':
      return {
        title: '🎟️ Plus One!',
        body: eventTitle ? `${fromName} checked in to "${eventTitle}" — you both earned a Plus One ticket` : `${fromName} checked in — you earned a Plus One ticket`,
      };
    default:
      return { title: 'Keno', body: 'You have a new notification' };
  }
}

export const onNotificationCreated = onDocumentCreated(
  'users/{userId}/notifications/{notifId}',
  async (event) => {
    const notif = event.data?.data();
    if (!notif) return;

    const { userId } = event.params;

    // Get recipient's push token
    const userSnap = await db.doc(`users/${userId}`).get();
    if (!userSnap.exists) return;

    const pushToken: string | undefined = userSnap.data()?.pushToken;
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;

    const { title, body } = buildPushMessage(
      notif.type as NotifType,
      notif.fromName ?? 'Someone',
      notif.eventTitle,
    );

    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: {
        type: notif.type,
        eventId: notif.eventId ?? null,
        fromUid: notif.fromUid ?? null,
      },
    };

    try {
      const chunks = expo.chunkPushNotifications([message]);
      for (const chunk of chunks) {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        // Clean up invalid tokens, and log everything else so failures (e.g.
        // missing/misconfigured Android FCM credentials on the Expo project)
        // are visible in Cloud Functions logs instead of vanishing silently.
        for (const receipt of receipts) {
          if (receipt.status === 'error') {
            if (receipt.details?.error === 'DeviceNotRegistered') {
              await db.doc(`users/${userId}`).update({ pushToken: admin.firestore.FieldValue.delete() });
            } else {
              logger.error('Push send failed', { userId, error: receipt.message, details: receipt.details });
            }
          }
        }
      }
    } catch (err) {
      logger.error('Push send threw', { userId, err: String(err) });
    }
  },
);

// Solo buddy matching — when someone checks in solo, match with another solo attendee.
// arrivedSolo is never set on the initial check-in write (it's added later by
// the "did you come alone?" prompt on the success screen), so this has to be
// an update trigger firing on that flip to true — not onDocumentCreated,
// which would only ever see the field as unset.
export const onCheckIn = onDocumentUpdated(
  'events/{eventId}/checkIns/{userId}',
  async (event) => {
    const before = event.data?.before?.data();
    const checkIn = event.data?.after?.data();
    if (!checkIn || checkIn.arrivedSolo !== true || before?.arrivedSolo === true) return;

    const { eventId, userId } = event.params;

    try {
      // Find other solo attendees who checked in within ±15 minutes
      const now = new Date();
      const fifteenMinAgo = new Date(now.getTime() - 15 * 60000);
      const fifteenMinLater = new Date(now.getTime() + 15 * 60000);

      const q = db.collection(`events/${eventId}/checkIns`).where('arrivedSolo', '==', true).where('timestamp', '>=', fifteenMinAgo).where('timestamp', '<=', fifteenMinLater);
      const snap = await q.get();

      // Find first other solo person (not self)
      const matchedUserId = snap.docs.find((d) => d.id !== userId)?.id;
      if (!matchedUserId) return; // No match found yet

      // Get both users' info for notifications
      const [user1Snap, user2Snap] = await Promise.all([
        db.collection('users').doc(userId).get(),
        db.collection('users').doc(matchedUserId).get(),
      ]);

      const user1 = user1Snap.data();
      const user2 = user2Snap.data();

      // Send buddy match notifications to both
      await Promise.all([
        db.collection(`users/${userId}/notifications`).add({
          type: 'buddy_match',
          fromUid: matchedUserId,
          fromName: user2?.name ?? 'Someone',
          fromAvatarColor: user2?.avatarColor ?? '#C94D0A',
          fromPhotoUri: user2?.photoUri ?? null,
          eventId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
        db.collection(`users/${matchedUserId}/notifications`).add({
          type: 'buddy_match',
          fromUid: userId,
          fromName: user1?.name ?? 'Someone',
          fromAvatarColor: user1?.avatarColor ?? '#C94D0A',
          fromPhotoUri: user1?.photoUri ?? null,
          eventId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
      ]);

      // Auto-create DM conversation between buddies
      const convoId = [userId, matchedUserId].sort().join('_');
      await db.collection('conversations').doc(convoId).set(
        {
          participantIds: [userId, matchedUserId],
          lastMessage: '👥 You got matched!',
          lastAt: admin.firestore.FieldValue.serverTimestamp(),
          isBuddyMatch: true,
        },
        { merge: true },
      );
    } catch (err) {
      console.error('Buddy matching failed:', err);
    }
  },
);

// One-tap "how was it?" feedback (client sets checkIns/{uid}.feedback once,
// see event/[id].tsx) — aggregated server-side onto both the event (so a
// future organiser-facing view could show it) and the creator's lifetime
// organiserFeedback, since a client write can't be trusted to touch another
// user's document directly. Update-triggered, not create, because the
// check-in doc already exists from the QR scan before feedback is added.
export const onEventFeedback = onDocumentUpdated(
  'events/{eventId}/checkIns/{userId}',
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after?.feedback || before?.feedback === after.feedback) return;
    if (after.feedback !== 'good' && after.feedback !== 'bad') return;

    const { eventId } = event.params;
    const field = after.feedback === 'good' ? 'feedbackGoodCount' : 'feedbackBadCount';

    try {
      const eventRef = db.collection('events').doc(eventId);
      await eventRef.update({ [field]: admin.firestore.FieldValue.increment(1) });

      const eventSnap = await eventRef.get();
      const creatorId = eventSnap.data()?.creatorId as string | undefined;
      if (creatorId) {
        await db.collection('users').doc(creatorId).update({
          [`organiserFeedback.${after.feedback}`]: admin.firestore.FieldValue.increment(1),
        });
      }
    } catch (err) {
      logger.error('Event feedback aggregation failed', { eventId, err: String(err) });
    }
  },
);

// Referral reward — check-in-based, not install-based (research doc #17).
// Fires once, the moment a fresh checkIns doc is created, and only pays out
// if the checked-in user was actually invited (events/{eventId}.referredBy,
// written by claimReferral below — never directly by the client; see
// event/[id].tsx and user/[uid].tsx, which call the callable instead of
// writing the field themselves). Server-side and unconditional on XP amount
// so a forged referredBy entry can only ever grant this fixed, small bonus —
// never an arbitrary one — same trust model as the roll-call XP delta bound
// above.
const REFERRAL_BONUS_XP = 20; // keep in sync with XP_VALUES.referralBonus (src/core/constants/gamification.ts)

// Group check-in bonus (research doc #32) — "3 or more mutual friends check
// into the same event." Mutual = direct two-way follow, not just a shared
// connection count. Evaluated from whoever just checked in outward (a
// star centered on them), so it's order-independent: the 3rd person in a
// cluster to check in flags everyone already there, and a 4th mutual friend
// checking in later gets folded in by their own trigger run.
const GROUP_BONUS_MIN_MUTUAL_FRIENDS = 2; // +1 (the checker-in themself) = 3 total
const GROUP_BONUS_XP = 15; // keep in sync with XP_VALUES.groupCheckinBonus

export const onCheckInCreated = onDocumentCreated(
  'events/{eventId}/checkIns/{userId}',
  async (event) => {
    const checkIn = event.data?.data();
    if (!checkIn) return;
    const { eventId, userId } = event.params;

    try {
      const eventRef = db.collection('events').doc(eventId);
      const eventSnap = await eventRef.get();
      const eventData = eventSnap.data();
      const inviterId = eventData?.referredBy?.[userId] as string | undefined;

      if (inviterId && inviterId !== userId) {
        await event.data!.ref.update({ isPlusOne: true });
        await Promise.all([
          db.collection('users').doc(userId).update({ xp: admin.firestore.FieldValue.increment(REFERRAL_BONUS_XP) }),
          db.collection('users').doc(inviterId).update({ xp: admin.firestore.FieldValue.increment(REFERRAL_BONUS_XP) }),
        ]);

        const inviteeSnap = await db.collection('users').doc(userId).get();
        const invitee = inviteeSnap.data();
        await db.collection(`users/${inviterId}/notifications`).add({
          type: 'referral_reward',
          fromUid: userId,
          fromName: invitee?.name ?? 'Someone',
          fromAvatarColor: invitee?.avatarColor ?? '#C94D0A',
          fromPhotoUri: invitee?.photoUri ?? null,
          eventId,
          eventTitle: eventData?.title ?? '',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      logger.error('Referral reward failed', { eventId, userId, err: String(err) });
    }

    try {
      const userSnap = await db.collection('users').doc(userId).get();
      const following: string[] = (userSnap.data()?.following ?? []).filter((uid: string) => uid !== userId);
      if (following.length < GROUP_BONUS_MIN_MUTUAL_FRIENDS) return;

      // Was: fetch every checkIn doc for the whole event on every single
      // check-in — O(event size) reads each time, O(n²) total across a
      // large event (a real cost risk for exactly the flagship events this
      // feature is meant to reward). Scoped instead to just the checking-in
      // user's own following list, chunked into 'in' queries of 10 — reads
      // now scale with the caller's own social graph, not the event's total
      // attendance.
      const followingChunks: string[][] = [];
      for (let i = 0; i < following.length; i += 10) followingChunks.push(following.slice(i, i + 10));
      const checkedInSnaps = await Promise.all(followingChunks.map((chunk) =>
        db.collection(`events/${eventId}/checkIns`).where(admin.firestore.FieldPath.documentId(), 'in', chunk).get(),
      ));
      const candidateUids = checkedInSnaps.flatMap((snap) => snap.docs.map((d) => d.id));
      if (candidateUids.length < GROUP_BONUS_MIN_MUTUAL_FRIENDS) return;

      const candidateSnaps = await Promise.all(candidateUids.map((uid) => db.collection('users').doc(uid).get()));
      const mutualUids = candidateUids.filter((uid, i) => {
        const theirFollowing: string[] = candidateSnaps[i].data()?.following ?? [];
        return theirFollowing.includes(userId);
      });
      if (mutualUids.length < GROUP_BONUS_MIN_MUTUAL_FRIENDS) return;

      await Promise.all([userId, ...mutualUids].map(async (uid) => {
        const ref = db.collection(`events/${eventId}/checkIns`).doc(uid);
        const snap = await ref.get();
        if (snap.exists && !snap.data()?.isGroupBonus) {
          await ref.update({ isGroupBonus: true });
          await db.collection('users').doc(uid).update({ xp: admin.firestore.FieldValue.increment(GROUP_BONUS_XP) });
        }
      }));
    } catch (err) {
      logger.error('Group check-in bonus failed', { eventId, userId, err: String(err) });
    }
  },
);

// Mutual match detection — daily check for mutual swipes and create matches
export const onSwipeCreated = onDocumentCreated(
  'events/{eventId}/swipes/{swipeId}',
  async (event) => {
    const swipe = event.data?.data();
    if (!swipe || swipe.direction !== 'interested') return;

    const { eventId } = event.params;
    const { fromUid, toUid } = swipe;

    try {
      // Check if the other person also swiped interested on this person
      const q = db.collection(`events/${eventId}/swipes`).where('fromUid', '==', toUid).where('toUid', '==', fromUid).where('direction', '==', 'interested');
      const snap = await q.get();

      if (snap.empty) return; // No mutual match

      // Check if match already exists (both directions)
      const existingMatch = await db.collection('mutualMatches')
        .where('eventId', '==', eventId)
        .get();
      const alreadyMatched = existingMatch.docs.some((d) => {
        const data = d.data();
        return (data.user1Id === fromUid && data.user2Id === toUid) || (data.user1Id === toUid && data.user2Id === fromUid);
      });
      if (alreadyMatched) return;

      // Create mutual match
      const [user1Snap, user2Snap] = await Promise.all([
        db.collection('users').doc(fromUid).get(),
        db.collection('users').doc(toUid).get(),
      ]);

      const user1 = user1Snap.data();
      const user2 = user2Snap.data();

      await db.collection('mutualMatches').add({
        user1Id: fromUid,
        user2Id: toUid,
        eventId,
        matchedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Send mutual match notifications
      await Promise.all([
        db.collection(`users/${fromUid}/notifications`).add({
          type: 'mutual_match',
          fromUid: toUid,
          fromName: user2?.name ?? 'Someone',
          fromAvatarColor: user2?.avatarColor ?? '#C94D0A',
          fromPhotoUri: user2?.photoUri ?? null,
          eventId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
        db.collection(`users/${toUid}/notifications`).add({
          type: 'mutual_match',
          fromUid: fromUid,
          fromName: user1?.name ?? 'Someone',
          fromAvatarColor: user1?.avatarColor ?? '#C94D0A',
          fromPhotoUri: user1?.photoUri ?? null,
          eventId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
      ]);

      // Meet-people weekly quest: a mutual match is the server-side signal
      // that these two people actually connected, so both sides get credit.
      await Promise.all([
        incrementWeeklyQuestServerSide(fromUid, 'meet_people').catch((e) => console.error('quest progress (fromUid) failed:', e)),
        incrementWeeklyQuestServerSide(toUid, 'meet_people').catch((e) => console.error('quest progress (toUid) failed:', e)),
      ]);

      // Auto-create DM conversation between matches
      const convoId = [fromUid, toUid].sort().join('_');
      await db.collection('conversations').doc(convoId).set(
        {
          participantIds: [fromUid, toUid],
          lastMessage: '❤️ You matched!',
          lastAt: admin.firestore.FieldValue.serverTimestamp(),
          isMutualMatch: true,
        },
        { merge: true },
      );
    } catch (err) {
      console.error('Mutual match detection failed:', err);
    }
  },
);

// Attendee claims stand-in host duties (QR display, roll-call) after the
// creator failed to show up within HOST_GRACE_PERIOD_MS of the event's
// start. Runs as a transaction so two people tapping the button at once
// can't both win it — the first write to land sets standInHostId and every
// later one fails the precondition check.
// Keno's own branded verification email, sent instead of relying on
// Firebase Auth's default one. Firebase's default template's link isn't
// reliably clickable in every mail client — some university webmail strips
// button styling and renders it as plain unclickable text, forcing students
// to copy-paste the URL by hand. This generates the exact same real
// Firebase verification link server-side (Admin SDK), then sends it via
// Resend with a bulletproof HTML button plus a visible plain-text fallback
// link, so it degrades gracefully even in the pickiest mail clients.
export const sendVerificationEmail = onCall({ secrets: [RESEND_API_KEY] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  await checkRateLimit(uid, 'sendVerificationEmail', 1, 30_000);

  const userRecord = await admin.auth().getUser(uid);
  const email = userRecord.email;
  if (!email) throw new HttpsError('failed-precondition', 'This account has no email address.');
  if (userRecord.emailVerified) return { alreadyVerified: true };

  const link = await admin.auth().generateEmailVerificationLink(email);
  const name = userRecord.displayName ?? '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
      <h2 style="color:#B8482A; margin-bottom: 4px;">keno.</h2>
      <p>Γεια${name ? ` ${name}` : ''}! Πάτησε το κουμπί παρακάτω για να επιβεβαιώσεις το email σου και να ξεκινήσεις.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 24px 0;">
        <tr>
          <td style="border-radius:8px;background-color:#B8482A;">
            <a href="${link}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,sans-serif;font-size:16px;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">
              Επιβεβαίωση email
            </a>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:#666;">Αν το κουμπί δεν λειτουργεί, αντίγραψε και επικόλλησε αυτόν τον σύνδεσμο στον browser σου:</p>
      <p style="font-size:12px;color:#666;word-break:break-all;">${link}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0;" />
      <p>Hi${name ? ` ${name}` : ''}! Tap the button above to verify your email and get started with Keno.</p>
      <p style="font-size:13px;color:#666;">If the button doesn't work, copy and paste the link above into your browser.</p>
      <p style="font-size:12px;color:#999;margin-top:24px;">If you didn't sign up for Keno, you can safely ignore this email.</p>
    </div>
  `;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY.value()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Resend's shared sandbox sender — works with zero setup, but is
      // rate-limited and unbranded. Once a domain is verified with Resend
      // (Resend dashboard → Domains), switch this to e.g.
      // "Keno <noreply@yourdomain.gr>" for real deliverability at scale.
      from: 'Keno <onboarding@resend.dev>',
      to: email,
      subject: 'Επιβεβαίωσε το email σου — Keno',
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    logger.error('Verification email send failed', { uid, status: res.status, errText });
    throw new HttpsError('internal', 'Failed to send verification email.');
  }

  return { sent: true };
});

export const claimStandInHost = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  await checkRateLimit(uid, 'claimStandInHost', 5, 5 * 60_000);

  const eventId = request.data?.eventId;
  if (typeof eventId !== 'string' || !eventId) {
    throw new HttpsError('invalid-argument', 'eventId is required.');
  }

  const ref = db.collection('events').doc(eventId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Event not found.');
    const event = snap.data()!;

    if (!(event.attendeeIds ?? []).includes(uid)) {
      throw new HttpsError('permission-denied', 'Only people attending this event can take over as host.');
    }
    if (event.hostArrivedAt) {
      throw new HttpsError('failed-precondition', 'host-arrived');
    }
    if (event.standInHostId) {
      throw new HttpsError('failed-precondition', 'already-claimed');
    }
    const startMs = (event.dateTime as admin.firestore.Timestamp).toMillis();
    if (Date.now() < startMs + HOST_GRACE_PERIOD_MS) {
      throw new HttpsError('failed-precondition', 'too-early');
    }

    tx.update(ref, {
      standInHostId: uid,
      standInClaimedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});

// Records a plus-one invite (events/{eventId}.referredBy[targetUid] =
// inviterUid) so onCheckInCreated can pay out the referral bonus if the
// invitee actually shows up. Used to be a direct client write gated only by
// onlyChangedFields(['referredBy']) in firestore.rules — that let anyone
// write an arbitrary uid -> uid entry (not just their own), so a script
// could pre-seed referredBy for every uid across every event and silently
// farm REFERRAL_BONUS_XP off other people's organic check-ins forever.
// Moved server-side: only an actual attendee can claim credit, only for
// someone else, and only once per invitee (first claim wins, no overwriting
// someone else's real invite).
export const claimReferral = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  await checkRateLimit(uid, 'claimReferral', 20, 10 * 60_000);

  const eventId = request.data?.eventId;
  const targetUid = request.data?.targetUid;
  if (typeof eventId !== 'string' || !eventId || typeof targetUid !== 'string' || !targetUid) {
    throw new HttpsError('invalid-argument', 'eventId and targetUid are required.');
  }
  if (targetUid === uid) {
    throw new HttpsError('invalid-argument', 'Cannot refer yourself.');
  }

  const ref = db.collection('events').doc(eventId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Event not found.');
    const event = snap.data()!;

    if (!(event.attendeeIds ?? []).includes(uid)) {
      throw new HttpsError('permission-denied', 'Only people attending this event can invite someone to it.');
    }
    if (event.referredBy?.[targetUid]) {
      return; // Already claimed (by this inviter or someone else) — no-op.
    }

    tx.update(ref, { [`referredBy.${targetUid}`]: uid });
  });

  return { ok: true };
});

// Anti-flake enforcement — runs every 30 minutes looking for events whose
// assumed end time (start + ASSUMED_EVENT_DURATION_MS) just passed.
//
// Host side: if the creator never opened the QR/roll-call screen
// (hostArrivedAt unset), they eat a steeper hostNoShowPenalty than a regular
// attendee no-show, since it stranded everyone else too — regardless of
// whether a stand-in host rescued the event. A stand-in host, if one
// claimed the role, gets a flat bonus for stepping up.
//
// Attendee side: if the host never showed AND nobody claimed stand-in, no
// one ever had a real chance to check in (no QR was ever legitimately shown)
// — so instead of marking every attendee a no-show, we refund their staked
// XP and skip the attendanceHistory/reliability hit entirely. Otherwise
// (host showed, or a stand-in ran check-in) attendees are judged normally
// against the real checkIns record, same as before.
// Automated image moderation — Apple App Review Guideline 1.2 (and Google
// Play's UGC policy) require "a method for filtering objectionable
// material" for any app with user-generated content; this was a real,
// unaddressed compliance gap (text has containsBlockedContent client-side,
// images had nothing). Runs on every image finalized in Storage, checks it
// against Cloud Vision's SafeSearch, and deletes it immediately if it's
// flagged for adult/violent/racy content. Scoped to paths actually shown to
// other users — verification-photos/ and issue-reports/ are admin-only
// submissions (ID review, bug reports) nobody else ever sees, so they're
// out of scope for this requirement.
const MODERATED_STORAGE_PREFIXES = ['events/', 'groups/', 'avatars/', 'dm-images/'];
const UNSAFE_LIKELIHOODS = ['LIKELY', 'VERY_LIKELY'];

export const moderateUploadedImage = onObjectFinalized(async (event) => {
  const filePath = event.data.name;
  const contentType = event.data.contentType;
  if (!filePath || !contentType?.startsWith('image/')) return;
  if (!MODERATED_STORAGE_PREFIXES.some((prefix) => filePath.startsWith(prefix))) return;

  try {
    const [result] = await visionClient.safeSearchDetection(`gs://${event.data.bucket}/${filePath}`);
    const safeSearch = result.safeSearchAnnotation;
    if (!safeSearch) return;

    const flagged = UNSAFE_LIKELIHOODS.includes(String(safeSearch.adult ?? ''))
      || UNSAFE_LIKELIHOODS.includes(String(safeSearch.violence ?? ''))
      || UNSAFE_LIKELIHOODS.includes(String(safeSearch.racy ?? ''));

    if (flagged) {
      await admin.storage().bucket(event.data.bucket).file(filePath).delete().catch(() => {});
      await db.collection('moderationLog').add({
        filePath,
        adult: safeSearch.adult,
        violence: safeSearch.violence,
        racy: safeSearch.racy,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      logger.warn('Removed an uploaded image that failed automated content moderation', { filePath });
    }
  } catch (err) {
    // Fails open (image stays up) rather than closed — a Vision API outage
    // shouldn't start silently deleting every upload. Logged so a sustained
    // failure is visible rather than a silent gap in coverage.
    logger.error('Image moderation check failed', { filePath, err: String(err) });
  }
});

// Event photo walls fill Storage fast at any real scale, and nobody was
// ever told the photos wouldn't stick around — so this bounds cost by
// deleting both the Firestore doc and the underlying Storage object once a
// photo is older than PHOTO_RETENTION_DAYS. Users can always save a photo
// to their own device before then (SavePhotoModal, tap-to-save on the photo
// wall) — see the in-app retention notice on the photo wall itself.
const PHOTO_RETENTION_DAYS = 30;

export const sweepOldPhotos = onSchedule('every 24 hours', async () => {
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const snap = await db.collectionGroup('photos').where('createdAt', '<', cutoff).get();
  if (snap.empty) return;

  const bucket = admin.storage().bucket();
  await Promise.all(snap.docs.map(async (photoDoc) => {
    const uri = photoDoc.data().uri as string | undefined;
    if (uri) {
      try {
        // Firebase Storage download URLs embed the object path as
        // .../o/<url-encoded-path>?alt=media&token=... — pull it back out
        // rather than requiring a separate stored path field.
        const match = uri.match(/\/o\/([^?]+)/);
        if (match) {
          await bucket.file(decodeURIComponent(match[1])).delete({ ignoreNotFound: true });
        }
      } catch (err) {
        logger.error('sweepOldPhotos: failed to delete storage object', { path: photoDoc.ref.path, err: String(err) });
      }
    }
    await photoDoc.ref.delete();
  }));
  logger.log(`sweepOldPhotos: deleted ${snap.docs.length} photo(s) older than ${PHOTO_RETENTION_DAYS} days`);
});

// Auto-expiring event chat (research doc #8) — the whole point of a
// pre/post-event thread instead of a permanent one is that it eventually
// goes away, bounding the moderation surface instead of inheriting it
// forever. The client (event-chat/[id].tsx) closes the composer 24h after
// the event starts; this actually deletes the messages/typing subcollections
// once that window has passed, marking the event so it's never rescanned.
const CHAT_EXPIRY_MS = 24 * 60 * 60 * 1000; // keep in sync with event-chat/[id].tsx
const CHAT_SWEEP_LOOKBACK_DAYS = 45; // bounds the query — no need to ever rescan ancient events

export const sweepExpiredChats = onSchedule('every 24 hours', async () => {
  const now = Date.now();
  const expiredBefore = admin.firestore.Timestamp.fromMillis(now - CHAT_EXPIRY_MS);
  const lookback = admin.firestore.Timestamp.fromMillis(now - CHAT_SWEEP_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const snap = await db.collection('events')
    .where('dateTime', '<=', expiredBefore)
    .where('dateTime', '>=', lookback)
    .get();
  if (snap.empty) return;

  let archived = 0;
  await Promise.all(snap.docs.map(async (eventDoc) => {
    if (eventDoc.data().chatArchivedAt) return;
    const [messagesSnap, typingSnap] = await Promise.all([
      db.collection(`events/${eventDoc.id}/messages`).get(),
      db.collection(`events/${eventDoc.id}/typing`).get(),
    ]);
    const batch = db.batch();
    messagesSnap.docs.forEach((d) => batch.delete(d.ref));
    typingSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.update(eventDoc.ref, { chatArchivedAt: admin.firestore.FieldValue.serverTimestamp() });
    await batch.commit();
    archived++;
  }));
  logger.log(`sweepExpiredChats: archived ${archived} event chat(s)`);
});

// Keeps the weekly streak (and the "Regular" badge derived from it,
// isRegularUser in gamification.ts) current in near-real-time instead of
// lazily recalculated whenever the user next happens to check in — a
// streak that silently never decays until their next visit would let the
// badge lie about someone who stopped showing up months ago. Runs daily:
// a user who's missed exactly one week gets a banked freeze token consumed
// automatically to cover the gap (protecting the streak); a user who's
// missed a second week with no token left has their streak — and with it
// the badge — reset. Mirrors the same lastAttendedDate/lastWeek comparison
// auth.store.ts's client-side updateStreak uses, so a check-in in between
// sweep runs reconciles correctly either way.
export const sweepStreaks = onSchedule('every 24 hours', async () => {
  const now = new Date();
  const thisWeek = getISOWeekId(now);
  const lastWeek = getISOWeekId(new Date(now.getTime() - 7 * 86400000));

  const snap = await db.collection('users').where('currentStreak', '>', 0).get();
  if (snap.empty) return;

  let protectedCount = 0;
  let resetCount = 0;

  await Promise.all(snap.docs.map(async (userDoc) => {
    const d = userDoc.data();
    const last = d.lastAttendedDate as string | undefined;
    if (last === thisWeek || last === lastWeek) return; // current, or still within this week's grace

    const tokens = (d.streakFreezeTokens as number | undefined) ?? 0;
    if (tokens > 0) {
      await userDoc.ref.update({
        lastAttendedDate: lastWeek,
        streakFreezeTokens: admin.firestore.FieldValue.increment(-1),
      });
      protectedCount++;
    } else {
      await userDoc.ref.update({ currentStreak: 0 });
      resetCount++;
    }
  }));

  logger.log(`sweepStreaks: protected ${protectedCount}, reset ${resetCount}`);
});

export const markNoShows = onSchedule('every 30 minutes', async () => {
  const now = Date.now();
  const windowStart = admin.firestore.Timestamp.fromMillis(now - NO_SHOW_SCAN_WINDOW_MS - ASSUMED_EVENT_DURATION_MS);
  const windowEnd = admin.firestore.Timestamp.fromMillis(now - ASSUMED_EVENT_DURATION_MS);

  const snap = await db.collection('events')
    .where('dateTime', '>=', windowStart)
    .where('dateTime', '<=', windowEnd)
    .get();

  for (const eventDoc of snap.docs) {
    const event = eventDoc.data();
    if (event.noShowsProcessed) continue;

    const attendeeIds: string[] = event.attendeeIds ?? [];
    const creatorId: string | undefined = event.creatorId;
    const hostArrived = !!event.hostArrivedAt;
    const standInHostId: string | undefined = event.standInHostId;
    const dateStr = (event.dateTime as admin.firestore.Timestamp).toDate().toISOString().split('T')[0];

    try {
      const checkInsSnap = await eventDoc.ref.collection('checkIns').get();
      const checkedInIds = new Set(checkInsSnap.docs.map((d) => d.id));
      const rsvpStakes: Record<string, { xp: number }> = event.rsvpStakes ?? {};
      const nonCreatorAttendeeIds = attendeeIds.filter((uid) => uid !== creatorId);

      const hostGaveEveryoneAChance = hostArrived || !!standInHostId;

      if (!hostGaveEveryoneAChance) {
        // Nobody could have checked in — refund stakes, no penalties.
        await Promise.all(nonCreatorAttendeeIds.map(async (uid) => {
          const staked = rsvpStakes[uid]?.xp ?? 0;
          if (staked <= 0) return;
          await db.collection('users').doc(uid).update({ xp: admin.firestore.FieldValue.increment(staked) });
        }));
      } else {
        const noShowIds = nonCreatorAttendeeIds.filter((uid) => !checkedInIds.has(uid));
        await Promise.all(noShowIds.map(async (uid) => {
          const staked = rsvpStakes[uid]?.xp ?? 0;
          const userRef = db.collection('users').doc(uid);
          await db.runTransaction(async (tx) => {
            const userSnap = await tx.get(userRef);
            if (!userSnap.exists) return;
            const userData = userSnap.data()!;
            const attendanceHistory = {
              ...(userData.attendanceHistory ?? {}),
              [eventDoc.id]: { checkedIn: false, xpStaked: staked, date: dateStr },
            };
            const newXp = Math.max(0, (userData.xp ?? 0) - NO_SHOW_PENALTY_XP);
            tx.update(userRef, {
              attendanceHistory,
              xp: newXp,
              reliabilityScore: calculateReliabilityScore(attendanceHistory),
            });
          });
        }));
      }

      if (!hostArrived && creatorId) {
        const creatorRef = db.collection('users').doc(creatorId);
        await db.runTransaction(async (tx) => {
          const creatorSnap = await tx.get(creatorRef);
          if (!creatorSnap.exists) return;
          const creatorData = creatorSnap.data()!;
          const attendanceHistory = {
            ...(creatorData.attendanceHistory ?? {}),
            [eventDoc.id]: { checkedIn: false, xpStaked: 0, date: dateStr },
          };
          const newXp = Math.max(0, (creatorData.xp ?? 0) - HOST_NO_SHOW_PENALTY_XP);
          tx.update(creatorRef, {
            attendanceHistory,
            xp: newXp,
            reliabilityScore: calculateReliabilityScore(attendanceHistory),
          });
        });
      }

      if (standInHostId) {
        await db.collection('users').doc(standInHostId)
          .update({ xp: admin.firestore.FieldValue.increment(STAND_IN_HOST_BONUS_XP) })
          .catch(() => {});
      }

      await eventDoc.ref.update({ noShowsProcessed: true });
    } catch (err) {
      logger.error('markNoShows failed for event', { eventId: eventDoc.id, err: String(err) });
    }
  }
});
