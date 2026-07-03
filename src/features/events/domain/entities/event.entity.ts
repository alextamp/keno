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
  [EventCategory.Party]: '#8B5CF6',
  [EventCategory.Sports]: '#10B981',
  [EventCategory.Study]: '#3B82F6',
  [EventCategory.Chill]: '#EC4899',
  [EventCategory.Coffee]: '#F59E0B',
  [EventCategory.Other]: '#6B7280',
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
  timestamp: Date;
  reactions?: Record<string, string[]>; // emoji → [uid, ...]
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
  creatorUniversity?: string;
  latitude?: number;
  longitude?: number;
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
