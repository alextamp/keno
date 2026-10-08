import {
  collection, endAt, getDocs, limit, orderBy, query, startAt, where,
  type QueryDocumentSnapshot, type DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UNIVERSITIES } from '@/core/constants/universities';

// High-codepoint sentinel used to turn startAt/endAt into a prefix-range
// query: it sorts after virtually any real character, so endAt(lower +
// PREFIX_END) captures every string starting with `lower`. Plain
// endAt(lower) is just an exact-match range (start and end identical),
// which is the bug this replaced — it silently matched nothing for any
// partial name and fell through to whatever the caller did next.
const PREFIX_END = '';

// Firestore prefix-range query on nameLower, plus a separate university
// match (see below) merged in. Scales with the result count, not with
// total users, unlike the pattern this replaces (fetch up to 200 users,
// substring-filter client-side): two of the three previous callers never
// attempted an indexed query at all, so anyone past the alphabetically-first
// 200 users was permanently unfindable via search or invite.
//
// No fallback to an unindexed fetch: nameLower is written on every profile
// at signup (see ensureUserProfileExists in auth.store.ts), so there's
// nothing left for a fallback to catch.
export async function queryUsersByNamePrefix(text: string, resultLimit = 20): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const lower = text.trim().toLowerCase();
  if (lower.length < 2) return [];

  const nameQuery = query(
    collection(db, 'users'),
    orderBy('nameLower'),
    startAt(lower),
    endAt(lower + PREFIX_END),
    limit(resultLimit),
  );

  // universityName is stored as the stable Greek abbreviation (e.g. 'ΟΠΑ')
  // regardless of display language — not free text — so "search by
  // university" means resolving whatever was typed (Greek abbreviation or
  // English label, e.g. "AUEB") to that stored id first, then an equality
  // match, not a text search.
  const matchingUniIds = UNIVERSITIES
    .filter((u) => u.el.toLowerCase().startsWith(lower) || u.en.toLowerCase().startsWith(lower))
    .map((u) => u.el)
    .slice(0, 10); // Firestore 'in' caps at 10 values

  const uniQuery = matchingUniIds.length > 0
    ? query(collection(db, 'users'), where('universityName', 'in', matchingUniIds), limit(resultLimit))
    : null;

  const [nameSnap, uniSnap] = await Promise.all([
    getDocs(nameQuery),
    uniQuery ? getDocs(uniQuery) : Promise.resolve(null),
  ]);

  if (!uniSnap) return nameSnap.docs;

  const merged = [...nameSnap.docs];
  const seen = new Set(merged.map((d) => d.id));
  for (const d of uniSnap.docs) {
    if (!seen.has(d.id)) { merged.push(d); seen.add(d.id); }
  }
  return merged.slice(0, resultLimit);
}
