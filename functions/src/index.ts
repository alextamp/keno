import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();

type NotifType =
  | 'follow'
  | 'event_join'
  | 'event_message'
  | 'event_invite'
  | 'waitlist_promoted'
  | 'event_cancelled'
  | 'event_reminder'
  | 'group_invite';

function buildPushMessage(type: NotifType, fromName: string, eventTitle?: string): { title: string; body: string } {
  switch (type) {
    case 'follow':
      return { title: '👤 New follower', body: `${fromName} started following you` };
    case 'event_join':
      return {
        title: '🎉 Someone joined!',
        body: eventTitle ? `${fromName} joined "${eventTitle}"` : `${fromName} joined your event`,
      };
    case 'event_message':
      return {
        title: '💬 New message',
        body: eventTitle ? `${fromName} sent a message in "${eventTitle}"` : `${fromName} sent you a message`,
      };
    case 'event_invite':
      return {
        title: "📩 You're invited!",
        body: eventTitle ? `${fromName} invited you to "${eventTitle}"` : `${fromName} invited you to an event`,
      };
    case 'waitlist_promoted':
      return {
        title: '🎊 You\'re in!',
        body: eventTitle ? `A spot opened up — you\'re now attending "${eventTitle}"` : 'A spot opened up and you\'re now attending!',
      };
    case 'event_cancelled':
      return {
        title: '❌ Event cancelled',
        body: eventTitle ? `"${eventTitle}" has been cancelled` : 'An event you joined has been cancelled',
      };
    case 'event_reminder':
      return {
        title: '⏰ Starting soon',
        body: eventTitle ? `"${eventTitle}" starts in 1 hour` : 'An event you joined starts in 1 hour',
      };
    case 'group_invite':
      return {
        title: '👥 Group invite',
        body: eventTitle ? `${fromName} invited you to "${eventTitle}"` : `${fromName} invited you to a group`,
      };
    default:
      return { title: 'Keno', body: 'You have a new notification' };
  }
}

export const onNotificationCreated = onDocumentCreated(
  'users/{userId}/notifications/{notifId}',
  async (event) => {
    const notif = event.data?.data();
    if (!notif) return;

    const { userId } = event.params;

    // Get recipient's push token
    const userSnap = await db.doc(`users/${userId}`).get();
    if (!userSnap.exists) return;

    const pushToken: string | undefined = userSnap.data()?.pushToken;
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;

    const { title, body } = buildPushMessage(
      notif.type as NotifType,
      notif.fromName ?? 'Someone',
      notif.eventTitle,
    );

    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: {
        type: notif.type,
        eventId: notif.eventId ?? null,
        fromUid: notif.fromUid ?? null,
      },
    };

    try {
      const chunks = expo.chunkPushNotifications([message]);
      for (const chunk of chunks) {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        // Clean up invalid tokens
        for (const receipt of receipts) {
          if (receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered') {
            await db.doc(`users/${userId}`).update({ pushToken: admin.firestore.FieldValue.delete() });
          }
        }
      }
    } catch {
      // Silently ignore push errors — notification still exists in Firestore
    }
  },
);
