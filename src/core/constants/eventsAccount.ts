// The existing "Keno" user account that auto-imported events are published
// under — chosen on purpose over a bot/service account so they show up and
// behave exactly like any human-created event (editable, receives join
// requests, etc.) via the normal creatorId == uid checks everywhere else in
// the app. Mirrors scripts/import-events.js's KENO_EVENTS_UID env var — keep
// the two in sync if this ever changes.
//
// keno.app.official@gmail.com ("Keno.")
export const KENO_EVENTS_UID = 'ObDcfgYrUJQVHYhLcyZ5WetCxSE3';
