# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Keno — a hyper-local event-sharing app for Greek university students. Expo (SDK 54) + React Native 0.81 + TypeScript + expo-router, Zustand for state, Firebase (Auth/Firestore/Storage) for the backend, plus a small set of Firebase Cloud Functions for push notifications.

## Commands

```
npx expo start              # dev server (use --tunnel for physical devices off the same LAN/behind campus wifi)
npx expo start --tunnel     # tunnel mode — needed most of the time for on-device testing here
npx tsc --noEmit             # typecheck — run this after any non-trivial change, it's the fastest signal
npm run lint                 # eslint . --ext .ts,.tsx
```

There is no test suite in this repo — verification is `tsc --noEmit` plus manual testing on-device via Expo Go or a local build.

### Building

EAS cloud builds run into free-tier quota limits regularly on this project, so **local EAS builds are the fallback** and are the ones actually used to ship:

```
export JAVA_HOME=/opt/homebrew/opt/openjdk@17
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
npx eas build --platform android --profile production --local
```

iOS builds must go through EAS's cloud (no local Xcode signing workflow set up) — `npx eas build --platform ios --profile production`, interactively, since Apple sign-in needs the user present for password/2FA.

### Deploying Firestore/Storage rules

`firebase login` does not work in this dev environment. Rules changes are **never** deployed via `firebase deploy` — copy the rules file to the Desktop and the user pastes it into the Firebase Console manually:

```
cp firestore.rules ~/Desktop/firestore-rules-latest.txt && open ~/Desktop/firestore-rules-latest.txt
cp storage.rules ~/Desktop/storage-rules-latest.txt && open ~/Desktop/storage-rules-latest.txt
```

Cloud Functions deploys (`functions/`) do work via the Firebase CLI when authenticated with a service account (`GOOGLE_APPLICATION_CREDENTIALS`) rather than interactive login.

## Architecture

### Routing

File-based routing via expo-router under `app/`. Two route groups: `(auth)` (sign-in/up, email verification, ID-photo pending-verification) and `(app)` (everything post-login). `app/_layout.tsx` has an `AuthGate` component that owns all top-level redirect logic (signed out → auth screens; signed in but unverified email → stays put; pending ID verification → `/pending-verification`; onboarding incomplete → `/onboarding`) — this is the one place that decides what screen a user should be on, based on `useAuthStore`'s `user`/`isLoading`/`isEmailVerified`.

**The 5 main tabs are not expo-router tab routes.** `app/(app)/index.tsx` is a single screen hosting a `react-native-pager-view` that swipes between `src/screens/{FeedTab,CreateTab,MapTab,GroupsTab,ProfileTab}.tsx`, with a custom tab bar driven by `useTabNavigation` (`src/core/tabNavigation.ts`) for programmatic tab switches from elsewhere in the app.

### Data layer — three coexisting patterns

The codebase mixes three different approaches to talking to Firebase, split by when each feature was built. Know which one a file uses before touching it:

1. **Clean-architecture with `Either<Failure, T>`** (`src/features/events/`, `src/features/groups/`): `domain/entities` + `domain/repositories` (interfaces) + `data/repositories/*.impl.ts` (Firestore calls wrapped in try/catch, returning `left(Failure)` / `right(value)` via `src/core/utils/either.ts`) + `presentation/store` (Zustand, calls the repository and `fold()`s the result). This is the pattern to follow for new event/group functionality.
2. **Unused legacy layer + direct-Firebase store** (`src/features/auth/`): `domain/`, `data/repositories/auth.repository.impl.ts`, and `data/datasources/auth.remote.datasource.ts` exist and implement the same `Either<Failure,T>` pattern as above — but `auth.store.ts` (the Zustand store actually used everywhere) **does not call any of it**. It imports `firebase/auth` and `firebase/firestore` directly and duplicates the logic inline. Don't assume changing `auth.repository.impl.ts` affects app behavior — check `auth.store.ts` first, that's almost certainly the file that needs the change.
3. **Flat direct-Firestore modules, no Either** (`src/features/notifications/`): a plain object (`notificationsRepository`) with async methods that hit Firestore directly and throw on failure, no `Failure`/`Either` wrapping. Simplest pattern, used for notifications only.

On top of this, screens sometimes bypass the repository layer entirely for one-off field updates (e.g. `app/(app)/event/[id].tsx` calls `updateDoc` directly for join-request state, then manually calls the events store's `upsertEvent()` to keep the local cache in sync). This is intentional in those spots (avoids over-abstracting a single dot-notation field write) but means the events/groups Zustand stores are Firestore caches synced from multiple call sites, not the sole owners of writes.

### Firestore security rules mirror app-level authorization

`firestore.rules` encodes per-field write permissions that the client-side code depends on — e.g. non-owners of an event may only touch `attendeeIds`/`waitlistIds`/`reactions`/`joinRequests` (via `onlyChangedFields()`), not arbitrary fields. When adding a new field that non-owners need to write (new join-request-style flow, etc.), it must be added to the relevant `onlyChangedFields([...])` allowlist in `firestore.rules`, or the write will silently fail with a permission-denied error that has nothing to do with the client code being wrong.

`isAdmin()` in `firestore.rules` checks a hardcoded UID that must stay in sync with `ADMIN_UID` in `src/core/constants/admin.ts`, and the same UID literal appears again in `storage.rules` for verification-photo read access. All three must be updated together if the admin account ever changes.

### Environment variables

Firebase config (`src/lib/firebase.ts`) and the Sentry DSN are read from `EXPO_PUBLIC_*` env vars. Locally these come from `.env.local` (gitignored, see `.env.example` for the shape). For EAS builds, these are **not** picked up from `.env.local` — EAS's build archive excludes gitignored files, so they must be set as EAS project environment variables (`eas env:create --environment production --name X --value Y`) or the build ships with `undefined` Firebase config and crashes on launch.

### Notifications

Two independent systems: (1) in-app notifications are Firestore docs under `users/{uid}/notifications/{id}`, created via `notificationsRepository.create()` from whichever repository/screen triggers the event (follow, event join, join-request submitted/accepted, group invite, chat message, etc.), read by `src/features/notifications/notifications.store.ts` via `onSnapshot`. (2) Push notifications are handled by the `onNotificationCreated` Cloud Function (`functions/src/index.ts`), a Firestore trigger on that same subcollection that sends an Expo push via `expo-server-sdk` to the user's `pushToken` field (set on `users/{uid}` by `getExpoPushToken()` in `src/core/utils/eventReminders.ts`). Push notifications do not work in Expo Go (SDK 53+ removed remote push support there) — only in a dev client or standalone build.

### Auth signup flow

The Firestore `users/{uid}` profile doc is **not** created at signup time — it's deferred until the email is actually verified (`ensureUserProfileExists()` in `auth.store.ts`, called from both `onAuthStateChanged` and `reloadAndCheckVerification`). The signup form data is held in `AsyncStorage` under `pendingProfile:{uid}` until then. This is deliberate: it prevents abandoned/fake/typo'd signups from leaving permanent orphaned rows in `users`. There's also a secondary signup path for students without a recognized university email domain (`src/core/utils/validators.ts`'s `KNOWN_UNIVERSITY_DOMAINS`) — they submit a photo ID instead, land in `idVerificationStatus: 'pending'`, and are gated to `/pending-verification` until the admin approves via `app/(app)/admin-verifications.tsx`.

### Design language

"Kid drawing" / hand-drawn aesthetic: `DrawFont` = Comfortaa (chosen for Greek-glyph coverage), primary color `#C94D0A` (burnt orange) on `#F7F3ED` (warm cream), thick 2.5px borders with offset "stamp" shadows on cards/buttons (`src/core/constants/theme.ts`). Light/dark palettes live in `src/core/theme/index.ts` as `LightColors`/`DarkColors`, selected via `useTheme()`. Press feedback (spring-scale + haptic + click sound) is centralized in `AnimatedPressable` / `usePressAnimation` (`src/core/hooks/usePressAnimation.ts`) — reuse it rather than ad-hoc `Pressable` + `Animated` for anything tappable.

### Localization

`src/core/i18n/index.ts` exports `en`/`el` objects matching a single `Translations` type and a `useTranslation()` hook backed by `useLanguageStore`. Adding user-facing text means adding the key to the type and both language objects, not just one.
