import { Either } from '@/core/utils/either';
import { Failure } from '@/core/errors/failures';
import { EventCategory, EventEntity, GenderFilter, ReactionType } from '../entities/event.entity';

export interface CreateEventParams {
  title: string;
  description: string;
  category: EventCategory;
  customCategory?: string;
  dateTime: Date;
  location: string;
  creatorId: string;
  maxAttendees: number;
  imageUri?: string;
  minAge?: number;
  maxAge?: number;
  allowedUniversities?: string[];
  genderFilter?: GenderFilter;
  isPrivate?: boolean;
  invitedUserIds?: string[];
  creatorUniversity?: string;
  latitude?: number;
  longitude?: number;
  soloFriendly?: boolean;
  checkInInfo?: { text?: string; photoUri?: string };
  isFlagship?: boolean;
}

export type UpdateEventParams = Partial<Omit<CreateEventParams, 'creatorId'>>;

export interface EventsRepository {
  createEvent(params: CreateEventParams): Promise<Either<Failure, EventEntity>>;
  updateEvent(eventId: string, params: UpdateEventParams): Promise<Either<Failure, EventEntity>>;
  getEvent(id: string): Promise<Either<Failure, EventEntity>>;
  getFeedEvents(limit?: number): Promise<Either<Failure, EventEntity[]>>;
  /** Events with dateTime >= cutoff, including ones already underway/past —
   *  unlike getFeedEvents (which only shows what's still joinable), this is
   *  for aggregate stats like the weekly leaderboard that need to count
   *  events that already happened this week, not just what's upcoming. */
  getEventsSince(cutoff: Date): Promise<Either<Failure, EventEntity[]>>;
  subscribeToFeedEvents(onUpdate: (events: EventEntity[]) => void, onError?: (e: Error) => void): () => void;
  joinEvent(eventId: string, userId: string): Promise<Either<Failure, void>>;
  leaveEvent(eventId: string, userId: string): Promise<Either<Failure, void>>;
  joinWaitlist(eventId: string, userId: string): Promise<Either<Failure, void>>;
  leaveWaitlist(eventId: string, userId: string): Promise<Either<Failure, void>>;
  deleteEvent(eventId: string, creatorId: string): Promise<Either<Failure, void>>;
  getEventsByAttendee(uid: string): Promise<Either<Failure, EventEntity[]>>;
  reactToEvent(eventId: string, userId: string, reaction: ReactionType): Promise<Either<Failure, EventEntity>>;
  sendMessage(eventId: string, userId: string, text: string): Promise<Either<Failure, EventEntity>>;
  stakeXpOnRsvp(eventId: string, userId: string, xpAmount: number): Promise<Either<Failure, void>>;
  /** Idempotent QR/roll-call check-in: verifies against the event's rotating
   *  30s-bucket secret (enforced server-side by firestore.rules), writes
   *  checkIns/{userId}, unconditionally updates attendanceHistory/
   *  checkInCount (no longer gated on an RSVP stake existing), and awards XP. */
  checkInWithToken(eventId: string, userId: string, secret: string, bucket: number): Promise<Either<Failure, void>>;

  /** Fetches the event's check-in secret, lazily creating `private/checkin`
   *  if it doesn't exist yet (events created before this feature shipped
   *  never got one) — caller must be the event's creator or stand-in host. */
  ensureCheckinSecret(eventId: string): Promise<Either<Failure, string>>;

  /** Records that the creator opened the QR/roll-call screen after the
   *  event started — the signal markNoShows uses to decide whether the host
   *  actually showed up. No-op call is safe; caller should still only fire
   *  it once (see event/[id].tsx). */
  markHostArrived(eventId: string): Promise<Either<Failure, void>>;

  /** Attendee claims the stand-in host role after the creator's grace period
   *  lapsed with no sign of them — enforced server-side (attendee membership,
   *  grace period, first-claim-wins) by the claimStandInHost Cloud Function. */
  claimStandInHost(eventId: string): Promise<Either<Failure, void>>;

  /** Creator ends the event early from the Live Mode panel instead of
   *  waiting for the assumed-duration heuristic — flips eventIsOver
   *  immediately for everyone viewing the event. */
  endEvent(eventId: string): Promise<Either<Failure, void>>;

  /** Records a plus-one invite (referredBy[targetUid] = caller) so the
   *  referral bonus pays out if targetUid actually checks in — enforced
   *  server-side (caller must be attending, first-claim-wins) by the
   *  claimReferral Cloud Function; referredBy is not client-writable. */
  claimReferral(eventId: string, targetUid: string): Promise<Either<Failure, void>>;
}
