import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, updateDoc, getDoc, getDocs, addDoc, collection, arrayUnion, Timestamp, Firestore, query, where, orderBy, limit,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-keno-test';

const CREATOR = 'creator-uid';
const ADMIN = 'admin-uid';
const USER_A = 'user-a-uid';
const USER_B = 'user-b-uid';
const USER_C = 'user-c-uid';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

// Bypasses rules entirely — used only to arrange fixture state, never to
// perform the action under test.
async function seed(fn: (db: Firestore) => Promise<void>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore() as unknown as Firestore);
  });
}

function asUser(uid: string): Firestore {
  return testEnv.authenticatedContext(uid).firestore() as unknown as Firestore;
}

describe('groups: isVerifiedOrganiser', () => {
  test('creator cannot self-grant the verified badge', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'groups', 'g1'), {
        creatorId: CREATOR, isVerifiedOrganiser: false, memberIds: [CREATOR], invitedUserIds: [], joinRequests: {},
      });
    });
    await assertFails(updateDoc(doc(asUser(CREATOR), 'groups', 'g1'), { isVerifiedOrganiser: true }));
  });

  test('admin can grant the verified badge', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'groups', 'g1'), {
        creatorId: CREATOR, isVerifiedOrganiser: false, memberIds: [CREATOR], invitedUserIds: [], joinRequests: {},
      });
      await setDoc(doc(db, 'admins', ADMIN), { role: 'admin' });
    });
    await assertSucceeds(updateDoc(doc(asUser(ADMIN), 'groups', 'g1'), { isVerifiedOrganiser: true }));
  });
});

describe('events: isFlagship', () => {
  test('creator cannot self-flag their own event', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'events', 'e1'), { creatorId: CREATOR, isFlagship: false, attendeeIds: [], maxAttendees: 10 });
    });
    await assertFails(updateDoc(doc(asUser(CREATOR), 'events', 'e1'), { isFlagship: true }));
  });

  test('admin can flag any event', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'events', 'e1'), { creatorId: CREATOR, isFlagship: false, attendeeIds: [], maxAttendees: 10 });
      await setDoc(doc(db, 'admins', ADMIN), { role: 'admin' });
    });
    await assertSucceeds(updateDoc(doc(asUser(ADMIN), 'events', 'e1'), { isFlagship: true }));
  });
});

describe('admins collection', () => {
  test('a regular user cannot write to admins', async () => {
    await assertFails(setDoc(doc(asUser(USER_A), 'admins', USER_B), { role: 'admin' }));
  });

  test('an existing admin cannot grant admin to someone else through the app either', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'admins', ADMIN), { role: 'admin' });
    });
    await assertFails(setDoc(doc(asUser(ADMIN), 'admins', USER_B), { role: 'moderator' }));
  });
});

describe('event capacity', () => {
  test('joining at capacity is rejected', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'events', 'e-full'), { creatorId: CREATOR, attendeeIds: [USER_A], maxAttendees: 1 });
    });
    await assertFails(updateDoc(doc(asUser(USER_B), 'events', 'e-full'), { attendeeIds: arrayUnion(USER_B) }));
  });

  test('joining under capacity succeeds', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'events', 'e-room'), { creatorId: CREATOR, attendeeIds: [USER_A], maxAttendees: 2 });
    });
    await assertSucceeds(updateDoc(doc(asUser(USER_B), 'events', 'e-room'), { attendeeIds: arrayUnion(USER_B) }));
  });

  test('two concurrent joins for the last spot: only one succeeds', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'events', 'e-race'), { creatorId: CREATOR, attendeeIds: [USER_A], maxAttendees: 2 });
    });
    const results = await Promise.allSettled([
      updateDoc(doc(asUser(USER_B), 'events', 'e-race'), { attendeeIds: arrayUnion(USER_B) }),
      updateDoc(doc(asUser(USER_C), 'events', 'e-race'), { attendeeIds: arrayUnion(USER_C) }),
    ]);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    expect(succeeded).toBe(1);
  });
});

describe('user profile writes', () => {
  test('a user cannot write to another user\'s profile', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', USER_A), { name: 'A', xp: 0, checkInCount: 0 });
    });
    await assertFails(updateDoc(doc(asUser(USER_B), 'users', USER_A), { name: 'Hacked' }));
  });

  test('a user can edit their own profile', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', USER_A), { name: 'A', xp: 0, checkInCount: 0 });
    });
    await assertSucceeds(updateDoc(doc(asUser(USER_A), 'users', USER_A), { name: 'A2' }));
  });

  test('a user cannot set another user\'s xp/reliability/checkInCount to an arbitrary value', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', USER_A), { xp: 10, checkInCount: 2, reliabilityScore: 80 });
    });
    await assertFails(updateDoc(doc(asUser(USER_B), 'users', USER_A), { xp: 999999 }));
  });

  test('a user cannot pair a correct checkInCount bump with an out-of-bounds xp delta', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', USER_A), { xp: 10, checkInCount: 2, reliabilityScore: 80 });
    });
    // +86 is one past the documented [+5, +85] roll-call check-in bound.
    await assertFails(updateDoc(doc(asUser(USER_B), 'users', USER_A), { checkInCount: 3, xp: 10 + 86 }));
  });

  test('a roll-call check-in from another user at exactly the xp bound succeeds', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'users', USER_A), { xp: 10, checkInCount: 2, reliabilityScore: 80 });
    });
    await assertSucceeds(updateDoc(doc(asUser(USER_B), 'users', USER_A), { checkInCount: 3, xp: 10 + 85 }));
  });
});

describe('DM conversations', () => {
  test('a non-participant cannot read a DM thread', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'conversations', 'c1'), { participantIds: [USER_A, USER_B] });
    });
    await assertFails(getDoc(doc(asUser(USER_C), 'conversations', 'c1')));
  });

  test('a participant can read the DM thread', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'conversations', 'c1'), { participantIds: [USER_A, USER_B] });
    });
    await assertSucceeds(getDoc(doc(asUser(USER_A), 'conversations', 'c1')));
  });
});

describe('moderationLog / adminAuditLog', () => {
  test('nobody, including an admin, can write to moderationLog from a client', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'admins', ADMIN), { role: 'admin' });
    });
    await assertFails(addDoc(collection(asUser(ADMIN), 'moderationLog'), { filePath: 'x' }));
  });

  test('a non-admin cannot write to adminAuditLog', async () => {
    await assertFails(addDoc(collection(asUser(USER_A), 'adminAuditLog'), { adminUid: USER_A, action: 'x' }));
  });

  test('an admin can write their own adminAuditLog entry', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'admins', ADMIN), { role: 'admin' });
    });
    await assertSucceeds(addDoc(collection(asUser(ADMIN), 'adminAuditLog'), { adminUid: ADMIN, action: 'x' }));
  });
});

describe('event chat 24h expiry', () => {
  test('a message is rejected once the 24h post-start window has passed', async () => {
    const past = Timestamp.fromDate(new Date(Date.now() - 48 * 60 * 60 * 1000));
    await seed(async (db) => {
      await setDoc(doc(db, 'events', 'e-old'), { creatorId: CREATOR, dateTime: past });
    });
    await assertFails(addDoc(collection(asUser(USER_A), 'events', 'e-old', 'messages'), { userId: USER_A, text: 'hi' }));
  });

  test('a message succeeds within the 24h post-start window', async () => {
    const recent = Timestamp.fromDate(new Date());
    await seed(async (db) => {
      await setDoc(doc(db, 'events', 'e-new'), { creatorId: CREATOR, dateTime: recent });
    });
    await assertSucceeds(addDoc(collection(asUser(USER_A), 'events', 'e-new', 'messages'), { userId: USER_A, text: 'hi' }));
  });
});

describe('event photo wall', () => {
  test('a user who never checked in cannot post to the photo wall', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'events', 'e-photos'), { creatorId: CREATOR });
    });
    await assertFails(addDoc(collection(asUser(USER_A), 'events', 'e-photos', 'photos'), { uploaderUid: USER_A, url: 'x' }));
  });

  test('a checked-in user can post to the photo wall', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'events', 'e-photos'), { creatorId: CREATOR });
      await setDoc(doc(db, 'events', 'e-photos', 'checkIns', USER_A), { userId: USER_A });
    });
    await assertSucceeds(addDoc(collection(asUser(USER_A), 'events', 'e-photos', 'photos'), { uploaderUid: USER_A, url: 'x' }));
  });
});

describe('events: referredBy', () => {
  test('the event creator cannot self-write referredBy', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'events', 'e-ref'), { creatorId: CREATOR, attendeeIds: [USER_A], maxAttendees: 10 });
    });
    await assertFails(updateDoc(doc(asUser(CREATOR), 'events', 'e-ref'), { referredBy: { [USER_A]: USER_B } }));
  });

  test('a non-creator attendee cannot write referredBy either', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'events', 'e-ref'), { creatorId: CREATOR, attendeeIds: [USER_A], maxAttendees: 10 });
    });
    await assertFails(updateDoc(doc(asUser(USER_A), 'events', 'e-ref'), { referredBy: { [USER_A]: USER_B } }));
  });
});

describe('users: isOrganization (Keno for Good)', () => {
  test('nobody can sign up as an organization', async () => {
    await assertFails(setDoc(doc(asUser(USER_A), 'users', USER_A), { name: 'A', isOrganization: true }));
    await assertSucceeds(setDoc(doc(asUser(USER_B), 'users', USER_B), { name: 'B' }));
  });

  test('an owner cannot flip themselves to organization', async () => {
    await seed(async (db) => { await setDoc(doc(db, 'users', USER_A), { name: 'A' }); });
    await assertFails(updateDoc(doc(asUser(USER_A), 'users', USER_A), { isOrganization: true }));
    await assertSucceeds(updateDoc(doc(asUser(USER_A), 'users', USER_A), { name: 'A2' }));
  });

  test('an admin can mark an account as an organization', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'admins', ADMIN), {});
      await setDoc(doc(db, 'users', USER_A), { name: 'A' });
    });
    await assertSucceeds(updateDoc(doc(asUser(ADMIN), 'users', USER_A), { isOrganization: true }));
  });
});

describe('Keno for Good', () => {
  test('clients cannot create missions, participations, ledger entries or profiles', async () => {
    const db = asUser(USER_A);
    await assertFails(setDoc(doc(db, 'kfgMissions', 'm1'), { creatorId: USER_A, status: 'published' }));
    await assertFails(setDoc(doc(db, 'kfgParticipations', `m1_${USER_A}`), { uid: USER_A, status: 'completed' }));
    await assertFails(setDoc(doc(db, 'kfgLedger', 'e1'), { uid: USER_A, delta: 10000 }));
    await assertFails(setDoc(doc(db, 'kfgProfiles', USER_A), { lifetimePoints: 10000 }));
    await assertFails(setDoc(doc(db, 'kfgLeaderboards', '2026-11'), { top: [] }));
  });

  test('a user cannot edit their own points', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'kfgProfiles', USER_A), { lifetimePoints: 100, balance: 100, monthPoints: 100, equipped: {} });
    });
    await assertFails(updateDoc(doc(asUser(USER_A), 'kfgProfiles', USER_A), { lifetimePoints: 9999 }));
    await assertFails(updateDoc(doc(asUser(USER_A), 'kfgProfiles', USER_A), { monthPoints: 9999 }));
  });

  test('a user can wear an item they own in the right slot, nothing else', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'kfgProfiles', USER_A), { lifetimePoints: 0, equipped: { head: null, face: null, neck: null } });
      await setDoc(doc(db, 'kfgProfiles', USER_A, 'cosmetics', 'scarf'), { slot: 'neck' });
    });
    const db = asUser(USER_A);
    await assertSucceeds(updateDoc(doc(db, 'kfgProfiles', USER_A), { equipped: { head: null, face: null, neck: 'scarf' } }));
    await assertFails(updateDoc(doc(db, 'kfgProfiles', USER_A), { equipped: { head: 'scarf', face: null, neck: null } }));
    await assertFails(updateDoc(doc(db, 'kfgProfiles', USER_A), { equipped: { head: 'beanie', face: null, neck: null } }));
    await assertFails(updateDoc(doc(asUser(USER_B), 'kfgProfiles', USER_A), { equipped: { head: null, face: null, neck: null } }));
  });

  test('pending missions are only visible to their creator and admins', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'admins', ADMIN), {});
      await setDoc(doc(db, 'kfgMissions', 'pending1'), { creatorId: USER_A, status: 'pending', title: 'x' });
      await setDoc(doc(db, 'kfgMissions', 'pub1'), { creatorId: USER_A, status: 'published', title: 'y' });
    });
    await assertSucceeds(getDoc(doc(asUser(USER_A), 'kfgMissions', 'pending1')));
    await assertSucceeds(getDoc(doc(asUser(ADMIN), 'kfgMissions', 'pending1')));
    await assertFails(getDoc(doc(asUser(USER_B), 'kfgMissions', 'pending1')));
    await assertSucceeds(getDoc(doc(asUser(USER_B), 'kfgMissions', 'pub1')));
  });

  test('a creator can edit the text of their mission but not its points or status', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'kfgMissions', 'm1'), { creatorId: USER_A, status: 'pending', title: 'x', points: 150 });
    });
    const db = asUser(USER_A);
    await assertSucceeds(updateDoc(doc(db, 'kfgMissions', 'm1'), { title: 'better' }));
    await assertFails(updateDoc(doc(db, 'kfgMissions', 'm1'), { points: 300 }));
    await assertFails(updateDoc(doc(db, 'kfgMissions', 'm1'), { status: 'published' }));
    await assertFails(updateDoc(doc(asUser(USER_B), 'kfgMissions', 'm1'), { title: 'hijack' }));
  });

  test('participations are visible to the participant and the mission creator only', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'kfgParticipations', `m1_${USER_B}`), { uid: USER_B, missionId: 'm1', missionCreatorId: USER_A, status: 'joined' });
      await setDoc(doc(db, 'kfgParticipations', `m1_${USER_B}`, 'private', 'qr'), { secret: 's' });
    });
    await assertSucceeds(getDoc(doc(asUser(USER_B), 'kfgParticipations', `m1_${USER_B}`)));
    await assertSucceeds(getDoc(doc(asUser(USER_A), 'kfgParticipations', `m1_${USER_B}`)));
    await assertFails(getDoc(doc(asUser(USER_C), 'kfgParticipations', `m1_${USER_B}`)));
    await assertSucceeds(getDoc(doc(asUser(USER_B), 'kfgParticipations', `m1_${USER_B}`, 'private', 'qr')));
    await assertFails(getDoc(doc(asUser(USER_A), 'kfgParticipations', `m1_${USER_B}`, 'private', 'qr')));
  });

  test('the ledger is readable only by its owner', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'kfgLedger', 'e1'), { uid: USER_A, delta: 250 });
    });
    await assertSucceeds(getDoc(doc(asUser(USER_A), 'kfgLedger', 'e1')));
    await assertFails(getDoc(doc(asUser(USER_B), 'kfgLedger', 'e1')));
    await assertFails(updateDoc(doc(asUser(USER_A), 'kfgLedger', 'e1'), { delta: 9999 }));
  });

  test('the app\'s list queries are allowed, and only for your own data', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'admins', ADMIN), {});
      await setDoc(doc(db, 'kfgParticipations', `m1_${USER_B}`), { uid: USER_B, missionId: 'm1', missionCreatorId: USER_A, status: 'joined' });
      await setDoc(doc(db, 'kfgMissions', 'm1'), { creatorId: USER_A, status: 'published', startsAt: Timestamp.now() });
      await setDoc(doc(db, 'kfgMissions', 'p1'), { creatorId: USER_A, status: 'pending', startsAt: Timestamp.now() });
    });
    await assertSucceeds(getDocs(query(collection(asUser(USER_B), 'kfgParticipations'), where('uid', '==', USER_B))));
    await assertFails(getDocs(query(collection(asUser(USER_C), 'kfgParticipations'), where('uid', '==', USER_B))));
    await assertSucceeds(getDocs(query(collection(asUser(USER_A), 'kfgParticipations'),
      where('missionId', '==', 'm1'), where('missionCreatorId', '==', USER_A))));
    await assertSucceeds(getDocs(query(collection(asUser(USER_C), 'kfgMissions'), where('status', '==', 'published'))));
    await assertFails(getDocs(query(collection(asUser(USER_C), 'kfgMissions'), where('status', '==', 'pending'))));
    // Admin approval queue (admin-events.tsx) and the creator's "My missions" list.
    await assertSucceeds(getDocs(query(collection(asUser(ADMIN), 'kfgMissions'), where('status', '==', 'pending'), orderBy('startsAt', 'asc'))));
    await assertSucceeds(getDocs(query(collection(asUser(USER_A), 'kfgMissions'), where('creatorId', '==', USER_A), orderBy('startsAt', 'desc'), limit(20))));
    // The "keno" events account reviews the same queue, but not the photo queue.
    const KENO = 'ObDcfgYrUJQVHYhLcyZ5WetCxSE3';
    await assertSucceeds(getDocs(query(collection(asUser(KENO), 'kfgMissions'), where('status', '==', 'pending'), orderBy('startsAt', 'asc'))));
    await assertFails(getDocs(query(collection(asUser(KENO), 'kfgParticipations'), where('reviewState', '==', 'queued'))));
    // Admin photo review queue (kfg/admin.tsx).
    await assertSucceeds(getDocs(query(collection(asUser(ADMIN), 'kfgParticipations'), where('reviewState', '==', 'queued'))));
    await assertFails(getDocs(query(collection(asUser(USER_C), 'kfgParticipations'), where('reviewState', '==', 'queued'))));
  });

  test('mission photo wall: only people who were there, and only if the wall is on', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'kfgMissions', 'w1'), { creatorId: USER_A, status: 'published' });
      await setDoc(doc(db, 'kfgMissions', 'w2'), { creatorId: USER_A, status: 'published', photoWall: false });
      await setDoc(doc(db, 'kfgParticipations', `w1_${USER_B}`), { uid: USER_B, missionId: 'w1', status: 'checkedIn' });
      await setDoc(doc(db, 'kfgParticipations', `w1_${USER_C}`), { uid: USER_C, missionId: 'w1', status: 'joined' });
      await setDoc(doc(db, 'kfgParticipations', `w2_${USER_B}`), { uid: USER_B, missionId: 'w2', status: 'completed' });
    });
    const photo = (uid: string) => ({ uri: 'https://x/y.jpg', uploaderUid: uid, uploaderName: 'B', uploaderAvatarColor: '#999', createdAt: Timestamp.now() });
    await assertSucceeds(addDoc(collection(asUser(USER_B), 'kfgMissions', 'w1', 'photos'), photo(USER_B)));
    await assertFails(addDoc(collection(asUser(USER_C), 'kfgMissions', 'w1', 'photos'), photo(USER_C)));
    await assertFails(addDoc(collection(asUser(USER_B), 'kfgMissions', 'w1', 'photos'), photo(USER_C)));
    await assertFails(addDoc(collection(asUser(USER_B), 'kfgMissions', 'w1', 'photos'), { ...photo(USER_B), extra: 1 }));
    await assertFails(addDoc(collection(asUser(USER_B), 'kfgMissions', 'w2', 'photos'), photo(USER_B)));
    await assertSucceeds(getDocs(collection(asUser(USER_C), 'kfgMissions', 'w1', 'photos')));
  });

  test('mission chat: creator and participants only, closes 24h after the start', async () => {
    const soon = Timestamp.fromMillis(Date.now() + 3600_000);
    const old = Timestamp.fromMillis(Date.now() - 30 * 3600_000);
    await seed(async (db) => {
      await setDoc(doc(db, 'kfgMissions', 'c1'), { creatorId: USER_A, status: 'published', startsAt: soon, participantIds: [USER_B] });
      await setDoc(doc(db, 'kfgMissions', 'c2'), { creatorId: USER_A, status: 'published', startsAt: old, participantIds: [USER_B] });
    });
    const msg = (uid: string) => ({ userId: uid, text: 'γεια', timestamp: Timestamp.now(), reactions: {} });
    await assertSucceeds(addDoc(collection(asUser(USER_A), 'kfgMissions', 'c1', 'messages'), msg(USER_A)));
    await assertSucceeds(addDoc(collection(asUser(USER_B), 'kfgMissions', 'c1', 'messages'), msg(USER_B)));
    await assertFails(addDoc(collection(asUser(USER_C), 'kfgMissions', 'c1', 'messages'), msg(USER_C)));
    await assertFails(addDoc(collection(asUser(USER_B), 'kfgMissions', 'c1', 'messages'), msg(USER_A)));
    await assertFails(addDoc(collection(asUser(USER_B), 'kfgMissions', 'c2', 'messages'), msg(USER_B)));
  });

  test('mission kudos and reconnect swipes: only between people who were there', async () => {
    await seed(async (db) => {
      await setDoc(doc(db, 'kfgMissions', 'k1'), { creatorId: USER_A, status: 'published', presentIds: [USER_B, USER_C] });
    });
    const kd = (db: Firestore, target: string) => doc(db, 'kfgMissions', 'k1', 'kudos', target);
    await assertSucceeds(setDoc(kd(asUser(USER_B), USER_C), { kudos: [USER_B] }));
    await assertFails(setDoc(kd(asUser(USER_C), USER_C), { kudos: [USER_C] }));
    await assertFails(setDoc(kd(asUser(USER_A), USER_C), { kudos: [USER_B, USER_A] }));
    await assertFails(setDoc(kd(asUser(USER_B), USER_A), { kudos: [USER_B] }));
    await assertFails(updateDoc(kd(asUser(USER_C), USER_C), { kudos: [] }));
    await assertSucceeds(updateDoc(kd(asUser(USER_B), USER_C), { kudos: [] }));
    await assertSucceeds(addDoc(collection(asUser(USER_B), 'kfgMissions', 'k1', 'swipes'), { fromUid: USER_B, toUid: USER_C, direction: 'interested' }));
    await assertFails(addDoc(collection(asUser(USER_A), 'kfgMissions', 'k1', 'swipes'), { fromUid: USER_A, toUid: USER_C, direction: 'interested' }));
  });

  test('trust scores are not readable by users', async () => {
    await seed(async (db) => { await setDoc(doc(db, 'kfgTrust', USER_A), { score: 0.5 }); });
    await assertFails(getDoc(doc(asUser(USER_A), 'kfgTrust', USER_A)));
    await assertFails(getDoc(doc(asUser(USER_B), 'kfgTrust', USER_A)));
  });

  test('anyone can pick a character, but not slip points in with it', async () => {
    const db = asUser(USER_A);
    const empty = { head: null, face: null, neck: null };
    await assertFails(setDoc(doc(db, 'kfgProfiles', USER_A), { character: 'dragon', equipped: empty }));
    await assertFails(setDoc(doc(db, 'kfgProfiles', USER_A), { character: 'fox', equipped: empty, lifetimePoints: 5000 }));
    await assertFails(setDoc(doc(asUser(USER_B), 'kfgProfiles', USER_A), { character: 'fox', equipped: empty }));
    await assertSucceeds(setDoc(doc(db, 'kfgProfiles', USER_A), { character: 'fox', equipped: empty }));
    await assertSucceeds(updateDoc(doc(db, 'kfgProfiles', USER_A), { character: 'bear' }));
    await assertFails(updateDoc(doc(db, 'kfgProfiles', USER_A), { character: 'dragon' }));
  });
});
