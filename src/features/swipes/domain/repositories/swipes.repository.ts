import { Either } from '@/core/utils/either';
import { Failure } from '@/core/errors/failures';
import { SwipeEntity, MutualMatchEntity } from '../entities/swipe.entity';

export interface SwipesRepository {
  getSwipeableAttendees(eventId: string, currentUid: string): Promise<Either<Failure, any[]>>;
  recordSwipe(eventId: string, fromUid: string, toUid: string, direction: 'interested' | 'skip'): Promise<Either<Failure, SwipeEntity>>;
  getSwipesForEvent(eventId: string, uid: string): Promise<Either<Failure, SwipeEntity[]>>;
  getMutualMatches(uid: string): Promise<Either<Failure, MutualMatchEntity[]>>;
  subscribeToMatches(uid: string, onUpdate: (matches: MutualMatchEntity[]) => void): () => void;
}
