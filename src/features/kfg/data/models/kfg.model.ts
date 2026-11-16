import { DocumentData, DocumentSnapshot, Timestamp } from 'firebase/firestore';
import { DEFAULT_KFG_CHARACTER, getKfgMonthId, KFG_CHARACTERS } from '@/core/constants/kfg';
import {
  EMPTY_KFG_PROFILE, KfgLeaderboard, KfgMission, KfgParticipation, KfgProfile,
} from '../../domain/entities/kfg.entity';

const date = (v: unknown): Date | undefined => (v instanceof Timestamp ? v.toDate() : undefined);
const opt = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

export function missionFromFirestore(snap: DocumentSnapshot<DocumentData>): KfgMission {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    creatorId: d.creatorId,
    creatorType: d.creatorType,
    creatorName: d.creatorName ?? '',
    title: d.title ?? '',
    description: d.description ?? '',
    infoText: opt(d.infoText),
    infoPhotoUri: opt(d.infoPhotoUri),
    ridesEnabled: d.ridesEnabled === true,
    kind: d.kind,
    cause: d.cause ?? 'other',
    startsAt: date(d.startsAt) ?? new Date(0),
    endsAt: date(d.endsAt) ?? new Date(0),
    minDurationMin: d.minDurationMin ?? 0,
    areaLabel: d.areaLabel ?? '',
    address: opt(d.address),
    latitude: opt(d.lat),
    longitude: opt(d.lng),
    capacity: d.capacity ?? 0,
    imageUri: opt(d.imageUri),
    minAge: opt(d.minAge),
    maxAge: opt(d.maxAge),
    allowedUniversities: Array.isArray(d.allowedUniversities) && d.allowedUniversities.length ? d.allowedUniversities : undefined,
    genderFilter: d.genderFilter === 'male' || d.genderFilter === 'female' ? d.genderFilter : undefined,
    soloFriendly: d.soloFriendly === true,
    groupId: opt(d.groupId),
    groupName: opt(d.groupName),
    photoWall: d.photoWall !== false,
    points: d.points ?? 0,
    status: d.status,
    participantCount: d.participantCount ?? 0,
    participantIds: d.participantIds ?? [],
    presentIds: d.presentIds ?? [],
    endedEarly: d.endedEarlyAt != null,
    isPrivate: d.isPrivate === true,
    joinRequests: d.joinRequests ?? {},
    waitlistIds: d.waitlistIds ?? [],
    coHostIds: d.coHostIds ?? [],
    verifiedCount: d.verifiedCount ?? 0,
    finalized: d.finalized === true,
    rejectionReason: opt(d.rejectionReason),
  };
}

export function participationFromFirestore(snap: DocumentSnapshot<DocumentData>): KfgParticipation {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    uid: d.uid,
    missionId: d.missionId,
    missionCreatorId: d.missionCreatorId,
    kind: d.kind,
    creatorType: d.creatorType,
    status: d.status,
    joinedAt: date(d.joinedAt),
    checkInAt: date(d.checkInAt),
    checkOutAt: date(d.checkOutAt),
    award: opt(d.award),
    photos: d.photos ?? {},
    reviewState: opt(d.reviewState),
    rejectionReason: opt(d.rejectionReason),
    reviewProblems: opt(d.reviewProblems),
  };
}

export function profileFromFirestore(uid: string, d: DocumentData | undefined, now = new Date()): KfgProfile {
  if (!d) return { uid, ...EMPTY_KFG_PROFILE };
  // monthPoints belong to `monthId`; a profile nobody has touched since last
  // month is simply at 0 this month (no reset job rewrites old profiles).
  const currentMonth = d.monthId === getKfgMonthId(now);
  return {
    uid,
    lifetimePoints: d.lifetimePoints ?? 0,
    balance: d.balance ?? 0,
    monthPoints: currentMonth ? (d.monthPoints ?? 0) : 0,
    streakWeeks: d.streakWeeks ?? 0,
    university: opt(d.university),
    character: KFG_CHARACTERS.some((c) => c.id === d.character) ? d.character : DEFAULT_KFG_CHARACTER,
    equipped: { head: null, face: null, neck: null, ...(d.equipped ?? {}) },
    rankAtWeekStart: opt(d.rankAtWeekStart),
    rankWeekId: opt(d.rankWeekId),
  };
}

export function leaderboardFromFirestore(d: DocumentData): KfgLeaderboard {
  return {
    monthId: d.monthId,
    final: d.final === true,
    totalRanked: d.totalRanked ?? 0,
    top: (d.top ?? []).map((e: DocumentData) => ({
      uid: e.uid, name: e.name ?? '', points: e.points ?? 0,
      university: opt(e.university), avatarColor: opt(e.avatarColor), photoUri: opt(e.photoUri),
    })),
    universities: d.universities ?? [],
  };
}
