import {
  addDoc, arrayUnion, collection, deleteDoc, doc, onSnapshot,
  query, serverTimestamp, Timestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { haversineKm } from '@/core/utils/geo';
import { BEACON_RADIUS_KM, BeaconEntity } from './beacon.entity';

function beaconsCol() {
  return collection(db, 'beacons');
}

function fromDoc(d: any): BeaconEntity {
  const data = d.data();
  return {
    id: d.id,
    userId: data.userId,
    note: data.note ?? undefined,
    durationMinutes: data.durationMinutes,
    createdAt: (data.createdAt as Timestamp)?.toDate() ?? new Date(),
    expiresAt: (data.expiresAt as Timestamp)?.toDate() ?? new Date(),
    latitude: data.latitude,
    longitude: data.longitude,
    seenByUids: data.seenByUids ?? [],
  };
}

export const beaconsRepository = {
  async create(params: {
    userId: string; latitude: number; longitude: number;
    durationMinutes: BeaconEntity['durationMinutes']; note?: string;
  }): Promise<void> {
    const expiresAt = new Date(Date.now() + params.durationMinutes * 60 * 1000);
    await addDoc(beaconsCol(), {
      userId: params.userId,
      latitude: params.latitude,
      longitude: params.longitude,
      durationMinutes: params.durationMinutes,
      note: params.note || null,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      seenByUids: [],
    });
  },

  async cancel(beaconId: string): Promise<void> {
    await deleteDoc(doc(db, 'beacons', beaconId));
  },

  async markSeen(beaconId: string, viewerUid: string): Promise<void> {
    await updateDoc(doc(db, 'beacons', beaconId), { seenByUids: arrayUnion(viewerUid) }).catch(() => {});
  },

  // Client-side distance filter, same pattern as Feed/Map's event radius
  // filtering (geo.ts) — Firestore has no native geo-radius query, so the
  // `expiresAt` where-clause does the cheap server-side narrowing and
  // haversineKm does the rest locally.
  subscribeNearby(lat: number, lon: number, onChange: (beacons: BeaconEntity[]) => void): () => void {
    const q = query(beaconsCol(), where('expiresAt', '>', Timestamp.fromDate(new Date())));
    return onSnapshot(q, (snap) => {
      const nearby = snap.docs
        .map(fromDoc)
        .filter((b) => haversineKm(lat, lon, b.latitude, b.longitude) <= BEACON_RADIUS_KM);
      onChange(nearby);
    }, () => onChange([]));
  },

  // Used by the DM screen to show "X has a beacon active" context, and by
  // FeedTab to show the viewer's own active beacon (if any) for management.
  subscribeForUser(userId: string, onChange: (beacon: BeaconEntity | null) => void): () => void {
    const q = query(
      beaconsCol(),
      where('userId', '==', userId),
      where('expiresAt', '>', Timestamp.fromDate(new Date())),
    );
    return onSnapshot(q, (snap) => {
      if (snap.empty) { onChange(null); return; }
      // Only one active beacon per user is ever created (the create-sheet
      // doesn't block a second one, but there's no UI path to open it while
      // one is already active) — take the most recently created if more
      // than one somehow exists.
      const beacons = snap.docs.map(fromDoc).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      onChange(beacons[0]);
    }, () => onChange(null));
  },
};
