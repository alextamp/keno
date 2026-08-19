import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Every admin action (resolving a report, deleting someone's event,
// approving/rejecting ID verification) previously happened with zero
// record of who did it or when — fine solo, but leaves no trail to
// reconstruct what happened if the admin account is ever compromised, or
// once there's more than one moderator. Append-only (firestore.rules denies
// update/delete on this collection) — a record, not something meant to be
// edited after the fact.
export async function logAdminAction(
  adminUid: string,
  action: string,
  detail: Record<string, string | undefined> = {},
): Promise<void> {
  try {
    await addDoc(collection(db, 'adminAuditLog'), {
      adminUid,
      action,
      ...detail,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Never let audit logging itself block or fail the actual admin action.
  }
}
