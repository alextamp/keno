import { GenderFilter } from '@/features/events/domain/entities/event.entity';
import { Failure } from '@/core/errors/failures';
import { Either } from '@/core/utils/either';
import { KfgMissionKind, KfgSlot } from '@/core/constants/kfg';
import {
  KfgCause, KfgLeaderboard, KfgMission, KfgParticipation, KfgProfile,
} from '../entities/kfg.entity';

export interface CreateKfgMissionParams {
  title: string;
  description: string;
  infoText?: string;
  /** Ignored for students (always partner QR, verified by the creator). */
  kind?: KfgMissionKind;
  cause: KfgCause;
  startsAt: Date;
  endsAt: Date;
  minDurationMin?: number;
  areaLabel: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  capacity: number;
  /** Organization QR missions only; the server clamps it to 200–300. */
  points?: number;
  imageUri?: string;
  minAge?: number;
  maxAge?: number;
  allowedUniversities?: string[];
  genderFilter?: GenderFilter;
  soloFriendly?: boolean;
  /** A KfG community the creator belongs to (checked by the server). */
  groupId?: string;
  /** Default true. */
  photoWall?: boolean;
}

export type KfgScanResult =
  | { result: 'checkedIn' | 'completed' | 'verified' | 'alreadyDone'; name: string }
  | { result: 'tooEarly'; name: string; remainingMin: number };

export interface KfgRepository {
  subscribePublishedMissions(onChange: (missions: KfgMission[]) => void): () => void;
  /** Missions this user created, any status (pending/rejected included), newest first. */
  /** Missions by id (one get each — a list query can't prove the read rule). Missing/unreadable ones are skipped. */
  getMissions(ids: string[]): Promise<KfgMission[]>;
  /** Someone's public KfG profile, or null if they've never opened Keno for Good. */
  getPublicProfile(uid: string): Promise<KfgProfile | null>;
  subscribeMyMissions(uid: string, onChange: (missions: KfgMission[]) => void): () => void;
  subscribeMission(id: string, onChange: (mission: KfgMission | null) => void): () => void;
  subscribeMyParticipations(uid: string, onChange: (items: KfgParticipation[]) => void): () => void;
  subscribeMissionParticipations(missionId: string, creatorId: string, onChange: (items: KfgParticipation[]) => void): () => void;
  subscribeProfile(uid: string, onChange: (profile: KfgProfile) => void): () => void;
  subscribeOwnedCosmetics(uid: string, onChange: (ids: string[]) => void): () => void;
  getQrSecret(participationId: string): Promise<Either<Failure, string>>;
  getLeaderboard(monthId: string): Promise<Either<Failure, KfgLeaderboard | null>>;
  getProfiles(uids: string[]): Promise<Either<Failure, KfgProfile[]>>;
  /** 1-based rank this month, or null with no points yet. */
  getMyRank(monthPoints: number): Promise<Either<Failure, number | null>>;
  /** Admin: live list of student missions waiting for approval. onError gets the Firestore message. */
  subscribePendingMissions(onChange: (missions: KfgMission[]) => void, onError: (message: string) => void): () => void;
  /** Admin: photo pairs waiting for a human decision, with readable photo URLs. */
  getPhotoReviewQueue(): Promise<Either<Failure, { participation: KfgParticipation; before?: string; after?: string }[]>>;

  createMission(params: CreateKfgMissionParams): Promise<Either<Failure, { missionId: string; status: 'pending' | 'published' }>>;
  reviewMission(missionId: string, approve: boolean, reason?: string): Promise<Either<Failure, void>>;
  cancelMission(missionId: string): Promise<Either<Failure, void>>;
  /** Creator, while it's running: end it now (Live Mode). */
  endMission(missionId: string): Promise<Either<Failure, void>>;
  join(missionId: string): Promise<Either<Failure, string>>;
  leave(missionId: string): Promise<Either<Failure, void>>;
  scan(code: string): Promise<Either<Failure, KfgScanResult>>;
  checkOutAll(missionId: string): Promise<Either<Failure, { completed: number; tooEarly: number }>>;
  confirmPeers(missionId: string, uids: string[]): Promise<Either<Failure, number>>;
  uploadPhoto(params: {
    uid: string; participationId: string; side: 'before' | 'after'; localUri: string;
    takenAt: Date; latitude: number; longitude: number;
  }): Promise<Either<Failure, void>>;
  reviewPhoto(participationId: string, approve: boolean): Promise<Either<Failure, void>>;
  purchase(itemId: string): Promise<Either<Failure, void>>;
  equip(uid: string, equipped: Record<KfgSlot, string | null>): Promise<Either<Failure, void>>;
  setCharacter(uid: string, character: string): Promise<Either<Failure, void>>;
}
