import { KfgMission, KfgParticipation } from './domain/entities/kfg.entity';

// A Keno for Good ticket = a mission you actually completed (the server paid
// you for it), never just one you signed up for — same meaning as a regular
// event ticket ("you were actually there"). Derived, not stored.

export interface KfgTicketData {
  mission: KfgMission;
  participation: KfgParticipation;
  /** 1-based, in completion order — the "Nº 007" on the ticket. */
  serial: number;
  /** When it was done: check-out for QR missions, else the mission's end. */
  doneAt: Date;
}

export function completedParticipations(participations: KfgParticipation[]): KfgParticipation[] {
  return participations.filter((p) => p.status === 'completed');
}

/** Newest first, with serials counted from the oldest. */
export function buildKfgTickets(participations: KfgParticipation[], missions: KfgMission[]): KfgTicketData[] {
  const byId = new Map(missions.map((m) => [m.id, m]));
  const done = completedParticipations(participations)
    .map((p) => {
      const mission = byId.get(p.missionId);
      return mission ? { mission, participation: p, doneAt: p.checkOutAt ?? mission.endsAt } : null;
    })
    .filter((x): x is Omit<KfgTicketData, 'serial'> => !!x)
    .sort((a, b) => a.doneAt.getTime() - b.doneAt.getTime());
  return done.map((x, i) => ({ ...x, serial: i + 1 })).reverse();
}
