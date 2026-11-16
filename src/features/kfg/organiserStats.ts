import { KfgMission } from './domain/entities/kfg.entity';

// The events' organiser stats (features/organiser/organiserStats), for the
// missions you created: who came vs. who signed up, regulars, and the
// private "how was it?" signal. Only finished, published missions count.

export const KFG_ORG_STATS_MIN = 2;

export interface KfgOrganiserStats {
  finished: number;
  /** Came / signed up, across finished missions. */
  attendanceRate: number;
  noShowRate: number;
  /** Newest first, at most 8. */
  recent: { missionId: string; title: string; startsAt: Date; joined: number; came: number }[];
  uniqueVolunteers: number;
  /** Came to 2+ of your missions. */
  returningVolunteers: number;
  /** Share of "good" answers, or null with no answers yet. */
  positiveFeedback: number | null;
  feedbackCount: number;
}

export function computeKfgOrganiserStats(missions: KfgMission[], now: number = Date.now()): KfgOrganiserStats {
  const done = missions
    .filter((m) => m.status === 'published' && m.endsAt.getTime() <= now)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
  const joined = done.reduce((n, m) => n + m.participantIds.length, 0);
  const came = done.reduce((n, m) => n + m.presentIds.filter((u) => m.participantIds.includes(u)).length, 0);
  const visits = new Map<string, number>();
  done.forEach((m) => m.presentIds.forEach((u) => visits.set(u, (visits.get(u) ?? 0) + 1)));
  const good = done.reduce((n, m) => n + m.feedbackGoodCount, 0);
  const bad = done.reduce((n, m) => n + m.feedbackBadCount, 0);
  return {
    finished: done.length,
    attendanceRate: joined ? came / joined : 0,
    noShowRate: joined ? (joined - came) / joined : 0,
    recent: done.slice(0, 8).map((m) => ({
      missionId: m.id, title: m.title, startsAt: m.startsAt, joined: m.participantIds.length,
      came: m.presentIds.filter((u) => m.participantIds.includes(u)).length,
    })),
    uniqueVolunteers: visits.size,
    returningVolunteers: [...visits.values()].filter((n) => n >= 2).length,
    positiveFeedback: good + bad > 0 ? good / (good + bad) : null,
    feedbackCount: good + bad,
  };
}
