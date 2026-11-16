import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onObjectFinalized } from 'firebase-functions/v2/storage';
import { logger } from 'firebase-functions';
import { randomBytes } from 'crypto';
import sharp from 'sharp';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { db, checkRateLimit } from './shared';
import {
  athensDayId, athensMonthId, athensWeekId, clampTrust, countsForLeaderboard, isInScanWindow, isQrValid,
  KFG_COSMETICS, KFG_LIMITS, KFG_POINTS, KfgCreatorType, KfgMissionKind, kfgLevel, levelUnlocks, missionEligibility,
  missionPoints, nextStreak, sanitizeMissionFilters, parseQrCode, PhotoShot, photoPairProblems, resolveGroup,
} from './kfgLogic';

// ── Keno for Good ───────────────────────────────────────────────────────────
// Everything that changes KfG state lives here: firestore.rules deny client
// writes to every kfg* collection except `equipped` on your own profile.
//
//   kfgMissions/{id}                  missions (status: pending → published | rejected; cancelled)
//   kfgParticipations/{mission_uid}   one per user per mission
//     /private/qr                     that user's QR secret
//   kfgVerifications/{id}             QR scans, peer votes, photo submissions
//   kfgLedger/{id}                    append-only points log (the source of truth)
//   kfgProfiles/{uid}                 running totals, streak, equipped (public)
//   kfgTrust/{uid}                    peer-confirmation trust score (server-only)
//     /cosmetics/{itemId}             owned items
//   kfgLeaderboards/{monthId}         monthly snapshot (final: true once the month is over)

const MISSIONS = 'kfgMissions';
const PARTICIPATIONS = 'kfgParticipations';
const VERIFICATIONS = 'kfgVerifications';
const LEDGER = 'kfgLedger';
const PROFILES = 'kfgProfiles';
const LEADERBOARDS = 'kfgLeaderboards';
// Peer-confirmation trust is kept apart from the public profile: only these
// functions read or write it (firestore.rules lets admins read it, nobody write).
const TRUST = 'kfgTrust';
const KINDS: KfgMissionKind[] = ['partnerQr', 'group', 'photo'];
const CAUSES = ['food', 'animals', 'environment', 'recycling', 'people', 'other'];
const OPEN_STATUSES = ['joined', 'checkedIn'];

let vision: ImageAnnotatorClient | null = null;
const visionClient = () => (vision ??= new ImageAnnotatorClient());

function requireUid(request: { auth?: { uid: string } }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  return uid;
}

async function isAdminUid(uid: string): Promise<boolean> {
  return (await db.doc(`admins/${uid}`).get()).exists;
}

// The "keno" account that reviews pending events every day (firestore.rules
// isEventsManager, src/core/constants/eventsAccount.ts). It may also approve
// student missions — that queue sits on the same screen — and nothing else.
const KENO_EVENTS_UID = 'ObDcfgYrUJQVHYhLcyZ5WetCxSE3';

function str(v: unknown, field: string, min: number, max: number): string {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) {
    throw new HttpsError('invalid-argument', `${field} must be ${min}–${max} characters.`);
  }
  return v.trim();
}

function optStr(v: unknown, field: string, max: number): string | null {
  if (v == null || v === '') return null;
  return str(v, field, 1, max);
}

// ── Notifications ───────────────────────────────────────────────────────────
// Same users/{uid}/notifications docs the app writes (onNotificationCreated
// in index.ts turns them into pushes); KfG types carry the mission id in
// `eventId`, which is what the client routes on.

async function notify(
  toUids: string[], type: string, missionId: string, missionTitle: string,
  from?: { uid: string; name?: string; avatarColor?: string; photoUri?: string },
): Promise<void> {
  const targets = [...new Set(toUids)].filter((u) => u && u !== from?.uid);
  if (targets.length === 0) return;
  for (let i = 0; i < targets.length; i += 400) {
    const batch = db.batch();
    targets.slice(i, i + 400).forEach((uid) => batch.set(db.collection(`users/${uid}/notifications`).doc(), {
      fromUid: from?.uid ?? 'keno', fromName: from?.name ?? 'Keno for Good',
      fromAvatarColor: from?.avatarColor ?? null, fromPhotoUri: from?.photoUri ?? null,
      type, eventId: missionId, eventTitle: missionTitle, messagePreview: null,
      read: false, createdAt: Timestamp.now(),
    }));
    await batch.commit().catch((err) => logger.error('kfg notify failed', { type, missionId, err: String(err) }));
  }
}

/** A mission just went live: tell its community (the creator excluded). */
async function announceToCommunity(groupId: unknown, missionId: string, title: string, creatorId: string): Promise<void> {
  if (typeof groupId !== 'string' || !groupId) return;
  const g = (await db.doc(`groups/${groupId}`).get()).data();
  if (!g) return;
  await notify((g.memberIds ?? []).filter((u: string) => u !== creatorId), 'kfg_new_mission', missionId, title);
}

// ── Communities (groups docs with scope 'kfg') ──────────────────────────────

/** The KfG community a mission is posted to: must exist, be a KfG community, and include the creator. */
async function communityFor(groupId: unknown, uid: string): Promise<{ id: string; name: string } | null> {
  if (groupId == null || groupId === '') return null;
  if (typeof groupId !== 'string' || groupId.length > 128) throw new HttpsError('invalid-argument', 'group');
  const g = (await db.doc(`groups/${groupId}`).get()).data();
  if (!g || g.scope !== 'kfg') throw new HttpsError('not-found', 'group');
  if (!(g.memberIds ?? []).includes(uid)) throw new HttpsError('permission-denied', 'not-a-member');
  return { id: groupId, name: String(g.name ?? '').slice(0, 80) };
}

/** Keeps the community's mission count in step; best effort — the group may have been deleted. */
async function syncCommunityMission(groupId: unknown, missionId: string, add: boolean): Promise<void> {
  if (typeof groupId !== 'string' || !groupId) return;
  await db.doc(`groups/${groupId}`)
    .update({ missionIds: add ? FieldValue.arrayUnion(missionId) : FieldValue.arrayRemove(missionId) })
    .catch(() => {});
}

// A cover photo must be one the app uploaded to our own bucket's events/
// folder (same place as regular event covers) — never an arbitrary URL.
function coverImage(v: unknown): string | null {
  if (v == null || v === '') return null;
  const prefix = `https://firebasestorage.googleapis.com/v0/b/${admin.storage().bucket().name}/o/events%2F`;
  if (typeof v !== 'string' || v.length > 600 || !v.startsWith(prefix)) throw new HttpsError('invalid-argument', 'imageUri');
  return v;
}

// ── Points ──────────────────────────────────────────────────────────────────

interface AwardMeta {
  reason: 'mission' | 'host' | 'reversal';
  countsForLeaderboard: boolean;
  missionId: string;
  participationId?: string;
}

export interface AwardResult {
  points: number;
  countsForLeaderboard: boolean;
  levelBefore: number;
  levelAfter: number;
  unlocked: string[];
}

/**
 * Writes one ledger entry and updates the running totals on kfgProfiles in a
 * single transaction. Positive mission points raise the level (lifetime), the
 * spendable balance, the weekly streak and — only when countsForLeaderboard —
 * the current month's score. A reversal (negative delta) undoes the same
 * fields. Level-gated cosmetics reached by this award are granted here.
 */
export async function awardPoints(uid: string, delta: number, meta: AwardMeta): Promise<AwardResult> {
  const now = new Date();
  const monthId = athensMonthId(now);
  const profileRef = db.doc(`${PROFILES}/${uid}`);
  return db.runTransaction(async (tx) => {
    const [profileSnap, userSnap] = await Promise.all([tx.get(profileRef), tx.get(db.doc(`users/${uid}`))]);
    const p = profileSnap.data() ?? {};
    const lifetimeBefore: number = p.lifetimePoints ?? 0;
    const lifetimeAfter = Math.max(0, lifetimeBefore + delta);
    const sameMonth = p.monthId === monthId;
    const update: Record<string, unknown> = {
      lifetimePoints: lifetimeAfter,
      balance: Math.max(0, (p.balance ?? 0) + delta),
      university: userSnap.data()?.universityName ?? p.university ?? null,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (!profileSnap.exists) {
      Object.assign(update, {
        streakWeeks: 0, lastWeekId: null,
        equipped: { head: null, face: null, neck: null }, monthId, monthPoints: 0,
      });
    }
    if (meta.countsForLeaderboard) {
      update.monthId = monthId;
      update.monthPoints = Math.max(0, (sameMonth ? (p.monthPoints ?? 0) : 0) + delta);
    }
    if (delta > 0 && meta.reason !== 'reversal') {
      Object.assign(update, nextStreak({ streakWeeks: p.streakWeeks ?? 0, lastWeekId: p.lastWeekId ?? null }, now));
    }

    const unlocked = delta > 0 ? levelUnlocks(lifetimeBefore, lifetimeAfter) : [];
    tx.set(profileRef, update, { merge: true });
    unlocked.forEach((itemId) => tx.set(profileRef.collection('cosmetics').doc(itemId), {
      slot: KFG_COSMETICS[itemId].slot, acquiredVia: 'achievement', at: FieldValue.serverTimestamp(),
    }));
    tx.set(db.collection(LEDGER).doc(), {
      uid, delta, reason: meta.reason, countsForLeaderboard: meta.countsForLeaderboard, monthId,
      missionId: meta.missionId, participationId: meta.participationId ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
    return {
      points: delta, countsForLeaderboard: meta.countsForLeaderboard,
      levelBefore: kfgLevel(lifetimeBefore), levelAfter: kfgLevel(lifetimeAfter), unlocked,
    };
  });
}

/**
 * `presentIds` on the mission = who was actually there (checked in, or paid
 * for a group/photo mission). Public, like an event's checkIns list — it's
 * what Kudos, "who came" and the reconnect swipes are gated on.
 */
async function markPresent(missionId: string, uid: string): Promise<void> {
  await db.doc(`${MISSIONS}/${missionId}`).update({ presentIds: FieldValue.arrayUnion(uid) }).catch(() => {});
}

/** Pays a participant and stores the result on their participation (the completion screen reads it). */
async function payParticipant(
  participationRef: admin.firestore.DocumentReference,
  uid: string,
  mission: admin.firestore.DocumentData,
  missionId: string,
  counts: boolean,
): Promise<AwardResult> {
  const award = await awardPoints(uid, mission.points, {
    reason: 'mission', countsForLeaderboard: counts, missionId, participationId: participationRef.id,
  });
  await participationRef.update({
    status: 'completed', award, completedAt: FieldValue.serverTimestamp(),
    completedDayId: athensDayId(new Date()), completedWeekId: athensWeekId(new Date()),
  });
  await markPresent(missionId, uid);
  return award;
}

// ── Missions ────────────────────────────────────────────────────────────────

/**
 * Organizations (users.isOrganization, admin-granted) publish straight away
 * and choose the kind. Students may only create QR missions they verify
 * themselves (no monthly cap — the 5/hour rate limit above stops spam), and those
 * wait for admin approval.
 */
export const kfgCreateMission = onCall(async (request) => {
  const uid = requireUid(request);
  await checkRateLimit(uid, 'kfgCreateMission', 5, 60 * 60_000);
  const d = request.data ?? {};

  const user = (await db.doc(`users/${uid}`).get()).data();
  if (!user) throw new HttpsError('failed-precondition', 'no-profile');
  if (user.idVerificationStatus === 'pending' || user.idVerificationStatus === 'rejected') {
    throw new HttpsError('permission-denied', 'not-verified');
  }
  const creatorType: KfgCreatorType = user.isOrganization === true ? 'organization' : 'student';

  const kind: KfgMissionKind = creatorType === 'student' ? 'partnerQr' : d.kind;
  if (!KINDS.includes(kind)) throw new HttpsError('invalid-argument', 'kind');
  const cause = CAUSES.includes(d.cause) ? d.cause : 'other';

  const startsAt = new Date(d.startsAt);
  const endsAt = new Date(d.endsAt);
  const now = Date.now();
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) throw new HttpsError('invalid-argument', 'dates');
  if (startsAt.getTime() < now || startsAt.getTime() > now + 90 * 86_400_000) throw new HttpsError('invalid-argument', 'startsAt');
  if (endsAt <= startsAt || endsAt.getTime() - startsAt.getTime() > KFG_LIMITS.maxDurationHours * 3_600_000) {
    throw new HttpsError('invalid-argument', 'endsAt');
  }
  const durationMin = (endsAt.getTime() - startsAt.getTime()) / 60_000;
  const minDurationMin = kind === 'partnerQr' ? Math.round(Number(d.minDurationMin ?? 0)) : 0;
  if (!(minDurationMin >= 0 && minDurationMin <= durationMin)) throw new HttpsError('invalid-argument', 'minDurationMin');
  const capacity = Math.round(Number(d.capacity));
  if (!(capacity >= 1 && capacity <= KFG_LIMITS.maxCapacity)) throw new HttpsError('invalid-argument', 'capacity');
  const lat = typeof d.lat === 'number' && Number.isFinite(d.lat) ? d.lat : null;
  const lng = typeof d.lng === 'number' && Number.isFinite(d.lng) ? d.lng : null;
  const filters = sanitizeMissionFilters(d);
  if (!filters) throw new HttpsError('invalid-argument', 'ages');
  const imageUri = coverImage(d.imageUri);
  const community = await communityFor(d.groupId, uid);

  const monthId = athensMonthId(new Date());

  const ref = await db.collection(MISSIONS).add({
    creatorId: uid,
    creatorType,
    creatorName: str(user.name ?? 'Keno', 'name', 1, 80),
    title: str(d.title, 'title', 3, 80),
    description: str(d.description, 'description', 10, 1000),
    infoText: optStr(d.infoText, 'infoText', 500),
    kind,
    cause,
    startsAt: Timestamp.fromDate(startsAt),
    endsAt: Timestamp.fromDate(endsAt),
    minDurationMin,
    areaLabel: str(d.areaLabel, 'areaLabel', 2, 60),
    address: optStr(d.address, 'address', 160),
    lat,
    lng,
    capacity,
    imageUri,
    groupId: community?.id ?? null,
    photoWall: d.photoWall !== false,
    groupName: community?.name ?? null,
    ...filters,
    points: missionPoints(kind, creatorType, d.points),
    status: creatorType === 'organization' ? 'published' : 'pending',
    participantCount: 0,
    participantIds: [],
    verifiedCount: 0,
    finalized: false,
    createdMonthId: monthId,
    createdAt: FieldValue.serverTimestamp(),
  });
  if (creatorType === 'organization') {
    await syncCommunityMission(community?.id, ref.id, true);
    await announceToCommunity(community?.id, ref.id, String(d.title).trim(), uid);
  }
  return { missionId: ref.id, status: creatorType === 'organization' ? 'published' : 'pending' };
});

export const kfgReviewMission = onCall(async (request) => {
  const uid = requireUid(request);
  if (uid !== KENO_EVENTS_UID && !(await isAdminUid(uid))) throw new HttpsError('permission-denied', 'admin-only');
  const { missionId, approve, reason } = request.data ?? {};
  const ref = db.doc(`${MISSIONS}/${String(missionId)}`);
  let groupId: unknown = null;
  let mission: FirebaseFirestore.DocumentData = {};
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'mission');
    if (snap.data()!.status !== 'pending') throw new HttpsError('failed-precondition', 'not-pending');
    groupId = snap.data()!.groupId;
    mission = snap.data()!;
    tx.update(ref, {
      status: approve === true ? 'published' : 'rejected',
      rejectionReason: approve === true ? null : (typeof reason === 'string' ? reason.slice(0, 300) : null),
      reviewedBy: uid, reviewedAt: FieldValue.serverTimestamp(),
    });
  });
  if (approve === true) {
    await syncCommunityMission(groupId, String(missionId), true);
    await announceToCommunity(groupId, String(missionId), mission.title, mission.creatorId);
  }
  await notify([mission.creatorId], approve === true ? 'kfg_approved' : 'kfg_rejected', String(missionId), mission.title);
  return { ok: true };
});

export const kfgCancelMission = onCall(async (request) => {
  const uid = requireUid(request);
  const missionId = String(request.data?.missionId ?? '');
  const ref = db.doc(`${MISSIONS}/${missionId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'mission');
  const m = snap.data()!;
  if (m.creatorId !== uid && !(await isAdminUid(uid))) throw new HttpsError('permission-denied', 'not-creator');
  if (!['pending', 'published'].includes(m.status)) throw new HttpsError('failed-precondition', 'not-active');
  if (m.endsAt.toMillis() < Date.now()) throw new HttpsError('failed-precondition', 'already-over');

  await ref.update({ status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() });
  await syncCommunityMission(m.groupId, missionId, false);
  await notify(m.participantIds ?? [], 'kfg_cancelled', missionId, m.title, { uid });
  const open = await db.collection(PARTICIPATIONS).where('missionId', '==', missionId).get();
  const batch = db.batch();
  open.docs.filter((p) => OPEN_STATUSES.includes(p.data().status))
    .forEach((p) => batch.update(p.ref, { status: 'cancelled' }));
  await batch.commit();
  return { ok: true };
});

/** Live Mode's "end mission now" (creator only): moves endsAt to now, like an event's early end. */
export const kfgEndMission = onCall(async (request) => {
  const uid = requireUid(request);
  const missionId = String(request.data?.missionId ?? '');
  const ref = db.doc(`${MISSIONS}/${missionId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'mission');
  const m = snap.data()!;
  if (m.creatorId !== uid) throw new HttpsError('permission-denied', 'not-creator');
  if (m.status !== 'published') throw new HttpsError('failed-precondition', 'not-published');
  const now = Date.now();
  if (m.startsAt.toMillis() > now) throw new HttpsError('failed-precondition', 'not-started');
  if (m.endsAt.toMillis() <= now) return { ok: true };
  await ref.update({ endsAt: Timestamp.fromMillis(now), endedEarlyAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

// ── Joining ─────────────────────────────────────────────────────────────────

export const kfgJoin = onCall(async (request) => {
  const uid = requireUid(request);
  await checkRateLimit(uid, 'kfgJoin', 20, 60 * 60_000);
  const missionId = String(request.data?.missionId ?? '');
  const missionRef = db.doc(`${MISSIONS}/${missionId}`);
  const participationRef = db.doc(`${PARTICIPATIONS}/${missionId}_${uid}`);

  const user = (await db.doc(`users/${uid}`).get()).data();
  if (!user) throw new HttpsError('failed-precondition', 'no-profile');
  if (user.isOrganization === true) throw new HttpsError('permission-denied', 'organizations-cannot-join');
  if (user.idVerificationStatus === 'pending' || user.idVerificationStatus === 'rejected') {
    throw new HttpsError('permission-denied', 'not-verified');
  }

  const open = await db.collection(PARTICIPATIONS)
    .where('uid', '==', uid).where('status', 'in', OPEN_STATUSES).count().get();
  if (open.data().count >= KFG_LIMITS.maxOpenParticipations) throw new HttpsError('resource-exhausted', 'too-many-open');

  let joined: FirebaseFirestore.DocumentData | null = null;
  await db.runTransaction(async (tx) => {
    const [mSnap, pSnap] = await Promise.all([tx.get(missionRef), tx.get(participationRef)]);
    if (!mSnap.exists) throw new HttpsError('not-found', 'mission');
    const m = mSnap.data()!;
    if (m.status !== 'published') throw new HttpsError('failed-precondition', 'not-published');
    if (m.creatorId === uid) throw new HttpsError('failed-precondition', 'own-mission');
    if (m.endsAt.toMillis() <= Date.now()) throw new HttpsError('failed-precondition', 'over');
    if (pSnap.exists && pSnap.data()!.status !== 'cancelled') return; // already in — idempotent
    const ineligible = missionEligibility(m, user);
    if (ineligible) throw new HttpsError('permission-denied', ineligible);
    if ((m.participantCount ?? 0) >= m.capacity) throw new HttpsError('resource-exhausted', 'full');

    joined = m;
    tx.set(participationRef, {
      uid, missionId, missionCreatorId: m.creatorId, kind: m.kind, creatorType: m.creatorType,
      status: 'joined', joinedAt: FieldValue.serverTimestamp(),
      checkInAt: null, checkOutAt: null, award: null, photos: {}, reviewState: null,
    });
    tx.set(participationRef.collection('private').doc('qr'), { secret: randomBytes(16).toString('hex') });
    tx.update(missionRef, { participantCount: FieldValue.increment(1), participantIds: FieldValue.arrayUnion(uid) });
  });
  const j = joined as FirebaseFirestore.DocumentData | null;
  if (j) await notify([j.creatorId], 'kfg_join', missionId, j.title, { uid, name: user.name, avatarColor: user.avatarColor, photoUri: user.photoUri });
  return { participationId: participationRef.id };
});

export const kfgLeave = onCall(async (request) => {
  const uid = requireUid(request);
  const missionId = String(request.data?.missionId ?? '');
  const missionRef = db.doc(`${MISSIONS}/${missionId}`);
  const participationRef = db.doc(`${PARTICIPATIONS}/${missionId}_${uid}`);
  await db.runTransaction(async (tx) => {
    const pSnap = await tx.get(participationRef);
    if (!pSnap.exists || pSnap.data()!.status !== 'joined') throw new HttpsError('failed-precondition', 'cannot-leave');
    tx.update(participationRef, { status: 'cancelled' });
    tx.update(missionRef, { participantCount: FieldValue.increment(-1), participantIds: FieldValue.arrayRemove(uid) });
  });
  return { ok: true };
});

// ── QR check-in / check-out (scanned by the mission's creator) ──────────────

async function completeQr(
  participationRef: admin.firestore.DocumentReference,
  p: admin.firestore.DocumentData,
  mission: admin.firestore.DocumentData,
  missionId: string,
): Promise<'completed' | 'verified'> {
  await participationRef.update({ checkOutAt: FieldValue.serverTimestamp() });
  await db.doc(`${MISSIONS}/${missionId}`).update({ verifiedCount: FieldValue.increment(1) });
  if (mission.creatorType === 'student') {
    // Paid when the mission is finalized — it only counts with enough verified people.
    await participationRef.update({ status: 'verified' });
    return 'verified';
  }
  await payParticipant(participationRef, p.uid, mission, missionId, true);
  return 'completed';
}

export const kfgScan = onCall(async (request) => {
  const uid = requireUid(request);
  await checkRateLimit(uid, 'kfgScan', 300, 10 * 60_000);
  const parsed = parseQrCode(request.data?.code);
  if (!parsed) throw new HttpsError('invalid-argument', 'bad-code');

  const participationRef = db.doc(`${PARTICIPATIONS}/${parsed.participationId}`);
  const pSnap = await participationRef.get();
  if (!pSnap.exists) throw new HttpsError('not-found', 'participation');
  const p = pSnap.data()!;
  const missionSnap = await db.doc(`${MISSIONS}/${p.missionId}`).get();
  const m = missionSnap.data();
  if (!m) throw new HttpsError('not-found', 'mission');
  if (m.creatorId !== uid && !(await isAdminUid(uid))) throw new HttpsError('permission-denied', 'not-your-mission');
  if (m.kind !== 'partnerQr' || m.status !== 'published') throw new HttpsError('failed-precondition', 'not-scannable');
  const now = Date.now();
  if (!isInScanWindow(m.startsAt.toMillis(), m.endsAt.toMillis(), now)) throw new HttpsError('failed-precondition', 'outside-window');

  const secret = (await participationRef.collection('private').doc('qr').get()).data()?.secret;
  if (!secret || !isQrValid(secret, parsed.participationId, parsed.bucket, parsed.sig, now)) {
    throw new HttpsError('permission-denied', 'invalid-code');
  }
  const name = (await db.doc(`users/${p.uid}`).get()).data()?.name ?? '';

  if (p.status === 'joined') {
    await participationRef.update({ status: 'checkedIn', checkInAt: FieldValue.serverTimestamp() });
    await markPresent(p.missionId, p.uid);
    await db.collection(VERIFICATIONS).add({
      type: 'qrIn', uid: p.uid, participationId: participationRef.id, missionId: p.missionId, by: uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { result: 'checkedIn', name };
  }
  if (p.status === 'checkedIn') {
    const elapsedMin = (now - p.checkInAt.toMillis()) / 60_000;
    if (elapsedMin < m.minDurationMin) {
      return { result: 'tooEarly', name, remainingMin: Math.ceil(m.minDurationMin - elapsedMin) };
    }
    await db.collection(VERIFICATIONS).add({
      type: 'qrOut', uid: p.uid, participationId: participationRef.id, missionId: p.missionId, by: uid,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { result: await completeQr(participationRef, p, m, p.missionId), name };
  }
  return { result: 'alreadyDone', name };
});

/** End of a QR mission: checks out everyone present long enough. Nobody else is credited. */
export const kfgCheckOutAll = onCall(async (request) => {
  const uid = requireUid(request);
  const missionId = String(request.data?.missionId ?? '');
  const missionSnap = await db.doc(`${MISSIONS}/${missionId}`).get();
  const m = missionSnap.data();
  if (!m) throw new HttpsError('not-found', 'mission');
  if (m.creatorId !== uid && !(await isAdminUid(uid))) throw new HttpsError('permission-denied', 'not-your-mission');
  if (m.kind !== 'partnerQr') throw new HttpsError('failed-precondition', 'not-qr');
  const now = Date.now();
  if (!isInScanWindow(m.startsAt.toMillis(), m.endsAt.toMillis(), now)) throw new HttpsError('failed-precondition', 'outside-window');

  const present = await db.collection(PARTICIPATIONS)
    .where('missionId', '==', missionId).where('missionCreatorId', '==', m.creatorId).get();
  let completed = 0;
  let tooEarly = 0;
  for (const doc of present.docs) {
    const p = doc.data();
    if (p.status !== 'checkedIn') continue;
    if ((now - p.checkInAt.toMillis()) / 60_000 < m.minDurationMin) { tooEarly++; continue; }
    await db.collection(VERIFICATIONS).add({
      type: 'qrOut', uid: p.uid, participationId: doc.id, missionId, by: uid, bulk: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    await completeQr(doc.ref, p, m, missionId);
    completed++;
  }
  return { completed, tooEarly };
});

// ── Group missions: participants confirm each other ─────────────────────────

/** Replaces the caller's set of confirmations for a group mission. */
export const kfgConfirmPeers = onCall(async (request) => {
  const uid = requireUid(request);
  await checkRateLimit(uid, 'kfgConfirmPeers', 20, 60 * 60_000);
  const missionId = String(request.data?.missionId ?? '');
  const uids: unknown = request.data?.uids;
  if (!Array.isArray(uids) || uids.some((u) => typeof u !== 'string')) throw new HttpsError('invalid-argument', 'uids');

  const m = (await db.doc(`${MISSIONS}/${missionId}`).get()).data();
  if (!m || m.kind !== 'group' || m.status !== 'published') throw new HttpsError('failed-precondition', 'not-group');
  const now = Date.now();
  if (now < m.startsAt.toMillis() || now > m.endsAt.toMillis() + KFG_LIMITS.groupConfirmWindowHours * 3_600_000) {
    throw new HttpsError('failed-precondition', 'outside-window');
  }
  const mine = (await db.doc(`${PARTICIPATIONS}/${missionId}_${uid}`).get()).data();
  if (!mine || mine.status !== 'joined') throw new HttpsError('permission-denied', 'not-participant');

  const members = new Set<string>(m.participantIds ?? []);
  const targets = [...new Set(uids as string[])].filter((t) => t !== uid && members.has(t));
  const existing = await db.collection(VERIFICATIONS)
    .where('missionId', '==', missionId).where('uid', '==', uid).where('type', '==', 'peer').get();
  const batch = db.batch();
  existing.docs.filter((d) => !targets.includes(d.data().to)).forEach((d) => batch.delete(d.ref));
  targets.forEach((to) => batch.set(db.doc(`${VERIFICATIONS}/${missionId}_${uid}_${to}`), {
    type: 'peer', uid, to, missionId, createdAt: FieldValue.serverTimestamp(),
  }));
  await batch.commit();
  return { confirmed: targets.length };
});

// ── Photo missions ──────────────────────────────────────────────────────────
// The app uploads kfg-photos-raw/{uid}/{participationId}_{before|after}.jpg
// with customMetadata { takenAt, lat, lng } from the in-app camera. This
// re-encodes it (sharp drops all EXIF/GPS by default), writes the clean copy
// to kfg-photos/, deletes the raw file, counts faces, and once both photos
// are in decides: pay now, or hold for manual review.

export const kfgProcessPhoto = onObjectFinalized({ memory: '512MiB' }, async (event) => {
  const path = event.data.name ?? '';
  const match = path.match(/^kfg-photos-raw\/([^/]+)\/([^/]+)_(before|after)\.jpg$/);
  if (!match) return;
  const [, uid, participationId, side] = match;
  const bucket = admin.storage().bucket(event.data.bucket);
  const raw = bucket.file(path);

  try {
    const participationRef = db.doc(`${PARTICIPATIONS}/${participationId}`);
    const p = (await participationRef.get()).data();
    if (!p || p.uid !== uid || p.kind !== 'photo' || p.status !== 'joined' || p.photos?.[side]) {
      logger.warn('kfgProcessPhoto: rejected upload', { path });
      return;
    }

    const meta = event.data.metadata ?? {};
    const shot: PhotoShot = {
      takenAtMs: Number(meta.takenAt), lat: Number(meta.lat), lng: Number(meta.lng), faces: 0,
    };
    const [buffer] = await raw.download();
    const clean = await sharp(buffer).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    const cleanPath = `kfg-photos/${uid}/${participationId}_${side}.jpg`;
    await bucket.file(cleanPath).save(clean, { contentType: 'image/jpeg' });

    try {
      const [res] = await visionClient().faceDetection({ image: { content: clean } });
      shot.faces = res.faceAnnotations?.length ?? 0;
    } catch (err) {
      // Can't tell — treat as needing a human look rather than paying out blind.
      logger.error('kfgProcessPhoto: face detection failed', { path, err: String(err) });
      shot.faces = 1;
    }

    await db.doc(`${VERIFICATIONS}/${participationId}_${side}`).set({
      type: 'photo', side, uid, participationId, missionId: p.missionId, path: cleanPath,
      takenAtMs: shot.takenAtMs, lat: shot.lat, lng: shot.lng, faces: shot.faces,
      createdAt: FieldValue.serverTimestamp(),
    });
    await participationRef.update({ [`photos.${side}`]: cleanPath });

    const other = (await db.doc(`${VERIFICATIONS}/${participationId}_${side === 'before' ? 'after' : 'before'}`).get()).data();
    if (other) {
      const before = side === 'before' ? shot : (other as unknown as PhotoShot);
      const after = side === 'after' ? shot : (other as unknown as PhotoShot);
      await decidePhotoPair(participationRef, p, before, after);
    }
  } finally {
    await raw.delete({ ignoreNotFound: true }).catch(() => {});
  }
});

async function decidePhotoPair(
  participationRef: admin.firestore.DocumentReference,
  p: admin.firestore.DocumentData,
  before: PhotoShot,
  after: PhotoShot,
): Promise<void> {
  const missionSnap = await db.doc(`${MISSIONS}/${p.missionId}`).get();
  const m = missionSnap.data()!;
  const now = new Date();

  const done = db.collection(PARTICIPATIONS).where('uid', '==', p.uid).where('kind', '==', 'photo');
  const [today, week] = await Promise.all([
    done.where('completedDayId', '==', athensDayId(now)).count().get(),
    done.where('completedWeekId', '==', athensWeekId(now)).count().get(),
  ]);
  if (today.data().count >= KFG_LIMITS.photoMissionsPerDay || week.data().count >= KFG_LIMITS.photoMissionsPerWeek) {
    await participationRef.update({ status: 'rejected', rejectionReason: 'limit' });
    return;
  }

  const problems = photoPairProblems(before, after, { startsAtMs: m.startsAt.toMillis(), endsAtMs: m.endsAt.toMillis() });
  if (problems.length) {
    await participationRef.update({ status: 'inReview', reviewState: 'queued', reviewProblems: problems });
    await markPhotoReview(participationRef.id, 'queued');
    return;
  }
  const sampled = Math.random() < KFG_LIMITS.photoReviewSampleRate;
  await payParticipant(participationRef, p.uid, m, p.missionId, countsForLeaderboard('photo', m.creatorType, 1));
  await participationRef.update({ reviewState: sampled ? 'queued' : 'auto' });
  await markPhotoReview(participationRef.id, sampled ? 'queued' : 'auto');
}

async function markPhotoReview(participationId: string, reviewState: string): Promise<void> {
  const batch = db.batch();
  ['before', 'after'].forEach((side) => batch.set(
    db.doc(`${VERIFICATIONS}/${participationId}_${side}`), { reviewState }, { merge: true },
  ));
  await batch.commit();
}

/** Admin decision on a queued photo pair. Rejecting something already paid writes a reversal. */
export const kfgReviewPhoto = onCall(async (request) => {
  const uid = requireUid(request);
  if (!(await isAdminUid(uid))) throw new HttpsError('permission-denied', 'admin-only');
  const participationId = String(request.data?.participationId ?? '');
  const approve = request.data?.approve === true;
  const participationRef = db.doc(`${PARTICIPATIONS}/${participationId}`);
  const p = (await participationRef.get()).data();
  if (!p || p.reviewState !== 'queued') throw new HttpsError('failed-precondition', 'not-queued');
  const m = (await db.doc(`${MISSIONS}/${p.missionId}`).get()).data()!;
  const paid = p.status === 'completed';

  if (approve && !paid) await payParticipant(participationRef, p.uid, m, p.missionId, false);
  if (!approve && paid) {
    await awardPoints(p.uid, -(p.award?.points ?? m.points), {
      reason: 'reversal', countsForLeaderboard: p.award?.countsForLeaderboard ?? false,
      missionId: p.missionId, participationId,
    });
  }
  await participationRef.update({
    reviewState: approve ? 'approved' : 'rejected',
    ...(approve ? {} : { status: 'rejected', rejectionReason: 'review' }),
    reviewedBy: uid, reviewedAt: FieldValue.serverTimestamp(),
  });
  await markPhotoReview(participationId, approve ? 'approved' : 'rejected');
  return { ok: true };
});

// ── Cosmetics ───────────────────────────────────────────────────────────────

export const kfgPurchase = onCall(async (request) => {
  const uid = requireUid(request);
  await checkRateLimit(uid, 'kfgPurchase', 20, 60 * 60_000);
  const itemId = String(request.data?.itemId ?? '');
  const item = KFG_COSMETICS[itemId];
  if (!item || item.price == null) throw new HttpsError('invalid-argument', 'not-for-sale');
  const price = item.price;
  const profileRef = db.doc(`${PROFILES}/${uid}`);
  const itemRef = profileRef.collection('cosmetics').doc(itemId);

  await db.runTransaction(async (tx) => {
    const [profileSnap, itemSnap] = await Promise.all([tx.get(profileRef), tx.get(itemRef)]);
    if (itemSnap.exists) throw new HttpsError('already-exists', 'owned');
    const balance = profileSnap.data()?.balance ?? 0;
    if (balance < price) throw new HttpsError('failed-precondition', 'not-enough-points');
    tx.update(profileRef, { balance: balance - price, updatedAt: FieldValue.serverTimestamp() });
    tx.set(itemRef, { slot: item.slot, acquiredVia: 'purchase', at: FieldValue.serverTimestamp() });
    tx.set(db.collection(LEDGER).doc(), {
      uid, delta: -price, reason: 'purchase', itemId, countsForLeaderboard: false,
      monthId: athensMonthId(new Date()), createdAt: FieldValue.serverTimestamp(),
    });
  });
  return { ok: true };
});

// ── Finalizing missions ─────────────────────────────────────────────────────
// After a mission ends: student QR missions pay out (counting for the
// leaderboard only with enough verified people, plus the host's points),
// group missions resolve peer confirmations (24h after the end), and anyone
// left joined/checked-in without completing is marked expired.

async function finalizeMission(missionDoc: admin.firestore.QueryDocumentSnapshot): Promise<void> {
  const m = missionDoc.data();
  const missionId = missionDoc.id;
  const participations = await db.collection(PARTICIPATIONS).where('missionId', '==', missionId).get();
  // Paid in this run — the snapshot above still shows their old status, so
  // they must be left out of the "expired" sweep at the end.
  const paid = new Set<string>();

  if (m.kind === 'partnerQr' && m.creatorType === 'student') {
    const verified = participations.docs.filter((d) => d.data().status === 'verified');
    const counts = countsForLeaderboard('partnerQr', 'student', verified.length);
    for (const d of verified) {
      await payParticipant(d.ref, d.data().uid, m, missionId, counts);
      paid.add(d.id);
    }
    if (counts) {
      await awardPoints(m.creatorId, KFG_POINTS.studentHost, { reason: 'host', countsForLeaderboard: true, missionId });
    }
  }

  if (m.kind === 'group') {
    const members = participations.docs.filter((d) => d.data().status === 'joined');
    const uids = members.map((d) => d.data().uid as string);
    const votesSnap = await db.collection(VERIFICATIONS).where('missionId', '==', missionId).where('type', '==', 'peer').get();
    const votes = votesSnap.docs.map((d) => ({ from: d.data().uid as string, to: d.data().to as string }));
    const trustDocs = await Promise.all(uids.map((u) => db.doc(`${TRUST}/${u}`).get()));
    const trust: Record<string, number> = {};
    trustDocs.forEach((s, i) => { trust[uids[i]] = s.data()?.score ?? KFG_LIMITS.initialTrust; });

    const { verified, trustDelta } = resolveGroup(uids, votes, trust);
    for (const d of members) {
      if (!verified.includes(d.data().uid)) continue;
      await payParticipant(d.ref, d.data().uid, m, missionId, true);
      paid.add(d.id);
    }
    await Promise.all(Object.entries(trustDelta).map(([u, delta]) => db.doc(`${TRUST}/${u}`).set(
      { score: clampTrust((trust[u] ?? KFG_LIMITS.initialTrust) + delta), updatedAt: FieldValue.serverTimestamp() }, { merge: true },
    )));
    await missionDoc.ref.update({ verifiedCount: verified.length });
  }

  const batch = db.batch();
  participations.docs
    .filter((d) => !paid.has(d.id) && ['joined', 'checkedIn', 'verified'].includes(d.data().status))
    .forEach((d) => batch.update(d.ref, { status: 'expired' }));
  batch.update(missionDoc.ref, { finalized: true, finalizedAt: FieldValue.serverTimestamp() });
  await batch.commit();
}

export const kfgFinalizeMissions = onSchedule('every 30 minutes', async () => {
  const now = Date.now();
  const snap = await db.collection(MISSIONS)
    .where('status', '==', 'published').where('endsAt', '<=', Timestamp.fromMillis(now - 60 * 60_000)).get();
  for (const doc of snap.docs) {
    const m = doc.data();
    if (m.finalized) continue;
    if (m.kind === 'group' && m.endsAt.toMillis() + KFG_LIMITS.groupConfirmWindowHours * 3_600_000 > now) continue;
    try {
      await finalizeMission(doc);
    } catch (err) {
      logger.error('kfgFinalizeMissions failed', { missionId: doc.id, err: String(err) });
    }
  }
});

// ── Monthly leaderboard ─────────────────────────────────────────────────────

interface Standing { uid: string; points: number; university: string | null }

async function writeLeaderboard(monthId: string, standings: Standing[], final: boolean, extra: Record<string, unknown> = {}) {
  const ranked = standings.filter((s) => s.points > 0).sort((a, b) => b.points - a.points);
  const top = ranked.slice(0, KFG_LIMITS.leaderboardTop);
  const users = top.length ? await db.getAll(...top.map((s) => db.doc(`users/${s.uid}`))) : [];
  const universities: Record<string, number> = {};
  ranked.forEach((s) => { if (s.university) universities[s.university] = (universities[s.university] ?? 0) + s.points; });

  await db.doc(`${LEADERBOARDS}/${monthId}`).set({
    monthId,
    final,
    totalRanked: ranked.length,
    top: top.map((s, i) => {
      const u = users[i]?.data() ?? {};
      return {
        uid: s.uid, points: s.points, university: s.university,
        name: u.name ?? '', avatarColor: u.avatarColor ?? null, photoUri: u.photoUri ?? null,
      };
    }),
    universities: Object.entries(universities).sort((a, b) => b[1] - a[1]).map(([name, points]) => ({ name, points })),
    updatedAt: FieldValue.serverTimestamp(),
    ...extra,
  }, { merge: true });
  return top;
}

/** Final standings of a finished month, summed from the ledger (profiles only hold the current month). */
async function closeMonth(monthId: string): Promise<void> {
  const entries = await db.collection(LEDGER)
    .where('monthId', '==', monthId).where('countsForLeaderboard', '==', true).get();
  const totals: Record<string, number> = {};
  entries.docs.forEach((d) => { const e = d.data(); totals[e.uid] = (totals[e.uid] ?? 0) + e.delta; });
  const uids = Object.keys(totals);
  const profiles = uids.length ? await db.getAll(...uids.map((u) => db.doc(`${PROFILES}/${u}`))) : [];
  await writeLeaderboard(monthId, uids.map((uid, i) => ({
    uid, points: totals[uid], university: profiles[i].data()?.university ?? null,
  })), true);
}

export const kfgUpdateLeaderboard = onSchedule('every 30 minutes', async () => {
  const now = new Date();
  const monthId = athensMonthId(now);
  const [y, m] = monthId.split('-').map(Number);
  const prevMonthId = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const prev = await db.doc(`${LEADERBOARDS}/${prevMonthId}`).get();
  if (!prev.data()?.final) await closeMonth(prevMonthId);

  const snap = await db.collection(PROFILES).where('monthId', '==', monthId).orderBy('monthPoints', 'desc').get();
  const standings: Standing[] = snap.docs.map((d) => ({
    uid: d.id, points: d.data().monthPoints ?? 0, university: d.data().university ?? null,
  }));

  // Once a week, remember everyone's rank so the app can show "+14 θέσεις αυτή τη βδομάδα".
  const weekId = athensWeekId(now);
  const current = await db.doc(`${LEADERBOARDS}/${monthId}`).get();
  if (current.data()?.rankWeekId !== weekId) {
    const ranked = standings.filter((s) => s.points > 0);
    for (let i = 0; i < ranked.length; i += 400) {
      const batch = db.batch();
      ranked.slice(i, i + 400).forEach((s, j) => batch.update(db.doc(`${PROFILES}/${s.uid}`), {
        rankAtWeekStart: i + j + 1, rankWeekId: weekId,
      }));
      await batch.commit();
    }
  }

  const top = await writeLeaderboard(monthId, standings, false, { rankWeekId: weekId });

  // Being in the top 100 at any point unlocks the medal for good.
  await Promise.all(top.map(async (s) => {
    const ref = db.doc(`${PROFILES}/${s.uid}/cosmetics/medal_top100`);
    if (!(await ref.get()).exists) {
      await ref.set({ slot: KFG_COSMETICS.medal_top100.slot, acquiredVia: 'achievement', at: FieldValue.serverTimestamp() });
    }
  }));
});

// ── Housekeeping ────────────────────────────────────────────────────────────

/** Photo coordinates are only needed for the checks and a review; drop them after the retention period. */
export const kfgSweepPhotoLocations = onSchedule('every 24 hours', async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - KFG_LIMITS.photoLocationRetentionDays * 86_400_000);
  const snap = await db.collection(VERIFICATIONS).where('type', '==', 'photo').where('createdAt', '<', cutoff).get();
  const stale = snap.docs.filter((d) => d.data().lat != null && d.data().reviewState !== 'queued');
  for (let i = 0; i < stale.length; i += 400) {
    const batch = db.batch();
    stale.slice(i, i + 400).forEach((d) => batch.update(d.ref, { lat: FieldValue.delete(), lng: FieldValue.delete() }));
    await batch.commit();
  }
});

/** Called from onUserDeleted (index.ts). The ledger is kept for the leaderboard audit trail, without the uid. */
export async function deleteKfgUserData(uid: string): Promise<void> {
  const bucket = admin.storage().bucket();
  const [files] = await bucket.getFiles({ prefix: `kfg-photos/${uid}/` });
  await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })));

  await db.recursiveDelete(db.doc(`${PROFILES}/${uid}`));
  await db.doc(`${TRUST}/${uid}`).delete();
  const participations = await db.collection(PARTICIPATIONS).where('uid', '==', uid).get();
  for (const p of participations.docs) {
    if (OPEN_STATUSES.includes(p.data().status)) {
      await db.doc(`${MISSIONS}/${p.data().missionId}`).update({
        participantCount: FieldValue.increment(-1), participantIds: FieldValue.arrayRemove(uid),
      }).catch(() => {});
    }
    await db.recursiveDelete(p.ref);
  }
  const verifications = await db.collection(VERIFICATIONS).where('uid', '==', uid).get();
  const ledger = await db.collection(LEDGER).where('uid', '==', uid).get();
  const missions = await db.collection(MISSIONS).where('creatorId', '==', uid).get();
  const writes: ((b: admin.firestore.WriteBatch) => void)[] = [
    ...verifications.docs.map((d) => (b: admin.firestore.WriteBatch) => b.delete(d.ref)),
    ...ledger.docs.map((d) => (b: admin.firestore.WriteBatch) => b.update(d.ref, { uid: 'deleted' })),
    ...missions.docs
      .filter((d) => ['pending', 'published'].includes(d.data().status) && d.data().endsAt.toMillis() > Date.now())
      .map((d) => (b: admin.firestore.WriteBatch) => b.update(d.ref, { status: 'cancelled', creatorName: '' })),
  ];
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    writes.slice(i, i + 400).forEach((w) => w(batch));
    await batch.commit();
  }
}
