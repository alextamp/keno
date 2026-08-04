export enum EventCategory {
  Party = 'party',
  Sports = 'sports',
  Study = 'study',
  Chill = 'chill',
  Coffee = 'coffee',
  Other = 'other',
}

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  [EventCategory.Party]: 'Party',
  [EventCategory.Sports]: 'Sports',
  [EventCategory.Study]: 'Study',
  [EventCategory.Chill]: 'Chill',
  [EventCategory.Coffee]: 'Coffee',
  [EventCategory.Other]: 'Other',
};

export const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  [EventCategory.Party]: '#7E52A8',
  [EventCategory.Sports]: '#3F7A55',
  [EventCategory.Study]: '#3A6494',
  [EventCategory.Chill]: '#B2537A',
  [EventCategory.Coffee]: '#A0702C',
  [EventCategory.Other]: '#7A6E62',
};

export type GenderFilter = 'any' | 'male' | 'female';

export type ReactionType = 'hype' | 'funny' | 'interested';

export const REACTION_EMOJIS: Record<ReactionType, string> = {
  hype: '🔥',
  funny: '😂',
  interested: '👀',
};

export const REACTION_LABELS: Record<ReactionType, string> = {
  hype: 'Hype',
  funny: 'Funny',
  interested: 'Interested',
};

export interface ChatMessage {
  id: string;
  userId: string;
  text: string;
  imageUri?: string;
  timestamp: Date;
  reactions?: Record<string, string[]>; // emoji → [uid, ...]
  editedAt?: Date;
  isDeleted?: boolean;
}

export interface EventEntity {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
  customCategory?: string;
  dateTime: Date;
  location: string;
  creatorId: string;
  maxAttendees: number;
  attendeeIds: string[];
  imageUri?: string;
  minAge?: number;
  maxAge?: number;
  allowedUniversities?: string[];
  genderFilter?: GenderFilter;
  reactions: Record<ReactionType, string[]>;
  messages: ChatMessage[];
  waitlistIds: string[];
  coHostIds?: string[];
  viewCount?: number;
  isPrivate?: boolean;
  invitedUserIds?: string[];
  /** uid -> message the requester wrote explaining why they should be let in. */
  joinRequests?: Record<string, string>;
  creatorUniversity?: string;
  latitude?: number;
  longitude?: number;
  /** XP stakes for Anti-Flake system: { uid: { xp: number staked, timestamp, didCheckIn } } */
  rsvpStakes?: Record<string, { xp: number; timestamp: Date; didCheckIn: boolean }>;
  /** Set the first time the creator opens the QR/roll-call screen after the
   * event's start time — the only server-side signal that the host actually
   * showed up. Missing past the grace period is what triggers both the
   * stand-in-host offer and the creator's own no-show penalty. */
  hostArrivedAt?: Date;
  /** uid of the attendee who took over hosting duties (QR display, roll-call)
   * because the creator never showed — see functions/claimStandInHost. */
  standInHostId?: string;
  standInClaimedAt?: Date;
  /** One-tap post-event "how was it?" feedback, given only by people who
   *  actually checked in (events/{id}/checkIns/{uid}.feedback). Aggregated
   *  here by a Cloud Function — a private quality signal, never shown as a
   *  public rating, just used to build organiser trust over time. */
  feedbackGoodCount?: number;
  feedbackBadCount?: number;
  /** Creator-set tag: "good to attend alone" — shown as a chip on the card
   *  and detail page, since going alone is a private anxiety most students
   *  never voice; naming it up front lowers that bar. */
  soloFriendly?: boolean;
  /** Optional creator-authored "find your group" info, shown to attendees
   *  the moment they check in (checkin/success/[eventId].tsx) — a table
   *  number, a description of the meeting spot, or a photo of it. Entirely
   *  optional: when unset, check-in works exactly as it did before this
   *  existed. */
  checkInInfo?: { text?: string; photoUri?: string };
  /** uid (invitee) -> uid (inviter), set when a plus-one invite is sent from
   *  the event page or a profile — read by checkInWithToken so that if the
   *  invitee actually checks in (not just installs/joins), both of them get
   *  rewarded. Only ever grows; never cleared. */
  referredBy?: Record<string, string>;
  /** Creator can end the event early from the Live Mode panel instead of
   *  waiting for the assumed-duration heuristic — once set, the event is
   *  immediately treated as over (eventIsOver) everywhere. */
  endedAt?: Date;
  /** Admin-curated "Keno Wednesdays" style flagship ritual (research doc
   *  #28) — pinned above the feed's normal filters/search so it "requires
   *  no browsing or decision." Only settable by ADMIN_UID (see edit/[id].tsx),
   *  not a general creator feature. */
  isFlagship?: boolean;
}

export function isEventFull(event: EventEntity): boolean {
  return event.attendeeIds.length >= event.maxAttendees;
}

export function spotsLeft(event: EventEntity): number {
  return Math.max(0, event.maxAttendees - event.attendeeIds.length);
}

export function isAttending(event: EventEntity, userId: string): boolean {
  return event.attendeeIds.includes(userId);
}

export function isOnWaitlist(event: EventEntity, userId: string): boolean {
  return (event.waitlistIds ?? []).includes(userId);
}

// A day-old grace window before an un-ended event quietly falls off the feed
// into "past" — a live event may run well past its listed start time, so
// only the creator explicitly ending it, or a full 24h passing, moves it out
// of "happening now" and into event history.
const PAST_EVENT_GRACE_MS = 24 * 60 * 60 * 1000;

export function isEventPast(event: EventEntity): boolean {
  return !!event.endedAt || Date.now() >= event.dateTime.getTime() + PAST_EVENT_GRACE_MS;
}

export function getCategoryLabel(category: EventCategory, customCategory?: string): string {
  if (category === EventCategory.Other && customCategory?.trim()) {
    return customCategory.trim();
  }
  return EVENT_CATEGORY_LABELS[category];
}

export function parseCategoryOrDefault(value: string): EventCategory {
  return (Object.values(EventCategory) as string[]).includes(value)
    ? (value as EventCategory)
    : EventCategory.Other;
}

export function totalReactions(event: EventEntity): number {
  return (
    event.reactions.hype.length +
    event.reactions.funny.length +
    event.reactions.interested.length
  );
}
