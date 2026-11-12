// End-to-end check of the KfG callables against the local emulators only
// (project demo-keno-test). Never touches production.
const path = require('path').resolve(__dirname, '..', '..') + '/';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
const admin = require(path + 'functions/node_modules/firebase-admin');
const { initializeApp } = require(path + 'node_modules/firebase/app');
const { getAuth, connectAuthEmulator, signInWithCustomToken } = require(path + 'node_modules/firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require(path + 'node_modules/firebase/functions');
const { createHmac } = require('crypto');

admin.initializeApp({ projectId: 'demo-keno-test' });
const db = admin.firestore();
let n = 0;
function client(uid) {
  const app = initializeApp({ apiKey: 'demo', projectId: 'demo-keno-test' }, `c${n++}`);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const fns = getFunctions(app); connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  return { auth, call: (name, data) => httpsCallable(fns, name)(data).then((r) => r.data), uid };
}
async function signIn(uid) {
  const c = client(uid);
  await signInWithCustomToken(c.auth, await admin.auth().createCustomToken(uid));
  return c;
}
const ok = (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg); console.log('  ✓ ' + msg); };
async function fails(p, code, msg) {
  try { await p; } catch (e) { ok(String(e.message + e.code).includes(code), `${msg} (${code})`); return; }
  throw new Error('FAIL: expected error ' + code + ' — ' + msg);
}
const qr = async (pid) => {
  const secret = (await db.doc(`kfgParticipations/${pid}/private/qr`).get()).data().secret;
  const bucket = Math.floor(Date.now() / 30000);
  return `kfg:${pid}:${bucket}:${createHmac('sha256', secret).update(`${pid}:${bucket}`).digest('hex').slice(0, 16)}`;
};

(async () => {
  await db.doc('users/org1').set({ name: 'Τράπεζα Τροφίμων', isOrganization: true });
  for (const u of ['s1', 's2', 's3', 's4', 'host']) await db.doc(`users/${u}`).set({ name: u.toUpperCase(), universityName: 'ΟΠΑ' });
  const org = await signIn('org1'); const s1 = await signIn('s1'); const s2 = await signIn('s2'); const host = await signIn('host');

  const start = new Date(Date.now() + 2 * 60_000); const end = new Date(Date.now() + 3 * 3600_000);
  console.log('Organization QR mission');
  const { missionId, status } = await org.call('kfgCreateMission', {
    title: 'Ταξινόμηση τροφίμων', description: 'Βοήθεια στην αποθήκη τροφίμων.', kind: 'partnerQr', cause: 'food',
    startsAt: start.toISOString(), endsAt: end.toISOString(), minDurationMin: 0, capacity: 2, areaLabel: 'Ρουφ', points: 999,
  });
  ok(status === 'published', 'org mission is published immediately');
  ok((await db.doc(`kfgMissions/${missionId}`).get()).data().points === 300, 'points clamped to 300');

  await fails(org.call('kfgJoin', { missionId }), 'organizations-cannot-join', 'organization cannot join');
  const { participationId } = await s1.call('kfgJoin', { missionId });
  await s1.call('kfgJoin', { missionId });
  ok((await db.doc(`kfgMissions/${missionId}`).get()).data().participantCount === 1, 'joining twice is idempotent');
  await s2.call('kfgJoin', { missionId });
  const s3 = await signIn('s3');
  await fails(s3.call('kfgJoin', { missionId }), 'full', 'capacity enforced');

  const code = await qr(participationId);
  await fails(s2.call('kfgScan', { code }), 'not-your-mission', 'only the creator can scan');
  await fails(org.call('kfgScan', { code: code.slice(0, -1) + (code.endsWith('0') ? '1' : '0') }), 'invalid-code', 'tampered code rejected');
  ok((await org.call('kfgScan', { code })).result === 'checkedIn', 'first scan checks in');
  const r2 = await org.call('kfgScan', { code: await qr(participationId) });
  ok(r2.result === 'completed', 'second scan completes (min duration 0)');
  const p = (await db.doc(`kfgParticipations/${participationId}`).get()).data();
  ok(p.status === 'completed' && p.award.points === 300 && p.award.countsForLeaderboard, 'award stored on participation');
  const prof = (await db.doc('kfgProfiles/s1').get()).data();
  ok(prof.lifetimePoints === 300 && prof.balance === 300 && prof.monthPoints === 300 && prof.streakWeeks === 1, 'profile totals + streak');
  ok((await db.collection('kfgLedger').where('uid', '==', 's1').get()).size === 1, 'one ledger entry');
  ok((await org.call('kfgScan', { code: await qr(participationId) })).result === 'alreadyDone', 'third scan is a no-op');

  console.log('Cosmetics');
  await s1.call('kfgPurchase', { itemId: 'cap_green' });
  ok((await db.doc('kfgProfiles/s1').get()).data().balance === 100, 'purchase lowers balance only');
  ok((await db.doc('kfgProfiles/s1').get()).data().lifetimePoints === 300, 'level points untouched');
  await fails(s1.call('kfgPurchase', { itemId: 'beanie' }), 'not-enough-points', 'cannot overspend');
  await fails(s1.call('kfgPurchase', { itemId: 'sunhat' }), 'not-for-sale', 'level items are not for sale');

  console.log('Student mission');
  const st = await host.call('kfgCreateMission', {
    title: 'Καθαρισμός πάρκου', description: 'Μαζεύουμε σκουπίδια στο πάρκο.', kind: 'photo',
    startsAt: start.toISOString(), endsAt: end.toISOString(), capacity: 10, areaLabel: 'Πεδίον Άρεως',
  });
  ok(st.status === 'pending', 'student mission waits for approval');
  const sm = (await db.doc(`kfgMissions/${st.missionId}`).get()).data();
  ok(sm.kind === 'partnerQr' && sm.points === 150, 'student mission forced to QR, 150 points');
  await fails(s1.call('kfgJoin', { missionId: st.missionId }), 'not-published', 'cannot join before approval');
  await host.call('kfgCreateMission', { title: 'Δεύτερη', description: 'Δεύτερη αποστολή μου.', startsAt: start.toISOString(), endsAt: end.toISOString(), capacity: 5, areaLabel: 'Αθήνα' });
  await fails(host.call('kfgCreateMission', { title: 'Τρίτη', description: 'Τρίτη αποστολή μου.', startsAt: start.toISOString(), endsAt: end.toISOString(), capacity: 5, areaLabel: 'Αθήνα' }), 'monthly-limit', 'student monthly limit');
  await fails(s1.call('kfgReviewMission', { missionId: st.missionId, approve: true }), 'admin-only', 'only admins approve');
  await db.doc('admins/s4').set({});
  const adminC = await signIn('s4');
  await adminC.call('kfgReviewMission', { missionId: st.missionId, approve: true });
  ok((await db.doc(`kfgMissions/${st.missionId}`).get()).data().status === 'published', 'admin approval publishes');
  const j = await s2.call('kfgJoin', { missionId: st.missionId });
  await host.call('kfgScan', { code: await qr(j.participationId) });
  ok((await host.call('kfgScan', { code: await qr(j.participationId) })).result === 'verified', 'student mission: verified, paid at finalize');
  ok(!(await db.doc('kfgProfiles/s2').get()).exists, 'no points before finalize');

  console.log('\nALL PASSED');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
