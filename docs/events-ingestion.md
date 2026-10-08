# Auto-imported events: ingestion & approval

An automated agent can find candidate events somewhere on the web and feed
them into Keno. They never appear in the app's feed without either (a) the
script itself judging them fully confirmed, or (b) a human approving them
in-app. Nothing from this pipeline ever touches the live `events` collection
except through the two paths below.

## How it works

1. Something (an agent, a manual scrape, whatever) produces a JSON file of
   candidate events in the format below.
2. `scripts/import-events.js` validates each one, maps its category onto
   Keno's real categories, and dedupes against both `events` and
   `eventsPending` by a stable `externalId` (hash of title+date+location) —
   re-running the same input never creates duplicates.
3. For each event that isn't a duplicate:
   - If the script found **nothing** uncertain about it (`needsReview` ends
     up empty) — it writes straight into `events`, exactly like a normal
     human-created event, attributed to the existing "keno" account
     (`KENO_EVENTS_UID`). It's live immediately.
   - Otherwise it goes into `eventsPending` and waits for a decision.
4. Settings → Admin → **Review events** (`admin-events.tsx`) lists everything
   in `eventsPending`, shows what's flagged in `needsReview`, and lets you
   Approve (copies it into `events`, same as above, then deletes the pending
   doc) or Reject (just deletes the pending doc — nothing else happens).

Rejecting isn't a permanent blacklist: if the same event (same externalId)
shows up in a later import run, it'll be considered fresh and go through the
same validation again.

## Input JSON format

An array of objects. One event:

```json
{
  "title": "Βραδιά επιτραπέζιων στο ΟΠΑ",
  "description": "Board game night ανοιχτό σε όλους τους φοιτητές.",
  "category": "Άλλο",
  "dateTime": "2026-11-12T19:00:00+02:00",
  "location": "Φοιτητική Λέσχη ΟΠΑ, Κεφαλληνίας 46, Αθήνα",
  "latitude": 37.9995,
  "longitude": 23.7435,
  "imageUri": "https://example.com/cover.jpg",
  "source": "https://example.com/events/board-game-night",
  "needsReview": []
}
```

| Field         | Required | Notes |
|---------------|----------|-------|
| `title`       | yes      | — |
| `description` | no       | defaults to empty string |
| `category`    | yes      | one of: Καφές, Μπάλα/Αθλητικά, Διάβασμα, Πάρτι, Πεζοπορία, Πολιτισμός, Εθελοντισμός, Άλλο — mapped onto Keno's `coffee/sports/study/party/other/other/other/other` (the last four keep the original label as `customCategory`) |
| `dateTime`    | yes      | ISO 8601, must be in the future |
| `location`    | yes      | free-text address/venue |
| `latitude`/`longitude` | no | both or neither; if absent, `location` is auto-added to `needsReview` (no map pin, not a hard rejection) |
| `maxAttendees`| no       | defaults to 30 |
| `imageUri`    | no       | — |
| `source`      | yes      | the URL this event was found at — events without one are rejected outright |
| `needsReview` | no       | array of field names the agent itself isn't fully confident about, e.g. `["time", "location"]`. **Empty or absent = auto-publish immediately.** |

Note what Keno's event schema does **not** have: per-language title/description
fields (it's one string each — pick a language and be consistent) and no
price/cost field at all (Keno events are free by design).

## Running it

```bash
# See what would happen without writing anything:
node scripts/import-events.js scripts/sample-events.json --dry-run

# Actually import:
node scripts/import-events.js path/to/events.json
# or: npm run import:events -- path/to/events.json
```

## Env vars

| Var | Required | Notes |
|---|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS` | one of these two | path to a service-account JSON file **outside this repo** |
| `FIREBASE_SERVICE_ACCOUNT_JSON`  | one of these two | the service-account JSON contents inline, as a string |
| `KENO_EVENTS_UID` | yes | uid of the existing "keno" account auto-published events are attributed to (`creatorId`) — must match `src/core/constants/eventsAccount.ts`'s `KENO_EVENTS_UID` |

Never commit a service-account key file — `.gitignore` already blocks the
common naming patterns (`*serviceAccount*.json`, `*-firebase-adminsdk-*.json`),
but double-check before `git add` regardless.

### Minimal service-account IAM role

The service account only ever needs to read/write Firestore documents — grant
it **Cloud Datastore User** (or the narrower **Cloud Firestore User** role, if
your GCP project exposes it) on the Firebase project, nothing broader like
Editor/Owner.

## Approving / rejecting (in-app)

Settings → Admin section → **Review events**. Each pending event shows its
`needsReview` flags and a link to `source`. Approve writes it into `events`
(with a fresh check-in QR secret, same as a normal created event) and removes
it from `eventsPending`; Reject just removes it.

## Cleanup of past events

The feed's own query (`getFeedEvents`/`subscribeToFeedEvents`) already only
pulls events from a rolling lookback window and orders by `dateTime` — a
past auto-imported event falls out of the feed the same way any past event
does, no separate TTL needed. `eventsPending` entries have no TTL yet; a
candidate event whose date has already passed by the time someone gets to
reviewing it will still show up in `admin-events.tsx` (reject it) — ask if
you want a scheduled sweep to auto-reject those instead.
