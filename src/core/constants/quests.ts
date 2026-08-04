import { IconName } from '@/components/ui/Icon';

// Weekly quests (mockup screen 25). Static config, same style as LEVELS in
// gamification.ts. Progress lives on the user doc at
// `weeklyQuests[questId] = { progress, weekId }` with a lazy reset (see
// core/utils/weekId.ts) — there's no scheduled function that zeroes these
// out at the start of a new ISO week, so every read/write compares the
// stored weekId against the current one first.
export interface WeeklyQuest {
  id: string;
  titleKey: string; // Translations key, resolved by QuestsView
  target: number;
  xp: number;
  icon: IconName;
}

export const WEEKLY_QUESTS: WeeklyQuest[] = [
  { id: 'join_events', titleKey: 'questJoinEvents', target: 2, xp: 30, icon: 'check' },
  { id: 'meet_people', titleKey: 'questMeetPeople', target: 3, xp: 25, icon: 'zap' },
  { id: 'host_event', titleKey: 'questHostEvent', target: 1, xp: 50, icon: 'star' },
  { id: 'checkin_event', titleKey: 'questCheckinEvent', target: 1, xp: 20, icon: 'qr' },
  { id: 'save_events', titleKey: 'questSaveEvents', target: 2, xp: 15, icon: 'bookmark' },
  { id: 'follow_people', titleKey: 'questFollowPeople', target: 2, xp: 20, icon: 'users' },
];

// Max streak-freeze tokens a user can bank at once (mockup shows "2").
export const MAX_STREAK_FREEZE_TOKENS = 2;
