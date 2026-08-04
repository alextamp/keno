import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  loadTheme: () => Promise<void>;
}

const STORAGE_KEY = 'app_theme_mode';
// Old boolean-only key from before the "auto" (system-following) option existed.
// Read once on load so existing users keep whatever they'd picked.
const LEGACY_KEY = 'app_dark_mode';

function resolveIsDark(mode: ThemeMode): boolean {
  if (mode === 'auto') return Appearance.getColorScheme() === 'dark';
  return mode === 'dark';
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'light',
  isDark: false,

  setMode: (mode) => {
    set({ mode, isDark: resolveIsDark(mode) });
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  },

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'auto') {
        set({ mode: stored, isDark: resolveIsDark(stored) });
        return;
      }
      const legacy = await AsyncStorage.getItem(LEGACY_KEY);
      if (legacy === '1' || legacy === '0') {
        const mode: ThemeMode = legacy === '1' ? 'dark' : 'light';
        set({ mode, isDark: resolveIsDark(mode) });
        AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
      }
    } catch {}
  },
}));

// Keep isDark live when mode is 'auto' and the OS theme flips while the app is open.
Appearance.addChangeListener(({ colorScheme }) => {
  if (useThemeStore.getState().mode === 'auto') {
    useThemeStore.setState({ isDark: colorScheme === 'dark' });
  }
});
