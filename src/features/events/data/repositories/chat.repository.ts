import {
  addDoc, arrayRemove, arrayUnion,
  collection, deleteField, doc, getDoc, onSnapshot,
  orderBy, query, Timestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ChatMessage } from '../../domain/entities/event.entity';
import { notificationsRepository } from '@/features/notifications/notifications.repository';

function msgPath(eventId: string) {
  return collection(db, 'events', eventId, 'messages');
}

function fromDoc(snap: { id: string; data(): Record<string, any> }): ChatMessage {
  const d = snap.data();
  return {
    id: snap.id,
    userId: d.userId,
    text: d.text,
    imageUri: d.imageUri,
    timestamp: d.timestamp?.toDate() ?? new Date(),
    reactions: d.reactions ?? {},
    editedAt: d.editedAt?.toDate(),
    isDeleted: d.isDeleted ?? false,
  };
}

async function notifyEventMessage(eventId: string, userId: string): Promise<void> {
  try {
    const [eventSnap, userSnap] = await Promise.all([
      getDoc(doc(db, 'events', eventId)),
      getDoc(doc(db, 'users', userId)),
    ]);
    if (!eventSnap.exists() || !userSnap.exists()) return;
    const eventData = eventSnap.data();
    const creatorId = eventData.creatorId as string;
    if (creatorId === userId) return;
    const userData = userSnap.data();
    await notificationsRepository.create({
      toUid: creatorId,
      fromUid: userId,
      fromName: userData.name ?? 'Someone',
      fromAvatarColor: userData.avatarColor,
      fromPhotoUri: userData.photoUri,
      type: 'event_message',
      eventId,
      eventTitle: eventData.title,
    });
  } catch {
    // Best-effort — a failed notification should never block the message send.
  }
}

export const chatRepository = {
  subscribeToMessages(eventId: string, onUpdate: (msgs: ChatMessage[]) => void): () => void {
    const q = query(msgPath(eventId), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snap) => onUpdate(snap.docs.map(fromDoc)), () => {});
  },

  async sendMessage(eventId: string, userId: string, text: string): Promise<void> {
    await addDoc(msgPath(eventId), {
      userId,
      text: text.trim(),
      timestamp: Timestamp.now(),
      reactions: {},
    });
    await notifyEventMessage(eventId, userId);
  },

  async sendImageMessage(eventId: string, userId: string, imageUri: string): Promise<void> {
    await addDoc(msgPath(eventId), {
      userId,
      text: '',
      imageUri,
      timestamp: Timestamp.now(),
      reactions: {},
    });
    await notifyEventMessage(eventId, userId);
  },

  async reactToMessage(eventId: string, messageId: string, userId: string, emoji: string): Promise<void> {
    const ref = doc(db, 'events', eventId, 'messages', messageId);
    // Toggle: if already reacted with this emoji, remove; otherwise add
    // We use arrayUnion/Remove on the reactions sub-field
    // Read is done optimistically in the UI
    await updateDoc(ref, {
      [`reactions.${emoji}`]: arrayUnion(userId),
    });
  },

  async removeReaction(eventId: string, messageId: string, userId: string, emoji: string): Promise<void> {
    const ref = doc(db, 'events', eventId, 'messages', messageId);
    await updateDoc(ref, {
      [`reactions.${emoji}`]: arrayRemove(userId),
    });
  },

  async editMessage(eventId: string, messageId: string, text: string): Promise<void> {
    const ref = doc(db, 'events', eventId, 'messages', messageId);
    await updateDoc(ref, { text: text.trim(), editedAt: Timestamp.now() });
  },

  async deleteMessage(eventId: string, messageId: string): Promise<void> {
    const ref = doc(db, 'events', eventId, 'messages', messageId);
    await updateDoc(ref, { isDeleted: true, text: deleteField(), imageUri: deleteField() });
  },

  setTyping(eventId: string, userId: string, isTyping: boolean): void {
    const ref = doc(db, 'events', eventId, 'typing', userId);
    updateDoc(ref, { isTyping, updatedAt: Timestamp.now() }).catch(() => {
      // Doc might not exist yet
      if (isTyping) {
        import('firebase/firestore').then(({ setDoc }) =>
          setDoc(ref, { isTyping: true, updatedAt: Timestamp.now() }).catch(() => {}),
        );
      }
    });
  },

  subscribeToTyping(eventId: string, currentUserId: string, onUpdate: (typingUids: string[]) => void): () => void {
    const typingCol = collection(db, 'events', eventId, 'typing');
    return onSnapshot(typingCol, (snap) => {
      const now = Date.now();
      const active = snap.docs
        .filter((d) => {
          if (d.id === currentUserId) return false;
          const data = d.data();
          if (!data.isTyping) return false;
          // Stale after 5s
          const updatedAt = data.updatedAt?.toDate()?.getTime() ?? 0;
          return now - updatedAt < 5000;
        })
        .map((d) => d.id);
      onUpdate(active);
    }, () => {});
  },
};
