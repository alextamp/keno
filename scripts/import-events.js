#!/usr/bin/env node
/**
 * Ingests auto-discovered events into Firestore.
 *
 * Usage:
 *   node scripts/import-events.js <input.json> [--dry-run]
 *   npm run import:events -- <input.json> [--dry-run]
 *
 * Input: a JSON file containing an array of event objects — see
 * docs/events-ingestion.md for the full field reference and a sample.
 *
 * Writes NEVER happen directly from untrusted input into the live `events`
 * collection without going through the validation + needsReview logic
 * below. An event only skips human review (admin-events.tsx) when the
 * script itself found nothing uncertain about it (needsReview is empty) —
 * everything else lands in `eventsPending` instead.
 *
 * Required env vars (never read from a file inside this repo):
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *     — or —
 *   FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
 *   KENO_EVENTS_UID=<uid of the existing "keno" account events are attributed to>
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const admin = require('firebase-admin');

const VALID_SOURCE_CATEGORIES = [
  'Καφές', 'Μπάλα/Αθλητικά', 'Διάβασμα', 'Πάρτι', 'Πεζοπορία', 'Πολιτισμός', 'Εθελοντισμός', 'Άλλο',
];

// Keno's real EventCategory enum (src/features/events/domain/entities/event.entity.ts)
// is party/sports/study/chill/coffee/other — narrower than the source
// categories above. Anything without a direct match falls back to 'other'
// with the original Greek label preserved as customCategory, same as a
// human picking "Other" and typing their own label at creation time.
const CATEGORY_MAP = {
  'Καφές': { category: 'coffee' },
  'Μπάλα/Αθλητικά': { category: 'sports' },
  'Διάβασμα': { category: 'study' },
  'Πάρτι': { category: 'party' },
  'Πεζοπορία': { category: 'other', customCategory: 'Πεζοπορία' },
  'Πολιτισμός': { category: 'other', customCategory: 'Πολιτισμός' },
  'Εθελοντισμός': { category: 'other', customCategory: 'Εθελοντισμός' },
  'Άλλο': { category: 'other' },
};

const DEFAULT_MAX_ATTENDEES = 30;

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const inputPath = args.find((a) => !a.startsWith('--'));
  if (!inputPath) fail('Usage: node scripts/import-events.js <input.json> [--dry-run]');
  return { inputPath, dryRun };
}

function initAdmin() {
  if (admin.apps.length) return;
  const inlineJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    const creds = JSON.parse(inlineJson);
    admin.initializeApp({ credential: admin.credential.cert(creds) });
    return;
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
    return;
  }
  fail('Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON (see docs/events-ingestion.md).');
}

function computeExternalId(title, dateTimeIso, location) {
  const norm = `${title}|${dateTimeIso}|${location}`.trim().toLowerCase().replace(/\s+/g, ' ');
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 32);
}

/**
 * Validates + normalizes one raw input event.
 * Returns { ok: true, event, needsReview } or { ok: false, reason }.
 */
function validateEvent(raw) {
  if (!raw.title || typeof raw.title !== 'string' || !raw.title.trim()) {
    return { ok: false, reason: 'missing title' };
  }
  if (!raw.source || typeof raw.source !== 'string' || !/^https?:\/\//.test(raw.source)) {
    return { ok: false, reason: 'missing/invalid source URL' };
  }
  if (!raw.dateTime) return { ok: false, reason: 'missing dateTime' };
  const dateTime = new Date(raw.dateTime);
  if (Number.isNaN(dateTime.getTime())) return { ok: false, reason: 'invalid dateTime' };
  if (dateTime.getTime() <= Date.now()) return { ok: false, reason: 'dateTime is not in the future' };

  if (!raw.category || !CATEGORY_MAP[raw.category]) {
    return { ok: false, reason: `invalid category "${raw.category}" — must be one of: ${VALID_SOURCE_CATEGORIES.join(', ')}` };
  }
  const { category, customCategory } = CATEGORY_MAP[raw.category];

  if (!raw.location || typeof raw.location !== 'string' || !raw.location.trim()) {
    return { ok: false, reason: 'missing location' };
  }

  // The agent marks its own uncertain fields; the validator only ever adds
  // to that list, never removes from it.
  const needsReview = Array.isArray(raw.needsReview) ? [...raw.needsReview] : [];
  if ((raw.latitude == null) !== (raw.longitude == null)) {
    return { ok: false, reason: 'latitude/longitude must both be set or both be absent' };
  }
  if (raw.latitude == null && !needsReview.includes('location')) {
    needsReview.push('location'); // no pin to place on the map — flag it, don't block on it
  }

  const externalId = computeExternalId(raw.title, dateTime.toISOString(), raw.location);

  const event = {
    title: raw.title.trim(),
    description: (raw.description ?? '').trim(),
    category,
    ...(customCategory ? { customCategory } : {}),
    dateTime,
    location: raw.location.trim(),
    ...(raw.latitude != null ? { latitude: raw.latitude, longitude: raw.longitude } : {}),
    maxAttendees: Number.isInteger(raw.maxAttendees) && raw.maxAttendees > 0 ? raw.maxAttendees : DEFAULT_MAX_ATTENDEES,
    ...(raw.imageUri ? { imageUri: raw.imageUri } : {}),
    source: raw.source,
    externalId,
  };

  return { ok: true, event, needsReview };
}

function generateCheckInSecret() {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 20; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function findExistingByExternalId(db, externalId) {
  const [eventsSnap, pendingSnap] = await Promise.all([
    db.collection('events').where('externalId', '==', externalId).limit(1).get(),
    db.collection('eventsPending').where('externalId', '==', externalId).limit(1).get(),
  ]);
  if (!eventsSnap.empty) return { collection: 'events', doc: eventsSnap.docs[0] };
  if (!pendingSnap.empty) return { collection: 'eventsPending', doc: pendingSnap.docs[0] };
  return null;
}

async function main() {
  const { inputPath, dryRun } = parseArgs();
  const kenoUid = process.env.KENO_EVENTS_UID;
  if (!kenoUid) fail('Set KENO_EVENTS_UID (the uid of the "keno" account auto-imported events are attributed to).');

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
  } catch (e) {
    fail(`Couldn't read/parse ${inputPath}: ${e.message}`);
  }
  if (!Array.isArray(raw)) fail('Input JSON must be an array of events.');

  initAdmin();
  const db = admin.firestore();

  const results = { published: [], pending: [], skippedDuplicate: [], rejected: [] };

  for (const item of raw) {
    const v = validateEvent(item);
    if (!v.ok) {
      results.rejected.push({ title: item.title ?? '(no title)', reason: v.reason });
      continue;
    }
    const { event, needsReview } = v;

    const existing = await findExistingByExternalId(db, event.externalId);
    if (existing) {
      results.skippedDuplicate.push({ title: event.title, existingIn: existing.collection });
      continue;
    }

    const willAutoPublish = needsReview.length === 0;
    if (willAutoPublish) {
      results.published.push({ title: event.title, dateTime: event.dateTime.toISOString() });
    } else {
      results.pending.push({ title: event.title, needsReview });
    }

    if (dryRun) continue;

    if (willAutoPublish) {
      const ref = db.collection('events').doc();
      await ref.set({
        title: event.title,
        description: event.description,
        category: event.category,
        ...(event.customCategory ? { customCategory: event.customCategory } : {}),
        dateTime: admin.firestore.Timestamp.fromDate(event.dateTime),
        location: event.location,
        ...(event.latitude != null ? { latitude: event.latitude, longitude: event.longitude } : {}),
        creatorId: kenoUid,
        maxAttendees: event.maxAttendees,
        attendeeIds: [kenoUid],
        ...(event.imageUri ? { imageUri: event.imageUri } : {}),
        reactions: { hype: [], funny: [], interested: [] },
        waitlistIds: [],
        messages: [],
        source: event.source,
        sourceType: 'auto',
        addedBy: 'events-agent',
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        externalId: event.externalId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('events').doc(ref.id).collection('private').doc('checkin').set({
        secret: generateCheckInSecret(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      await db.collection('eventsPending').add({
        title: event.title,
        description: event.description,
        category: event.category,
        ...(event.customCategory ? { customCategory: event.customCategory } : {}),
        dateTime: admin.firestore.Timestamp.fromDate(event.dateTime),
        location: event.location,
        ...(event.latitude != null ? { latitude: event.latitude, longitude: event.longitude } : {}),
        maxAttendees: event.maxAttendees,
        ...(event.imageUri ? { imageUri: event.imageUri } : {}),
        source: event.source,
        sourceType: 'auto',
        addedBy: 'events-agent',
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        needsReview,
        externalId: event.externalId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Import summary for ${inputPath}:\n`);
  console.log(`  Auto-published (needsReview empty): ${results.published.length}`);
  results.published.forEach((e) => console.log(`    ✓ ${e.title} — ${e.dateTime}`));
  console.log(`  Sent to review (eventsPending): ${results.pending.length}`);
  results.pending.forEach((e) => console.log(`    ? ${e.title} — needsReview: [${e.needsReview.join(', ')}]`));
  console.log(`  Skipped as duplicate (existing externalId): ${results.skippedDuplicate.length}`);
  results.skippedDuplicate.forEach((e) => console.log(`    = ${e.title} (already in ${e.existingIn})`));
  console.log(`  Rejected (invalid): ${results.rejected.length}`);
  results.rejected.forEach((e) => console.log(`    ✗ ${e.title} — ${e.reason}`));
  console.log('');
  if (dryRun) console.log('Dry run — nothing was written. Re-run without --dry-run to apply.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
