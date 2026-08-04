import PostHog from 'posthog-react-native';

type EventProperties = Record<string, any>;

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

// No-op locally / in dev builds without a key configured — analytics should
// never be able to break the app or make noise for people testing without
// a .env.local set up.
const client = apiKey
  ? new PostHog(apiKey, { host, enableSessionReplay: false })
  : null;

if (!apiKey && __DEV__) {
  console.log('[analytics] EXPO_PUBLIC_POSTHOG_API_KEY not set — events will not be sent.');
}

export const analytics = {
  /** Associates all future events with this account — call once on sign-in
   *  and whenever the auth listener resolves an existing session. */
  identify(uid: string, properties?: EventProperties) {
    client?.identify(uid, properties);
  },

  /** Clears the association — call on sign-out so the next person on this
   *  device doesn't inherit the previous account's identity. */
  reset() {
    client?.reset();
  },

  track(event: string, properties?: EventProperties) {
    client?.capture(event, properties);
  },
};
