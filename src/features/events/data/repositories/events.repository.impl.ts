import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { XP_VALUES } from '@/core/constants/gamification';
import { Failure, ServerFailure } from '@/core/errors/failures';
import { Either, left, right } from '@/core/utils/either';
import { EventEntity, ReactionType } from '../../domain/entities/event.entity';
import { CreateEventParams, EventsRepository } from '../../domain/repositories/events.repository';
import { eventFromFirestore, eventToFirestore } from '../models/event.model';
import { notificationsRepository } from '@/features/notifications/notifications.repository';

const EVENTS = 'events';
const USERS = 'users';

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
        reactions: { hype: [], funny: [], interested: [] },
        waitlistIds: [],
        messages: [],
      };
      const ref = await addDoc(collection(db, EVENTS), eventToFirestore(newEvent));
      await updateDoc(doc(db, USERS, params.creatorId), {
        createdEvents: arrayUnion(ref.id),
        joinedEvents: arrayUnion(ref.id),
      });
      const snap = await getDoc(ref);
      const { awardXP } = useAuthStore.getState();
      awardXP(XP_VALUES.createEvent).catch(() => {});
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
      // Only fetch upcoming events (last 6 hours to show recently-started), capped at 200
      const cutoff = new Date(Date.now() - 6 * 3600_000);
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
      const { user, awardXP, updateStreak } = useAuthStore.getState();
      const alreadyJoined = user?.joinedEvents?.includes(eventId) ?? false;
      await updateDoc(doc(db, EVENTS, eventId), { attendeeIds: arrayUnion(userId) });
      await updateDoc(doc(db, USERS, userId), { joinedEvents: arrayUnion(eventId) });
      if (!alreadyJoined) {
        awardXP(XP_VALUES.joinEvent).catch(() => {});
        updateStreak().catch(() => {});
      }
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to join event.'));
    }
  },

  async leaveEvent(eventId: string, userId: string): Promise<Either<Failure, void>> {
    try {
      const eventSnap = await getDoc(doc(db, EVENTS, eventId));
      const eventData = eventSnap.exists() ? eventFromFirestore(eventSnap) : null;

      await updateDoc(doc(db, EVENTS, eventId), { attendeeIds: arrayRemove(userId) });
      await updateDoc(doc(db, USERS, userId), { joinedEvents: arrayRemove(eventId) });

      if (eventData && eventData.waitlistIds && eventData.waitlistIds.length > 0) {
        const nextUserId = eventData.waitlistIds[0];
        await updateDoc(doc(db, EVENTS, eventId), {
          attendeeIds: arrayUnion(nextUserId),
          waitlistIds: arrayRemove(nextUserId),
        });
        await updateDoc(doc(db, USERS, nextUserId), { joinedEvents: arrayUnion(eventId) });
        const { user } = useAuthStore.getState();
        notificationsRepository.create({
          toUid: nextUserId,
          fromUid: userId,
          fromName: user?.name ?? 'Someone',
          type: 'waitlist_promoted',
          eventId,
          eventTitle: eventData.title,
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

      await updateDoc(doc(db, USERS, creatorId), {
        createdEvents: arrayRemove(eventId),
        joinedEvents: arrayRemove(eventId),
      });
      await deleteDoc(doc(db, EVENTS, eventId));

      if (eventData) {
        const { user } = useAuthStore.getState();
        const toNotify = eventData.attendeeIds.filter((uid) => uid !== creatorId);
        toNotify.forEach((uid) => {
          notificationsRepository.create({
            toUid: uid,
            fromUid: creatorId,
            fromName: user?.name ?? 'Organizer',
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
      const q = query(collection(db, EVENTS), where('attendeeIds', 'array-contains', uid));
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
};
