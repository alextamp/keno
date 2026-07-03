import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface UserProfile {
  uid: string;
  name: string;
  avatarColor: string;
  university: string;
  photoUri?: string;
}

export async function fetchUserProfiles(uids: string[]): Promise<Record<string, UserProfile>> {
  if (uids.length === 0) return {};
  const snaps = await Promise.all(uids.map((uid) => getDoc(doc(db, 'users', uid))));
  const profiles: Record<string, UserProfile> = {};
  snaps.forEach((snap) => {
    if (snap.exists()) {
      const d = snap.data();
      profiles[snap.id] = {
        uid: snap.id,
        name: d.name ?? 'User',
        avatarColor: d.avatarColor ?? '#999',
        university: d.universityName ?? '',
        photoUri: d.photoUri,
      };
    }
  });
  return profiles;
}
