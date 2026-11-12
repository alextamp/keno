// Photo mission flow against the local emulators only (demo-keno-test).
const path = require('path').resolve(__dirname, '..', '..') + '/';
process.env.GCLOUD_PROJECT = 'demo-keno-test';
const admin = require(path + 'functions/node_modules/firebase-admin');
const sharp = require(path + 'functions/node_modules/sharp');
const kfg = require(path + 'functions/lib/kfg.js');
const db = admin.firestore();
const bucket = admin.storage().bucket('demo-keno-test.appspot.com');
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m); console.log('  ✓ ' + m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = (fn, uid, data) => kfg[fn].run({ data, auth: { uid, token: {} }, rawRequest: {} });

(async () => {
  await db.doc('users/org1').set({ name: 'Δήμος', isOrganization: true });
  await db.doc('users/u1').set({ name: 'U1' });
  await db.doc('admins/adm').set({});
  const start = new Date(Date.now() + 5 * 60_000); const end = new Date(Date.now() + 4 * 3600_000);
  const { missionId } = await call('kfgCreateMission', 'org1', {
    title: 'Καθαρισμός παραλίας', description: 'Μάζεψε σκουπίδια από την παραλία.', kind: 'photo',
    startsAt: start.toISOString(), endsAt: end.toISOString(), capacity: 50, areaLabel: 'Βούλα',
  });
  const { participationId } = await call('kfgJoin', 'u1', { missionId });

  // A photo that carries EXIF with GPS, like a phone camera would.
  const img = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#88aa66' } })
    .withExif({ IFD0: { Make: 'TestPhone' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '37/1 50/1 0/1' } })
    .jpeg().toBuffer();
  ok(!!(await sharp(img).metadata()).exif, 'test photo starts with EXIF');

  const now = Date.now();
  for (const [side, t] of [['before', now], ['after', now + 60_000]]) {
    await bucket.file(`kfg-photos-raw/u1/${participationId}_${side}.jpg`).save(img, {
      contentType: 'image/jpeg', metadata: { metadata: { takenAt: String(t), lat: '37.81', lng: '23.78' } },
    });
    await sleep(6000);
  }
  for (let i = 0; i < 20; i++) {
    const p = (await db.doc(`kfgParticipations/${participationId}`).get()).data();
    if (p.status !== 'joined') break;
    await sleep(1000);
  }

  const [cleanBefore] = await bucket.file(`kfg-photos/u1/${participationId}_before.jpg`).download();
  ok(!(await sharp(cleanBefore).metadata()).exif, 'stored photo has no EXIF/GPS');
  const [rawExists] = await bucket.file(`kfg-photos-raw/u1/${participationId}_before.jpg`).exists();
  ok(!rawExists, 'raw upload deleted');
  const v = (await db.doc(`kfgVerifications/${participationId}_after`).get()).data();
  ok(v && v.type === 'photo' && v.lat === 37.81, 'verification stored with location');
  const p = (await db.doc(`kfgParticipations/${participationId}`).get()).data();
  console.log('    participation:', p.status, p.reviewState, JSON.stringify(p.reviewProblems ?? []));
  ok(p.status === 'inReview' || p.status === 'completed', 'pair was decided');

  if (p.status === 'inReview') {
    await call('kfgReviewPhoto', 'adm', { participationId, approve: true });
    const after = (await db.doc(`kfgParticipations/${participationId}`).get()).data();
    ok(after.status === 'completed' && after.award.points === 40 && !after.award.countsForLeaderboard, 'approved: 40 points, not on the leaderboard');
  }
  const prof = (await db.doc('kfgProfiles/u1').get()).data();
  ok(prof.lifetimePoints === 40 && (prof.monthPoints ?? 0) === 0, 'level points yes, monthly ranking no');

  await call('kfgReviewPhoto', 'adm', { participationId, approve: false }).then(
    () => { throw new Error('FAIL: second review should be refused'); },
    () => ok(true, 'already-decided pair cannot be reviewed again'),
  );
  console.log('\nALL PASSED');
  process.exit(0);
})().catch((e) => { console.error(e.message ?? e); process.exit(1); });
