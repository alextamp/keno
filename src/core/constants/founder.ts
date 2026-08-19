// The founder's own uid — used only for the cosmetic, non-earnable CEO
// level rung in gamification.ts (LevelsModal). Deliberately NOT part of the
// admins Firestore collection / isAdmin() permission system: a second
// moderator added there should get real moderation access, not this
// founder-only badge, so the two are kept separate on purpose.
export const FOUNDER_UID = 'Ijfcvx8cqGb1WNnOZxWgGUuGD6N2';
