import {
  addDoc,
  collection,
  deleteDoc,
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
  fromPhotoUri?: string;
  type: NotifType;
  eventId?: string;
  eventTitle?: string;
  /** Only used by 'dm_message' — the actual text (or a placeholder like
   *  "📷 Photo") shown in the push notification body, Instagram-style,
   *  instead of a generic "sent you a message". */
  messagePreview?: string;
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
      fromPhotoUri: params.fromPhotoUri ?? null,
      type: params.type,
      eventId: params.eventId ?? null,
      eventTitle: params.eventTitle ?? null,
      messagePreview: params.messagePreview ?? null,
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
            fromPhotoUri: data.fromPhotoUri ?? undefined,
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

  async delete(uid: string, notifId: string): Promise<void> {
    await deleteDoc(doc(db, 'users', uid, 'notifications', notifId));
  },

  async deleteMany(uid: string, notifIds: string[]): Promise<void> {
    if (notifIds.length === 0) return;
    const batch = writeBatch(db);
    notifIds.forEach((id) => {
      batch.delete(doc(db, 'users', uid, 'notifications', id));
    });
    await batch.commit();
  },
};
