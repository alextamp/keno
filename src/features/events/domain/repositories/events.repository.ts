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
}

export type UpdateEventParams = Partial<Omit<CreateEventParams, 'creatorId'>>;

export interface EventsRepository {
  createEvent(params: CreateEventParams): Promise<Either<Failure, EventEntity>>;
  updateEvent(eventId: string, params: UpdateEventParams): Promise<Either<Failure, EventEntity>>;
  getEvent(id: string): Promise<Either<Failure, EventEntity>>;
  getFeedEvents(limit?: number): Promise<Either<Failure, EventEntity[]>>;
  subscribeToFeedEvents(onUpdate: (events: EventEntity[]) => void, onError?: (e: Error) => void): () => void;
  joinEvent(eventId: string, userId: string): Promise<Either<Failure, void>>;
  leaveEvent(eventId: string, userId: string): Promise<Either<Failure, void>>;
  joinWaitlist(eventId: string, userId: string): Promise<Either<Failure, void>>;
  leaveWaitlist(eventId: string, userId: string): Promise<Either<Failure, void>>;
  deleteEvent(eventId: string, creatorId: string): Promise<Either<Failure, void>>;
  getEventsByAttendee(uid: string): Promise<Either<Failure, EventEntity[]>>;
  reactToEvent(eventId: string, userId: string, reaction: ReactionType): Promise<Either<Failure, EventEntity>>;
  sendMessage(eventId: string, userId: string, text: string): Promise<Either<Failure, EventEntity>>;
}
