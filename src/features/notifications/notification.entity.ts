export type NotifType = 'follow' | 'event_join' | 'event_message' | 'event_invite' | 'waitlist_promoted' | 'event_cancelled' | 'event_reminder' | 'group_invite';

export interface NotificationEntity {
  id: string;
  fromUid: string;
  fromName: string;
  fromAvatarColor?: string;
  type: NotifType;
  eventId?: string;
  eventTitle?: string;
  read: boolean;
  createdAt: Date;
}
