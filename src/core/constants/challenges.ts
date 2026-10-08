import { UserEntity } from '@/features/auth/domain/entities/user.entity';
import { Translations } from '@/core/i18n';

export interface ChallengeDef {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  xp: number;
  current: number;
  target: number;
}

// Shared between ProfileTab's compact card and the full /(app)/challenges
// page so both render the exact same list from one definition instead of
// two copies drifting apart.
export function getChallengeDefs(user: UserEntity | null | undefined, t: Translations): ChallengeDef[] {
  if (!user) return [];
  return [
    { id: 'join_1',    emoji: '🎯', title: t.challengeJoin1Title,    desc: t.challengeJoin1Desc,    xp: 10,  current: Math.min(user.joinedEvents.length, 1),    target: 1  },
    { id: 'join_5',    emoji: '⭐', title: t.challengeJoin5Title,    desc: t.challengeJoin5Desc,    xp: 50,  current: Math.min(user.joinedEvents.length, 5),    target: 5  },
    { id: 'join_10',   emoji: '🏆', title: t.challengeJoin10Title,   desc: t.challengeJoin10Desc,   xp: 100, current: Math.min(user.joinedEvents.length, 10),   target: 10 },
    { id: 'join_25',   emoji: '👑', title: t.challengeJoin25Title,   desc: t.challengeJoin25Desc,   xp: 250, current: Math.min(user.joinedEvents.length, 25),   target: 25 },
    { id: 'create_1',  emoji: '📣', title: t.challengeCreate1Title,  desc: t.challengeCreate1Desc,  xp: 25,  current: Math.min(user.createdEvents.length, 1),   target: 1  },
    { id: 'create_5',  emoji: '🎪', title: t.challengeCreate5Title,  desc: t.challengeCreate5Desc,  xp: 125, current: Math.min(user.createdEvents.length, 5),   target: 5  },
    { id: 'streak_3',  emoji: '🔥', title: t.challengeStreak3Title,  desc: t.challengeStreak3Desc,  xp: 15,  current: Math.min(user.currentStreak ?? 0, 3),     target: 3  },
    { id: 'streak_7',  emoji: '💥', title: t.challengeStreak7Title,  desc: t.challengeStreak7Desc,  xp: 30,  current: Math.min(user.currentStreak ?? 0, 7),     target: 7  },
    { id: 'follow_5',  emoji: '👥', title: t.challengeFollow5Title,  desc: t.challengeFollow5Desc,  xp: 15,  current: Math.min(user.following?.length ?? 0, 5),  target: 5  },
    { id: 'follow_10', emoji: '🌐', title: t.challengeFollow10Title, desc: t.challengeFollow10Desc, xp: 25,  current: Math.min(user.following?.length ?? 0, 10), target: 10 },
  ];
}
