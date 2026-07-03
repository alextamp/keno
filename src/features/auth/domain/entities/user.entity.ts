export interface UserEntity {
  id: string;
  name: string;
  universityEmail: string;
  universityName: string;
  department: string;
  joinedEvents: string[];
  createdEvents: string[];
  following: string[];
  followers: string[];
  bio?: string;
  avatarColor?: string;
  photoUri?: string;
  interests?: string[];
  onboardingDone?: boolean;
  savedEventIds?: string[];
  xp?: number;
  currentStreak?: number;
  longestStreak?: number;
  lastAttendedDate?: string; // ISO date string YYYY-MM-DD
}
