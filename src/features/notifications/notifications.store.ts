import { create } from 'zustand';
import { NotificationEntity } from './notification.entity';
import { notificationsRepository } from './notifications.repository';
import { sounds } from '@/core/utils/sounds';

interface NotificationsState {
  notifications: NotificationEntity[];
  unreadCount: number;
  subscribe: (uid: string) => () => void;
  markAllRead: (uid: string) => Promise<void>;
  clear: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  notifications: [],
  unreadCount: 0,

  subscribe: (uid: string) => {
    let isFirstSnapshot = true;
    let previousIds = new Set<string>();
    return notificationsRepository.subscribe(uid, (notifs) => {
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

  clear: () => set({ notifications: [], unreadCount: 0 }),
}));
