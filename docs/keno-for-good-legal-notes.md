# Keno for Good — what needs a Privacy Policy / Terms update

The legal texts have not been edited. This lists what the Keno for Good feature
does with personal data, so the Privacy Policy and Terms can be updated (with
legal review) before the feature is switched on (`FEATURES.kenoForGood`).

## New personal data

| Data | Where | Who can see it | How long |
|---|---|---|---|
| Missions joined, check-in / check-out times | `kfgParticipations` | the user, the mission's organizer, admins | while the account exists |
| QR scan records (who scanned whom, when) | `kfgVerifications` | the user, admins | while the account exists |
| Group-mission confirmations ("X was there") | `kfgVerifications` | the voter, admins | while the account exists |
| Trust score (0–1, from group confirmations) | `kfgTrust` | admins only (server-side) | while the account exists |
| Points, level, streak, monthly score, rank snapshot | `kfgProfiles`, `kfgLedger` | profile: any signed-in user; ledger: the user, admins | ledger kept after account deletion **with the uid removed** |
| Owned / worn character items | `kfgProfiles/{uid}/cosmetics` | any signed-in user | while the account exists |
| Before/after photos (EXIF stripped on upload) | Storage `kfg-photos/{uid}/` | the user, admins | while the account exists (no automatic deletion yet) |
| Photo GPS position + time (sent by the app at capture) | `kfgVerifications` | the user, admins | coordinates deleted 30 days after upload (unless still under review) |
| Face count from Google Cloud Vision | `kfgVerifications` | the user, admins | while the account exists |
| Monthly leaderboard (name, photo, university, points of the top 100) | `kfgLeaderboards` | any signed-in user | kept as monthly history |
| Organization flag on an account | `users.isOrganization` | any signed-in user | while the account exists |

## Points to cover

1. **Photos are processed by Google Cloud Vision** (face detection) — a new processor use. Photos with faces go to manual review; the rules ask users never to photograph people, but bystanders can still appear.
2. **Location at photo capture** — collected only for photo missions, only at the moment of the photo, after the OS permission prompt; used to check both photos are from the same spot; kept 30 days.
3. **Trust score** — an automated score from peer confirmations that decides whether a group-mission participant is credited. Explain it plainly (Art. 13/22 transparency).
4. **Partner organizations** see the names of the people who signed up for their missions and their check-in/out times. They act on our platform, but the Terms should say what they may and may not do with this.
5. **Monthly prize** — a contest with a prize needs contest terms (eligibility, how winners are picked, ties, how the prize is delivered, tax, disqualification for abuse). **Users can be 17**: a prize for minors may need parental consent or an age limit for prize eligibility.
6. **Volunteering is not employment or insurance** — Keno doesn't insure participants; the partner organization is responsible for safety on site. Disclaimer in the Terms, similar to the ride-sharing one.
7. **Student-created missions** — Keno reviews them before they're published but doesn't supervise them. Disclaimer.
8. **Account deletion** removes all KfG data except the points ledger, which is kept without the user id so past leaderboards stay consistent. Mention this.
9. **Photos aren't auto-deleted** today (unlike the event photo wall, 30 days). Decide a retention period; it's a small change in `kfgSweepPhotoLocations`.
