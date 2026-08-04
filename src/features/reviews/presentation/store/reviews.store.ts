import { create } from 'zustand';
import { ReviewEntity } from '../../domain/entities/review.entity';
import { reviewsRepository } from '../../data/repositories/reviews.repository.impl';
import { isLeft } from '@/core/utils/either';

interface ReviewsState {
  reviews: ReviewEntity[];
  isLoading: boolean;
  error: string | null;
  loadUserReviews: (uid: string) => Promise<void>;
  submitReview: (fromUid: string, toUid: string, eventId: string, type: 'recommend') => Promise<boolean>;
  clearError: () => void;
}

export const useReviewsStore = create<ReviewsState>((set, get) => ({
  reviews: [],
  isLoading: false,
  error: null,

  loadUserReviews: async (uid: string) => {
    set({ isLoading: true, error: null });
    const result = await reviewsRepository.getUserReviews(uid);
    if (isLeft(result)) {
      set({ isLoading: false, error: result.left.message });
    } else {
      set({ reviews: result.right, isLoading: false });
    }
  },

  submitReview: async (fromUid: string, toUid: string, eventId: string, type: 'recommend') => {
    const result = await reviewsRepository.submitReview(fromUid, toUid, eventId, type);
    if (isLeft(result)) {
      set({ error: result.left.message });
      return false;
    }
    set((s) => ({ reviews: [...s.reviews, result.right], error: null }));
    return true;
  },

  clearError: () => set({ error: null }),
}));
