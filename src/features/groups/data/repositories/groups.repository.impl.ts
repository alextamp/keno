import {
  addDoc, arrayRemove, arrayUnion, collection,
  doc, DocumentSnapshot, getDoc, getDocs, onSnapshot,
  orderBy, query, Timestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Failure, ServerFailure } from '@/core/errors/failures';
import { Either, left, right } from '@/core/utils/either';
import { GroupEntity } from '../../domain/entities/group.entity';
import { CreateGroupParams, GroupsRepository } from '../../domain/repositories/groups.repository';
import { notificationsRepository } from '@/features/notifications/notifications.repository';

const GROUPS = 'groups';
const USERS = 'users';

function groupFromFirestore(snap: DocumentSnapshot): GroupEntity {
  const d = snap.data() ?? {};
  return {
    id: snap.id,
    name: d.name,
    description: d.description,
    emoji: d.emoji ?? '🎓',
    coverColor: d.coverColor ?? '#C94D0A',
    creatorId: d.creatorId,
    memberIds: d.memberIds ?? [],
    eventIds: d.eventIds ?? [],
    universityName: d.universityName,
    isPrivate: d.isPrivate ?? false,
    invitedUserIds: d.invitedUserIds ?? [],
    createdAt: d.createdAt?.toDate() ?? new Date(),
  };
}

export const groupsRepository: GroupsRepository = {
  async createGroup(params: CreateGroupParams): Promise<Either<Failure, GroupEntity>> {
    try {
      const ref = await addDoc(collection(db, GROUPS), {
        name: params.name,
        description: params.description,
        emoji: params.emoji,
        coverColor: params.coverColor,
        creatorId: params.creatorId,
        memberIds: [params.creatorId],
        eventIds: [],
        invitedUserIds: [],
        universityName: params.universityName ?? null,
        isPrivate: params.isPrivate,
        createdAt: Timestamp.now(),
      });
      await updateDoc(doc(db, USERS, params.creatorId), {
        groups: arrayUnion(ref.id),
      });
      const snap = await getDoc(ref);
      return right(groupFromFirestore(snap));
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to create group.'));
    }
  },

  async getGroup(id: string): Promise<Either<Failure, GroupEntity>> {
    try {
      const snap = await getDoc(doc(db, GROUPS, id));
      if (!snap.exists()) return left(new ServerFailure('Group not found.'));
      return right(groupFromFirestore(snap));
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to load group.'));
    }
  },

  async getPublicGroups(): Promise<Either<Failure, GroupEntity[]>> {
    try {
      const q = query(collection(db, GROUPS), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return right(snap.docs.map(groupFromFirestore).filter((g) => !g.isPrivate));
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to load groups.'));
    }
  },

  async getUserGroups(uid: string): Promise<Either<Failure, GroupEntity[]>> {
    try {
      const q = query(collection(db, GROUPS), where('memberIds', 'array-contains', uid));
      const snap = await getDocs(q);
      return right(snap.docs.map(groupFromFirestore));
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to load user groups.'));
    }
  },

  async joinGroup(groupId: string, userId: string): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, GROUPS, groupId), { memberIds: arrayUnion(userId) });
      await updateDoc(doc(db, USERS, userId), { groups: arrayUnion(groupId) });
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to join group.'));
    }
  },

  async leaveGroup(groupId: string, userId: string): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, GROUPS, groupId), { memberIds: arrayRemove(userId) });
      await updateDoc(doc(db, USERS, userId), { groups: arrayRemove(groupId) });
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to leave group.'));
    }
  },

  async inviteToGroup(groupId: string, userId: string, invitedByUid: string, invitedByName: string, groupTitle: string): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, GROUPS, groupId), { invitedUserIds: arrayUnion(userId) });
      notificationsRepository.create({
        toUid: userId,
        fromUid: invitedByUid,
        fromName: invitedByName,
        type: 'group_invite',
        eventId: groupId,
        eventTitle: groupTitle,
      }).catch(() => {});
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to invite user.'));
    }
  },

  async addEventToGroup(groupId: string, eventId: string): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, GROUPS, groupId), { eventIds: arrayUnion(eventId) });
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to add event to group.'));
    }
  },

  subscribeToGroup(id, onUpdate, onError) {
    return onSnapshot(
      doc(db, GROUPS, id),
      (snap) => { if (snap.exists()) onUpdate(groupFromFirestore(snap)); },
      onError,
    );
  },
};
