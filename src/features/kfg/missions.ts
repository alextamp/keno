import { KfgMission, KfgParticipation } from './domain/entities/kfg.entity';

const WEEK_MS = 7 * 86_400_000;

/** Missions someone could still sign up for in the next 7 days: not theirs, not full, not already joined. */
export function openMissionsFor(missions: KfgMission[], participations: KfgParticipation[], uid: string, now = Date.now()): KfgMission[] {
  const joined = new Set(participations.filter((p) => p.status !== 'cancelled').map((p) => p.missionId));
  return missions.filter((m) =>
    m.status === 'published'
    && m.creatorId !== uid
    && !joined.has(m.id)
    && m.endsAt.getTime() > now
    && m.startsAt.getTime() < now + WEEK_MS
    && m.participantCount < m.capacity);
}

/** "This week" list on the Actions tab: everything running in the next 7 days, plus your own joined ones further out. */
export function missionsThisWeek(missions: KfgMission[], participations: KfgParticipation[], now = Date.now()): KfgMission[] {
  const joined = new Set(participations.filter((p) => p.status !== 'cancelled').map((p) => p.missionId));
  return missions
    .filter((m) => m.status === 'published' && m.endsAt.getTime() > now
      && (m.startsAt.getTime() < now + WEEK_MS || joined.has(m.id)))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
