export interface GroupEntity {
  id: string;
  name: string;
  description: string;
  emoji: string;
  coverColor: string;
  creatorId: string;
  memberIds: string[];
  eventIds: string[];
  universityName?: string;
  isPrivate: boolean;
  invitedUserIds: string[];
  createdAt: Date;
}

export const GROUP_COVER_COLORS = [
  '#C94D0A', '#8B3FCC', '#0A8A52', '#2952CC',
  '#CC1F6E', '#CC6B00', '#0891B2', '#DC2626',
];
