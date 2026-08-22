# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start              # expo start — dev server (scan QR with Expo Go / dev client)
npm run ios            # expo run:ios — build & launch native iOS
npm run android        # expo run:android — build & launch native Android
npm run web            # expo start --web
npm run lint           # eslint . --ext .ts,.tsx
npx tsc --noEmit       # type-check (no dedicated script; tsconfig has strict: true)
```

There is no test runner configured in this repo (no `test` script, no test files). Verify changes by running the app via `npm run ios`/`npm run android` and, for backend logic, via the Firebase emulator (below).

`npm run lint` currently has no ESLint config or `eslint` package installed (not in `package.json` devDependencies) — it will fail until one is added. Don't assume lint output is meaningful until that's fixed.

**Firebase backend** (Cloud Functions, Firestore/Storage rules) lives in this repo too:
```bash
cd functions && npm run build         # tsc compile functions/src -> functions/lib
cd functions && npm run build:watch
cd functions && npm run serve         # build + firebase emulators:start --only functions
firebase deploy --only functions      # deploy Cloud Functions
firebase deploy --only firestore:rules
firebase deploy --only storage
```
Firebase project alias is `keno-212fa` (`.firebaserc`). Client env vars (Firebase config, PostHog key) come from `.env.local` / `EXPO_PUBLIC_*` vars — see `.env.example` for the full list.

**EAS builds** (`eas.json`): profiles are `development`, `preview`, `production`. Production submit config targets App Store (`alextampdias@gmail.com`) and Play internal track.

## Architecture

Expo Router (v6) + React Native app, TypeScript strict mode, Firebase backend (Auth/Firestore/Storage/Functions), Zustand for state, no Redux/React Query.

### Routing (`app/`)
File-based routing via `expo-router`. Two root groups:
- `app/(auth)/` — sign-in, sign-up, email verification, forgot-password. Unauthenticated flow.
- `app/(app)/` — everything behind login: feed (`index.tsx`), event detail/edit, groups, DMs, messages, search, leaderboard, settings, admin screens, onboarding, swipes.

`app/_layout.tsx` is the single source of truth for navigation gating: `AuthGate` watches `useAuthStore` (`user`, `isInitializing`, `isEmailVerified`) plus `user.idVerificationStatus` and `user.onboardingDone` to redirect between `(auth)`, `(app)/onboarding`, `(app)/pending-verification`, and the main app — read this before changing anything about signup/verification/onboarding flow, since routing decisions live here, not in the individual screens. This same file wires up Sentry (`Sentry.wrap(RootLayout)`), font loading, push-notification tap routing, event-reminder syncing, and the Android hardware back button.

### Feature modules (`src/features/*`)
Each feature (`auth`, `events`, `groups`, `reviews`, `swipes`, `notifications`) follows the same clean-architecture-style layering:
```
feature/
  data/
    models/           # Firestore-shaped DTOs, (de)serialization
    repositories/      # concrete Firestore/Cloud Function implementations
    datasources/        # (auth only) raw Firebase Auth calls
  domain/
    entities/          # plain domain types used by UI
    repositories/       # interfaces the data layer implements
  presentation/
    store/              # Zustand store — the only thing screens import
```
Screens/components never talk to Firestore directly — they call a `presentation/store`, which calls a `domain/repositories` interface, implemented in `data/repositories`. Repository methods return `Promise<Either<Failure, T>>` (`src/core/utils/either.ts`, `src/core/errors/failures.ts`) instead of throwing — always `fold`/check `isLeft` rather than wrapping calls in try/catch.

Server-enforced logic (things a client must not be trusted to do itself — check-in secrets, stand-in host claims, no-show marking, notification fan-out) lives in `functions/src/index.ts` as Cloud Functions (`onCall`, Firestore triggers, `onSchedule`), not in the repository impl. When a repository method's docstring says something is "enforced server-side," the actual rule is in `firestore.rules` and/or `functions/src/index.ts`, not in the client code.

### Cross-cutting `src/core/`
- `core/theme/` — `LightColors`/`DarkColors` (Warm Paper design system, see `design/`), `useTheme()` hook, `theme.store.ts` (persisted dark/light preference).
- `core/i18n/` — `useLanguageStore` (EL/EN), defaults to device locale, persisted to AsyncStorage. The app is bilingual throughout; new user-facing strings need both.
- `core/constants/` — theme tokens (spacing, font, radius), color/gamification constants.
- `core/errors/failures.ts` — the `Failure` subclass hierarchy used across all repositories.
- `core/utils/` — `either.ts`, calendar sync, event reminders (local notifications), image upload, validators, sound effects.
- `core/hooks/` — small shared hooks (`usePressAnimation`, `useKeyboardOffset`).

### Shared UI (`src/components/ui/`)
Plain, theme-aware components (`Button`, `Card`, `Input`, `EventCard`, `ScreenHeader`, `Skeleton`, etc.) — no external UI kit. Every component reads colors via `useTheme()` and sizing via `core/constants/theme`, so a new component should follow that pattern rather than hardcoding colors/spacing.

### Path alias
`@/*` → `src/*` (configured in both `tsconfig.json` and `babel.config.js` via `babel-plugin-module-resolver`). Always import from `@/...`, not relative paths across features.

### Metro config gotchas (`metro.config.js`)
- `unstable_enablePackageExports` is force-disabled globally because Firebase v10's `package.json` exports break Metro's resolver ("component not registered" errors).
- It's re-enabled selectively just for `@posthog/core` subpath imports, since PostHog's survey UI needs it.
- Sentry's Metro source-map wrapper is intentionally not wired in (broke dev bundling); only matters for symbolicated prod stack traces.

## Product context

---

# KENO — Project Context Brief
*Paste this into any new Claude session, or drop it in your repo root as `CLAUDE.md` so Claude Code reads it automatically.*
*Last updated: 2 August 2026*

## What Keno is
Hyper-local events app for Greek university students (iOS + Android). Students discover and join real activities nearby — καφές, μπάλα, διάβασμα, πάρτι, πεζοπορία — instead of texting and scrolling. Tagline: **«λιγότερο scrolling, περισσότερη ζωή»**. Hand-drawn aesthetic, dark mode, bilingual EL/EN.

**Mission:** students connect by DOING things together and creating real memories, not by messaging.
**North-star metric:** real-world meetups per weekly-active user. Time-in-app is explicitly NOT a goal.

## Founder & setup
- Alexandros (Alex) Tampakis — solo founder, ΟΠΑ (AUEB) Statistics student. Support email: keno.app.official@gmail.com
- Builds with Claude Code + Antigravity (AI-speed dev, weekly ship cycles)
- ~6h/day available until universities reopen (late Sept 2026); growth budget €300
- Tech: Firebase (Auth, Firestore, Storage), Sentry crash reporting, .gr university-email verification (+ ID fallback)

## Current state (2 August 2026)
- Launched 25 Jul 2026 on both stores; ~300 users as reported by Alex on 2 Aug (unis still closed for summer, so this is pre-golden-window traction, not yet the real test)
- **Alex paused new feature work on 2 Aug** to focus on (1) refining/QA'ing what already exists — there's no iOS/Android simulator set up in the Claude Code dev environment, so real-device testing has to be Alex's own pass, reported back as bugs to fix — and (2) growth execution per the 90-day plan below (TikTok content, Founding Crew recruiting, ASO). Don't propose new features unprompted; treat requests as bug fixes, polish, or growth/content support unless Alex explicitly reopens the freeze.
- Nearly everything worth building from the original 40-feature research doc is now shipped at this density. What's left (Semester Wrapped, auto-grouping for large events, cross-campus discovery, seasonal ticket drops, mutual-reveal ratings, interest-based notification targeting) is explicitly gated on more density than Keno has yet — the doc's own guidance, not a gap.

**Core loop:** For-You feed (category tabs, friends/for-you toggles, radius/when/uni/solo-friendly filter sheet), a feed that's never fully empty (falls back to real "opening soon" events, plus an admin-pinned flagship-event banner), 5km map, search, event creation with restrictions (age/uni/gender/solo-friendly tag), private events + join requests, capacity + waitlist with auto-promotion, co-hosts.

**Check-in & tickets:** QR check-in (rotating 30s secret) with a manual roll-call fallback, a collectible Ticket (per-event variant art, serial number), a micro-recap + share-as-image card right after check-in, creator-authored "find your group" info (text/photo) shown at check-in, mandatory XP staking on join scaled to what the joiner can afford, a private non-punitive reliability score + no-show sweep.

**Live Mode:** a distinct panel on the event page for anyone who's actually checked in while the event is still ongoing — tell-a-friend share, a discreet 🆘 safety button (messages a pre-set emergency contact + one-tap 112), a quick photo-wall upload shortcut, and (creator-only) "end event now."

**Social:** attendee list with mutual-connection counts, plus-one friend invites (from the event page or a profile) that reward both sides with a Plus One ticket + XP once the invitee actually checks in (not just installs), follow/DMs, event chat that now auto-expires 24h after the event starts (closed client-side, enforced in firestore.rules, swept/deleted server-side), Kudos reactions on checked-in attendees, private post-event "how was it?" feedback for organiser trust, solo-friendly tagging + a first-solo-attendance ticket + a welcome ticket for first-timers.

**Photo wall:** gated to people who actually checked in (no lurkers), 30-day auto-delete with an in-app notice and a save-to-device option before it expires.

**Groups (Ομάδες):** create/join/leave, public and request-to-join private groups, admin-granted verified-organiser badge.

**Gamification:** XP/levels (Freshman→GOAT, plus a founder-only CEO rung), weekly (never daily) streaks with banked freeze tokens plus a user-initiated "pause my streak" capped at twice a semester (for εξεταστική), a Regular badge as a consistency track separate from raw volume, a verified-checkin badge, a group check-in bonus (3+ mutual friends all checking into the same event unlock a Squad ticket + XP), weekly quests, lifetime challenges.

**Leaderboards:** split into "your university" and "all of Greece," check-ins only (never RSVPs), weekly.

**Reviews & reconnect:** a lightweight one-tap "recommend" between people who attended together, plus a post-event "Θα ξαναβρεθούμε;" mutual-swipe reconnect flow that opens a DM on a match.

**Safety & moderation:** reporting on every profile/event, bidirectional block, ID-photo verification fallback alongside .gr email verification (with an admin review queue), content-moderation filter on free-text fields, party events default to verified-only, event creators can still restrict to women-only at creation (the dedicated "browse women-only" feed filter was removed 28 Jul).

**Notifications:** behaviour-triggered (friend-going, referral-reward, etc.), never generic broadcasts — push + in-app, with per-category opt-out prefs.

**Auth & onboarding:** .gr email verification now sends a custom branded email via Resend (Firebase's default link wasn't reliably clickable for some users), ID-photo fallback with a pending-verification screen, and an inline sign-in banner when email is verified but the ID photo isn't yet.

**Settings:** theme (light/dark), language (EL/EN), notification prefs, interests, profile visibility, an emergency contact (for Live Mode's safety button), blocked users, feedback/report, legal links.

## The 90-day plan (27 Jul – 25 Oct 2026, W1–W13; full PDF exists)
**Single goal:** ignite ONE Athens campus cluster (beachhead: ΟΠΑ + ΕΜΠ + ΕΚΠΑ) to **≥300 weekly actives by 31 Oct**. Density beats breadth.

**Targets:** D1 ≥40% · D7 ≥20% · D30 ≥10% · meetups/WAU ≥0.4/wk · installs ≥3,000 · MAU ≥1,200 · RSVP→check-in ≥50% · ≥60 events/week created in Athens.

**Product roadmap:** (✅ = confirmed present in code as of 2 Aug scan; ASO/content/ops items can't be verified from code and are left unmarked either way)
- Phase 0 (by 9 Aug): ✅ analytics instrumentation (full funnel events via `analytics.track`), ✅ zero-state rescue (new-user "3 things near you" + never-empty feed fallback), ✅ push permission after first join, authenticity pass (no stock photos, honest seeding, full-Greek copy — a content/ops call, not code-verifiable)
- Phase 1 "Memory Loop" (by 30 Aug): ✅ post-event mutual reconnect «Θα ξαναβρεθούμε;» (swipes feature), ✅ shareable memory recap cards, ✅ anti-flake (mandatory XP stake + reliability badge + no-show sweep), ✅ solo-buddy matching (onCheckIn trigger). **All four appear code-complete already** — worth Alex confirming they actually work end-to-end rather than treating Phase 1 as still-to-build.
- Phase 2 (by 20 Sept): freshers mode «Νέος στην πόλη», study-παρέες, coffee beacon — none of these exist in code yet; load testing + ASO refresh are ops, not code
- Phase 3 (Oct): feature freeze — only fix friction, scale what data says works
- **Freeze list until Nov:** dating/swipe anything, stories/video feed, web app, second city, AI chat

**Growth engines:** TikTok daily (pillars: A βάσεις/new-in-town, B build-in-public founder story, C real event recaps, D campus rivalry, E trends) · Founding Crew: 12–15 ambassadors across ΟΠΑ/ΕΜΠ/ΕΚΠΑ/Πάντειο/ΠΑΔΑ/Πειραιώς (recruit Aug, deploy Sept; 1 event + 2 posts + 1 flyer drop per week) · 50 student orgs + ESN outreach · €300 split: posters 120 / stickers 60 / ambassador perks 80 / contingency 40 · Keno Welcome Week 29 Sept–11 Oct (founder-hosted flagship event per campus)

**Key dates:** βάσεις announced 23 Jul (new-in-town content window OPEN NOW) · εξεταστική 1–26 Sept · semester starts late Sept · golden freshers window ~21 Sept–20 Oct · **decision review 9 Nov** — kill/pivot thresholds: D7 <10% OR meetups/WAU <0.15 OR best campus <150 WAU → stop scaling, run 20 user interviews, consider narrowing (freshers-only or sports-only)

**Weekly rhythm:** plan Mon · build Tue–Thu · ship Fri · host/film weekends · Sunday 20:00 review (automated task exists: "Keno — Sunday Review & Next-Week Plan")

## Safety non-negotiables
Report SLA <24h; second strike = suspension; party events default verified-only; event creators can still restrict an event to women-only (Male/Female/Any at creation) but the dedicated "browse women-only events" feed filter was removed 2026-07-28; no dating mechanics ever bolted on — romance stays emergent.

## Working style
Alex prefers direct, actionable answers over theory. Greek terms welcome. Speed matters — he ships in days, not months.
