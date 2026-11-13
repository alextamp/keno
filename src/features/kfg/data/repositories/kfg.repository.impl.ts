import {
  collection, doc, documentId, getCountFromServer, getDoc, getDocs, limit, onSnapshot, orderBy, query, setDoc, Timestamp, updateDoc, where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, functions, storage } from '@/lib/firebase';
import { Failure, ServerFailure } from '@/core/errors/failures';
import { Either, left, right } from '@/core/utils/either';
import { getKfgMonthId } from '@/core/constants/kfg';
import { KfgRepository, KfgScanResult } from '../../domain/repositories/kfg.repository';
import {
  leaderboardFromFirestore, missionFromFirestore, participationFromFirestore, profileFromFirestore,
} from '../models/kfg.model';

const MISSIONS = 'kfgMissions';
const PARTICIPATIONS = 'kfgParticipations';
const PROFILES = 'kfgProfiles';

// Callable errors carry the server's short reason code as their message
// ("full", "too-many-open", "not-enough-points"…); screens map those to
// translated text (kfgErrorText), so pass them through untouched.
async function attempt<T>(fn: () => Promise<T>): Promise<Either<Failure, T>> {
  try {
    return right(await fn());
  } catch (e: any) {
    return left(new ServerFailure(e?.message ?? 'unknown'));
  }
}

function call<T>(name: string, data: unknown): Promise<T> {
  return httpsCallable(functions, name)(data).then((r) => r.data as T);
}

export const kfgRepository: KfgRepository = {
  subscribePublishedMissions(onChange) {
    // Upcoming and still-running missions; the 12h lookback covers the longest allowed mission.
    const since = Timestamp.fromMillis(Date.now() - 12 * 3_600_000);
    const q = query(collection(db, MISSIONS), where('status', '==', 'published'), where('startsAt', '>=', since), orderBy('startsAt', 'asc'));
    return onSnapshot(q, (snap) => onChange(snap.docs.map(missionFromFirestore)), () => onChange([]));
  },

  subscribeMyMissions(uid, onChange) {
    const q = query(collection(db, MISSIONS), where('creatorId', '==', uid), orderBy('startsAt', 'desc'), limit(20));
    return onSnapshot(q, (snap) => onChange(snap.docs.map(missionFromFirestore)), () => onChange([]));
  },

  subscribeMission(id, onChange) {
    return onSnapshot(doc(db, MISSIONS, id), (snap) => onChange(snap.exists() ? missionFromFirestore(snap) : null), () => onChange(null));
  },

  subscribeMyParticipations(uid, onChange) {
    const q = query(collection(db, PARTICIPATIONS), where('uid', '==', uid));
    return onSnapshot(q, (snap) => onChange(snap.docs.map(participationFromFirestore)), () => onChange([]));
  },

  subscribeMissionParticipations(missionId, creatorId, onChange) {
    const q = query(collection(db, PARTICIPATIONS), where('missionId', '==', missionId), where('missionCreatorId', '==', creatorId));
    return onSnapshot(q, (snap) => onChange(snap.docs.map(participationFromFirestore)), () => onChange([]));
  },

  subscribeProfile(uid, onChange) {
    return onSnapshot(doc(db, PROFILES, uid), (snap) => onChange(profileFromFirestore(uid, snap.data())),
      () => onChange(profileFromFirestore(uid, undefined)));
  },

  subscribeOwnedCosmetics(uid, onChange) {
    return onSnapshot(collection(db, PROFILES, uid, 'cosmetics'), (snap) => onChange(snap.docs.map((d) => d.id)), () => onChange([]));
  },

  getQrSecret(participationId) {
    return attempt(async () => {
      const snap = await getDoc(doc(db, PARTICIPATIONS, participationId, 'private', 'qr'));
      if (!snap.exists()) throw new Error('no-secret');
      return snap.data().secret as string;
    });
  },

  getLeaderboard(monthId) {
    return attempt(async () => {
      const snap = await getDoc(doc(db, 'kfgLeaderboards', monthId));
      return snap.exists() ? leaderboardFromFirestore(snap.data()) : null;
    });
  },

  getProfiles(uids) {
    return attempt(async () => {
      const out = [];
      for (let i = 0; i < uids.length; i += 30) {
        const snap = await getDocs(query(collection(db, PROFILES), where(documentId(), 'in', uids.slice(i, i + 30))));
        out.push(...snap.docs.map((d) => profileFromFirestore(d.id, d.data())));
      }
      return out;
    });
  },

  getMyRank(monthPoints) {
    return attempt(async () => {
      if (monthPoints <= 0) return null;
      const ahead = await getCountFromServer(query(collection(db, PROFILES),
        where('monthId', '==', getKfgMonthId(new Date())), where('monthPoints', '>', monthPoints)));
      return ahead.data().count + 1;
    });
  },

  getPendingMissions() {
    return attempt(async () => {
      const snap = await getDocs(query(collection(db, MISSIONS), where('status', '==', 'pending'), orderBy('startsAt', 'asc')));
      return snap.docs.map(missionFromFirestore);
    });
  },

  getPhotoReviewQueue() {
    return attempt(async () => {
      const snap = await getDocs(query(collection(db, PARTICIPATIONS), where('reviewState', '==', 'queued')));
      const url = (path?: string) => (path ? getDownloadURL(ref(storage, path)).catch(() => undefined) : Promise.resolve(undefined));
      return Promise.all(snap.docs.map(async (d) => {
        const participation = participationFromFirestore(d);
        const [before, after] = await Promise.all([url(participation.photos.before), url(participation.photos.after)]);
        return { participation, before, after };
      }));
    });
  },

  createMission(p) {
    return attempt(() => call('kfgCreateMission', {
      title: p.title, description: p.description, infoText: p.infoText ?? null, kind: p.kind, cause: p.cause,
      startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString(), minDurationMin: p.minDurationMin ?? 0,
      areaLabel: p.areaLabel, address: p.address ?? null, lat: p.latitude ?? null, lng: p.longitude ?? null,
      capacity: p.capacity, points: p.points,
    }));
  },

  reviewMission(missionId, approve, reason) {
    return attempt(() => call<void>('kfgReviewMission', { missionId, approve, reason }));
  },

  cancelMission(missionId) {
    return attempt(() => call<void>('kfgCancelMission', { missionId }));
  },

  join(missionId) {
    return attempt(async () => (await call<{ participationId: string }>('kfgJoin', { missionId })).participationId);
  },

  leave(missionId) {
    return attempt(() => call<void>('kfgLeave', { missionId }));
  },

  scan(code) {
    return attempt(() => call<KfgScanResult>('kfgScan', { code }));
  },

  checkOutAll(missionId) {
    return attempt(() => call<{ completed: number; tooEarly: number }>('kfgCheckOutAll', { missionId }));
  },

  confirmPeers(missionId, uids) {
    return attempt(async () => (await call<{ confirmed: number }>('kfgConfirmPeers', { missionId, uids })).confirmed);
  },

  uploadPhoto({ uid, participationId, side, localUri, takenAt, latitude, longitude }) {
    return attempt(async () => {
      const blob = await (await fetch(localUri)).blob();
      // Raw upload; kfgProcessPhoto re-encodes it without EXIF and deletes this file.
      await uploadBytes(ref(storage, `kfg-photos-raw/${uid}/${participationId}_${side}.jpg`), blob, {
        contentType: 'image/jpeg',
        customMetadata: { takenAt: String(takenAt.getTime()), lat: String(latitude), lng: String(longitude) },
      });
    });
  },

  reviewPhoto(participationId, approve) {
    return attempt(() => call<void>('kfgReviewPhoto', { participationId, approve }));
  },

  purchase(itemId) {
    return attempt(() => call<void>('kfgPurchase', { itemId }));
  },

  equip(uid, equipped) {
    return attempt(() => updateDoc(doc(db, PROFILES, uid), { equipped }));
  },

  // merge: someone with no points yet has no profile; the rules let them
  // create one holding only `character` and empty `equipped`.
  setCharacter(uid, character) {
    return attempt(async () => {
      const ref = doc(db, PROFILES, uid);
      const exists = (await getDoc(ref)).exists();
      await (exists
        ? updateDoc(ref, { character })
        : setDoc(ref, { character, equipped: { head: null, face: null, neck: null } }));
    });
  },
};
