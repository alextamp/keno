import * as fs from 'fs';
import * as path from 'path';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, updateDoc, getDoc, addDoc, collection, arrayUnion, Timestamp, Firestore,
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
