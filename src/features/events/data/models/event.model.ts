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
    imageUri: data.imageUri as string | undefined,
    customCategory: data.customCategory as string | undefined,
    minAge: data.minAge as number | undefined,
    maxAge: data.maxAge as number | undefined,
    genderFilter: data.genderFilter as EventEntity['genderFilter'],
    allowedUniversities: (data.allowedUniversities as string[]) ?? [],
    coHostIds: (data.coHostIds as string[]) ?? [],
    viewCount: (data.viewCount as number) ?? 0,
    isPrivate: (data.isPrivate as boolean) ?? false,
    invitedUserIds: (data.invitedUserIds as string[]) ?? [],
    joinRequests: (data.joinRequests as Record<string, string>) ?? {},
    creatorUniversity: (data.creatorUniversity as string) ?? '',
    latitude: data.latitude as number | undefined,
    longitude: data.longitude as number | undefined,
    reactions: (data.reactions as EventEntity['reactions']) ?? { hype: [], funny: [], interested: [] },
    waitlistIds: (data.waitlistIds as string[]) ?? [],
    hostArrivedAt: data.hostArrivedAt ? (data.hostArrivedAt as Timestamp).toDate() : undefined,
    standInHostId: data.standInHostId as string | undefined,
    standInClaimedAt: data.standInClaimedAt ? (data.standInClaimedAt as Timestamp).toDate() : undefined,
    feedbackGoodCount: (data.feedbackGoodCount as number) ?? 0,
    feedbackBadCount: (data.feedbackBadCount as number) ?? 0,
    soloFriendly: (data.soloFriendly as boolean) ?? false,
    checkInInfo: data.checkInInfo as EventEntity['checkInInfo'],
    referredBy: (data.referredBy as Record<string, string>) ?? undefined,
    endedAt: data.endedAt ? (data.endedAt as Timestamp).toDate() : undefined,
    isFlagship: (data.isFlagship as boolean) ?? false,
    rsvpStakes: data.rsvpStakes
      ? Object.fromEntries(
          Object.entries(data.rsvpStakes as Record<string, { xp: number; timestamp: Timestamp; didCheckIn: boolean }>)
            .map(([uid, s]) => [uid, { xp: s.xp, timestamp: s.timestamp.toDate(), didCheckIn: !!s.didCheckIn }]),
        )
      : undefined,
    messages: ((data.messages as any[]) ?? []).map((m) => ({
      id: m.id as string,
      userId: m.userId as string,
      text: m.text as string,
      timestamp: m.timestamp instanceof Timestamp ? m.timestamp.toDate() : new Date(m.timestamp),
    })),
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
    ...(event.imageUri ? { imageUri: event.imageUri } : {}),
    ...(event.customCategory ? { customCategory: event.customCategory } : {}),
    ...(event.minAge != null ? { minAge: event.minAge } : {}),
    ...(event.maxAge != null ? { maxAge: event.maxAge } : {}),
    ...(event.genderFilter ? { genderFilter: event.genderFilter } : {}),
    ...(event.allowedUniversities?.length ? { allowedUniversities: event.allowedUniversities } : {}),
    ...(event.isPrivate ? { isPrivate: true } : {}),
    ...(event.invitedUserIds?.length ? { invitedUserIds: event.invitedUserIds } : {}),
    ...(event.joinRequests && Object.keys(event.joinRequests).length ? { joinRequests: event.joinRequests } : {}),
    ...(event.creatorUniversity ? { creatorUniversity: event.creatorUniversity } : {}),
    ...(event.latitude != null ? { latitude: event.latitude } : {}),
    ...(event.longitude != null ? { longitude: event.longitude } : {}),
    reactions: event.reactions,
    waitlistIds: event.waitlistIds ?? [],
    ...(event.soloFriendly ? { soloFriendly: true } : {}),
    ...(event.checkInInfo && (event.checkInInfo.text || event.checkInInfo.photoUri) ? { checkInInfo: event.checkInInfo } : {}),
    ...(event.isFlagship ? { isFlagship: true } : {}),
    messages: event.messages.map((m) => ({
      ...m,
      timestamp: Timestamp.fromDate(m.timestamp),
    })),
    createdAt: serverTimestamp(),
  };
}
