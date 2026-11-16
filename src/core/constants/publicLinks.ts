// The eventPage Cloud Function (functions/src/index.ts) — a logged-out web
// page for a public event, so a shared link previews and opens without the
// app. Swap this for a custom domain once one is set up.
const EVENT_PAGE_BASE = 'https://us-central1-keno-212fa.cloudfunctions.net/eventPage';

export function publicEventUrl(eventId: string): string {
  return `${EVENT_PAGE_BASE}?id=${eventId}`;
}

const MISSION_PAGE_BASE = 'https://us-central1-keno-212fa.cloudfunctions.net/missionPage';

/** Keno for Good mission page (missionPage Cloud Function) — published missions only. */
export function publicMissionUrl(missionId: string): string {
  return `${MISSION_PAGE_BASE}?id=${missionId}`;
}
