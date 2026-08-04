import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_KEY = 'app_sound_effects_enabled';
const HERO_KEY = 'app_dynamic_hero_enabled';

interface PreferencesState {
  soundEffectsEnabled: boolean;
  dynamicHeroEnabled: boolean;
  setSoundEffectsEnabled: (enabled: boolean) => void;
  setDynamicHeroEnabled: (enabled: boolean) => void;
  loadPreferences: () => Promise<void>;
}

export const usePreferencesStore = create<PreferencesState>((set) => ({
  soundEffectsEnabled: true,
  dynamicHeroEnabled: true,

  setSoundEffectsEnabled: (enabled) => {
    set({ soundEffectsEnabled: enabled });
    AsyncStorage.setItem(SOUND_KEY, enabled ? '1' : '0').catch(() => {});
  },

  setDynamicHeroEnabled: (enabled) => {
    set({ dynamicHeroEnabled: enabled });
    AsyncStorage.setItem(HERO_KEY, enabled ? '1' : '0').catch(() => {});
  },

  loadPreferences: async () => {
    try {
      const [sound, hero] = await Promise.all([
        AsyncStorage.getItem(SOUND_KEY),
        AsyncStorage.getItem(HERO_KEY),
      ]);
      set({
        soundEffectsEnabled: sound !== '0',
        dynamicHeroEnabled: hero !== '0',
      });
    } catch {}
  },
}));
