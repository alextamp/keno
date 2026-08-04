import { Either } from '@/core/utils/either';
import { Failure } from '@/core/errors/failures';
import { GroupEntity } from '../entities/group.entity';

export interface CreateGroupParams {
  name: string;
  description: string;
  emoji: string;
  coverColor: string;
  coverPhotoUri?: string;
  creatorId: string;
  universityName?: string;
  isPrivate: boolean;
}

export interface UpdateGroupParams {
  name: string;
  description: string;
  emoji: string;
  coverColor: string;
  coverPhotoUri?: string;
  universityName?: string;
  isPrivate: boolean;
}

export interface GroupsRepository {
  createGroup(params: CreateGroupParams): Promise<Either<Failure, GroupEntity>>;
  getGroup(id: string): Promise<Either<Failure, GroupEntity>>;
  getPublicGroups(): Promise<Either<Failure, GroupEntity[]>>;
  getUserGroups(uid: string): Promise<Either<Failure, GroupEntity[]>>;
  joinGroup(groupId: string, userId: string): Promise<Either<Failure, void>>;
  leaveGroup(groupId: string, userId: string): Promise<Either<Failure, void>>;
  addEventToGroup(groupId: string, eventId: string): Promise<Either<Failure, void>>;
  inviteToGroup(groupId: string, userId: string, invitedByUid: string, invitedByName: string, groupTitle: string, invitedByAvatarColor?: string, invitedByPhotoUri?: string): Promise<Either<Failure, void>>;
  updateGroup(groupId: string, params: UpdateGroupParams): Promise<Either<Failure, void>>;
  deleteGroup(groupId: string, creatorId: string): Promise<Either<Failure, void>>;
  /** Admin-only (enforced by firestore.rules' isAdmin() check) — manual
   *  confirmation that the group genuinely represents a university club. */
  setVerifiedOrganiser(groupId: string, verified: boolean): Promise<Either<Failure, void>>;
  requestToJoin(groupId: string, userId: string, message: string): Promise<Either<Failure, void>>;
  decideJoinRequest(groupId: string, uid: string, accept: boolean): Promise<Either<Failure, void>>;
  subscribeToGroup(id: string, onUpdate: (group: GroupEntity) => void, onError?: (e: Error) => void): () => void;
}
