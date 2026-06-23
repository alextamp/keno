import {
  DocumentData,
  DocumentSnapshot,
  FieldValue,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { EventCategory, EventEntity, parseCategoryOrDefault } from '../../domain/entities/event.entity';

export type EventModel = EventEntity;

export function eventFromFirestore(doc: DocumentSnapshot<DocumentData>): EventModel {
  const data = doc.data()!;
  return {
    id: doc.id,
    title: data.title as string,
    description: data.description as string,
    category: parseCategoryOrDefault(data.category as string),
    dateTime: (data.dateTime as Timestamp).toDate(),
    location: data.location as string,
    creatorId: data.creatorId as string,
    maxAttendees: data.maxAttendees as number,
    attendeeIds: (data.attendeeIds as string[]) ?? [],
  };
}

export function eventToFirestore(
  event: Omit<EventModel, 'id'>,
): DocumentData & { createdAt: FieldValue } {
  return {
    title: event.title,
    description: event.description,
    category: event.category,
    dateTime: Timestamp.fromDate(event.dateTime),
    location: event.location,
    creatorId: event.creatorId,
    maxAttendees: event.maxAttendees,
    attendeeIds: event.attendeeIds,
    createdAt: serverTimestamp(),
  };
}
