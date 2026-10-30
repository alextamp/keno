import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const organiserRepository = {
  /** uids who actually checked in to an event (not just joined). */
  async checkInUids(eventId: string): Promise<string[]> {
    const snap = await getDocs(collection(db, 'events', eventId, 'checkIns'));
    return snap.docs.map((d) => d.id);
  },
};
