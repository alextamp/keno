import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp,
  setDoc, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Failure, ServerFailure } from '@/core/errors/failures';
import { Either, left, right } from '@/core/utils/either';

// events/{eventId}/rides/{rideId}             — public: area, time, seats, confirmedIds
//   /bookings/{uid}                           — rider + driver only
//   /private/meeting                          — driver + confirmed riders only
// See the rides block in firestore.rules.

export type BookingStatus = 'pending' | 'confirmed' | 'declined';

export interface Ride {
  id: string;
  driverId: string;
  driverName: string;
  driverAvatarColor: string;
  driverPhotoUri?: string;
  driverCheckInCount: number;
  departureArea: string;
  departureTime: Date;
  seats: number;
  costPerPerson?: number;
  confirmedIds: string[];
}

export interface Booking {
  uid: string;
  name: string;
  avatarColor: string;
  photoUri?: string;
  status: BookingStatus;
}

export interface OfferRideParams {
  driver: { id: string; name: string; avatarColor?: string; photoUri?: string; checkInCount?: number };
  departureArea: string;
  departureTime: Date;
  seats: number;
  costPerPerson?: number;
  meetingPoint: string;
}

const ridesCol = (eventId: string) => collection(db, 'events', eventId, 'rides');
const rideDoc = (eventId: string, rideId: string) => doc(db, 'events', eventId, 'rides', rideId);
const bookingDoc = (eventId: string, rideId: string, uid: string) =>
  doc(db, 'events', eventId, 'rides', rideId, 'bookings', uid);
const meetingDoc = (eventId: string, rideId: string) =>
  doc(db, 'events', eventId, 'rides', rideId, 'private', 'meeting');

async function attempt<T>(fn: () => Promise<T>, fallback: string): Promise<Either<Failure, T>> {
  try {
    return right(await fn());
  } catch (e: any) {
    return left(new ServerFailure(e.message ?? fallback));
  }
}

export const ridesRepository = {
  subscribeRides(eventId: string, onUpdate: (rides: Ride[]) => void): () => void {
    return onSnapshot(ridesCol(eventId), (snap) => {
      onUpdate(snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          driverId: data.driverId,
          driverName: data.driverName ?? '',
          driverAvatarColor: data.driverAvatarColor ?? '#C94D0A',
          driverPhotoUri: data.driverPhotoUri ?? undefined,
          driverCheckInCount: data.driverCheckInCount ?? 0,
          departureArea: data.departureArea ?? '',
          departureTime: (data.departureTime as Timestamp).toDate(),
          seats: data.seats ?? 1,
          costPerPerson: data.costPerPerson ?? undefined,
          confirmedIds: data.confirmedIds ?? [],
        };
      }).sort((a, b) => a.departureTime.getTime() - b.departureTime.getTime()));
    }, () => onUpdate([]));
  },

  /** Bookings on the driver's own ride (rules hide them from everyone else). */
  subscribeBookings(eventId: string, rideId: string, onUpdate: (bookings: Booking[]) => void): () => void {
    return onSnapshot(collection(db, 'events', eventId, 'rides', rideId, 'bookings'), (snap) => {
      onUpdate(snap.docs.map((d) => ({ uid: d.id, ...(d.data() as Omit<Booking, 'uid'>) })));
    }, () => onUpdate([]));
  },

  /** The caller's own booking on a ride, or null. */
  subscribeMyBooking(eventId: string, rideId: string, uid: string, onUpdate: (b: Booking | null) => void): () => void {
    return onSnapshot(bookingDoc(eventId, rideId, uid), (snap) => {
      onUpdate(snap.exists() ? { uid, ...(snap.data() as Omit<Booking, 'uid'>) } : null);
    }, () => onUpdate(null));
  },

  /** Exact meeting point — readable only once the caller is the driver or confirmed. */
  async getMeetingPoint(eventId: string, rideId: string): Promise<string | null> {
    try {
      const snap = await getDoc(meetingDoc(eventId, rideId));
      return snap.exists() ? (snap.data().point as string) : null;
    } catch {
      return null;
    }
  },

  offerRide(eventId: string, p: OfferRideParams): Promise<Either<Failure, string>> {
    return attempt(async () => {
      const ref = await addDoc(ridesCol(eventId), {
        driverId: p.driver.id,
        driverName: p.driver.name,
        driverAvatarColor: p.driver.avatarColor ?? '#C94D0A',
        driverPhotoUri: p.driver.photoUri ?? null,
        driverCheckInCount: p.driver.checkInCount ?? 0,
        departureArea: p.departureArea,
        departureTime: Timestamp.fromDate(p.departureTime),
        seats: p.seats,
        ...(p.costPerPerson != null ? { costPerPerson: p.costPerPerson } : {}),
        confirmedIds: [],
        createdAt: serverTimestamp(),
      });
      await setDoc(meetingDoc(eventId, ref.id), { point: p.meetingPoint });
      return ref.id;
    }, 'Failed to offer ride.');
  },

  /** Removes the ride; bookings are left orphaned but unreachable (no ride doc to list them under). */
  cancelRide(eventId: string, rideId: string): Promise<Either<Failure, void>> {
    return attempt(() => deleteDoc(rideDoc(eventId, rideId)), 'Failed to cancel ride.');
  },

  requestSeat(eventId: string, rideId: string, rider: { id: string; name: string; avatarColor?: string; photoUri?: string }): Promise<Either<Failure, void>> {
    return attempt(() => setDoc(bookingDoc(eventId, rideId, rider.id), {
      uid: rider.id, // collection-group lookup on account deletion (functions onUserDeleted)
      name: rider.name,
      avatarColor: rider.avatarColor ?? '#C94D0A',
      photoUri: rider.photoUri ?? null,
      status: 'pending',
      createdAt: serverTimestamp(),
    }), 'Failed to request a seat.');
  },

  /** Rider cancels: the booking is removed (so they can ask again later) and a confirmed seat is given back. */
  cancelSeat(eventId: string, rideId: string, uid: string, wasConfirmed: boolean): Promise<Either<Failure, void>> {
    return attempt(async () => {
      const batch = writeBatch(db);
      if (wasConfirmed) batch.update(rideDoc(eventId, rideId), { confirmedIds: arrayRemove(uid) });
      batch.delete(bookingDoc(eventId, rideId, uid));
      await batch.commit();
    }, 'Failed to cancel seat.');
  },

  /** Driver confirms — the rules reject it if the ride is already full. */
  confirmSeat(eventId: string, rideId: string, uid: string): Promise<Either<Failure, void>> {
    return attempt(async () => {
      const batch = writeBatch(db);
      batch.update(rideDoc(eventId, rideId), { confirmedIds: arrayUnion(uid) });
      batch.update(bookingDoc(eventId, rideId, uid), { status: 'confirmed' });
      await batch.commit();
    }, 'Failed to confirm seat.');
  },

  declineSeat(eventId: string, rideId: string, uid: string, wasConfirmed: boolean): Promise<Either<Failure, void>> {
    return attempt(async () => {
      const batch = writeBatch(db);
      if (wasConfirmed) batch.update(rideDoc(eventId, rideId), { confirmedIds: arrayRemove(uid) });
      batch.update(bookingDoc(eventId, rideId, uid), { status: 'declined' });
      await batch.commit();
    }, 'Failed to decline seat.');
  },
};
