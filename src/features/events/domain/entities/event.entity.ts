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

export interface EventEntity {
  id: string;
  title: string;
  description: string;
  category: EventCategory;
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

export function parseCategoryOrDefault(value: string): EventCategory {
  return (Object.values(EventCategory) as string[]).includes(value)
    ? (value as EventCategory)
    : EventCategory.Other;
}
