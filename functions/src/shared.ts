import * as admin from 'firebase-admin';
import { HttpsError } from 'firebase-functions/v2/https';

// Initialized here, not in index.ts, so every module that imports `db` gets
// an initialized app regardless of import order (index.ts re-exports kfg.ts).
admin.initializeApp();
export const db = admin.firestore();

// Simple per-user, per-action rate limiter for the callable functions
// — none of them had any cooldown before, so a scripted client could hammer
// sendVerificationEmail (costs real money per call) or spam claimReferral/
// claimStandInHost with no cost to the caller. Stored under
// users/{uid}/private/rateLimits, written via the Admin SDK like everything
// else in this file (bypasses firestore.rules, no client access needed).
// Resets the window once windowMs has elapsed since it started; otherwise
// increments and rejects once maxCalls is hit within the window.
export async function checkRateLimit(uid: string, action: string, maxCalls: number, windowMs: number): Promise<void> {
  const ref = db.collection('users').doc(uid).collection('private').doc('rateLimits');
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() ?? {}) : {};
    const entry = data[action] as { count: number; windowStart: number } | undefined;
    const now = Date.now();
    if (!entry || now - entry.windowStart > windowMs) {
      tx.set(ref, { [action]: { count: 1, windowStart: now } }, { merge: true });
      return;
    }
    if (entry.count >= maxCalls) {
      throw new HttpsError('resource-exhausted', 'Too many requests — please try again in a bit.');
    }
    tx.set(ref, { [action]: { count: entry.count + 1, windowStart: entry.windowStart } }, { merge: true });
  });
}
