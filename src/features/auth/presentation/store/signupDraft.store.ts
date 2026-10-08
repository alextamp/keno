import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Answers collected across app/(auth)/start/* before an account exists.
// Deliberately excludes email/password/ID-photo — those are typed fresh on
// the final step and never persisted to disk (no reason to keep a password
// sitting in AsyncStorage between app launches).
export interface SignupDraft {
  universityName: string;
  department: string;
  name: string;
  age: string;
  interests: string[];
  bio: string;
  avatarColor: string;
  photoUri?: string;
}

const STORAGE_KEY = 'signup_draft_v1';

const DEFAULT_DRAFT: SignupDraft = {
  universityName: '',
  department: '',
  name: '',
  age: '',
  interests: [],
  bio: '',
  avatarColor: '#B8482A',
  photoUri: undefined,
};

interface SignupDraftState {
  draft: SignupDraft;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<SignupDraft>) => void;
  reset: () => void;
}

export const useSignupDraftStore = create<SignupDraftState>((set, get) => ({
  draft: DEFAULT_DRAFT,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      set({ draft: raw ? { ...DEFAULT_DRAFT, ...JSON.parse(raw) } : DEFAULT_DRAFT, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  update: (patch) => {
    const draft = { ...get().draft, ...patch };
    set({ draft });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(draft)).catch(() => {});
  },

  reset: () => {
    set({ draft: DEFAULT_DRAFT });
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  },
}));

export const STEP_ORDER = ['university', 'department', 'name', 'age', 'interests', 'personalise', 'account'] as const;
export type SignupStep = typeof STEP_ORDER[number];

// Only steps with data nothing else can substitute for gate progress — e.g.
// department/age/bio/photo are all optional or have sane defaults, so they
// never block resuming further into the flow.
const REQUIRED_STEPS: { step: SignupStep; check: (d: SignupDraft) => boolean }[] = [
  { step: 'university', check: (d) => !!d.universityName },
  { step: 'name', check: (d) => d.name.trim().length >= 2 },
  { step: 'interests', check: (d) => d.interests.length >= 3 },
];

export function firstIncompleteStep(d: SignupDraft): SignupStep | null {
  for (const r of REQUIRED_STEPS) if (!r.check(d)) return r.step;
  return null;
}

export function isStepAllowed(step: SignupStep, d: SignupDraft): boolean {
  const incomplete = firstIncompleteStep(d);
  if (!incomplete) return true;
  return STEP_ORDER.indexOf(step) <= STEP_ORDER.indexOf(incomplete);
}

// 20 + step_index * (80 / 7) — starts pre-filled (endowed progress effect)
// and never printed as a number, just the bar width.
export const STEP_PROGRESS: Record<SignupStep, number> = STEP_ORDER.reduce((acc, step, i) => {
  acc[step] = 20 + i * (80 / 7);
  return acc;
}, {} as Record<SignupStep, number>);
