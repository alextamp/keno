export interface GroupEntity {
  id: string;
  name: string;
  description: string;
  emoji: string;
  coverColor: string;
  /** Optional custom cover photo — when set, it replaces the flat
   *  coverColor + emoji banner/thumb wherever the group is shown. */
  coverPhotoUri?: string;
  creatorId: string;
  memberIds: string[];
  eventIds: string[];
  universityName?: string;
  isPrivate: boolean;
  invitedUserIds: string[];
  /** uid -> message the requester wrote explaining why they should be let in. */
  joinRequests?: Record<string, string>;
  createdAt: Date;
  /** Manually confirmed (by the admin) to genuinely represent a university
   *  club/society — shown as a badge next to the group name. Never
   *  self-service; toggled only from the group screen by an admin (see
   *  core/utils/adminRole.ts). */
  isVerifiedOrganiser?: boolean;
}

export const GROUP_COVER_COLORS = [
  '#B8482A', '#7E52A8', '#3F7A55', '#3A6494',
  '#B2537A', '#A0702C', '#0891B2', '#DC2626',
  '#C2410C', '#4D7C0F', '#0F766E', '#6D28D9',
  '#BE185D', '#B45309', '#1D4ED8', '#059669',
];

export const GROUP_EMOJI_OPTIONS = [
  '🎓', '⚽', '☕', '🎨', '🎸', '📚', '🎮', '🏃',
  '🎭', '🌿', '🤝', '🧪', '🎬', '🍕', '📷', '🧘',
  '🎲', '🏀', '🎤', '✈️', '🐾', '🌊', '🔥', '💡',
];
