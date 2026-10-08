import { create } from 'zustand';
import { collection, onSnapshot, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ConvoState {
  lastAt: Date;
  lastSenderId?: string;
  myLastReadAt: number;
}

interface DmUnreadState {
  unreadCount: number;
  subscribe: (uid: string) => () => void;
  clear: () => void;
}

// A conversation counts as unread if its last message wasn't sent by me,
// and arrived after my last-read timestamp on that conversation (a
// Firestore field — see conversations/{id}.lastReadAt — so it also backs
// the Instagram-style "Seen" indicator in the DM screen, not just this
// badge).
function countUnread(convos: Record<string, ConvoState>): number {
  let count = 0;
  for (const c of Object.values(convos)) {
    if (!c.lastSenderId) continue;
    if (c.lastAt.getTime() > c.myLastReadAt) count++;
  }
  return count;
}

export const useDmUnreadStore = create<DmUnreadState>((set) => ({
  unreadCount: 0,

  subscribe: (uid: string) => {
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', uid),
      orderBy('lastAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      const convos: Record<string, ConvoState> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        const lastSenderId = data.lastSenderId as string | undefined;
        if (!lastSenderId || lastSenderId === uid) return;
        const lastReadAt = data.lastReadAt as Record<string, Timestamp> | undefined;
        convos[d.id] = {
          lastAt: (data.lastAt as Timestamp)?.toDate() ?? new Date(),
          lastSenderId,
          myLastReadAt: lastReadAt?.[uid]?.toMillis() ?? 0,
        };
      });
      set({ unreadCount: countUnread(convos) });
    }, () => {});
  },

  clear: () => set({ unreadCount: 0 }),
}));
