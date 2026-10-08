import { create } from 'zustand';
import { NotificationEntity } from './notification.entity';
import { notificationsRepository } from './notifications.repository';
import { sounds } from '@/core/utils/sounds';

interface NotificationsState {
  notifications: NotificationEntity[];
  unreadCount: number;
  subscribe: (uid: string) => () => void;
  markAllRead: (uid: string) => Promise<void>;
  deleteNotification: (uid: string, id: string) => Promise<void>;
  deleteNotifications: (uid: string, ids: string[]) => Promise<void>;
  clear: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  subscribe: (uid: string) => {
    let isFirstSnapshot = true;
    let previousIds = new Set<string>();
    return notificationsRepository.subscribe(uid, (raw) => {
      // DMs get their own push + unread badge (dmUnread.store.ts), not a
      // slot in the general activity list — same split Instagram makes
      // between its activity feed and DMs. The notification doc still gets
      // written (that's what triggers the push) and the Cloud Function
      // deletes it right after sending; this filter is just so it's never
      // even briefly visible here in the gap before that delete lands.
      const notifs = raw.filter((n) => n.type !== 'dm_message');
      // Only chime for notifications that arrive after the initial load —
      // otherwise every app open with unread notifications would play the
      // sound for old, already-existing ones.
      if (!isFirstSnapshot && notifs.some((n) => !previousIds.has(n.id))) {
        sounds.play('notification');
      }
      isFirstSnapshot = false;
      previousIds = new Set(notifs.map((n) => n.id));
      set({ notifications: notifs, unreadCount: notifs.filter((n) => !n.read).length });
    });
  },

  markAllRead: async (uid: string) => {
    const unreadIds = get().notifications.filter((n) => !n.read).map((n) => n.id);
    await notificationsRepository.markAllRead(uid, unreadIds);
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  // Optimistic removal — the live onSnapshot subscription will reconcile
  // the same removal a moment later regardless, but swiping/deleting should
  // feel instant rather than waiting on a round-trip.
  deleteNotification: async (uid: string, id: string) => {
    set((s) => {
      const notifications = s.notifications.filter((n) => n.id !== id);
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
    });
    await notificationsRepository.delete(uid, id);
  },

  deleteNotifications: async (uid: string, ids: string[]) => {
    const idSet = new Set(ids);
    set((s) => {
      const notifications = s.notifications.filter((n) => !idSet.has(n.id));
      return { notifications, unreadCount: notifications.filter((n) => !n.read).length };
    });
    await notificationsRepository.deleteMany(uid, ids);
  },

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));
