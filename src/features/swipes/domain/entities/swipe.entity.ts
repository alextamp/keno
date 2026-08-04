export type SwipeDirection = 'interested' | 'skip';

export interface SwipeEntity {
  id: string;
  eventId: string;
  fromUid: string;
  toUid: string;
  direction: SwipeDirection;
  createdAt: Date;
}

export interface MutualMatchEntity {
  id: string;
  user1Id: string;
  user2Id: string;
  eventId: string;
  matchedAt: Date;
}
