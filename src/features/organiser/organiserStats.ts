import { EventEntity, isEventPast } from '@/features/events/domain/entities/event.entity';

// Under this many finished events the percentages are too noisy to mean
// anything (one no-show out of 2 reads as "50% no-show").
export const ORGANISER_STATS_MIN_EVENTS = 3;

export interface OrganiserEventRow {
  eventId: string;
  title: string;
  dateTime: Date;
  joined: number;
  checkedIn: number;
}

export interface OrganiserStats {
  finishedEvents: number;
  /** checkedIn ÷ joined across all finished events, 0–1. */
  attendanceRate: number;
  noShowRate: number;
  uniqueAttendees: number;
  /** People who checked in to 2+ of your events — a count, never names. */
  returningAttendees: number;
  /** Oldest → newest, at most 6. */
  recent: OrganiserEventRow[];
  /** Share of "good" in private post-event feedback, aggregate only. null = no feedback yet. */
  positiveFeedback: number | null;
  feedbackCount: number;
}

/**
 * @param events     any events; only finished ones the user created are used
 * @param checkIns   eventId → uids who actually checked in (events/{id}/checkIns)
 */
export function computeOrganiserStats(
  creatorId: string,
  events: EventEntity[],
  checkIns: Record<string, string[]>,
  now: Date = new Date(),
): OrganiserStats {
  const finished = events
    .filter((e) => e.creatorId === creatorId && isEventPast(e, now.getTime()))
    .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());

  let joined = 0;
  let checkedIn = 0;
  let good = 0;
  let bad = 0;
  const perAttendee = new Map<string, number>();
  const rows: OrganiserEventRow[] = finished.map((e) => {
    // The host is in their own attendee list but isn't an attendee in any
    // meaningful sense — leaving them in would inflate every number.
    const j = e.attendeeIds.filter((uid) => uid !== creatorId).length;
    const came = (checkIns[e.id] ?? []).filter((uid) => uid !== creatorId);
    joined += j;
    checkedIn += came.length;
    came.forEach((uid) => perAttendee.set(uid, (perAttendee.get(uid) ?? 0) + 1));
    good += e.feedbackGoodCount ?? 0;
    bad += e.feedbackBadCount ?? 0;
    return { eventId: e.id, title: e.title, dateTime: e.dateTime, joined: j, checkedIn: came.length };
  });

  const attendanceRate = joined > 0 ? Math.min(1, checkedIn / joined) : 0;
  return {
    finishedEvents: finished.length,
    attendanceRate,
    noShowRate: joined > 0 ? 1 - attendanceRate : 0,
    uniqueAttendees: perAttendee.size,
    returningAttendees: [...perAttendee.values()].filter((n) => n >= 2).length,
    recent: rows.slice(-6),
    positiveFeedback: good + bad > 0 ? good / (good + bad) : null,
    feedbackCount: good + bad,
  };
}
