# Keno — Full Context for Claude

Paste this whole document into a new Claude conversation when you want help improving, expanding, or reasoning about Keno. It's a complete snapshot as of **18 August 2026**.

---

## 1. What Keno is

Hyper-local events app for Greek university students (iOS + Android). Students discover and join real activities nearby — καφές, μπάλα, διάβασμα, πάρτι, πεζοπορία — instead of texting and scrolling.

- **Tagline:** «λιγότερο scrolling, περισσότερη ζωή»
- **Mission:** students connect by DOING things together and creating real memories, not by messaging.
- **North-star metric:** real-world meetups per weekly-active user. Time-in-app is explicitly NOT a goal.
- **Aesthetic:** hand-drawn illustration style, dark mode default, fully bilingual EL/EN throughout (every user-facing string has both).

## 2. Founder & setup

- Alexandros (Alex) Tampakis — solo founder, ΟΠΑ (AUEB) Statistics student. Support email: keno.app.official@gmail.com.
- Builds solo with Claude Code, AI-speed dev, weekly ship cycles.
- ~6h/day available until universities reopen (late Sept 2026). Growth budget: €300 total.
- Backend: Firebase (Auth, Firestore, Storage, Cloud Functions v2). Sentry for crash reporting. PostHog for analytics. Resend for transactional email. Google Cloud Vision (SafeSearch) for automated image moderation.
- .gr university-email verification is the primary identity gate, with an ID-photo fallback + admin review queue.

## 3. Current traction & store status

- Launched 25 July 2026 on both the App Store and Google Play.
- **~400 registered users as of 18 August 2026** (up from ~300 on 2 Aug) — this is still pre-golden-window traction; universities are on summer break (εξεταστική runs 1–26 Sept, semester starts late Sept). The real test starts with the freshers window ~21 Sept–20 Oct.
- **iOS:** build 7 / v1.2 uploaded to App Store Connect via Transporter (needed as a workaround after EAS cloud-build/submit issues that session). Whether "Submit for Review" was actually clicked was last left unconfirmed — worth checking App Store Connect directly.
- **Android:** v1.2, versionCode 36, confirmed **live** on Google Play (after resolving a versionCode collision from an earlier untracked manual upload; EAS's remote version counter had to be manually bumped to 35 before the successful build landed on 36).
- Decision review date: **9 Nov 2026**. Kill/pivot thresholds: D7 retention <10% OR meetups/WAU <0.15 OR best single campus <150 WAU → stop scaling, run 20 user interviews, consider narrowing scope (e.g. freshers-only or sports-only).

## 4. Tech stack & architecture

- **Frontend:** Expo Router v6 + React Native, TypeScript strict mode, Zustand for state (no Redux, no React Query).
- **Routing (`app/`):** file-based via expo-router. `(auth)` group = signed-out flow (sign-in/up, email verification, forgot-password). `(app)` group = everything behind login (feed, event detail/edit, groups, DMs, messages, search, leaderboard, settings, admin screens, onboarding, swipes).
- `app/_layout.tsx` is the single source of truth for navigation gating (`AuthGate`) — watches auth state, email verification, ID verification status, and onboarding completion to route between auth/onboarding/pending-verification/main app. Also wires up Sentry, font loading, push-notification tap routing, event-reminder sync, and Android back button.
- **Feature modules (`src/features/*`):** `auth`, `events`, `groups`, `reviews`, `swipes`, `notifications` — each follows the same clean-architecture layering: `data/{models,repositories,datasources}` → `domain/{entities,repositories}` → `presentation/store`. Screens only ever talk to a Zustand store, which calls a domain repository interface, implemented against Firestore. Repository methods return `Promise<Either<Failure, T>>` — never throw, always `fold`/`isLeft`.
- **Server-enforced logic** (check-in secrets, stand-in host claims, no-show marking, notification fan-out, referral claims, image moderation) lives in Cloud Functions (`functions/src/index.ts`), not client code — because clients can't be trusted to self-enforce these.
- **Cross-cutting (`src/core/`):** theme system (Warm Paper design, light/dark), i18n (EL/EN, device-locale default), shared constants, `Failure` hierarchy, `either.ts`, calendar sync, local notification scheduling, image upload, validators.
- **Path alias:** `@/*` → `src/*`.
- No test runner configured (no test script, no test files) — verification is manual (`tsc --noEmit`, running on device/emulator) plus a newly-added CI typecheck workflow (see §6).

## 5. Full feature set (what's actually built and shipped)

**Core loop:** For-You feed with category tabs, friends/for-you toggle, radius/when/university/solo-friendly filter sheet; feed is never fully empty (falls back to "opening soon" events + an admin-pinned flagship-event banner); 5km map view; search; event creation with restrictions (age/university/gender/solo-friendly tag); private events + join requests; capacity + waitlist with auto-promotion; co-hosts.

**Check-in & tickets:** QR check-in with a rotating 30-second secret, manual roll-call fallback; a collectible Ticket per event (unique art + serial number); a micro-recap + share-as-image card immediately after check-in; creator-authored "find your group" info shown at check-in; mandatory XP staking on join (scaled to what the joiner can afford); private non-punitive reliability score + automated no-show sweep.

**Live Mode:** a distinct panel on the event page, visible only to people who've actually checked in while the event is ongoing — tell-a-friend share, a discreet 🆘 safety button (messages a pre-set emergency contact + one-tap 112), quick photo-wall upload shortcut, creator-only "end event now."

**Social:** attendee list with mutual-connection counts; plus-one friend invites (rewards both sides with a ticket + XP once the invitee actually checks in, not just installs); follow/DMs; event chat that auto-expires 24h after the event starts (client-closed, enforced in Firestore rules, swept server-side); Kudos reactions on checked-in attendees; private post-event "how was it?" feedback for organiser trust; solo-friendly tagging with a first-solo-attendance ticket and a first-timer welcome ticket.

**Photo wall:** gated to checked-in attendees only; 30-day auto-delete with an in-app notice and save-to-device option beforehand; images now pass through automated moderation (see §6).

**Groups (Ομάδες):** create/join/leave; public and request-to-join private groups; admin-granted verified-organiser badge.

**Gamification:** XP/levels (Freshman → GOAT, plus a founder-only CEO rung); weekly (not daily) streaks with banked freeze tokens and a user-initiated "pause my streak" capped at twice a semester (for εξεταστική); a Regular badge as a separate consistency track from raw volume; verified-checkin badge; group check-in bonus (3+ mutual friends checking into the same event together unlock a Squad ticket + XP); weekly quests; lifetime challenges.

**Leaderboards:** split into "your university" and "all of Greece," check-ins only (never RSVPs), weekly reset.

**Reviews & reconnect:** lightweight one-tap "recommend" between co-attendees; post-event "Θα ξαναβρεθούμε;" mutual-swipe reconnect flow that opens a DM on a match.

**Safety & moderation:** reporting on every profile/event; bidirectional block; ID-photo verification fallback alongside .gr email verification with an admin review queue; content-moderation filter on free-text fields; automated image moderation (Cloud Vision SafeSearch) on uploads; party events default to verified-only; creators can still restrict an event to women-only at creation (the standalone "browse women-only events" feed filter was intentionally removed 28 Jul 2026 — the per-event restriction stays).

**Notifications:** behaviour-triggered only (friend-going, referral-reward, etc.), never generic broadcasts — push + in-app, with per-category opt-out.

**Auth & onboarding:** .gr email verification sends a custom branded email via Resend's default sender (Firebase's own link wasn't reliably clickable for some users — see known issue in §7); ID-photo fallback with a pending-verification screen; inline sign-in banner when email is verified but ID photo isn't yet.

**Settings:** theme (light/dark), language (EL/EN), notification prefs, interests, profile visibility, emergency contact (for Live Mode's safety button), blocked users list, feedback/report, legal links.

## 6. Engineering work done in the most recent session (currently UNCOMMITTED — nothing pushed since commit `22f16cd`)

All of the below is written to the working tree but not yet committed or deployed. `git diff --stat` shows 16 modified files + several new untracked ones (`.github/`, `src/core/utils/adminAuditLog.ts`, `src/core/utils/userSearch.ts`).

- **Two real security exploits closed in `firestore.rules`:** (1) a group creator could self-grant the admin-only `isVerifiedOrganiser` badge via a crafted write — same bug class as an `isFlagship` exploit fixed earlier on events, this time applied to groups; (2) event `attendeeIds` capacity (`maxAttendees`) was never enforced server-side, only in the UI — a scripted client could overbook any event, or two simultaneous joins could both succeed on the last spot. Both closed with field-level `diff().affectedKeys()` guards.
- **Referral XP-farming closed:** new `claimReferral` Cloud Function replaces a client-writable `referredBy` field; verifies the caller is actually attending the event and enforces first-claim-wins.
- **Automated image content moderation:** new `moderateUploadedImage` Cloud Function (Storage `onObjectFinalized` trigger) runs Google Cloud Vision SafeSearch on every uploaded image, deletes flagged ones, and logs to a new `moderationLog` collection. This closes what was the one remaining Tier-0 App Store/Play compliance gap (Apple Guideline 1.2 / Google Play UGC policy require automated objectionable-content filtering on user-uploaded images) — was previously relying on manual reporting only.
- **Rate limiting added to Cloud Functions:** a reusable `checkRateLimit(uid, action, maxCalls, windowMs)` helper (Firestore transaction over a per-user counter doc), wired into `sendVerificationEmail` (1 per 30s — this one costs real money per call via Resend), `claimReferral` (20 per 10 min), `claimStandInHost` (5 per 5 min).
- **Top-level crash net:** `app/_layout.tsx` now wraps the render tree in `Sentry.ErrorBoundary` with a real fallback UI (retry button), replacing what was previously a hard crash to blank white screen on any unhandled render error.
- **Admin audit trail:** new `adminAuditLog` collection + `logAdminAction()` helper, wired into report-dismissal, event-deletion, and ID-verification-decision admin actions. Previously zero record existed of who did what as an admin.
- **User search fixed to actually scale:** previously three separate, partially-broken copies of a client-side substring search capped at 200 users fetched — meaning past ~200 total users, alphabetically-later people became permanently unfindable in search, invite-a-friend, and group-invite flows. This may already have been live at the ~300-400 user mark. Replaced with a single shared `queryUsersByNamePrefix` helper using a proper Firestore prefix-range query (`startAt`/`endAt(x + '')`), applied consistently across `search.tsx`, `group/[id].tsx`, and `event/[id].tsx`.
- **O(n²) Cloud Function fix:** the group check-in bonus logic (checking for 3+ mutual friends checking into the same event) previously scanned the entire event's check-ins collection; rewritten to chunked `where(documentId(), 'in', chunk)` queries scoped to just the caller's own following list.
- **CI added:** new `.github/workflows/typecheck.yml` — two jobs (app `tsc --noEmit`, functions `npm run build`) on Node 20. This is the first automated gate the project has ever had; previously every change shipped on manual verification alone.
- **`npm audit fix` (non-force) run** to close what safe dependency vulnerabilities could be closed without breaking changes.
- **Broken verification email fixed:** Resend's default sender domain only delivers to the account owner's own inbox (a Resend platform restriction, not a bug in this code) — meaning most real users' verification emails were silently failing, masked by a bare `.catch(() => {})` around the Firebase-default-email fallback that made the whole flow report success even when both paths failed. Fixed by removing the broken Resend call path and re-enabling the existing (previously dormant) client-side error UI.
- **`app.json` Gradle fix:** app name had a trailing period (`"keno."`) which breaks Gradle project naming — fixed to `"keno"`.
- Assorted smaller bug fixes earlier in the session: invite-friend modal keyboard covering the input, past events incorrectly showing Tickets inline, live/ongoing events being prematurely bucketed as "past" across feed/map/profile, a feed query silently dropping events past a hardcoded 6-hour cutoff, check-in roll-call allowing double-check-ins and self-check-in.

**None of this has been deployed yet.** Outstanding action items:
- `firebase deploy --only functions,firestore:rules`
- `gcloud services enable vision.googleapis.com` (Cloud Vision API needs to be enabled for the moderation function to work)
- Commit the working tree (nothing committed since `22f16cd`)

## 7. Known open issues / unconfirmed items

- Whether "Submit for Review" was actually completed in App Store Connect for build 7.
- Whether the Play Console content/permission declarations (incl. an "unused" declaration for `READ_MEDIA_VIDEO`, which the app doesn't actually use — image picker is locked to Images only) were saved.
- A "Ιστότοπος" (Website) field 404 in Play Console — missing a `/docs/` path segment; App Store Connect's equivalent field wasn't checked.
- Resend is still on its default/shared sending domain, not a verified custom domain — works for the account owner only until that's set up.
- No Play Console service-account key configured yet for fully automated `eas submit` (manual Transporter upload was used as a workaround this cycle).
- 43 known npm dependency vulnerabilities remain (1 "critical," but it's in a build-time-only tool — Expo's prebuild/dev-client tooling — not something bundled into what end users download; deferred, not urgent).
- No accessibility work anywhere (no `accessibilityLabel`/`accessibilityRole` usage found in a spot-check).
- `npm run lint` has no ESLint config or the `eslint` package installed — currently non-functional.
- Single hardcoded admin UID (`src/core/constants/admin.ts`), string-equality checked everywhere client + rules — no role system, no path to a second moderator, no revocation short of redeploying with a changed constant.
- Push notifications aren't batched — not an active bug, but would need an architecture change if volume grows.

## 8. The 90-day growth plan (27 Jul – 25 Oct 2026, W1–W13)

**Single goal:** ignite ONE Athens campus cluster (beachhead: ΟΠΑ + ΕΜΠ + ΕΚΠΑ) to **≥300 weekly actives by 31 Oct**. Density beats breadth.

**Targets:** D1 ≥40% · D7 ≥20% · D30 ≥10% · meetups/WAU ≥0.4/wk · installs ≥3,000 · MAU ≥1,200 · RSVP→check-in ≥50% · ≥60 events/week created in Athens.

**Roadmap phases:**
- Phase 0 (by 9 Aug) — analytics instrumentation, zero-state rescue, push permission after first join, authenticity pass (no stock photos, honest seeding). ✅ code-complete.
- Phase 1 "Memory Loop" (by 30 Aug) — post-event mutual reconnect, shareable memory recap cards, anti-flake (XP stake + reliability + no-show sweep), solo-buddy matching. ✅ all four appear code-complete — worth confirming they actually work end-to-end in production rather than assuming.
- Phase 2 (by 20 Sept) — freshers mode «Νέος στην πόλη», study-παρέες, coffee beacon. **None of these exist in code yet.**
- Phase 3 (Oct) — feature freeze, only fix friction / scale what data shows works.
- **Freeze list until Nov:** dating/swipe anything, stories/video feed, web app, second city, AI chat.

**Growth engines:** TikTok daily content (pillars: new-in-town, build-in-public, real event recaps, campus rivalry, trends) · Founding Crew: 12–15 ambassadors across ΟΠΑ/ΕΜΠ/ΕΚΠΑ/Πάντειο/ΠΑΔΑ/Πειραιώς (recruit Aug, deploy Sept) · 50 student orgs + ESN outreach · €300 budget split (posters/stickers/ambassador perks/contingency) · Keno Welcome Week 29 Sept–11 Oct (founder-hosted flagship event per campus).

## 9. Current operating mode — important constraint

**Alex paused new feature work on 2 August 2026** to focus on (1) QA/refinement of what already exists — there's no iOS/Android simulator in the dev environment, so real-device testing is Alex's own manual pass, reported back as bugs — and (2) growth execution per the plan above. Nearly everything worth building from the original 40-feature research doc is already shipped at this density; what's left (Semester Wrapped, auto-grouping for large events, cross-campus discovery, seasonal ticket drops, mutual-reveal ratings, interest-based notification targeting) is explicitly gated on the app having more density/scale than it has yet.

**When helping with this project: don't propose brand-new features unprompted.** Treat open-ended requests as bug fixes, polish, reliability/security hardening, or growth/content support — unless Alex explicitly says the feature freeze is lifted.

## 10. Safety non-negotiables

Report SLA <24h; second strike = suspension; party events default verified-only; event creators can restrict an event to women-only (Male/Female/Any at creation) but there's no standalone "browse women-only events" feed filter; no dating mechanics ever get bolted on — romance stays emergent, never a designed mechanic.

## 11. What to help with

Given all of the above, useful directions are: reliability/security hardening of what's shipped; growth/content ideas within the 90-day plan's existing phases; sharpening the Phase 1 "Memory Loop" features that are code-complete but unverified in production; thinking through Phase 2 (freshers mode, study-groups, coffee beacon) implementation *only if/when Alex reopens that work*; and honest critique — Alex wants direct, actionable answers over theory, ships in days not months, and is comfortable with Greek terms mixed into English.
