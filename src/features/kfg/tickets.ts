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
  /** Special ticket, like events: first ever, first time solo, squad (3+ mutual friends there), plus-one. */
  label?: 'welcome' | 'firstSolo' | 'squad' | 'plusOne';
}

/** Who the tickets belong to — needed for the squad / plus-one labels. */
export interface KfgTicketOwner { uid: string; following?: string[]; followers?: string[] }

export function completedParticipations(participations: KfgParticipation[]): KfgParticipation[] {
  return participations.filter((p) => p.status === 'completed');
}

/** Newest first, with serials counted from the oldest. */
export function buildKfgTickets(participations: KfgParticipation[], missions: KfgMission[], owner?: KfgTicketOwner): KfgTicketData[] {
  const byId = new Map(missions.map((m) => [m.id, m]));
  const done = completedParticipations(participations)
    .map((p) => {
      const mission = byId.get(p.missionId);
      return mission ? { mission, participation: p, doneAt: p.checkOutAt ?? mission.endsAt } : null;
    })
    .filter((x): x is Omit<KfgTicketData, 'serial'> => !!x)
    .sort((a, b) => a.doneAt.getTime() - b.doneAt.getTime());
  const mutual = new Set((owner?.following ?? []).filter((u) => (owner?.followers ?? []).includes(u)));
  const firstSoloId = done.find((x) => x.participation.arrivedSolo)?.mission.id;
  return done.map((x, i) => {
    const friendsThere = x.mission.presentIds.filter((u) => u !== owner?.uid && mutual.has(u)).length;
    const label: KfgTicketData['label'] = x.mission.id === firstSoloId ? 'firstSolo'
      : i === 0 ? 'welcome'
        : friendsThere >= 3 ? 'squad'
          : owner && x.mission.invites?.[owner.uid] ? 'plusOne'
            : undefined;
    return { ...x, serial: i + 1, label };
  }).reverse();
}
