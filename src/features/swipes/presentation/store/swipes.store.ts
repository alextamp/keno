import { create } from 'zustand';
import { swipesRepository } from '../../data/repositories/swipes.repository.impl';
import { MutualMatchEntity } from '../../domain/entities/swipe.entity';

interface SwipesState {
  matches: MutualMatchEntity[];
  isLoading: boolean;
  recordSwipe: (eventId: string, toUid: string, direction: 'interested' | 'skip') => Promise<void>;
  subscribeToMatches: (uid: string) => () => void;
}

export const useSwipesStore = create<SwipesState>((set, get) => ({
  matches: [],
  isLoading: false,
  recordSwipe: async (eventId: string, toUid: string, direction: 'interested' | 'skip') => {
    const user = useSwipesStore.getState();
    // Needs to be called from component with access to current user
  },
  subscribeToMatches: (uid: string) => {
    set({ isLoading: true });
    const unsub = swipesRepository.subscribeToMatches(uid, (matches) => {
      set({ matches, isLoading: false });
    });
    return unsub;
  },
}));
