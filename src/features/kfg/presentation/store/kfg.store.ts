import { create } from 'zustand';
import { kfgRepository } from '../../data/repositories/kfg.repository.impl';
import { KfgMission, KfgParticipation, KfgProfile } from '../../domain/entities/kfg.entity';

// Live KfG state for the signed-in user. The KfG section calls start(uid)
// when it mounts and stop() when it unmounts; the Feed entry card only needs
// the profile + mission count, so it starts the same subscriptions.

interface KfgState {
  uid: string | null;
  profile: KfgProfile | null;
  ownedCosmetics: string[];
  missions: KfgMission[];
  participations: KfgParticipation[];
  loaded: boolean;
  start: (uid: string) => void;
  stop: () => void;
  participationFor: (missionId: string) => KfgParticipation | undefined;
}

let unsubs: (() => void)[] = [];
let users = 0;

export const useKfgStore = create<KfgState>((set, get) => ({
  uid: null,
  profile: null,
  ownedCosmetics: [],
  missions: [],
  participations: [],
  loaded: false,

  // Reference-counted: the Feed card and the KfG screens can both be mounted.
  start: (uid) => {
    users += 1;
    if (get().uid === uid && unsubs.length) return;
    unsubs.forEach((u) => u());
    set({ uid, loaded: false });
    let pending = 2;
    const ready = () => { pending -= 1; if (pending === 0) set({ loaded: true }); };
    unsubs = [
      kfgRepository.subscribeProfile(uid, (profile) => set({ profile })),
      kfgRepository.subscribeOwnedCosmetics(uid, (ownedCosmetics) => set({ ownedCosmetics })),
      kfgRepository.subscribePublishedMissions((missions) => { set({ missions }); ready(); }),
      kfgRepository.subscribeMyParticipations(uid, (participations) => { set({ participations }); ready(); }),
    ];
  },

  stop: () => {
    users = Math.max(0, users - 1);
    if (users > 0) return;
    unsubs.forEach((u) => u());
    unsubs = [];
    set({ uid: null, profile: null, ownedCosmetics: [], missions: [], participations: [], loaded: false });
  },

  participationFor: (missionId) => get().participations.find((p) => p.missionId === missionId && p.status !== 'cancelled'),
}));
