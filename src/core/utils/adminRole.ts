import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';

// Replaces a single hardcoded ADMIN_UID (string-compared everywhere, no way
// to add a second moderator or revoke access without a redeploy) with the
// `admins` Firestore collection — doc id = uid, seeded via Console/script
// only (firestore.rules blocks all client writes to it). The signed-in
// user's own status is resolved once at load time and cached on their
// UserEntity (see auth.store.ts's loadUserFromFirestore); use this hook for
// that common case.
export function useIsAdmin(): boolean {
  return useAuthStore((s) => s.user?.isAdmin ?? false);
}

// For checking a uid other than the signed-in user — not needed by any
// current call site, kept for parity since firestore.rules' isAdmin()
// check works the same way for any uid.
export async function isAdminUid(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'admins', uid));
  return snap.exists();
}
