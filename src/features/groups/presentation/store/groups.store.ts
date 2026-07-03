import { create } from 'zustand';
import { fold } from '@/core/utils/either';
import { GroupEntity } from '../../domain/entities/group.entity';
import { groupsRepository } from '../../data/repositories/groups.repository.impl';
import { CreateGroupParams } from '../../domain/repositories/groups.repository';

interface GroupsState {
  publicGroups: GroupEntity[];
  myGroups: GroupEntity[];
  isLoading: boolean;
  error: string | null;
  loadPublicGroups: () => Promise<void>;
  loadMyGroups: (uid: string) => Promise<void>;
  createGroup: (params: CreateGroupParams) => Promise<GroupEntity | null>;
  joinGroup: (groupId: string, userId: string) => Promise<boolean>;
  leaveGroup: (groupId: string, userId: string) => Promise<boolean>;
  inviteToGroup: (groupId: string, userId: string, invitedByUid: string, invitedByName: string, groupTitle: string) => Promise<boolean>;
  clearError: () => void;
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  publicGroups: [],
  myGroups: [],
  isLoading: false,
  error: null,

  loadPublicGroups: async () => {
    set({ isLoading: true, error: null });
    const result = await groupsRepository.getPublicGroups();
    fold(result,
      (err) => set({ isLoading: false, error: err.message }),
      (groups) => set({ isLoading: false, publicGroups: groups }),
    );
  },

  loadMyGroups: async (uid) => {
    const result = await groupsRepository.getUserGroups(uid);
    fold(result,
      () => {},
      (groups) => set({ myGroups: groups }),
    );
  },

  createGroup: async (params) => {
    set({ isLoading: true, error: null });
    const result = await groupsRepository.createGroup(params);
    return fold(result,
      (err) => { set({ isLoading: false, error: err.message }); return null; },
      (group) => {
        set((s) => ({
          isLoading: false,
          publicGroups: [group, ...s.publicGroups],
          myGroups: [group, ...s.myGroups],
        }));
        return group;
      },
    );
  },

  joinGroup: async (groupId, userId) => {
    const result = await groupsRepository.joinGroup(groupId, userId);
    return fold(result,
      () => false,
      () => {
        set((s) => ({
          publicGroups: s.publicGroups.map((g) =>
            g.id === groupId ? { ...g, memberIds: [...g.memberIds, userId] } : g,
          ),
          myGroups: (() => {
            const alreadyMine = s.myGroups.find((g) => g.id === groupId);
            if (alreadyMine) {
              return s.myGroups.map((g) =>
                g.id === groupId ? { ...g, memberIds: [...g.memberIds, userId] } : g,
              );
            }
            const grp = s.publicGroups.find((g) => g.id === groupId);
            return grp ? [...s.myGroups, { ...grp, memberIds: [...grp.memberIds, userId] }] : s.myGroups;
          })(),
        }));
        return true;
      },
    );
  },

  leaveGroup: async (groupId, userId) => {
    const result = await groupsRepository.leaveGroup(groupId, userId);
    return fold(result,
      () => false,
      () => {
        set((s) => ({
          publicGroups: s.publicGroups.map((g) =>
            g.id === groupId ? { ...g, memberIds: g.memberIds.filter((id) => id !== userId) } : g,
          ),
          myGroups: s.myGroups.filter((g) => g.id !== groupId),
        }));
        return true;
      },
    );
  },

  inviteToGroup: async (groupId, userId, invitedByUid, invitedByName, groupTitle) => {
    const result = await groupsRepository.inviteToGroup(groupId, userId, invitedByUid, invitedByName, groupTitle);
    return fold(result,
      () => false,
      () => true,
    );
  },

  clearError: () => set({ error: null }),
}));
