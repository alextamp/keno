export interface UserEntity {
  id: string;
  name: string;
  universityEmail: string;
  universityName?: string; // (optional) — can be filled later in Settings
  department?: string; // (optional) — can be filled later in Settings
  age?: number; // (optional) — can be filled later in Settings
  joinedEvents: string[];
  createdEvents: string[];
  following: string[];
  followers: string[];
  bio?: string;
  avatarColor?: string;
  photoUri?: string;
  interests?: string[];
  onboardingDone?: boolean;
  savedEventIds?: string[];
  xp?: number;
  currentStreak?: number;
  longestStreak?: number;
  /** ISO-week id (getISOWeekId, e.g. "2026-W31") of the last week with a
   *  counted check-in — despite the field name, this drives a WEEKLY streak
   *  (see auth.store.ts's updateStreak), not a per-calendar-day one. */
  lastAttendedDate?: string;
  /** Set only for accounts that signed up without a recognised university
   *  email — pending admin review of their uploaded student ID photo. The
   *  photo itself lives at users/{uid}/private/verification, never on this
   *  document, since it's world-readable and a Storage download URL's
   *  embedded token bypasses storage.rules once it's out. */
  idVerificationStatus?: 'pending' | 'approved' | 'rejected';
  /** Awarded to everyone who signed up during closed testing, before the app left beta. */
  isBetaTester?: boolean;
  /** Users this account has blocked. Blocked users' content (events, chat
   *  messages) is filtered out of everything this account sees. */
  blockedUserIds?: string[];
  /** When the Firestore profile doc was created. Used (alongside isBetaTester)
   *  to compute the Beta Tester badge client-side — see BETA_CUTOFF_DATE. */
  createdAt?: Date;
  /** Track attendance history for Anti-Flake system. Format: { eventId: { checkedIn: boolean, xpStaked: number, date: ISO string } } */
  attendanceHistory?: Record<string, { checkedIn: boolean; xpStaked: number; date: string }>;
  /** Reliability score (0-100) calculated from last N events. Used for public badge display. */
  reliabilityScore?: number;
  /** Total real QR/roll-call check-ins ever recorded (events.repository.impl's
   *  checkInWithToken). Used as the ticket serial number source in the
   *  Ticket component — unlike attendanceHistory.length this isn't gated on
   *  an RSVP stake having existed, so it's the accurate lifetime count. */
  checkInCount?: number;
  /** Review summary: count of each review type received from other users. */
  reviewSummary?: { good_friend: number; great_person: number; awesome_vibe: number; total: number };
  /** Who can see this profile in search/discovery ("Ποιοι με βλέπουν" in Settings).
   *  Defaults to 'students' (visible to every verified student). 'connections'
   *  restricts search results (see search.tsx's isVisibleTo) to mutual
   *  follows — one-way followers don't count. */
  profileVisibility?: 'students' | 'connections';
  /** Per-category notification toggles set from Settings. A missing key (or
   *  a missing object entirely) means "on" — this is an opt-out model so
   *  existing users keep receiving everything until they turn something off. */
  notificationPrefs?: { eventReminders?: boolean; groupMessages?: boolean; suggestions?: boolean };
  /** Weekly quest progress (mockup screen 25), keyed by quest id (see
   *  WEEKLY_QUESTS in core/constants/quests.ts). `weekId` is an ISO-week
   *  string (getISOWeekId) — resets are lazy: a stale weekId is treated as
   *  0 progress by the reader/writer rather than a scheduled cron job. */
  weeklyQuests?: Record<string, { progress: number; weekId: string }>;
  /** Banked streak-freeze tokens (mockup screen 25). Consumed automatically
   *  to protect a missed day instead of breaking currentStreak; earned on
   *  level-up, capped at MAX_STREAK_FREEZE_TOKENS. */
  streakFreezeTokens?: number;
  /** Lifetime Profile "Challenges" (join_1, streak_7, etc. — distinct from
   *  the weekly Quests) already paid out their XP for. Unlike weeklyQuests
   *  these never reset, so a plain claimed-once list is enough. */
  claimedChallengeIds?: string[];
  /** Cumulative "how was it?" feedback across every event this account has
   *  hosted (functions/src/index.ts's onEventFeedback aggregates it from
   *  events/{id}/checkIns/{uid}.feedback). A private trust signal — never
   *  shown as a public rating. */
  organiserFeedback?: { good: number; bad: number };
  /** Event id of the first time this account checked in and answered "yes"
   *  to arriving solo — earns a one-time XP bonus and a distinct ticket
   *  label on that specific event's ticket (see Ticket usages). Never
   *  cleared once set, even if that event is later deleted. */
  firstSoloAttendanceEventId?: string;
  /** Optional emergency contact for the Live Mode safety button — a phone
   *  number the "🆘" action messages with the attendee's current event/
   *  location, plus a one-tap 112 dial. Never required to use the app. */
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  /** User-initiated streak protection (research doc #22) — distinct from
   *  the automatic streakFreezeTokens: this is a deliberate "I know I'm
   *  skipping this week for exams" action, capped per semester (see
   *  core/utils/weekId.ts's getSemesterId / MAX_STREAK_PAUSES_PER_SEMESTER).
   *  Count resets whenever semesterId no longer matches the current one. */
  streakPauses?: { semesterId: string; count: number };
  /** Whether this account has an entry in the `admins` collection —
   *  resolved once at load time (see loadUserFromFirestore), not live.
   *  Firestore rules always check the collection directly and immediately,
   *  regardless of this cached value, so a revoked admin loses real access
   *  right away even if this flag doesn't update until their next launch. */
  isAdmin?: boolean;
}
