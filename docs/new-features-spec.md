# Keno — Spec for 7 new features

Audience: a coding agent working on the Keno mobile app. Read this whole file before starting. Mockups live in a separate Design canvas artifact (ask the owner for the link): one visual mock per feature, plus the Instagram story designs (1080×1920) for feature 2. The mocks show intent, not final pixels: follow the app's existing design system and components.

> Revision note: an earlier 8-feature draft also proposed "Study buddy" (course-based matching). The owner removed it — it duplicates what Groups/Κοινότητες already does (opt-in, course-specific groups can be created there today), so it's out of scope here.

## 0. Context

Keno is a free event-discovery app for Greek university students. Users verify with a `.gr` university email (or an ID photo fallback). Stack, as far as the privacy policy says: Google Firebase (auth, database, storage, push) and Expo (push routing). Languages: Greek and English (the app has an EL/EN setting) — every new string needs both. Themes: light and dark.

Design tokens (match the existing app first, these are from the website): paper `#FAF7F2`, accent `#B8482A`, accent soft `#F6E4DC`, ink `#1F1B16`, border `#E7DFD3`. Fonts: Lora (headings), Inter (body). Tone: plain, warm, no hype, no dating-app language.

### Existing features: do NOT rebuild or duplicate
For-You/Friends feed with categories and filters (radius, when, my-university-only, solo-friendly); 5 km map; search; event creation with age/university/gender restrictions; private events and join requests; capacity and waitlist with auto-promotion; co-hosts; event editing; QR check-in (rotating 30 s secret) with manual roll-call; collectible tickets (serial = checkInCount); XP staking; private reliability score and no-show sweep; stand-in host claim; Live Mode (tell-a-friend share, safety button with emergency contact and 112, quick photo wall upload, end-event-now); attendee list with mutual connections; plus-one invites with XP and tickets; follow and DMs with read receipts; event chats (expire 24 h after start) and group chats; kudos; private post-event feedback; photo wall (check-in only, 30-day auto-delete); communities/groups (public/private, verified-organiser badge, their own events tab, course-specific groups can already be created here — do not add a parallel matching system for this); "Νέος στην πόλη" newcomer mode; "Έχω κενό" beacon; XP levels, weekly streaks with freeze tokens, badges, quests; leaderboards (check-ins only, university and national); recommend and "see you again" flows; reporting (SLA under 24 h), blocking, content filter; notifications (behaviour-triggered, per-category opt-out); settings (theme, language, notification prefs, interests, visibility, emergency contact, blocked users, feedback, legal); admin queue and events-ingestion pipeline.

### Product principles (do not violate)
- Real attendance is measured by check-in, never by RSVP.
- Notifications are triggered by behaviour, never generic broadcasts. Every new notification type needs a per-category opt-out.
- Not a dating app: no swiping, no matching language.
- Privacy by default. Any new personal data must be added to the Privacy Policy before release (see section 9).
- Free, no ads.
- No new parallel "community" or matching system — Groups already covers persistent multi-person coordination. Course-based, ride-based, or any other affinity grouping belongs inside an existing event/group, not a new entity type.

### Before you start each feature
First search the codebase to check whether it already exists in some form. If it does, tell the owner and adjust scope instead of duplicating.

## 1. Public event link and web page (growth)
**Goal:** Anyone, with or without the app, can open a link to an event and see it. Today sharing exists only in Live Mode and after check-in.

**Behaviour**
- Every public event has a share action that produces `https://<domain>/e/<shortId>`. Private events never produce a public page.
- The page shows: title, date/time, approximate area (not the exact address), host first name and university, attendee count, up to 4 avatars of attendees who allow public visibility, description, category.
- Primary button "Open in Keno": opens the app on that event via a universal link/app link if installed; otherwise sends to the App Store / Google Play (use the same store links as the website).
- Open Graph tags and an auto-generated preview image so the link looks good in Instagram, WhatsApp, and Messenger.
- Restricted events (university-only, gender-restricted, party verified-only) show the title and time but say "Only for <restriction>" and hide the attendee list.

**Data/Backend:** `shortId` on events, a read-only public endpoint (cloud function or hosted page) that returns only the allowed fields above. No exact address, no user ids, no emails.

**Acceptance criteria:** link opens in browser without login; app deep-links when installed; private and restricted events leak nothing beyond what is stated; preview image appears when pasted in WhatsApp.

## 2. Keno Wrapped (growth)
**Goal:** A shareable end-of-semester summary.

**Behaviour:** Shown as an in-app card/story around semester end (January and June) and available any time from Profile. Stats from real check-ins only: events attended, new people met (distinct co-attendees not followed before), longest weekly streak, top category, number of events created. "Share to story" produces a 9:16 image; "Save image" saves it locally. Minimum 3 check-ins to show it; otherwise show an encouraging empty state.

**Data:** computed from existing check-ins and streak data; cache the result per user per period. No new personal data.

**Acceptance criteria:** numbers match the user's actual history; image renders in light and dark; no other user's names appear on the shared image.

### Instagram story cards (part of features 1 and 2)
The target look lives in the Design canvas (ask the owner for the link). Generate them in the app (render a view to an image) so the numbers and names are the user's own.

- **Size:** 1080×1920 (9:16). Keep key content out of the top ~250 px and the bottom ~340 px, where Instagram shows its own UI.
- **Wrapped = 6 slides**, each with its own idea, shared as separate stories or one multi-image share:
  1. **Tickets:** a pile of the user's own collectible tickets from the semester (use each ticket's real art, event name, and serial number).
  2. **Semester map:** a stylised map with a glowing dot for each neighbourhood where they attended, joined by a dotted route. Use approximate areas only, never exact addresses.
  3. **Constellation:** the user in the centre, each event as a cluster, each new person met as a dot. Dots are anonymous (no names).
  4. **Receipt:** an itemised "receipt" of events per category, totals, streak, and "0,00 € — free, as always". Barcode is decorative.
  5. **Persona:** a fun title computed from behaviour (e.g. "Ο σταθερός της Πέμπτης", "αυτός/ή που φέρνει φίλους", "ο πρωινός τύπος", "ο εξερευνητής"), with a few short trait chips and the streak badge. Define 6–8 personas with simple rules and pick the best match.
  6. **Weeks grid:** one square per week of the semester coloured by number of events, plus streak and freeze tokens kept.
- **Event invite = 1 slide** (feature 1): ticket-style card with "one seat for you", event title, day and time, host first name and university, attendee avatars (only users who allow it), a decorative barcode, and the public link as a pill. Use the Instagram Stories sharing intent, passing the image as the background and the public link as the URL where the platform allows.
- Offer "Share to Instagram Stories", the system share sheet, and "Save image".
- Typography: Lora for headings and numbers, Inter for body, a monospace font for the receipt. Colors: terracotta `#B8482A`, paper `#FAF7F2`, ink `#1F1B16`, butter `#F2C879`, sage `#9DB59A`, plum `#5B3A5E`. Wordmark "keno." at the top of every slide.
- Never print other users' names on a shared image. The user's own name appears on the receipt only if they choose to include it (default: first name and initial).
- The exported image always uses the designs in the canvas; light/dark only applies to the in-app preview.

## 3. Pre-event reminder (retention)
**Goal:** Reduce no-shows. (Check first whether this already exists.)

**Behaviour:** For events the user joined, send a push 60 minutes before start: "In 1 hour: <title>. <N> friends are going. Get your ticket." Opens the ticket screen. A setting "Event reminders" in notification preferences, on by default, with a choice of 30 min / 1 h / 2 h. Skip if the user has already checked in or left the event. Skip if the event was cancelled; send an update if time or place changed.

**Backend:** scheduled function or delayed task per joined event; idempotent, handles edits and cancellations.

**Acceptance criteria:** one reminder per event per user; none after check-in; respects opt-out; changes to the start time reschedule it.

## 4. Recurring events (organisers)
**Goal:** "Every Thursday football" created once.

**Behaviour:** In event creation, add "Repeat": once / every week / every 2 weeks, plus days of the week and an end condition (after N occurrences, default 8, max 26). Show the list of generated dates before confirming. Each occurrence is its own event (own attendee list, tickets, check-in, chat, photo wall). Editing: "this event only" or "this and following". Cancelling one occurrence does not cancel the series. Users who joined one occurrence get a gentle prompt to join the next.

**Data:** a `seriesId` on events plus a series document with the rule; generate occurrences ahead of time (e.g. 4 weeks rolling) so the feed stays clean.

**Acceptance criteria:** occurrences appear in feed on the right dates; edit-this-and-following works; capacity, restrictions, and co-hosts copy to new occurrences.

## 5. Organiser stats (organisers)
**Goal:** Show hosts how their events do.

**Behaviour:** A "My events" stats screen: attendance rate (check-ins ÷ joined), no-show rate, unique attendees, returning attendees (2+ events), a simple bar chart of attendance for the last 6 events, average private post-event rating (aggregate only, never individual feedback). Data refreshes after each event ends.

**Privacy:** aggregates only; never show who gave which feedback. Returning attendee counts, not names (names only if the attendee already appears in that host's own attendee lists).

**Acceptance criteria:** numbers reconcile with check-in data; hidden when fewer than 3 finished events; individual feedback is never exposed.

## 6. Ride sharing for events (students)
**Goal:** Connect people travelling to events far from the centre (hikes, trips).

**Behaviour:** The event creator can enable "Rides". Users with a car can offer a ride: departure point (area, not exact address until booked), time, seats, optional cost per person (informational only; no payments in the app). Others book a seat; the driver confirms. After confirmation both can see a DM and exact meeting point. Safety: only verified users, rides show the driver's verification and reliability only as a badge, report/block always available.

**Out of scope:** payments, insurance, or any guarantee — add a short disclaimer in the UI and in Terms (section 9).

**Acceptance criteria:** driver can offer, rider can book and cancel; seat counts update; exact location is revealed only after confirmation.

## 7. Widgets (students)
**Goal:** Next event, ticket, and streak at a glance.

**Behaviour:** iOS and Android home-screen widgets: "Next event" (title, countdown), "Ticket" (title, serial, QR that opens the ticket in the app), "Streak" (weeks, freeze tokens). The rotating QR must not be rendered in the widget (it expires every 30 s): the widget opens the app's ticket screen instead. No widget data when logged out.

**Acceptance criteria:** widgets update when events change; tapping deep-links correctly; nothing sensitive is visible on a locked device beyond event title and time (add a setting to hide it).

## 8. Suggested order
1. Public event link (1), reminder (3).
2. Wrapped (2) with its story cards.
3. Recurring events (4).
4. Organiser stats (5).
5. Ride sharing (6), widgets (7).

Each feature should be shippable on its own behind a feature flag.

## 9. Legal and privacy updates required before release
The Privacy Policy and Terms of Service must be updated by the owner, with legal review, for: public event pages (1), ride sharing data and disclaimer (6), and widgets (7). The agent should list, per feature, exactly which new data is collected and where it is stored, so the owner can update the documents. Do not publish new data collection before the policy is updated.

## 10. Definition of done (all features)
Greek and English strings; light and dark themes; empty, loading, and error states; no regression to check-in, tickets, or streaks; analytics events for main actions; notification opt-outs; basic tests for scheduling and permission rules; short note of what changed for the owner.
