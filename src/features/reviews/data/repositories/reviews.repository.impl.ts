import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  getDoc,
  doc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Failure, ServerFailure } from '@/core/errors/failures';
import { Either, left, right, isRight } from '@/core/utils/either';
import { ReviewEntity, ReviewType } from '../../domain/entities/review.entity';
import { ReviewsRepository } from '../../domain/repositories/reviews.repository';

const USERS = 'users';
const REVIEWS = 'reviews';

export const reviewsRepository: ReviewsRepository = {
  async submitReview(fromUid: string, toUid: string, eventId: string, type: ReviewType): Promise<Either<Failure, ReviewEntity>> {
    try {
      // Check if already reviewed
      const hasReviewedResult = await this.hasUserReviewedInEvent(fromUid, toUid, eventId);
      if (!isRight(hasReviewedResult) || hasReviewedResult.right) {
        return left(new ServerFailure('You already reviewed this person for this event.'));
      }

      const reviewRef = await addDoc(collection(db, USERS, toUid, REVIEWS), {
        fromUid,
        toUid,
        eventId,
        type,
        createdAt: Timestamp.now(),
      });

      const snap = await getDoc(reviewRef);
      if (!snap.exists()) return left(new ServerFailure('Failed to create review.'));

      const data = snap.data();
      return right({
        id: snap.id,
        fromUid: data.fromUid,
        toUid: data.toUid,
        eventId: data.eventId,
        type: data.type,
        createdAt: data.createdAt?.toDate?.() ?? new Date(),
      });
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to submit review.'));
    }
  },

  async getUserReviews(uid: string): Promise<Either<Failure, ReviewEntity[]>> {
    try {
      const snap = await getDocs(collection(db, USERS, uid, REVIEWS));
      const reviews = snap.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          fromUid: data.fromUid,
          toUid: data.toUid,
          eventId: data.eventId,
          type: data.type,
          createdAt: data.createdAt?.toDate?.() ?? new Date(),
        } as ReviewEntity;
      });
      return right(reviews);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to load reviews.'));
    }
  },

  async getEventReviews(eventId: string): Promise<Either<Failure, ReviewEntity[]>> {
    try {
      // This requires a separate collection or querying across user subcollections
      // For now, return empty (can be expanded with cross-subcollection query)
      return right([]);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to load event reviews.'));
    }
  },

  async hasUserReviewedInEvent(fromUid: string, toUid: string, eventId: string): Promise<Either<Failure, boolean>> {
    try {
      const snap = await getDocs(
        query(
          collection(db, USERS, toUid, REVIEWS),
          where('fromUid', '==', fromUid),
          where('eventId', '==', eventId),
        ),
      );
      return right(snap.docs.length > 0);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to check review status.'));
    }
  },
};
