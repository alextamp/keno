import { KfgQuestDef } from '@/core/constants/kfg';

// Same progress rule as functions/src/kfgLogic.ts questProgress — display only,
// the server recomputes it when you claim.

export interface KfgDoneForQuest { weekId: string; cause: string; creatorId: string; creatorType: string }

export function questProgress(q: KfgQuestDef, done: KfgDoneForQuest[], weekId: string): number {
  const inScope = q.weekly ? done.filter((d) => d.weekId === weekId) : done;
  let n = 0;
  if (q.measure === 'completed') n = inScope.length;
  if (q.measure === 'causes') n = new Set(done.map((d) => d.cause)).size;
  if (q.measure === 'organizations') n = new Set(done.filter((d) => d.creatorType === 'organization').map((d) => d.creatorId)).size;
  if (q.measure === 'newCause') {
    const before = new Set(done.filter((d) => d.weekId < weekId).map((d) => d.cause));
    n = new Set(inScope.map((d) => d.cause).filter((c) => !before.has(c))).size;
  }
  return Math.min(n, q.target);
}

export function questClaimId(q: KfgQuestDef, weekId: string): string {
  return q.weekly ? `${q.id}_${weekId}` : q.id;
}
