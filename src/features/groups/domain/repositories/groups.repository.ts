import { Either } from '@/core/utils/either';
import { Failure } from '@/core/errors/failures';
import { GroupEntity } from '../entities/group.entity';

export interface CreateGroupParams {
  name: string;
  description: string;
  emoji: string;
  coverColor: string;
  creatorId: string;
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
  inviteToGroup(groupId: string, userId: string, invitedByUid: string, invitedByName: string, groupTitle: string): Promise<Either<Failure, void>>;
  subscribeToGroup(id: string, onUpdate: (group: GroupEntity) => void, onError?: (e: Error) => void): () => void;
}
