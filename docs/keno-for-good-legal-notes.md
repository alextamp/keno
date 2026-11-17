# Keno for Good — what needs a Privacy Policy / Terms update

Updated 17 Nov 2026 to cover the whole feature as built on `feature/keno-for-good`.

The legal texts have not been edited. This lists what Keno for Good (KfG — the
volunteering section of the app) does with personal data and what it lets
people do, so the Privacy Policy and Terms can be updated before the feature
is switched on for store builds (`FEATURES.kenoForGood`, currently dev-only).

**Where the current legal texts live** (all must stay in sync):
`docs/privacy/index.html`, `docs/terms/index.html`, `privacy.html`, `terms.html`
(repo root). Author line: "Alex Tampakis". Contact: keno.app.official@gmail.com.

## What KfG is (for the writer)

Inside the app, a separate green "world" with tabs Actions · Communities ·
Leaderboard · Character. Students and verified **partner organizations**
(food banks, shelters, municipalities — flagged by an admin, signup is the same)
create volunteer **missions**. Students' missions are reviewed by the Keno team
before they go live. People sign up, the organizer verifies they were there
(QR scan, manual roll-call, group confirmation, or before/after photos), and
the **server** awards KfG points. Points unlock levels, characters and
cosmetic items, and rank people on a monthly leaderboard with prizes for the
top 3. **KfG points are separate from the app's XP** and can't be bought.

## Personal data

| Data | Where | Who can see it | How long |
|---|---|---|---|
| Missions joined, status, check-in / check-out times | `kfgParticipations` | the user, the mission's creator, admins | while the account exists |
| Who signed up / who was actually there (`participantIds`, `presentIds`) | mission doc | **any signed-in user** (published missions) | while the mission exists |
| Waitlist, co-hosts, stand-in host | mission doc | any signed-in user | while the mission exists |
| Join requests to private missions, incl. the requester's message | mission doc `joinRequests` | any signed-in user (same as private events today) | until decided |
| Plus-one invites (who invited whom) | mission doc `invites` | any signed-in user | while the mission exists |
| QR / roll-call scan records (who scanned whom, when, how) | `kfgVerifications` | the user, admins | while the account exists |
| Group-mission confirmations ("X was there") | `kfgVerifications` | the voter, admins | while the account exists |
| Trust score (0–1, from group confirmations) | `kfgTrust` | admins only (server-side) | while the account exists |
| Points, level, streak, monthly score, rank snapshot | `kfgProfiles`, `kfgLedger` | profile: any signed-in user; ledger: the user, admins | ledger kept after account deletion **with the uid removed** |
| Character and owned / worn cosmetic items | `kfgProfiles/{uid}` | any signed-in user | while the account exists |
| Claimed weekly quests / challenges | `kfgProfiles/{uid}/claims` | the user only | while the account exists |
| Before/after verification photos (EXIF stripped on upload) | Storage `kfg-photos/{uid}/` | the user, admins | **deleted 30 days after the decision** (approved / rejected / expired); kept while still in review |
| Photo GPS position + time (sent by the app at capture) | `kfgVerifications` | the user, admins | coordinates deleted 30 days after upload (unless still under review) |
| Face count from Google Cloud Vision | `kfgVerifications` | the user, admins | while the account exists |
| Mission photo wall (photos people upload after attending) | `kfgMissions/{id}/photos` + Storage | any signed-in user | **deleted after 30 days** (same sweep as events) |
| Mission chat messages + typing indicator | `kfgMissions/{id}/messages` | any signed-in user can read; only creator/participants can post | chat closes 24h after the start, messages deleted by the daily sweep |
| Kudos given/received between attendees | `kfgMissions/{id}/kudos` | any signed-in user | while the mission exists |
| "Θα ξαναβρεθούμε;" reconnect swipes | `kfgMissions/{id}/swipes` | only the person who swiped; a mutual match opens a DM | while the account exists |
| "Recommend" after a mission | `users/{uid}/reviews` | as for events | as for events |
| Private "how was it?" feedback (good/bad) | participation + counts on the mission + creator's `organiserFeedback` | the user; totals: the creator (organiser stats). Note `organiserFeedback` sits on the public user doc, as for events | while the account exists |
| "Did you come alone?" answer | participation `arrivedSolo` | the user; **other people who also came alone to the same mission get a notification with your name** (solo-buddy nudge) | while the account exists |
| Communities (members, chat, join requests, invites) | `groups` with `scope: 'kfg'` | as for regular groups | as for regular groups |
| Rides to a mission (driver, seats, departure area/time; meeting point only to confirmed riders) | `kfgMissions/{id}/rides` | as for event rides | as for event rides |
| Mission reports (reporter, reason, reported creator) | `reports` | admins | until handled |
| Organization flag on an account | `users.isOrganization` | any signed-in user | while the account exists |
| Monthly leaderboard (name, photo, university, points of the top 100) | `kfgLeaderboards` | any signed-in user | kept as monthly history |

**On the device only (not sent to Keno):** local "starts soon" reminders,
missions added to the phone's calendar, Wrapped/ticket images the user saves
or shares.

## Public on the web (no login)

Published missions have a public web page (`missionPage` Cloud Function, link
shared from the app): title, date/time, **area label only** (never the exact
address), cause, description, cover photo, number of volunteers / capacity,
points, and the organizer — **organizations by full name, students by first
name only**. Private (unpublished, pending, rejected, cancelled) missions have
no page.

## Notifications (push + in-app)

New types: mission approved/rejected, new volunteer joined (to the creator),
mission cancelled, new mission in your community, starts soon, moved off the
waitlist, join request / request accepted, invite, mission chat message,
**"a friend is going"** (sent to the joiner's followers, max 20 — reveals that
they joined), **solo-buddy** (see above), reconnect match. Users can turn off
the "suggestions" category (covers friend-going and new-in-community) and
event reminders in Settings.

## Points to cover

1. **Google Cloud Vision** processes verification photos (face detection) — a new processor. Photos with faces go to manual review; the rules ask users never to photograph people, but bystanders can appear.
2. **Location at photo capture** — only for photo missions, only at the moment of the photo, after the OS permission prompt; used to check both photos are from the same spot; kept 30 days.
3. **Trust score** — automated score from peer confirmations that decides whether a group-mission participant is credited. Explain plainly (GDPR Art. 13/22 transparency).
4. **Attendance is visible to other users**: who signed up and who actually came are shown on the mission page to any signed-in user, plus kudos, photo wall, chat. Same model as events, but say it.
5. **Partner organizations** see sign-ups, check-in/out times, and can run roll-call. They act on our platform; the Terms should say what they may and may not do with participants' data.
6. **Co-hosts and stand-in hosts** — the creator can make a participant a co-host; if the creator doesn't show up, a participant can take over and verify others. Nobody can verify themselves.
7. **Monthly prize** — a contest with a prize needs contest terms (eligibility, how winners are picked, ties, delivery, tax, disqualification for abuse). **Decided: prizes are for adults only (18+).** Users can be 17; minors still rank on the leaderboard but can't win — the prize passes to the next adult. Eligibility needs an age of 18+ stated in the profile (users without an age set aren't eligible until they add it). Winners = the first 3 eligible people when the month closes (`prizeWinnerUids` on the final leaderboard).
8. **Points have no cash value**, can't be bought, sold or transferred; quests, plus-one bonuses and character purchases are in-app only. Keno can reverse points obtained by abuse (already done server-side for rejected photos).
9. **Volunteering is not employment or insurance** — Keno doesn't insure participants; the organizer (partner or student) is responsible for safety on site. Disclaimer, like the rides one.
10. **Student-created missions** — reviewed before publishing but not supervised. Disclaimer.
11. **Photo wall consent** — attendees can post photos of a mission; the creator can turn the wall off (e.g. shelters, soup kitchens). Ask users not to post identifiable photos of the people being helped. 30-day deletion.
12. **Public mission web page** — what is published (see above) and that organizers' names appear on it.
13. **Rides to missions** reuse the existing rides disclaimer — make sure it covers missions, not only events.
14. **Account deletion** removes the user's KfG data (participations, verifications, trust score, profile, cosmetics, claims, photos, place in waitlists / co-hosts / requests / present lists, kudos) and cancels their upcoming missions. The points ledger is kept **without the user id** so past leaderboards stay consistent. Mention this.
15. **Verification photo retention** — before/after photos are deleted 30 days after they're decided (approved, rejected or expired); their location 30 days after upload.
16. **Reporting** — missions can be reported to the Keno team, who can cancel them (same SLA as events).
