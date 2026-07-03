import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeState {
  isDark: boolean;
  toggle: () => void;
  loadTheme: () => Promise<void>;
}

const STORAGE_KEY = 'app_dark_mode';

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: false,

  toggle: () => {
    const next = !get().isDark;
    set({ isDark: next });
    AsyncStorage.setItem(STORAGE_KEY, next ? '1' : '0').catch(() => {});
  },

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === '1' || stored === '0') {
        set({ isDark: stored === '1' });
      }
    } catch {}
  },
}));
