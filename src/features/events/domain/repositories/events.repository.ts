import { Either } from '@/core/utils/either';
import { Failure } from '@/core/errors/failures';
import { EventCategory, EventEntity } from '../entities/event.entity';

export interface CreateEventParams {
  title: string;
  description: string;
  category: EventCategory;
  dateTime: Date;
  location: string;
  creatorId: string;
  maxAttendees: number;
  imageUri?: string;
  minAge?: number;
  maxAge?: number;
  allowedUniversities?: string[];
  genderFilter?: import('../entities/event.entity').GenderFilter;
}

export interface EventsRepository {
  createEvent(params: CreateEventParams): Promise<Either<Failure, EventEntity>>;
  getEvent(id: string): Promise<Either<Failure, EventEntity>>;
  getFeedEvents(limit?: number): Promise<Either<Failure, EventEntity[]>>;
  joinEvent(eventId: string, userId: string): Promise<Either<Failure, void>>;
  leaveEvent(eventId: string, userId: string): Promise<Either<Failure, void>>;
  deleteEvent(eventId: string, creatorId: string): Promise<Either<Failure, void>>;
}
