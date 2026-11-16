import { KfgCreatorType, KfgMissionKind, KfgSlot } from '@/core/constants/kfg';
import { GenderFilter } from '@/features/events/domain/entities/event.entity';

export type KfgCause = 'food' | 'animals' | 'environment' | 'recycling' | 'people' | 'other';
export type KfgMissionStatus = 'pending' | 'published' | 'rejected' | 'cancelled';
export type KfgParticipationStatus =
  | 'joined' | 'checkedIn' | 'verified' | 'inReview' | 'completed' | 'rejected' | 'cancelled' | 'expired';

export interface KfgMission {
  id: string;
  creatorId: string;
  creatorType: KfgCreatorType;
  creatorName: string;
  title: string;
  description: string;
  infoText?: string;
  kind: KfgMissionKind;
  cause: KfgCause;
  startsAt: Date;
  endsAt: Date;
  minDurationMin: number;
  areaLabel: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  capacity: number;
  /** Download URL of a cover photo in Storage's events/ folder (same as regular events). */
  imageUri?: string;
  /** Who may join — same filters as regular events. Age/university are enforced
   *  by kfgJoin; gender is a label only (there's no gender field on profiles). */
  minAge?: number;
  maxAge?: number;
  allowedUniversities?: string[];
  genderFilter?: GenderFilter;
  soloFriendly?: boolean;
  /** KfG community (groups doc with scope 'kfg') it was posted to; name denormalized by the server. */
  groupId?: string;
  groupName?: string;
  /** Photo wall on/off — off for e.g. shelters where people shouldn't be photographed. Missing = on. */
  photoWall: boolean;
  points: number;
  status: KfgMissionStatus;
  participantCount: number;
  participantIds: string[];
  /** Who was actually there (checked in / paid) — server-maintained, gates Kudos and reconnect. */
  presentIds: string[];
  /** The creator ended it early from Live Mode (endsAt was moved to that moment). */
  endedEarly: boolean;
  verifiedCount: number;
  finalized: boolean;
  rejectionReason?: string;
}

/** What a completion paid, as stored by the server on the participation. */
export interface KfgAward {
  points: number;
  countsForLeaderboard: boolean;
  levelBefore: number;
  levelAfter: number;
  unlocked: string[];
}

export interface KfgParticipation {
  id: string;
  uid: string;
  missionId: string;
  missionCreatorId: string;
  kind: KfgMissionKind;
  creatorType: KfgCreatorType;
  status: KfgParticipationStatus;
  joinedAt?: Date;
  checkInAt?: Date;
  checkOutAt?: Date;
  award?: KfgAward;
  photos: { before?: string; after?: string };
  reviewState?: 'auto' | 'queued' | 'approved' | 'rejected';
  rejectionReason?: string;
  /** Automatic photo checks that failed ('faces', 'distance', 'day', 'order', 'window'). */
  reviewProblems?: string[];
}

export interface KfgProfile {
  uid: string;
  lifetimePoints: number;
  balance: number;
  /** Already zeroed client-side when the stored month isn't the current one. */
  monthPoints: number;
  streakWeeks: number;
  university?: string;
  /** One of KFG_CHARACTERS. */
  character: string;
  equipped: Record<KfgSlot, string | null>;
  rankAtWeekStart?: number;
  rankWeekId?: string;
}

export interface KfgLeaderboardEntry {
  uid: string;
  name: string;
  points: number;
  university?: string;
  avatarColor?: string;
  photoUri?: string;
}

export interface KfgLeaderboard {
  monthId: string;
  final: boolean;
  totalRanked: number;
  top: KfgLeaderboardEntry[];
  universities: { name: string; points: number }[];
}

export const EMPTY_KFG_PROFILE: Omit<KfgProfile, 'uid'> = {
  lifetimePoints: 0, balance: 0, monthPoints: 0, streakWeeks: 0, character: 'classic',
  equipped: { head: null, face: null, neck: null },
};
