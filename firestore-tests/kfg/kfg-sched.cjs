// Scheduled KfG functions against the local emulators only (demo-keno-test).
const path = require('path').resolve(__dirname, '..', '..') + '/';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = 'demo-keno-test';
const admin = require(path + 'functions/node_modules/firebase-admin');
const kfg = require(path + 'functions/lib/kfg.js'); // initializes the default app (shared.ts)
const db = admin.firestore();
const { Timestamp } = admin.firestore;
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('  ✓ ' + m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function trigger(fn) { await kfg[fn].run({}); }
async function waitFor(check, label) { if (!(await check())) throw new Error('FAIL: ' + label); }

(async () => {
  const past = (h) => Timestamp.fromMillis(Date.now() - h * 3600_000);
  for (const u of ['a', 'b', 'c', 'd', 'host', 'g1', 'g2', 'g3']) await db.doc(`users/${u}`).set({ name: u, universityName: u.startsWith('g') ? 'ΕΜΠ' : 'ΟΠΑ' });

  // Student QR mission that ended 2h ago with 3 verified people.
  await db.doc('kfgMissions/stu').set({ creatorId: 'host', creatorType: 'student', kind: 'partnerQr', status: 'published', finalized: false, points: 150, startsAt: past(5), endsAt: past(2), participantIds: ['a', 'b', 'c', 'd'] });
  for (const u of ['a', 'b', 'c']) await db.doc(`kfgParticipations/stu_${u}`).set({ uid: u, missionId: 'stu', missionCreatorId: 'host', kind: 'partnerQr', creatorType: 'student', status: 'verified' });
  await db.doc('kfgParticipations/stu_d').set({ uid: 'd', missionId: 'stu', missionCreatorId: 'host', kind: 'partnerQr', creatorType: 'student', status: 'joined' });

  // Group mission that ended 26h ago: g1↔g2 confirm each other, g3 confirms g1 only.
  await db.doc('kfgMissions/grp').set({ creatorId: 'org', creatorType: 'organization', kind: 'group', status: 'published', finalized: false, points: 200, startsAt: past(30), endsAt: past(26), participantIds: ['g1', 'g2', 'g3'] });
  for (const u of ['g1', 'g2', 'g3']) await db.doc(`kfgParticipations/grp_${u}`).set({ uid: u, missionId: 'grp', missionCreatorId: 'org', kind: 'group', creatorType: 'organization', status: 'joined' });
  for (const [f, t] of [['g1', 'g2'], ['g2', 'g1'], ['g3', 'g1']]) await db.doc(`kfgVerifications/grp_${f}_${t}`).set({ type: 'peer', uid: f, to: t, missionId: 'grp' });

  console.log('Finalize');
  await trigger('kfgFinalizeMissions');
  await waitFor(async () => (await db.doc('kfgMissions/grp').get()).data().finalized && (await db.doc('kfgMissions/stu').get()).data().finalized, 'finalize');
  for (const u of ['a', 'b', 'c']) ok((await db.doc(`kfgParticipations/stu_${u}`).get()).data().status === 'completed', `student mission paid ${u}`);
  ok((await db.doc('kfgProfiles/a').get()).data().monthPoints === 150, '3 verified → counts for the leaderboard');
  ok((await db.doc('kfgProfiles/host').get()).data().monthPoints === 150, 'host gets host points');
  ok((await db.doc('kfgParticipations/stu_d').get()).data().status === 'expired', 'no-show expired');
  ok((await db.doc('kfgParticipations/grp_g1').get()).data().status === 'completed', 'g1 confirmed by two peers');
  ok((await db.doc('kfgParticipations/grp_g2').get()).data().status === 'completed', 'g2 confirmed (group of 3 needs 1)');
  ok((await db.doc('kfgParticipations/grp_g3').get()).data().status === 'expired', 'g3 unconfirmed');
  ok((await db.doc('kfgTrust/g3').get()).data().score < 0.5, 'unconfirmed member loses trust');
  ok(!('trustScore' in ((await db.doc('kfgProfiles/g1').get()).data())), 'trust is not on the public profile');

  console.log('Leaderboard');
  await trigger('kfgUpdateLeaderboard');
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7);
  await waitFor(async () => (await db.doc(`kfgLeaderboards/${month}`).get()).exists, 'leaderboard');
  const lb = (await db.doc(`kfgLeaderboards/${month}`).get()).data();
  ok(lb.top.length === 6 && lb.top[0].points === 200, 'top list sorted by monthly points');
  ok(lb.universities[0].name === 'ΟΠΑ' && lb.universities[0].points === 600, 'school totals');
  ok((await db.doc('kfgProfiles/a/cosmetics/medal_top100').get()).exists, 'top-100 medal unlocked');
  ok(typeof (await db.doc('kfgProfiles/a').get()).data().rankAtWeekStart === 'number', 'weekly rank snapshot');
  console.log('\nALL PASSED');
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
