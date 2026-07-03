import { create } from 'zustand';

interface TabNavigationState {
  pendingTab: number | null;
  goToTab: (index: number) => void;
  clearPendingTab: () => void;
}

export const useTabNavigation = create<TabNavigationState>((set) => ({
  pendingTab: null,
  goToTab: (index) => set({ pendingTab: index }),
  clearPendingTab: () => set({ pendingTab: null }),
}));
