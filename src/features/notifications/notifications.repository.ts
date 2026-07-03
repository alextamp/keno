import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NotificationEntity, NotifType } from './notification.entity';

export interface CreateNotifParams {
  toUid: string;
  fromUid: string;
  fromName: string;
  fromAvatarColor?: string;
  type: NotifType;
  eventId?: string;
  eventTitle?: string;
}

function notifCol(uid: string) {
  return collection(db, 'users', uid, 'notifications');
}

export const notificationsRepository = {
  async create(params: CreateNotifParams): Promise<void> {
    await addDoc(notifCol(params.toUid), {
      fromUid: params.fromUid,
      fromName: params.fromName,
      fromAvatarColor: params.fromAvatarColor ?? null,
      type: params.type,
      eventId: params.eventId ?? null,
      eventTitle: params.eventTitle ?? null,
      read: false,
      createdAt: Timestamp.now(),
    });
  },

  subscribe(uid: string, onUpdate: (notifs: NotificationEntity[]) => void): () => void {
    const q = query(notifCol(uid), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      onUpdate(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            fromUid: data.fromUid,
            fromName: data.fromName,
            fromAvatarColor: data.fromAvatarColor ?? undefined,
            type: data.type as NotifType,
            eventId: data.eventId ?? undefined,
            eventTitle: data.eventTitle ?? undefined,
            read: data.read,
            createdAt: (data.createdAt as Timestamp).toDate(),
          };
        }),
      );
    }, () => {});
  },

  async markAllRead(uid: string, notifIds: string[]): Promise<void> {
    if (notifIds.length === 0) return;
    const batch = writeBatch(db);
    notifIds.forEach((id) => {
      batch.update(doc(db, 'users', uid, 'notifications', id), { read: true });
    });
    await batch.commit();
  },
};
