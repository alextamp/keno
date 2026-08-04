export type NotifType = 'follow' | 'event_join' | 'event_message' | 'event_invite' | 'waitlist_promoted' | 'event_cancelled' | 'event_reminder' | 'group_invite' | 'event_join_request' | 'event_join_accepted' | 'group_join_request' | 'group_join_accepted' | 'group_message' | 'dm_message' | 'buddy_match' | 'mutual_match' | 'level_up' | 'friend_going' | 'referral_reward';

export interface NotificationEntity {
  id: string;
  fromUid: string;
  fromName: string;
  fromAvatarColor?: string;
  fromPhotoUri?: string;
  type: NotifType;
  eventId?: string;
  eventTitle?: string;
  read: boolean;
  createdAt: Date;
}
