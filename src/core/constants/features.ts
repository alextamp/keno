// Kill switches for features that collect or expose new personal data. Per
// the spec, each must stay off in a store release until the Privacy Policy /
// Terms cover it — flip to false before building if they don't yet.
export const FEATURES = {
  /** Public web page for an event (host first name + university become public). */
  publicEventLinks: true,
  /** Ride offers/bookings (departure area, meeting point). Needs a Terms disclaimer. */
  rides: true,
  recurringEvents: true,
} as const;
