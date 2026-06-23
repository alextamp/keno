import { Failure, ServerFailure } from '@/core/errors/failures';
import { Either, left, right } from '@/core/utils/either';
import { EventEntity, EventCategory } from '../../domain/entities/event.entity';
import { CreateEventParams, EventsRepository } from '../../domain/repositories/events.repository';
import { MOCK_EVENTS, MOCK_USER } from '@/mock/data';

let _events: EventEntity[] = [...MOCK_EVENTS];

export const eventsRepository: EventsRepository = {
  async createEvent(params: CreateEventParams): Promise<Either<Failure, EventEntity>> {
    const event: EventEntity = {
      id: `event-${Date.now()}`,
      title: params.title,
      description: params.description,
      category: params.category,
      dateTime: params.dateTime,
      location: params.location,
      creatorId: params.creatorId,
      maxAttendees: params.maxAttendees,
      attendeeIds: [params.creatorId],
      imageUri: params.imageUri,
      minAge: params.minAge,
      maxAge: params.maxAge,
      allowedUniversities: params.allowedUniversities,
      genderFilter: params.genderFilter,
    };
    _events = [event, ..._events];
    return right(event);
  },

  async getEvent(id: string): Promise<Either<Failure, EventEntity>> {
    const event = _events.find((e) => e.id === id);
    if (!event) return left(new ServerFailure('Event not found.'));
    return right(event);
  },

  async getFeedEvents(): Promise<Either<Failure, EventEntity[]>> {
    return right([..._events].sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime()));
  },

  async joinEvent(eventId: string, userId: string): Promise<Either<Failure, void>> {
    _events = _events.map((e) =>
      e.id === eventId && !e.attendeeIds.includes(userId)
        ? { ...e, attendeeIds: [...e.attendeeIds, userId] }
        : e,
    );
    return right(undefined);
  },

  async leaveEvent(eventId: string, userId: string): Promise<Either<Failure, void>> {
    _events = _events.map((e) =>
      e.id === eventId
        ? { ...e, attendeeIds: e.attendeeIds.filter((id) => id !== userId) }
        : e,
    );
    return right(undefined);
  },

  async deleteEvent(eventId: string): Promise<Either<Failure, void>> {
    _events = _events.filter((e) => e.id !== eventId);
    return right(undefined);
  },
};
