import { create } from 'zustand';
import { UserEntity } from '../../domain/entities/user.entity';
import { MOCK_USER } from '@/mock/data';

interface AuthState {
  user: UserEntity | null;
  isLoading: boolean;
  isEmailVerified: boolean;
  error: string | null;
  initializeAuth: () => () => void;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserEntity, 'bio' | 'avatarColor' | 'name' | 'photoUri'>>) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: MOCK_USER,
  isLoading: false,
  isEmailVerified: true,
  error: null,
  initializeAuth: () => {
    set({ user: MOCK_USER, isLoading: false, isEmailVerified: true });
    return () => {};
  },
  signOut: async () => {
    set({ user: MOCK_USER });
  },
  updateProfile: (patch) =>
    set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
  clearError: () => set({ error: null }),
}));
