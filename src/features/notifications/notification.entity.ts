export type NotifType = 'follow' | 'event_join' | 'event_message' | 'event_invite' | 'waitlist_promoted' | 'event_cancelled' | 'event_reminder' | 'group_invite' | 'event_join_request' | 'event_join_accepted' | 'group_join_request' | 'group_join_accepted' | 'group_message' | 'dm_message' | 'buddy_match' | 'mutual_match' | 'level_up' | 'friend_going' | 'referral_reward' | 'series_next' | 'ride_request' | 'ride_confirmed' | 'ride_declined' | 'ride_cancelled'
  | 'kfg_message' | 'kfg_approved' | 'kfg_rejected' | 'kfg_reminder' | 'kfg_new_mission' | 'kfg_join'
  | 'kfg_cancelled' | 'kfg_waitlist_promoted' | 'kfg_join_request' | 'kfg_join_accepted' | 'kfg_invite';

/** Keno for Good notifications carry the mission id in `eventId`. */
export const isKfgNotif = (type: string) => type.startsWith('kfg_');

export interface NotificationEntity {
  id: string;
  fromUid: string;
  fromName: string;
  fromAvatarColor?: string;
  fromPhotoUri?: string;
  type: NotifType;
  eventId?: string;
  eventTitle?: string;
  /** Keno for Good: eventId is a mission id. */
  kfg?: boolean;
  read: boolean;
  createdAt: Date;
}
