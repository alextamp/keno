import { collection, endAt, getDocs, limit, orderBy, query, startAt, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Firestore prefix-range query on nameLower — matches any name starting
// with the typed text. Scales with the result count, not with total users,
// unlike the pattern this replaces (fetch up to 200 users, substring-filter
// client-side): two of the three previous callers never attempted an
// indexed query at all, so anyone past the alphabetically-first 200 users
// was permanently unfindable via search or invite. The third had the right
// idea but a bug — endAt(lower + '') is just endAt(lower), an exact-match
// range rather than a prefix range, so it silently matched nothing for any
// partial name and always fell through to the same 200-user cap.
//
// No fallback to an unindexed fetch: nameLower is written on every profile
// at signup (see ensureUserProfileExists in auth.store.ts), so there's
// nothing left for a fallback to catch.
export async function queryUsersByNamePrefix(text: string, resultLimit = 20): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const lower = text.trim().toLowerCase();
  if (lower.length < 2) return [];
  const q = query(
    collection(db, 'users'),
    orderBy('nameLower'),
    startAt(lower),
    endAt(lower + ''),
    limit(resultLimit),
  );
  const snap = await getDocs(q);
  return snap.docs;
}
