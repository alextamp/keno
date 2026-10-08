import {
  addDoc, arrayRemove, arrayUnion, collection,
  deleteDoc, deleteField, doc, DocumentSnapshot, getDoc, getDocs, onSnapshot,
  orderBy, query, Timestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Failure, ServerFailure } from '@/core/errors/failures';
import { Either, left, right } from '@/core/utils/either';
import { GroupEntity } from '../../domain/entities/group.entity';
import { CreateGroupParams, GroupsRepository, UpdateGroupParams } from '../../domain/repositories/groups.repository';
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
    coverColor: d.coverColor ?? '#B8482A',
    coverPhotoUri: d.coverPhotoUri ?? undefined,
    creatorId: d.creatorId,
    memberIds: d.memberIds ?? [],
    eventIds: d.eventIds ?? [],
    // Falls back to the old single-university field for groups created
    // before this became a multi-select restriction, so existing data isn't
    // silently dropped.
    allowedUniversities: d.allowedUniversities ?? (d.universityName ? [d.universityName] : undefined),
    isPrivate: d.isPrivate ?? false,
    invitedUserIds: d.invitedUserIds ?? [],
    joinRequests: d.joinRequests ?? {},
    createdAt: d.createdAt?.toDate() ?? new Date(),
    isVerifiedOrganiser: d.isVerifiedOrganiser ?? false,
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
        coverPhotoUri: params.coverPhotoUri ?? null,
        creatorId: params.creatorId,
        memberIds: [params.creatorId],
        eventIds: [],
        invitedUserIds: [],
        allowedUniversities: params.allowedUniversities ?? null,
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

  async inviteToGroup(groupId: string, userId: string, invitedByUid: string, invitedByName: string, groupTitle: string, invitedByAvatarColor?: string, invitedByPhotoUri?: string): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, GROUPS, groupId), { invitedUserIds: arrayUnion(userId) });
      notificationsRepository.create({
        toUid: userId,
        fromUid: invitedByUid,
        fromName: invitedByName,
        fromAvatarColor: invitedByAvatarColor,
        fromPhotoUri: invitedByPhotoUri,
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

  async updateGroup(groupId: string, params: UpdateGroupParams): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, GROUPS, groupId), {
        name: params.name,
        description: params.description,
        emoji: params.emoji,
        coverColor: params.coverColor,
        coverPhotoUri: params.coverPhotoUri ?? null,
        allowedUniversities: params.allowedUniversities ?? null,
        isPrivate: params.isPrivate,
      });
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to update group.'));
    }
  },

  async deleteGroup(groupId: string, creatorId: string): Promise<Either<Failure, void>> {
    try {
      await deleteDoc(doc(db, GROUPS, groupId));
      await updateDoc(doc(db, USERS, creatorId), { groups: arrayRemove(groupId) }).catch(() => {});
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to delete group.'));
    }
  },

  async setVerifiedOrganiser(groupId: string, verified: boolean): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, GROUPS, groupId), { isVerifiedOrganiser: verified });
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to update verification.'));
    }
  },

  async requestToJoin(groupId: string, userId: string, message: string): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, GROUPS, groupId), {
        [`joinRequests.${userId}`]: message,
      });
      // Notification is sent by the caller (group/[id].tsx), which already
      // has the requester's profile in scope — don't duplicate it here.
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to send join request.'));
    }
  },

  async decideJoinRequest(groupId: string, uid: string, accept: boolean): Promise<Either<Failure, void>> {
    try {
      await updateDoc(doc(db, GROUPS, groupId), {
        [`joinRequests.${uid}`]: deleteField(),
        ...(accept ? { memberIds: arrayUnion(uid) } : {}),
      });
      if (accept) {
        await updateDoc(doc(db, USERS, uid), { groups: arrayUnion(groupId) }).catch(() => {});
      }
      // Notification is sent by the caller (group/[id].tsx) — don't duplicate it here.
      return right(undefined);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to update join request.'));
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
