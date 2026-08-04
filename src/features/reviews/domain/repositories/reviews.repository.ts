import { Either } from '@/core/utils/either';
import { Failure } from '@/core/errors/failures';
import { ReviewEntity, ReviewType } from '../entities/review.entity';

export interface ReviewsRepository {
  submitReview(fromUid: string, toUid: string, eventId: string, type: ReviewType): Promise<Either<Failure, ReviewEntity>>;
  getUserReviews(uid: string): Promise<Either<Failure, ReviewEntity[]>>;
  getEventReviews(eventId: string): Promise<Either<Failure, ReviewEntity[]>>;
  hasUserReviewedInEvent(fromUid: string, toUid: string, eventId: string): Promise<Either<Failure, boolean>>;
}
