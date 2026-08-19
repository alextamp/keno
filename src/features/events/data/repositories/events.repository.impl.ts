import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { XP_VALUES, calculateReliabilityScore } from '@/core/constants/gamification';
import { WEEKLY_QUESTS } from '@/core/constants/quests';
import { getISOWeekId } from '@/core/utils/weekId';
import { Failure, ServerFailure } from '@/core/errors/failures';
import { Either, left, right } from '@/core/utils/either';
import { EventEntity, ReactionType } from '../../domain/entities/event.entity';
import { CreateEventParams, EventsRepository } from '../../domain/repositories/events.repository';
import { eventFromFirestore, eventToFirestore } from '../models/event.model';
import { notificationsRepository } from '@/features/notifications/notifications.repository';
import { getTranslations } from '@/core/i18n';

const EVENTS = 'events';
const USERS = 'users';

function generateCheckInSecret(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 20; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export const eventsRepository: EventsRepository = {
  async createEvent(params: CreateEventParams): Promise<Either<Failure, EventEntity>> {
    try {
      const newEvent: Omit<EventEntity, 'id'> = {
        title: params.title,
        description: params.description,
        category: params.category,
        dateTime: params.dateTime,
        location: params.location,
        creatorId: params.creatorId,
        maxAttendees: params.maxAttendees,
        attendeeIds: [params.creatorId],
        imageUri: params.imageUri,
        customCategory: params.category === 'other' ? params.customCategory : undefined,
        minAge: params.minAge,
        maxAge: params.maxAge,
        allowedUniversities: params.allowedUniversities,
        genderFilter: params.genderFilter,
        isPrivate: params.isPrivate ?? false,
        invitedUserIds: params.invitedUserIds ?? [],
        creatorUniversity: params.creatorUniversity ?? '',
        latitude: params.latitude,
        longitude: params.longitude,
        soloFriendly: params.soloFriendly ?? false,
        checkInInfo: params.checkInInfo,
        isFlagship: params.isFlagship ?? false,
        reactions: { hype: [], funny: [], interested: [] },
        waitlistIds: [],
        messages: [],
      };
      const ref = await addDoc(collection(db, EVENTS), eventToFirestore(newEvent));
      await updateDoc(doc(db, USERS, params.creatorId), {
        createdEvents: arrayUnion(ref.id),
        joinedEvents: arrayUnion(ref.id),
      });
      // Check-in secret: private doc only the creator can read (firestore.rules).
      // The QR the creator displays rotates every 30s as
      // `keno:checkin:{eventId}:{secret}:{bucket}` — the secret itself never
      // changes, only the bucket, so a screenshot stays valid for ~60-90s
      // (accepted trade-off at this scale; see plan section A).
      await setDoc(doc(db, EVENTS, ref.id, 'private', 'checkin'), {
        secret: generateCheckInSecret(),
        createdAt: serverTimestamp(),
      });
      const snap = await getDoc(ref);
      const { awardXP, incrementQuestProgress } = useAuthStore.getState();
      awardXP(XP_VALUES.createEvent).catch(() => {});
      incrementQuestProgress('host_event').catch(() => {});
      return right(eventFromFirestore(snap));
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to create event.'));
    }
  },

  async updateEvent(eventId: string, params: import('../../domain/repositories/events.repository').UpdateEventParams): Promise<Either<Failure, EventEntity>> {
    try {
      const ref = doc(db, EVENTS, eventId);
      const patch: Record<string, unknown> = {};
      if (params.title !== undefined) patch.title = params.title;
      if (params.description !== undefined) patch.description = params.description;
      if (params.category !== undefined) patch.category = params.category;
      if (params.customCategory !== undefined) patch.customCategory = params.customCategory;
      if (params.dateTime !== undefined) patch.dateTime = Timestamp.fromDate(params.dateTime);
      if (params.location !== undefined) patch.location = params.location;
      if (params.maxAttendees !== undefined) patch.maxAttendees = params.maxAttendees;
      if (params.imageUri !== undefined) patch.imageUri = params.imageUri;
      if (params.minAge !== undefined) patch.minAge = params.minAge;
      if (params.maxAge !== undefined) patch.maxAge = params.maxAge;
      if (params.genderFilter !== undefined) patch.genderFilter = params.genderFilter;
      if (params.allowedUniversities !== undefined) patch.allowedUniversities = params.allowedUniversities;
      if (params.soloFriendly !== undefined) patch.soloFriendly = params.soloFriendly;
      if (params.checkInInfo !== undefined) patch.checkInInfo = params.checkInInfo;
      if (params.isFlagship !== undefined) patch.isFlagship = params.isFlagship;
      await updateDoc(ref, patch);
      const updated = await getDoc(ref);
      return right(eventFromFirestore(updated));
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to update event.'));
    }
  },

  async getEvent(id: string): Promise<Either<Failure, EventEntity>> {
    try {
      const snap = await getDoc(doc(db, EVENTS, id));
      if (!snap.exists()) return left(new ServerFailure('Event not found.'));
      return right(eventFromFirestore(snap));
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to load event.'));
    }
  },

  async getFeedEvents(): Promise<Either<Failure, EventEntity[]>> {
    try {
      // Only fetch upcoming/live events — a 24h lookback so an ongoing event
      // stays in the feed until isEventPast (endedAt or 24h) says it's over,
      // rather than a fixed dateTime cutoff quietly dropping it mid-event.
      const cutoff = new Date(Date.now() - 24 * 3600_000);
      const q = query(
        collection(db, EVENTS),
        where('dateTime', '>=', Timestamp.fromDate(cutoff)),
        orderBy('dateTime', 'asc'),
        limit(200),
      );
      const snap = await getDocs(q);
      return right(snap.docs.map(eventFromFirestore));
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to load events.'));
    }
  },

  async getEventsSince(cutoff: Date): Promise<Either<Failure, EventEntity[]>> {
    try {
      const q = query(
        collection(db, EVENTS),
        where('dateTime', '>=', Timestamp.fromDate(cutoff)),
        orderBy('dateTime', 'asc'),
        limit(500),
      );
      const snap = await getDocs(q);
      return right(snap.docs.map(eventFromFirestore));
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to load events.'));
    }
  },

  subscribeToFeedEvents(onUpdate, onError) {
    const cutoff = new Date(Date.now() - 6 * 3600_000);
    const q = query(
      collection(db, EVENTS),
      where('dateTime', '>=', Timestamp.fromDate(cutoff)),
      orderBy('dateTime', 'asc'),
      limit(200),
    );
    return onSnapshot(
      q,
      (snap) => onUpdate(snap.docs.map(eventFromFirestore)),
      onError,
    );
  },

  async joinEvent(eventId: string, userId: string): Promise<Either<Failure, void>> {
    try {
      const { user, awardXP, updateStreak, incrementQuestProgress } = useAuthStore.getState();
      const alreadyJoined = user?.joinedEvents?.includes(eventId) ?? false;
      await updateDoc(doc(db, EVENTS, eventId), { attendeeIds: arrayUnion(userId) });
      await updateDoc(doc(db, USERS, userId), { joinedEvents: arrayUnion(eventId) });
      if (!alreadyJoined) {
        awardXP(XP_VALUES.joinEvent).catch(() => {});
        updateStreak().catch(() => {});
        incrementQuestProgress('join_events').catch(() => {});
        // Notification is sent by the caller (event/[id].tsx), which already
        // has the event and user profile in scope — don't duplicate it here.
      }
      return right(undefined);
    } catch (e: any) {
      // firestore.rules rejects attendeeIds growing past maxAttendees —
      // the client's own isEventFull() check can be stale if someone else
      // took the last spot a moment earlier, so a permission-denied here
      // (rather than any other failure reason) means the event just filled
      // up, not a real error.
      if (e.code === 'permission-denied') {
        return left(new ServerFailure(getTranslations().eventFull));
      }
      return left(new ServerFailure(e.message ?? 'Failed to join event.'));
    }
  },

  async leaveEvent(eventId: string, userId: string): Promise<Either<Failure, void>> {
    try {
      // Read-then-write on separate calls meant that two people leaving a
      // full event around the same time could both read the same stale
      // waitlistIds[0] and promote the same person twice, leaving the
      // second opened-up spot's rightful next-in-line stuck on the
      // waitlist. A transaction makes the read+promote atomic.
      let promotedUserId: string | null = null;
      let eventTitle = '';
      const eventRef = doc(db, EVENTS, eventId);
      await runTransaction(db, async (tx) => {
        const eventSnap = await tx.get(eventRef);
        if (!eventSnap.exists()) return;
        const data = eventSnap.data();
        eventTitle = (data.title as string) ?? '';
        const attendeeIds = ((data.attendeeIds as string[]) ?? []).filter((id) => id !== userId);
        let waitlistIds = (data.waitlistIds as string[]) ?? [];
        if (waitlistIds.length > 0) {
          promotedUserId = waitlistIds[0];
          waitlistIds = waitlistIds.slice(1);
          attendeeIds.push(promotedUserId);
        }
        tx.update(eventRef, { attendeeIds, waitlistIds });
      });

      await updateDoc(doc(db, USERS, userId), { joinedEvents: arrayRemove(eventId) });

      if (promotedUserId) {
        await updateDoc(doc(db, USERS, promotedUserId), { joinedEvents: arrayUnion(eventId) });
        const { user } = useAuthStore.getState();
        notificationsRepository.create({
          toUid: promotedUserId,
          fromUid: userId,
          fromName: user?.name ?? 'Someone',
          fromAvatarColor: user?.avatarColor,
          fromPhotoUri: user?.photoUri,
          type: 'waitlist_promoted',
          eventId,
          eventTitle,
        }).catch(() => {});
      }

      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to leave event.'));
    }
  },

  async joinWaitlist(eventId: string, userId: string): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, EVENTS, eventId), { waitlistIds: arrayUnion(userId) });
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to join waitlist.'));
    }
  },

  async leaveWaitlist(eventId: string, userId: string): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, EVENTS, eventId), { waitlistIds: arrayRemove(userId) });
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to leave waitlist.'));
    }
  },

  async deleteEvent(eventId: string, creatorId: string): Promise<Either<Failure, void>> {
    try {
      const eventSnap = await getDoc(doc(db, EVENTS, eventId));
      const eventData = eventSnap.exists() ? eventFromFirestore(eventSnap) : null;

      // The event doc itself is the authoritative deletion — do it first so a
      // moderator (deleting someone else's event) isn't blocked by the
      // best-effort cleanup below, which is only guaranteed for the owner.
      await deleteDoc(doc(db, EVENTS, eventId));
      await updateDoc(doc(db, USERS, creatorId), {
        createdEvents: arrayRemove(eventId),
        joinedEvents: arrayRemove(eventId),
      }).catch(() => {});

      if (eventData) {
        const { user } = useAuthStore.getState();
        const toNotify = eventData.attendeeIds.filter((uid) => uid !== creatorId);
        toNotify.forEach((uid) => {
          notificationsRepository.create({
            toUid: uid,
            fromUid: creatorId,
            fromName: user?.name ?? 'Organizer',
            fromAvatarColor: user?.avatarColor,
            fromPhotoUri: user?.photoUri,
            type: 'event_cancelled',
            eventId,
            eventTitle: eventData.title,
          }).catch(() => {});
        });
      }

      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to delete event.'));
    }
  },

  async getEventsByAttendee(uid: string): Promise<Either<Failure, EventEntity[]>> {
    try {
      // A ceiling against unbounded growth for very long-tenured active
      // users — no orderBy alongside it on purpose, since array-contains +
      // orderBy on a different field needs a new composite index deployed
      // first or the query throws at runtime; the client already re-sorts
      // by dateTime below regardless of fetch order, so plain limit() here
      // doesn't change today's behavior for anyone.
      const q = query(collection(db, EVENTS), where('attendeeIds', 'array-contains', uid), limit(300));
      const snap = await getDocs(q);
      const sorted = snap.docs
        .map(eventFromFirestore)
        .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
      return right(sorted);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to load events.'));
    }
  },

  async reactToEvent(eventId: string, userId: string, reaction: ReactionType): Promise<Either<Failure, EventEntity>> {
    try {
      const ref = doc(db, EVENTS, eventId);
      const snap = await getDoc(ref);
      if (!snap.exists()) return left(new ServerFailure('Event not found.'));
      const event = eventFromFirestore(snap);
      const already = event.reactions[reaction].includes(userId);
      await updateDoc(ref, {
        [`reactions.${reaction}`]: already ? arrayRemove(userId) : arrayUnion(userId),
      });
      const updated = await getDoc(ref);
      return right(eventFromFirestore(updated));
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to react.'));
    }
  },

  async sendMessage(eventId: string, userId: string, text: string): Promise<Either<Failure, EventEntity>> {
    try {
      const ref = doc(db, EVENTS, eventId);
      const msg = {
        id: `msg-${Date.now()}`,
        userId,
        text: text.trim(),
        timestamp: Timestamp.now(),
      };
      await updateDoc(ref, { messages: arrayUnion(msg) });
      const updated = await getDoc(ref);
      return right(eventFromFirestore(updated));
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to send message.'));
    }
  },

  async stakeXpOnRsvp(eventId: string, userId: string, xpAmount: number): Promise<Either<Failure, void>> {
    try {
      const { awardXP } = useAuthStore.getState();
      await updateDoc(doc(db, EVENTS, eventId), {
        [`rsvpStakes.${userId}`]: {
          xp: xpAmount,
          timestamp: Timestamp.now(),
          didCheckIn: false,
        },
      });
      awardXP(-xpAmount).catch(() => {});
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to stake XP.'));
    }
  },

  async ensureCheckinSecret(eventId: string): Promise<Either<Failure, string>> {
    try {
      const ref = doc(db, EVENTS, eventId, 'private', 'checkin');
      const snap = await getDoc(ref);
      if (snap.exists()) return right(snap.data().secret as string);
      // Event predates the QR check-in feature — create the secret now
      // (firestore.rules only allows this for the event's creator).
      const secret = generateCheckInSecret();
      await setDoc(ref, { secret, createdAt: serverTimestamp() });
      return right(secret);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to prepare check-in code.'));
    }
  },

  async checkInWithToken(eventId: string, userId: string, secret: string, bucket: number): Promise<Either<Failure, void>> {
    try {
      const checkInRef = doc(db, EVENTS, eventId, 'checkIns', userId);
      const existing = await getDoc(checkInRef);
      const alreadyCheckedIn = existing.exists();

      // Idempotent: a rescanned/replayed QR (or a second tap of the fallback
      // roll-call) is a silent no-op past this point — the checkIns doc
      // itself is the source of truth for "has this already happened."
      if (!alreadyCheckedIn) {
        // firestore.rules verifies `secret` against events/{eventId}/private/checkin
        // and `bucket` against the current 30s window (unless the caller is
        // the event creator, who can always roll-call on someone else's behalf).
        await setDoc(checkInRef, { userId, secret, bucket, timestamp: Timestamp.now() });

        const eventSnap = await getDoc(doc(db, EVENTS, eventId));
        const event = eventSnap.exists() ? eventFromFirestore(eventSnap) : null;
        const stake = event?.rsvpStakes?.[userId];

        if (stake && !stake.didCheckIn) {
          await updateDoc(doc(db, EVENTS, eventId), {
            [`rsvpStakes.${userId}.didCheckIn`]: true,
          });
        }

        // Unconditional now (previously gated on a stake existing — a real
        // gap, since most attendees never stake XP on RSVP): every real
        // check-in earns a ticket and a checkinBonus, plus the staked XP
        // back if there was one.
        const xpAward = (stake?.xp ?? 0) + XP_VALUES.checkinBonus;

        // reliabilityScore needs the *full* history (not just this one
        // entry) to compute, so read-merge-write rather than a dot-path
        // update — this is also the only place a successful check-in ever
        // gets recorded, so it's what lets the badge recover after a past
        // no-show, not just regress from one (see markNoShows in functions).
        const userSnapForHistory = await getDoc(doc(db, USERS, userId));
        const priorHistory = userSnapForHistory.exists() ? (userSnapForHistory.data().attendanceHistory ?? {}) : {};
        const mergedHistory = {
          ...priorHistory,
          [eventId]: { checkedIn: true, xpStaked: stake?.xp ?? 0, date: new Date().toISOString().split('T')[0] },
        };
        const attendanceEntry = {
          attendanceHistory: mergedHistory,
          reliabilityScore: calculateReliabilityScore(mergedHistory),
          checkInCount: increment(1),
        };

        const { user: currentUser, awardXP, incrementQuestProgress } = useAuthStore.getState();
        if (currentUser?.id === userId) {
          // Self check-in (the common QR-scan path): route XP through the
          // auth store so the level-up sound/notification and local state
          // still fire, same as every other XP-earning action in the app.
          await updateDoc(doc(db, USERS, userId), attendanceEntry);
          awardXP(xpAward).catch(() => {});
          incrementQuestProgress('checkin_event').catch(() => {});
        } else {
          // Organizer roll-call fallback, checking someone else in — no
          // local store to route this through, so mirror incrementQuestProgress's
          // logic by hand against the checked-in user's own doc (previously
          // this branch updated XP/attendance but silently never advanced
          // their weekly "check in to an event" quest).
          const weekId = getISOWeekId(new Date());
          const existingQuest = userSnapForHistory.exists() ? userSnapForHistory.data().weeklyQuests?.checkin_event : undefined;
          const prevProgress = existingQuest && existingQuest.weekId === weekId ? existingQuest.progress : 0;
          const newProgress = prevProgress + 1;
          const quest = WEEKLY_QUESTS.find((q) => q.id === 'checkin_event');
          const questBonusXp = quest && prevProgress < quest.target && newProgress >= quest.target ? quest.xp : 0;
          await updateDoc(doc(db, USERS, userId), {
            ...attendanceEntry,
            xp: increment(xpAward + questBonusXp),
            'weeklyQuests.checkin_event': { progress: newProgress, weekId },
          });
        }
      }

      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to check in.'));
    }
  },

  async markHostArrived(eventId: string): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, EVENTS, eventId), { hostArrivedAt: serverTimestamp() });
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to record host arrival.'));
    }
  },

  async claimStandInHost(eventId: string): Promise<Either<Failure, void>> {
    try {
      const claim = httpsCallable(functions, 'claimStandInHost');
      await claim({ eventId });
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to take over as host.'));
    }
  },

  async endEvent(eventId: string): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, EVENTS, eventId), { endedAt: serverTimestamp() });
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to end event.'));
    }
  },

  async claimReferral(eventId: string, targetUid: string): Promise<Either<Failure, void>> {
    try {
      const claim = httpsCallable(functions, 'claimReferral');
      await claim({ eventId, targetUid });
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to invite friend.'));
    }
  },
};
