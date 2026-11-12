// Sample Keno for Good data for the LOCAL EMULATOR ONLY.
//   firebase emulators:exec --only firestore --project demo-keno-test "node firestore-tests/kfg/seed.cjs"
// Refuses to run unless FIRESTORE_EMULATOR_HOST is set and the project is a
// demo- project, so it can never write to production.
const path = require('path').resolve(__dirname, '..', '..') + '/';
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || '';
if (!process.env.FIRESTORE_EMULATOR_HOST || !project.startsWith('demo-')) {
  console.error('Refusing to run: only for the Firestore emulator with a demo- project.');
  process.exit(1);
}
const admin = require(path + 'functions/node_modules/firebase-admin');
admin.initializeApp({ projectId: project });
const db = admin.firestore();
const { Timestamp } = admin.firestore;

const day = (d, h) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, 0, 0, 0); return Timestamp.fromDate(x); };
const base = { status: 'published', participantCount: 0, participantIds: [], verifiedCount: 0, finalized: false, createdMonthId: 'seed' };

(async () => {
  await db.doc('users/seed-org').set({ name: 'Τράπεζα Τροφίμων Αθηνών', isOrganization: true });
  await db.doc('users/seed-municipality').set({ name: 'Δήμος Βούλας', isOrganization: true });
  const missions = [
    { id: 'seed-food', creatorId: 'seed-org', creatorType: 'organization', creatorName: 'Τράπεζα Τροφίμων Αθηνών', title: 'Ταξινόμηση τροφίμων', description: 'Βοήθεια στην αποθήκη: ταξινόμηση και πακετάρισμα δεμάτων.', kind: 'partnerQr', cause: 'food', startsAt: day(2, 10), endsAt: day(2, 14), minDurationMin: 120, areaLabel: 'Ρουφ', address: 'Πειραιώς 100', capacity: 12, points: 300 },
    { id: 'seed-dogs', creatorId: 'seed-org', creatorType: 'organization', creatorName: 'Καταφύγιο Ζώων', title: 'Βόλτα με σκύλους του καταφυγίου', description: 'Βγάζουμε βόλτα τους σκύλους του καταφυγίου στο πάρκο.', kind: 'group', cause: 'animals', startsAt: day(3, 11), endsAt: day(3, 13), minDurationMin: 0, areaLabel: 'Ελληνικό', capacity: 8, points: 200 },
    { id: 'seed-beach', creatorId: 'seed-municipality', creatorType: 'organization', creatorName: 'Δήμος Βούλας', title: 'Καθαρισμός παραλίας', description: 'Μαζεύουμε πλαστικά από την παραλία. Γάντια και σακούλες δίνονται επί τόπου.', kind: 'photo', cause: 'environment', startsAt: day(4, 9), endsAt: day(4, 13), minDurationMin: 0, areaLabel: 'Βούλα', capacity: 50, points: 40, infoText: 'Φόρεσε κλειστά παπούτσια.' },
  ];
  for (const { id, ...m } of missions) await db.doc(`kfgMissions/${id}`).set({ ...base, ...m });
  console.log(`Seeded ${missions.length} missions.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
