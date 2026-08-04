import {
  addDoc, collection, doc, getDocs, onSnapshot, or, query, serverTimestamp, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Either, left, right } from '@/core/utils/either';
import { Failure, ServerFailure } from '@/core/errors/failures';
import { SwipeEntity, MutualMatchEntity } from '../../domain/entities/swipe.entity';
import { SwipesRepository } from '../../domain/repositories/swipes.repository';

class SwipesRepositoryImpl implements SwipesRepository {
  async getSwipeableAttendees(eventId: string, currentUid: string): Promise<Either<Failure, any[]>> {
    try {
      const eventSnap = await getDocs(query(collection(db, 'events', eventId, 'attendees')));
      const attendees = eventSnap.docs
        .map((d) => d.data().userId)
        .filter((uid) => uid !== currentUid);
      return right(attendees);
    } catch (e) {
      return left(new ServerFailure(String(e)));
    }
  }

  async recordSwipe(eventId: string, fromUid: string, toUid: string, direction: 'interested' | 'skip'): Promise<Either<Failure, SwipeEntity>> {
    try {
      const docRef = await addDoc(collection(db, 'events', eventId, 'swipes'), {
        fromUid,
        toUid,
        direction,
        createdAt: serverTimestamp(),
      });
      return right({
        id: docRef.id,
        eventId,
        fromUid,
        toUid,
        direction,
        createdAt: new Date(),
      });
    } catch (e) {
      return left(new ServerFailure(String(e)));
    }
  }

  async getSwipesForEvent(eventId: string, uid: string): Promise<Either<Failure, SwipeEntity[]>> {
    try {
      const q = query(
        collection(db, 'events', eventId, 'swipes'),
        where('fromUid', '==', uid),
      );
      const snap = await getDocs(q);
      return right(snap.docs.map((d) => ({
        id: d.id,
        eventId,
        fromUid: d.data().fromUid,
        toUid: d.data().toUid,
        direction: d.data().direction,
        createdAt: d.data().createdAt?.toDate() ?? new Date(),
      })));
    } catch (e) {
      return left(new ServerFailure(String(e)));
    }
  }

  async getMutualMatches(uid: string): Promise<Either<Failure, MutualMatchEntity[]>> {
    try {
      // user1Id/user2Id just record swipe order (whoever swiped first vs
      // second) — the current user can land in either slot, so both need
      // to be matched against.
      const q = query(
        collection(db, 'mutualMatches'),
        or(where('user1Id', '==', uid), where('user2Id', '==', uid)),
      );
      const snap = await getDocs(q);
      return right(snap.docs.map((d) => ({
        id: d.id,
        user1Id: d.data().user1Id,
        user2Id: d.data().user2Id,
        eventId: d.data().eventId,
        matchedAt: d.data().matchedAt?.toDate() ?? new Date(),
      })));
    } catch (e) {
      return left(new ServerFailure(String(e)));
    }
  }

  subscribeToMatches(uid: string, onUpdate: (matches: MutualMatchEntity[]) => void): () => void {
    const q = query(collection(db, 'mutualMatches'), or(where('user1Id', '==', uid), where('user2Id', '==', uid)));
    return onSnapshot(q, (snap) => {
      onUpdate(snap.docs.map((d) => ({
        id: d.id,
        user1Id: d.data().user1Id,
        user2Id: d.data().user2Id,
        eventId: d.data().eventId,
        matchedAt: d.data().matchedAt?.toDate() ?? new Date(),
      })));
    }, () => {});
  }
}

export const swipesRepository = new SwipesRepositoryImpl();
