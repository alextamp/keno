import { getSemesterBounds, getSemesterId } from '@/core/utils/weekId';
import { KfgCause, KfgMission, KfgParticipation } from './domain/entities/kfg.entity';
import { buildKfgTickets, KfgTicketData } from './tickets';

// Keno for Good Wrapped: the same semester recap as the regular Wrapped
// (src/features/wrapped), built from missions you actually completed.

/** Below this many completed missions this semester, show the locked state instead. */
export const KFG_WRAPPED_MIN = 2;

export interface KfgWrappedStats {
  semesterId: string;
  missions: number;
  /** Rounded to the half hour. QR: check-in → check-out; group: the mission's length; photo: not counted. */
  hours: number;
  points: number;
  /** Distinct organizations you volunteered with. */
  organizations: number;
  /** Highest first. */
  causeCounts: { cause: KfgCause; count: number }[];
  topCause: KfgCause | null;
  /** This semester's tickets, oldest first, serial = position in the semester. */
  tickets: KfgTicketData[];
}

function hoursFor(tk: KfgTicketData): number {
  const { participation: p, mission: m } = tk;
  if (m.kind === 'partnerQr' && p.checkInAt && p.checkOutAt) return (p.checkOutAt.getTime() - p.checkInAt.getTime()) / 3_600_000;
  if (m.kind === 'group') return (m.endsAt.getTime() - m.startsAt.getTime()) / 3_600_000;
  return 0;
}

export function computeKfgWrapped(
  participations: KfgParticipation[], missions: KfgMission[], now: Date = new Date(),
): KfgWrappedStats {
  const { start, end } = getSemesterBounds(now);
  const tickets = buildKfgTickets(participations, missions)
    .filter((tk) => tk.doneAt >= start && tk.doneAt <= end)
    .reverse()
    .map((tk, i) => ({ ...tk, serial: i + 1 }));

  const counts = new Map<KfgCause, number>();
  tickets.forEach((tk) => counts.set(tk.mission.cause, (counts.get(tk.mission.cause) ?? 0) + 1));
  const causeCounts = [...counts.entries()].map(([cause, count]) => ({ cause, count })).sort((a, b) => b.count - a.count);

  const hours = tickets.reduce((sum, tk) => sum + Math.max(0, hoursFor(tk)), 0);
  return {
    semesterId: getSemesterId(now),
    missions: tickets.length,
    hours: Math.round(hours * 2) / 2,
    points: tickets.reduce((sum, tk) => sum + (tk.participation.award?.points ?? 0), 0),
    organizations: new Set(tickets.filter((tk) => tk.mission.creatorType === 'organization').map((tk) => tk.mission.creatorId)).size,
    causeCounts,
    topCause: causeCounts[0]?.cause ?? null,
    tickets,
  };
}
