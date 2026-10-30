// "Έχω κενό" — an ephemeral, location-based signal a user broadcasts to
// anyone within BEACON_RADIUS_KM, distinct from a full event: no join flow,
// no capacity, nothing to RSVP to. It just disappears once `expiresAt`
// passes, swept server-side by functions/src/index.ts's sweepExpiredBeacons.
export interface BeaconEntity {
  id: string;
  userId: string;
  note?: string;
  durationMinutes: 30 | 60 | 120;
  createdAt: Date;
  expiresAt: Date;
  latitude: number;
  longitude: number;
  /** Uids who've opened the creator's DM because of this beacon — purely
   *  informational ("3 people saw it"), never gates anything. */
  seenByUids?: string[];
}

export const BEACON_RADIUS_KM = 1;
export const BEACON_DURATIONS_MIN: BeaconEntity['durationMinutes'][] = [30, 60, 120];
