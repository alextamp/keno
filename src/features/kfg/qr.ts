import { sha256 } from 'js-sha256';
import { KFG_LIMITS } from '@/core/constants/kfg';

// The participant's rotating QR: `kfg:{participationId}:{bucket}:{sig}`,
// sig = first 16 hex chars of HMAC-SHA256(secret, `${participationId}:${bucket}`).
// Computed offline from the secret the server stored for this participation,
// and verified by kfgScan (functions/src/kfgLogic.ts qrSignature) — the two
// must stay byte-identical.

export function qrBucket(now: number): number {
  return Math.floor(now / KFG_LIMITS.qrBucketMs);
}

export function buildKfgQrCode(secret: string, participationId: string, now: number = Date.now()): string {
  const bucket = qrBucket(now);
  const sig = sha256.hmac(secret, `${participationId}:${bucket}`).slice(0, 16);
  return `kfg:${participationId}:${bucket}:${sig}`;
}

/** ms until the code changes — drives the re-render timer. */
export function msUntilNextBucket(now: number = Date.now()): number {
  return KFG_LIMITS.qrBucketMs - (now % KFG_LIMITS.qrBucketMs);
}
