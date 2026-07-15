import { create } from 'zustand';

export interface MapFocusLocation {
  latitude: number;
  longitude: number;
}

interface TabNavigationState {
  pendingTab: number | null;
  goToTab: (index: number) => void;
  clearPendingTab: () => void;
  /** Set right before navigating to the Map tab so it knows where to center. */
  focusLocation: MapFocusLocation | null;
  setFocusLocation: (loc: MapFocusLocation) => void;
  clearFocusLocation: () => void;
}

export const useTabNavigation = create<TabNavigationState>((set) => ({
  pendingTab: null,
  goToTab: (index) => set({ pendingTab: index }),
  clearPendingTab: () => set({ pendingTab: null }),
  focusLocation: null,
  setFocusLocation: (loc) => set({ focusLocation: loc }),
  clearFocusLocation: () => set({ focusLocation: null }),
}));
