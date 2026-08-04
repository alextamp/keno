import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface UserProfile {
  uid: string;
  name: string;
  avatarColor: string;
  university: string;
  department?: string;
  photoUri?: string;
  reliabilityScore?: number;
  universityEmail?: string;
  reviewSummary?: { count: number };
  /** Used client-side to compute a mutual-connections count against the
   *  viewer's own `following` list (see event/[id].tsx's attendee grid) —
   *  intentionally not `followers`, since that'd double the array size
   *  fetched per attendee for a count nobody currently uses. */
  following?: string[];
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
        department: d.department,
        photoUri: d.photoUri,
        reliabilityScore: d.reliabilityScore,
        universityEmail: d.universityEmail,
        reviewSummary: d.reviewSummary,
        following: d.following,
      };
    }
  });
  return profiles;
}
