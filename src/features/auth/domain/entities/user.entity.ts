export interface UserEntity {
  id: string;
  name: string;
  universityEmail: string;
  universityName: string;
  department: string;
  age: number;
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
  /** Set only for accounts that signed up without a recognised university
   *  email — pending admin review of their uploaded student ID photo. */
  idVerificationPhotoUri?: string;
  idVerificationStatus?: 'pending' | 'approved' | 'rejected';
  /** Awarded to everyone who signed up during closed testing, before the app left beta. */
  isBetaTester?: boolean;
  /** When the Firestore profile doc was created. Used (alongside isBetaTester)
   *  to compute the Beta Tester badge client-side — see BETA_CUTOFF_DATE. */
  createdAt?: Date;
}
