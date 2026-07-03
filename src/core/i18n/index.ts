import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { el as dateFnsEl } from 'date-fns/locale';
import { getLocales } from 'expo-localization';

export type AppLanguage = 'en' | 'el';

interface LanguageState {
  language: AppLanguage;
  isLoaded: boolean;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  loadLanguage: () => Promise<void>;
}

const STORAGE_KEY = 'app_language';

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'en',
  isLoaded: false,

  loadLanguage: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === 'en' || stored === 'el') {
        set({ language: stored, isLoaded: true });
      } else {
        // No saved preference — use device locale, defaulting to Greek for el-* locales
        const deviceLang = getLocales()[0]?.languageCode ?? 'en';
        const lang: AppLanguage = deviceLang === 'el' ? 'el' : 'en';
        set({ language: lang, isLoaded: true });
      }
    } catch {
      set({ isLoaded: true });
    }
  },

  setLanguage: async (lang) => {
    set({ language: lang });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  },
}));

// ── Greeting ─────────────────────────────────────────────────────────────────


export function getGreeting(language: AppLanguage, _firstName: string): {
  line1: string;
  line2: string;
} {
  if (language === 'el') {
    return {
      line1: 'λιγότερο scrolling,',
      line2: 'περισσότερη ζωή.',
    };
  }
  return {
    line1: 'less scrolling,',
    line2: 'more living.',
  };
}

// ── Date locale ───────────────────────────────────────────────────────────────

export function getDateLocale(language: AppLanguage) {
  return language === 'el' ? dateFnsEl : undefined;
}

// ── Full translations ─────────────────────────────────────────────────────────

type Translations = {
  // Tab bar
  tabFeed: string;
  tabCreate: string;
  tabMap: string;
  tabGroups: string;

  // Categories
  catAll: string;
  catParty: string;
  catSports: string;
  catStudy: string;
  catChill: string;
  catCoffee: string;
  catOther: string;

  // Feed
  feedFriends: string;
  feedFilterSoon: string;
  feedFilterNearby: string;
  feedForYou: string;
  feedSearchPlaceholder: string;
  feedSearchTypePlaceholder: string;
  feedEmptyFriendsTitle: string;
  feedEmptyFriendsBody: string;
  feedEmptySearchBody: string;
  feedEmptyTitle: string;
  feedEmptyBody: string;
  feedLeaderboardTitle: string;

  // Map
  mapEvents: (n: number) => string;
  mapEmptyTitle: string;
  mapEmptyBody: string;

  // Create
  createPrivateLabel: string;
  createPrivateHint: string;
  createTitle: string;
  createWhoTitle: string;
  createStep1: string;
  createStep2: string;
  createBack: string;
  createPhotoBtnLabel: string;
  createPhotoOptional: string;
  createLabelTitle: string;
  createLabelDescription: string;
  createLabelCategory: string;
  createLabelCustomCategory: string;
  createCustomCategoryPlaceholder: string;
  createLabelDateTime: string;
  createLabelLocation: string;
  createLabelMaxAttendees: string;
  createMaxAttendeesHint: string;
  createTitlePlaceholder: string;
  createDescriptionPlaceholder: string;
  createLocationPlaceholder: string;
  createBtnNext: string;
  createBtnCreate: string;
  createBtnUploading: (p: number) => string;
  createLabelGender: string;
  createLabelAgeRange: string;
  createAgeFrom: string;
  createAgeTo: string;
  createLabelUniversity: string;
  createLabelCommunity: string;
  createCommunityNone: string;
  createGenderAny: string;
  createGenderMale: string;
  createGenderFemale: string;
  createAlertMissingTitle: string;
  createAlertMissingBody: string;
  createAlertBadDateTitle: string;
  createAlertBadDateBody: string;
  createAlertBadMaxTitle: string;
  createAlertBadMaxBody: string;
  createAlertUploadTitle: string;
  createAlertUploadBody: string;
  createAlertSaveError: string;

  // Profile
  profileTitle: string;
  profileEdit: string;
  profileSave: string;
  profileCancel: string;
  profileLabelName: string;
  profileLabelBio: string;
  profileBioPlaceholder: string;
  profileBioEmpty: string;
  profileLabelUniversity: string;
  profileLabelDepartment: string;
  profileRemovePhoto: string;
  profileStreakEvents: (n: number) => string;
  profileStreakEmpty: string;
  profileStreakFire: string;
  profileStreakKeepUp: string;
  profileStatCreated: string;
  profileStatJoined: string;
  profileStatTotal: string;
  profileBadgesTitle: string;
  badgeFirstStep: string;
  badgeVeteran: string;
  badgeSocial: string;
  badgeOrganizer: string;
  badgeOnFire: string;
  badgeMegaphone: string;
  badgeFirstStepDesc: string;
  badgeVeteranDesc: string;
  badgeSocialDesc: string;
  badgeOrganizerDesc: string;
  badgeOnFireDesc: string;
  badgeMegaphoneDesc: string;
  badgeEarned: string;
  badgeNotEarned: string;
  profileTabUpcoming: (n: number) => string;
  profileTabPast: (n: number) => string;
  profileTabSaved: (n: number) => string;
  profileEmptyUpcoming: string;
  profileEmptyPast: string;
  profileEmptySaved: string;
  profileSettings: string;
  profileAlertNameTitle: string;
  profileAlertNameBody: string;
  profileAlertBioTitle: string;
  profileAlertPermTitle: string;
  profileAlertPermBody: string;
  profileAlertPhotoTitle: string;
  profileAlertPhotoBody: string;
  profileNudgeTitle: string;
  profileNudgeBio: string;
  profileNudgePhoto: string;
  profileNudgeInterests: string;

  // Group chat
  groupChatTitle: string;
  groupChatEmpty: string;
  groupChatPlaceholder: string;

  // Settings
  settingsTitle: string;
  settingsSectionAppearance: string;
  settingsDarkMode: string;
  settingsSectionLanguage: string;
  settingsSectionAccount: string;
  settingsUniDept: string;
  settingsSectionInterests: string;
  settingsInterestsEdit: string;
  settingsSectionDanger: string;
  settingsSignOut: string;
  settingsDeleteAccount: string;
  settingsTagline: string;
  settingsUniPlaceholder: string;
  settingsDeptPlaceholder: string;
  settingsBtnCancel: string;
  settingsBtnSave: string;
  settingsBtnSaving: string;
  settingsAlertSignOutTitle: string;
  settingsAlertSignOutBody: string;
  settingsAlertSignOutBtn: string;
  settingsAlertDeleteTitle: string;
  settingsAlertDeleteBody: string;
  settingsAlertDeleteBtn: string;
  settingsAlertReauthTitle: string;
  settingsAlertReauthBody: string;

  // Search
  searchPlaceholder: string;
  searchEmptyHint: string;
  searchNotFound: (q: string) => string;
  searchFollow: string;
  searchFollowing: string;

  // Event detail
  eventShareBtn: string;
  eventEditBtn: string;
  eventDeleteBtn: string;
  eventReportBtn: string;
  eventReportTitle: string;
  eventReportSpam: string;
  eventReportInappropriate: string;
  eventReportMisinformation: string;
  eventReportSubmitted: string;
  eventReportSubmittedBody: string;
  eventTapToReact: string;
  eventSaved: string;
  eventSaveBtn: string;
  eventInCalendar: string;
  eventAddToCalendar: string;
  eventShareAction: string;
  eventMetaDateTime: string;
  eventMetaLocation: string;
  eventMetaAttendees: string;
  eventFull: string;
  eventSpotsLeft: (n: number) => string;
  eventGoing: (n: number, max: number) => string;
  eventWaitlistCount: (n: number) => string;
  eventAbout: string;
  eventWhosGoing: string;
  eventRestrictions: string;
  eventChatTitle: string;
  eventChatEmpty: string;
  eventChatPlaceholder: string;
  eventChatLocked: (n: number) => string;
  eventBtnJoin: string;
  eventBtnLeave: string;
  eventBtnWaitlist: (n: number) => string;
  eventBtnOnWaitlist: (n: number) => string;
  eventWaitlistHint: string;
  eventYou: string;
  eventGenderAny: string;
  eventGenderMaleOnly: string;
  eventGenderFemaleOnly: string;
  eventDeleteTitle: string;
  eventDeleteBody: string;
  eventReactionHype: string;
  eventReactionFunny: string;
  eventReactionInterested: string;
  eventJoined: string;
  eventFilterAge: string;
  eventShareCta: string;
  eventTyping1: (name: string) => string;
  eventTypingMany: (n: number) => string;
  eventWaitlistSpotOpened: (title: string) => string;
  eventFriendGoing: (n: number) => string;
  eventQrTitle: string;
  eventQrShowBtn: string;
  eventCommentsTitle: string;
  eventCommentsEmpty: string;
  eventCommentsPlaceholder: string;
  eventAnalyticsTitle: string;
  eventAnalyticsViews: string;
  eventAnalyticsSaves: string;
  eventCoHostsTitle: string;
  eventMakeCoHost: string;
  eventRemoveCoHost: string;
  eventCoHostBadge: string;
  eventShareCard: string;
  eventShareWhatsApp: string;
  eventPhotoWall: string;
  eventPhotoWallEmpty: string;
  mutualFriends: (n: number) => string;
  dmTitle: string;
  dmEmpty: string;
  dmPlaceholder: string;
  dmNewMessage: string;
  searchUserMeta: (followers: number, events: number) => string;
  onboardingBioPlaceholder: (dept: string, uni: string) => string;
  groupNamePlaceholder: string;
  groupUniversityPlaceholder: string;

  // Validation errors
  validNameRequired: string;
  validNameMin: string;
  validEmailRequired: string;
  validEmailInvalid: string;
  validEmailUnrecognised: (domain: string) => string;
  validPasswordRequired: string;
  validPasswordMin: string;
  validContentBlocked: string;

  // Event reminder notifications
  reminderTitle: (title: string) => string;
  reminderBody: (location: string) => string;

  // Groups
  groupsTitle: string;
  groupsNewBtn: string;
  groupsTabDiscover: string;
  groupsTabMine: (n: number) => string;
  groupsSearchPlaceholder: string;
  groupsEmptyMine: string;
  groupsEmptyDiscover: string;
  groupsEmptySearch: string;
  groupsMemberBadge: string;
  groupsMembers: (n: number) => string;
  groupsEvents: (n: number) => string;

  // Notifications
  notifTitle: string;
  notifEmptyTitle: string;
  notifEmptyBody: string;
  notifFollow: (name: string) => string;
  notifEventJoin: (name: string, title: string) => string;
  notifEventMessage: (name: string, title: string) => string;
  notifEventInvite: (name: string, title: string) => string;
  notifWaitlistPromoted: (title: string) => string;
  notifEventCancelled: (title: string) => string;
  notifEventReminder: (title: string) => string;
  notifGroupInvite: (name: string, title: string) => string;

  // Group invite UI
  groupInviteTitle: string;
  groupInviteSearch: string;
  groupInviteBtn: string;
  groupInviteSent: string;
  groupPrivateOnly: string;

  // User public profile
  userProfileTitle: string;
  userNotFound: string;
  userFollowing: string;
  userFollow: string;
  userInvite: string;
  userFollowers: string;
  userFollowing2: string;
  userAbout: string;
  userStatCreated: string;
  userStatJoined: string;
  userUpcoming: string;
  userNoUpcoming: string;
  userInviteTo: (name: string) => string;
  userInviteSentTitle: string;
  userInviteSentBody: (name: string, title: string) => string;
  userInviteErrorTitle: string;
  userInviteErrorBody: string;

  // Edit event
  editEventTitle: string;
  editEventBack: string;
  editEventCoverPhoto: string;
  editEventChangeCover: string;
  editEventSave: string;
  editEventSaving: (p: number) => string;
  editEventType: string;

  // Onboarding
  onboardingWelcome: (name: string) => string;
  onboardingWelcomeSub: string;
  onboardingFeature1: string;
  onboardingFeature2: string;
  onboardingFeature3: string;
  onboardingFeature4: string;
  onboardingInterestsTitle: string;
  onboardingInterestsSub: string;
  onboardingInterestsPick: (n: number) => string;
  onboardingPersonaliseTitle: string;
  onboardingPersonaliseSub: string;
  onboardingPickColor: string;
  onboardingBioLabel: string;
  onboardingDoneTitle: string;
  onboardingDoneSub: string;
  onboardingBtnGetStarted: string;
  onboardingBtnContinue: string;
  onboardingBtnBack: string;
  onboardingBtnFinish: string;
  onboardingBtnSaving: string;

  // Auth
  authSignInTitle: string;
  authTagline: string;
  authEmailLabel: string;
  authPasswordLabel: string;
  authSignInBtn: string;
  authNoAccount: string;
  authSignUpLink: string;
  authSignUpTitle: string;
  authSignUpSubtitle: string;
  authNameLabel: string;
  authUniLabel: string;
  authDeptLabel: string;
  authPasswordMin: string;
  authUniHint: string;
  authCreateBtn: string;
  authHaveAccount: string;
  authSignInLink: string;
  authUniRequired: string;
  authDeptRequired: string;
  authErrWrongCredentials: string;
  authErrEmailInUse: string;
  authErrWeakPassword: string;
  authErrInvalidEmail: string;
  authErrTooManyRequests: string;
  authErrNetwork: string;
  authErrGeneric: string;
  authForgotLink: string;
  authForgotTitle: string;
  authForgotSubtitle: string;
  authForgotBtn: string;
  authForgotSent: string;
  authForgotSentBody: string;
  authForgotErrNotFound: string;
  privacyPolicy: string;
  termsOfService: string;
  settingsPrivacy: string;

  // Group detail
  groupStatMembers: string;
  groupStatEvents: string;
  groupStatPrivate: string;
  groupStatPublic: string;
  groupBtnJoin: string;
  groupBtnLeave: string;
  groupPastEvents: string;
  groupNoEvents: string;

  // Group create
  groupNewTitle: string;
  groupPreviewName: string;
  groupLabelIcon: string;
  groupLabelColour: string;
  groupLabelName: string;
  groupLabelDescription: string;
  groupDescriptionPlaceholder: string;
  groupLabelUniversity: string;
  groupPrivateLabel: string;
  groupPrivateSub: string;
  groupCreateBtn: string;

  // Verify email screen
  verifyTitle: string;
  verifyBody: string;
  verifyResent: string;
  verifyResendError: string;
  verifyBtnCheck: string;
  verifyBtnResend: string;
  verifyBtnSignOut: string;

  // Interests
  interestSports: string;
  interestMusic: string;
  interestGaming: string;
  interestStudy: string;
  interestCoffee: string;
  interestArt: string;
  interestParties: string;
  interestHiking: string;
  interestCinema: string;
  interestCooking: string;
  interestTravel: string;
  interestTech: string;
  interestReading: string;
  interestDance: string;
  interestFitness: string;
  interestChess: string;

  // Countdown / time strings
  countdownEnded: string;
  countdownMins: (n: number) => string;
  countdownHours: (n: number) => string;
  countdownTomorrow: string;
  countdownDays: (n: number) => string;
  timeNow: string;
  timeMinsAgo: (n: number) => string;
  timeHoursAgo: (n: number) => string;
  timeYesterday: string;
};

const en: Translations = {
  tabFeed: 'Feed',
  tabCreate: 'Create',
  tabMap: 'Map',
  tabGroups: 'Groups',

  catAll: 'All',
  catParty: 'Party',
  catSports: 'Sports',
  catStudy: 'Study',
  catChill: 'Chill',
  catCoffee: 'Coffee',
  catOther: 'Other',

  feedFriends: 'Friends',
  feedFilterSoon: 'Soon',
  feedFilterNearby: 'Nearby',
  feedForYou: 'For You',
  feedSearchPlaceholder: 'Search events, places...',
  feedSearchTypePlaceholder: 'Search by type — yoga, debate, hiking...',
  feedEmptyFriendsTitle: 'No friends events',
  feedEmptyFriendsBody: 'Follow people to see their events here!',
  feedEmptySearchBody: 'Try a different search term, or create this type of event yourself!',
  feedEmptyTitle: 'Nothing here yet',
  feedEmptyBody: 'Be the first to post something for your campus!',
  feedLeaderboardTitle: 'Top Universities This Week',

  mapEvents: (n) => `${n} event${n !== 1 ? 's' : ''}`,
  mapEmptyTitle: 'No pinned events nearby',
  mapEmptyBody: 'Events show up here once someone drops a pin for an exact spot. Try a different filter or check back later.',

  createTitle: 'New event',
  createWhoTitle: 'Who can join?',
  createStep1: 'Step 1 of 2 — The basics',
  createStep2: 'Step 2 of 2 — Set your filters',
  createBack: '← Back',
  createPhotoBtnLabel: 'Add a cover photo',
  createPhotoOptional: 'optional',
  createLabelTitle: 'Title',
  createLabelDescription: 'Description (optional)',
  createLabelCategory: 'Category',
  createLabelCustomCategory: 'What type of event is it?',
  createCustomCategoryPlaceholder: 'e.g. Yoga, Photography, Debate...',
  createLabelDateTime: 'Date & Time',
  createLabelLocation: 'Location',
  createLabelMaxAttendees: 'Max attendees',
  createMaxAttendeesHint: 'Between 2 and 100',
  createTitlePlaceholder: '5x5 football, study session, coffee...',
  createDescriptionPlaceholder: 'Details, what to bring, dress code...',
  createLocationPlaceholder: 'AUEB library, Exarcheia square...',
  createBtnNext: 'Next →',
  createBtnCreate: 'Create event',
  createBtnUploading: (p) => `Uploading photo... ${p}%`,
  createLabelGender: 'Gender',
  createLabelAgeRange: 'Age range',
  createAgeFrom: 'From',
  createAgeTo: 'To',
  createLabelUniversity: 'University',
  createLabelCommunity: 'Post to community',
  createCommunityNone: 'None',
  createGenderAny: 'Any',
  createGenderMale: 'Male',
  createGenderFemale: 'Female',
  createAlertMissingTitle: 'Missing info',
  createAlertMissingBody: 'Title and location are required.',
  createAlertBadDateTitle: 'Invalid date',
  createAlertBadDateBody: 'Event must be in the future.',
  createAlertBadMaxTitle: 'Invalid',
  createAlertBadMaxBody: 'Max attendees must be between 2 and 100.',
  createAlertUploadTitle: 'Upload failed',
  createAlertUploadBody: 'Could not upload the cover photo. The event will be created without it.',
  createAlertSaveError: 'Error',
  createPrivateLabel: 'Private Event',
  createPrivateHint: 'Only invited people can join',

  profileTitle: 'Profile',
  profileEdit: 'Edit',
  profileSave: 'Save',
  profileCancel: 'Cancel',
  profileLabelName: 'Name',
  profileLabelBio: 'Bio',
  profileBioPlaceholder: 'Tell people about yourself...',
  profileBioEmpty: 'Tap Edit to add a bio',
  profileLabelUniversity: 'University',
  profileLabelDepartment: 'Department',
  profileRemovePhoto: 'Remove photo',
  profileStreakEvents: (n) => `${n} event${n !== 1 ? 's' : ''} this week`,
  profileStreakEmpty: 'Join an event to get the flame going!',
  profileStreakFire: "You're on fire! 🔥",
  profileStreakKeepUp: 'Keep it up!',
  profileStatCreated: 'Created',
  profileStatJoined: 'Joined',
  profileStatTotal: 'Total',
  profileBadgesTitle: '🏅 Badges',
  badgeFirstStep: 'First step',
  badgeVeteran: 'Veteran',
  badgeSocial: 'Social',
  badgeOrganizer: 'Organizer',
  badgeOnFire: 'On fire',
  badgeMegaphone: 'Megaphone',
  badgeFirstStepDesc: 'Join your first event on Keno.',
  badgeVeteranDesc: 'Attend 5 or more events.',
  badgeSocialDesc: 'Follow 5 or more people.',
  badgeOrganizerDesc: 'Create 3 or more events.',
  badgeOnFireDesc: 'Attend events 3 weeks in a row.',
  badgeMegaphoneDesc: 'Create your first event.',
  badgeEarned: '✓ Earned',
  badgeNotEarned: 'Not yet earned',
  profileTabUpcoming: (n) => `📅 Upcoming (${n})`,
  profileTabPast: (n) => `🗂️ Past (${n})`,
  profileTabSaved: (n) => `🔖 Saved (${n})`,
  profileEmptyUpcoming: 'No upcoming events — go explore!',
  profileEmptyPast: 'No past events yet',
  profileEmptySaved: 'Tap 🏷️ on any event to save it',
  profileSettings: 'Settings',
  profileAlertNameTitle: 'Name required',
  profileAlertNameBody: 'Please enter your name.',
  profileAlertBioTitle: 'Bio blocked',
  profileAlertPermTitle: 'Permission needed',
  profileAlertPermBody: 'Please allow access to your photo library.',
  profileAlertPhotoTitle: 'Upload failed',
  profileAlertPhotoBody: 'Could not upload photo. Your other changes will still be saved.',
  profileNudgeTitle: 'Complete your profile',
  profileNudgeBio: 'Add a bio',
  profileNudgePhoto: 'Add a photo',
  profileNudgeInterests: 'Pick interests',

  groupChatTitle: 'Chat',
  groupChatEmpty: 'No messages yet — say something!',
  groupChatPlaceholder: 'Message the group...',

  settingsTitle: 'Settings',
  settingsSectionAppearance: 'Appearance',
  settingsDarkMode: 'Dark mode',
  settingsSectionLanguage: 'Language',
  settingsSectionAccount: 'Account',
  settingsUniDept: 'University & department',
  settingsSectionInterests: 'Interests',
  settingsInterestsEdit: 'Edit your interests',
  settingsSectionDanger: 'Danger zone',
  settingsSignOut: 'Sign out',
  settingsDeleteAccount: 'Delete account',
  settingsTagline: 'Keno · built for Greek students 🇬🇷',
  settingsUniPlaceholder: 'University name',
  settingsDeptPlaceholder: 'Department',
  settingsBtnCancel: 'Cancel',
  settingsBtnSave: 'Save',
  settingsBtnSaving: 'Saving…',
  settingsAlertSignOutTitle: 'Sign out',
  settingsAlertSignOutBody: 'Are you sure you want to sign out?',
  settingsAlertSignOutBtn: 'Sign out',
  settingsAlertDeleteTitle: 'Delete account',
  settingsAlertDeleteBody: 'This will permanently delete your account and all your data. This cannot be undone.',
  settingsAlertDeleteBtn: 'Delete',
  settingsAlertReauthTitle: 'Re-authentication required',
  settingsAlertReauthBody: 'For security, please sign out and sign back in before deleting your account.',

  searchPlaceholder: 'Search by name or university...',
  searchEmptyHint: 'Search for students by name, university, or department',
  searchNotFound: (q) => `No users found for "${q}"`,
  searchFollow: '+ Follow',
  searchFollowing: '✓ Following',

  eventShareBtn: 'Share',
  eventEditBtn: 'Edit',
  eventDeleteBtn: 'Delete',
  eventReportBtn: 'Report',
  eventReportTitle: 'Report Event',
  eventReportSpam: 'Spam',
  eventReportInappropriate: 'Inappropriate content',
  eventReportMisinformation: 'Misinformation',
  eventReportSubmitted: 'Report submitted',
  eventReportSubmittedBody: "Thanks for letting us know. We'll review this event.",
  eventTapToReact: 'Tap to react',
  eventSaved: 'Saved',
  eventSaveBtn: 'Save',
  eventInCalendar: 'In calendar',
  eventAddToCalendar: 'Add to calendar',
  eventShareAction: 'Share',
  eventMetaDateTime: 'Date & Time',
  eventMetaLocation: 'Location',
  eventMetaAttendees: 'Attendees',
  eventFull: 'Event is full',
  eventSpotsLeft: (n) => `${n} spot${n !== 1 ? 's' : ''} left`,
  eventGoing: (n, max) => `${n} / ${max} going`,
  eventWaitlistCount: (n) => `${n} on waitlist`,
  eventAbout: 'About',
  eventWhosGoing: "Who's going",
  eventRestrictions: 'Restrictions',
  eventChatTitle: 'Chat',
  eventChatEmpty: 'No messages yet — say something!',
  eventChatPlaceholder: 'Say something...',
  eventChatLocked: (n) => `Join the event to see ${n} message${n !== 1 ? 's' : ''}`,
  eventBtnJoin: 'Join event',
  eventBtnLeave: 'Leave event',
  eventBtnWaitlist: (n) => `Join waitlist (${n})`,
  eventBtnOnWaitlist: (n) => `✓ On waitlist (${n})`,
  eventWaitlistHint: "You'll be notified if a spot opens up",
  eventYou: 'You',
  eventGenderAny: 'Any',
  eventGenderMaleOnly: 'Male only',
  eventGenderFemaleOnly: 'Female only',
  eventDeleteTitle: 'Delete event',
  eventDeleteBody: 'This will permanently delete the event for all attendees.',
  eventReactionHype: 'Hype',
  eventReactionFunny: 'Funny',
  eventReactionInterested: 'Interested',
  eventJoined: '✓ Joined',
  eventFilterAge: 'Age',
  eventShareCta: 'Join on Keno!',
  eventTyping1: (name) => `${name} is typing...`,
  eventTypingMany: (n) => `${n} people are typing...`,
  eventWaitlistSpotOpened: (title) => `A spot opened in "${title}"!`,
  eventFriendGoing: (n) => `${n} friend${n !== 1 ? 's' : ''} going`,
  eventQrTitle: 'QR Check-in',
  eventQrShowBtn: 'Show QR',
  eventCommentsTitle: 'Comments',
  eventCommentsEmpty: 'No comments yet — be the first!',
  eventCommentsPlaceholder: 'Add a comment...',
  eventAnalyticsTitle: 'Your stats',
  eventAnalyticsViews: 'Views',
  eventAnalyticsSaves: 'Saves',
  eventCoHostsTitle: 'Co-hosts',
  eventMakeCoHost: '+ Co-host',
  eventRemoveCoHost: 'Remove',
  eventCoHostBadge: 'Co-host',
  eventShareCard: 'Share card',
  eventShareWhatsApp: 'WhatsApp',
  eventPhotoWall: 'Photo Wall',
  eventPhotoWallEmpty: 'No photos yet. Be the first to share a moment!',
  mutualFriends: (n) => `${n} mutual`,
  dmTitle: 'Messages',
  dmEmpty: 'No conversations yet',
  dmPlaceholder: 'Message...',
  dmNewMessage: '+ New',
  searchUserMeta: (followers, events) => `${followers} followers · ${events} events`,
  onboardingBioPlaceholder: (dept, uni) => `${dept} @ ${uni}. Tell people who you are...`,
  groupNamePlaceholder: 'e.g. AUEB Basketball Crew',
  groupUniversityPlaceholder: 'e.g. AUEB',

  validNameRequired: 'Name is required.',
  validNameMin: 'Name must be at least 2 characters.',
  validEmailRequired: 'Email is required.',
  validEmailInvalid: 'Please use your university email address (must end in .gr).',
  validEmailUnrecognised: (domain) => `"@${domain}" is not a recognised university domain. Contact support if your university is missing.`,
  validPasswordRequired: 'Password is required.',
  validPasswordMin: 'Password must be at least 8 characters.',
  validContentBlocked: 'That contains language we don\'t allow. Please rephrase.',

  reminderTitle: (title) => `Starting soon: ${title}`,
  reminderBody: (location) => `📌 ${location} — in 1 hour`,

  groupsTitle: 'Communities',
  groupsNewBtn: '+ New',
  groupsTabDiscover: '🔍 Discover',
  groupsTabMine: (n) => `👥 Mine (${n})`,
  groupsSearchPlaceholder: 'Search communities...',
  groupsEmptyMine: "You haven't joined any communities yet",
  groupsEmptyDiscover: 'No communities yet — create the first one!',
  groupsEmptySearch: 'No communities found',
  groupsMemberBadge: '✓ Joined',
  groupsMembers: (n) => `${n} member${n !== 1 ? 's' : ''}`,
  groupsEvents: (n) => `${n} event${n !== 1 ? 's' : ''}`,

  notifTitle: 'Notifications',
  notifEmptyTitle: 'All caught up!',
  notifEmptyBody: "When someone follows you, joins your event, or sends a message, it'll show up here.",
  notifFollow: (name) => `${name} started following you`,
  notifEventJoin: (name, title) => `${name} joined your event "${title}"`,
  notifEventMessage: (name, title) => `${name} sent a message in "${title}"`,
  notifEventInvite: (name, title) => `${name} invited you to "${title}"`,
  notifWaitlistPromoted: (title) => `You're in! Moved from waitlist — "${title}" is yours.`,
  notifEventCancelled: (title) => `"${title}" has been cancelled by the organizer.`,
  notifEventReminder: (title) => `Heads up! "${title}" starts soon.`,
  notifGroupInvite: (name, title) => `${name} invited you to the "${title}" community.`,

  groupInviteTitle: 'Invite members',
  groupInviteSearch: 'Search by name…',
  groupInviteBtn: 'Invite',
  groupInviteSent: 'Invited ✓',
  groupPrivateOnly: '🔒 This community is invite-only.',

  userProfileTitle: 'Profile',
  userNotFound: 'User not found',
  userFollowing: '✓ Following',
  userFollow: '+ Follow',
  userInvite: '✉️ Invite',
  userFollowers: ' followers',
  userFollowing2: ' following',
  userAbout: 'About',
  userStatCreated: 'Created',
  userStatJoined: 'Joined',
  userUpcoming: '📅 Upcoming events',
  userNoUpcoming: 'No upcoming events',
  userInviteTo: (name) => `Invite ${name} to…`,
  userInviteSentTitle: 'Invited!',
  userInviteSentBody: (name, title) => `${name} has been invited to "${title}".`,
  userInviteErrorTitle: 'Error',
  userInviteErrorBody: 'Could not send invite. Please try again.',

  editEventTitle: 'Edit event',
  editEventBack: '← Back',
  editEventCoverPhoto: 'Change cover photo',
  editEventChangeCover: 'Change cover photo',
  editEventSave: 'Save changes',
  editEventSaving: (p) => `Uploading... ${p}%`,
  editEventType: 'Event type',

  onboardingWelcome: (name) => `Welcome to Keno${name ? `, ${name}` : ''}!`,
  onboardingWelcomeSub: 'Go outside, meet new people, have fun.',
  onboardingFeature1: 'Discover events near you',
  onboardingFeature2: 'Meet people from your campus',
  onboardingFeature3: 'Explore on the map',
  onboardingFeature4: 'Never miss what matters',
  onboardingInterestsTitle: 'What are you into?',
  onboardingInterestsSub: "Pick at least 3 interests and we'll show you more relevant events.",
  onboardingInterestsPick: (n) => `Pick ${n} more to continue`,
  onboardingPersonaliseTitle: 'Make it yours',
  onboardingPersonaliseSub: 'Choose your profile colour and write a short bio.',
  onboardingPickColor: 'Pick a colour',
  onboardingBioLabel: 'Bio (optional)',
  onboardingDoneTitle: "You're all set!",
  onboardingDoneSub: 'Your profile is ready. Start exploring events happening around your campus right now.',
  onboardingBtnGetStarted: 'Get started',
  onboardingBtnContinue: 'Continue →',
  onboardingBtnBack: '← Back',
  onboardingBtnFinish: "Let's go! 🎉",
  onboardingBtnSaving: 'Saving...',

  authSignInTitle: 'Sign in',
  authTagline: 'less scrolling, more living',
  authEmailLabel: 'University Email',
  authPasswordLabel: 'Password',
  authSignInBtn: 'Sign in',
  authNoAccount: "Don't have an account? ",
  authSignUpLink: 'Sign up',
  authSignUpTitle: 'Create account',
  authSignUpSubtitle: 'Only verified university students can join',
  authNameLabel: 'Full Name',
  authUniLabel: 'University',
  authDeptLabel: 'Department',
  authPasswordMin: 'Min. 8 characters',
  authUniHint: 'Must be a recognised Greek university email (.gr)',
  authCreateBtn: 'Create account',
  authHaveAccount: 'Already have an account? ',
  authSignInLink: 'Sign in',
  authUniRequired: 'University name is required.',
  authDeptRequired: 'Department is required.',
  authErrWrongCredentials: 'Incorrect email or password.',
  authErrEmailInUse: 'This email is already registered.',
  authErrWeakPassword: 'Password must be at least 6 characters.',
  authErrInvalidEmail: 'Invalid email address.',
  authErrTooManyRequests: 'Too many attempts. Please try again later.',
  authErrNetwork: 'No internet connection.',
  authErrGeneric: 'Something went wrong. Please try again.',
  authForgotLink: 'Forgot password?',
  authForgotTitle: 'Reset password',
  authForgotSubtitle: "Enter your university email and we'll send you a reset link.",
  authForgotBtn: 'Send reset link',
  authForgotSent: 'Check your email',
  authForgotSentBody: "If an account exists for that address, a password reset link is on its way.",
  authForgotErrNotFound: 'No account found with that email.',
  privacyPolicy: 'Privacy Policy',
  termsOfService: 'Terms of Service',
  settingsPrivacy: 'Privacy Policy & Terms',

  groupStatMembers: 'Members',
  groupStatEvents: 'Events',
  groupStatPrivate: 'Private',
  groupStatPublic: 'Public',
  groupBtnJoin: '+ Join community',
  groupBtnLeave: '✓ Joined · Leave',
  groupPastEvents: '🕐 Past events',
  groupNoEvents: 'No events yet in this community',

  groupNewTitle: 'New Community',
  groupPreviewName: 'Community name',
  groupLabelIcon: 'Icon',
  groupLabelColour: 'Colour',
  groupLabelName: 'Name *',
  groupLabelDescription: 'Description *',
  groupDescriptionPlaceholder: "What's this community about?",
  groupLabelUniversity: 'University (optional)',
  groupPrivateLabel: 'Private community',
  groupPrivateSub: 'Only visible to invited members',
  groupCreateBtn: 'Create community 🎉',

  verifyTitle: 'Check your inbox',
  verifyBody: "We sent a verification link to your university email. Tap it to activate your Keno account, then come back here.",
  verifyResent: '✓  Email resent — check your inbox.',
  verifyResendError: "Couldn't resend the email — you may be sending too many requests. Try again in a bit.",
  verifyBtnCheck: "I've verified my email",
  verifyBtnResend: 'Resend verification email',
  verifyBtnSignOut: 'Sign out',

  interestSports: 'Sports',
  interestMusic: 'Music',
  interestGaming: 'Gaming',
  interestStudy: 'Study',
  interestCoffee: 'Coffee',
  interestArt: 'Art',
  interestParties: 'Parties',
  interestHiking: 'Hiking',
  interestCinema: 'Cinema',
  interestCooking: 'Cooking',
  interestTravel: 'Travel',
  interestTech: 'Tech',
  interestReading: 'Reading',
  interestDance: 'Dance',
  interestFitness: 'Fitness',
  interestChess: 'Chess',

  countdownEnded: 'ended',
  countdownMins: (n) => `in ${n}m`,
  countdownHours: (n) => `in ${n}h`,
  countdownTomorrow: 'tomorrow',
  countdownDays: (n) => `in ${n}d`,
  timeNow: 'now',
  timeMinsAgo: (n) => `${n}m ago`,
  timeHoursAgo: (n) => `${n}h ago`,
  timeYesterday: 'yesterday',
};

const el: Translations = {
  tabFeed: 'Ροή',
  tabCreate: 'Δημιουργία',
  tabMap: 'Χάρτης',
  tabGroups: 'Ομάδες',

  catAll: 'Όλα',
  catParty: 'Πάρτι',
  catSports: 'Αθλητισμός',
  catStudy: 'Μελέτη',
  catChill: 'Χαλάρωση',
  catCoffee: 'Καφέ',
  catOther: 'Άλλο',

  feedFriends: 'Φίλοι',
  feedFilterSoon: 'Σύντομα',
  feedFilterNearby: 'Κοντά',
  feedForYou: 'Για σένα',
  feedSearchPlaceholder: 'Αναζήτηση εκδηλώσεων...',
  feedSearchTypePlaceholder: 'Τύπος εκδήλωσης — γιόγκα, debate, πεζοπορία...',
  feedEmptyFriendsTitle: 'Καμία εκδήλωση φίλων',
  feedEmptyFriendsBody: 'Ακολούθησε κόσμο για να δεις τις εκδηλώσεις τους!',
  feedEmptySearchBody: 'Δοκίμασε άλλο όρο ή δημιούργησε αυτό το είδος εκδήλωσης!',
  feedEmptyTitle: 'Τίποτα εδώ ακόμα',
  feedEmptyBody: 'Γίνε ο πρώτος που θα ποστάρει για το campus σου!',
  feedLeaderboardTitle: 'Κορυφαία Πανεπιστήμια Αυτή την Εβδομάδα',

  mapEvents: (n) => n === 1 ? '1 εκδήλωση' : `${n} εκδηλώσεις`,
  mapEmptyTitle: 'Δεν υπάρχουν καρφιτσωμένες εκδηλώσεις κοντά',
  mapEmptyBody: 'Οι εκδηλώσεις εμφανίζονται εδώ όταν κάποιος καρφιτσώνει ακριβή τοποθεσία. Δοκίμασε άλλο φίλτρο ή ξανάρθε αργότερα.',

  createTitle: 'Νέα εκδήλωση',
  createWhoTitle: 'Ποιος μπορεί να συμμετάσχει;',
  createStep1: 'Βήμα 1 από 2 — Τα βασικά',
  createStep2: 'Βήμα 2 από 2 — Ορισμός φίλτρων',
  createBack: '← Πίσω',
  createPhotoBtnLabel: 'Προσθήκη εξώφυλλου',
  createPhotoOptional: 'προαιρετικό',
  createLabelTitle: 'Τίτλος',
  createLabelDescription: 'Περιγραφή (προαιρετικό)',
  createLabelCategory: 'Κατηγορία',
  createLabelCustomCategory: 'Τι είδους εκδήλωση είναι;',
  createCustomCategoryPlaceholder: 'π.χ. Γιόγκα, Φωτογραφία, Debate...',
  createLabelDateTime: 'Ημ/νία & Ώρα',
  createLabelLocation: 'Τοποθεσία',
  createLabelMaxAttendees: 'Μέγιστοι συμμετέχοντες',
  createMaxAttendeesHint: 'Μεταξύ 2 και 100',
  createTitlePlaceholder: 'Ποδόσφαιρο 5x5, μελέτη, καφέ...',
  createDescriptionPlaceholder: 'Λεπτομέρειες, τι να φέρετε, dress code...',
  createLocationPlaceholder: 'Βιβλιοθήκη ΑΣΟΕΕ, πλατεία Εξαρχείων...',
  createBtnNext: 'Επόμενο →',
  createBtnCreate: 'Δημιουργία εκδήλωσης',
  createBtnUploading: (p) => `Ανέβασμα φωτογραφίας... ${p}%`,
  createLabelGender: 'Φύλο',
  createLabelAgeRange: 'Ηλικιακό εύρος',
  createAgeFrom: 'Από',
  createAgeTo: 'Έως',
  createLabelUniversity: 'Πανεπιστήμιο',
  createLabelCommunity: 'Δημοσίευση σε κοινότητα',
  createCommunityNone: 'Κανένα',
  createGenderAny: 'Οποιοδήποτε',
  createGenderMale: 'Άντρας',
  createGenderFemale: 'Γυναίκα',
  createAlertMissingTitle: 'Ελλιπείς πληροφορίες',
  createAlertMissingBody: 'Τίτλος και τοποθεσία είναι υποχρεωτικά.',
  createAlertBadDateTitle: 'Μη έγκυρη ημερομηνία',
  createAlertBadDateBody: 'Η εκδήλωση πρέπει να είναι στο μέλλον.',
  createAlertBadMaxTitle: 'Μη έγκυρο',
  createAlertBadMaxBody: 'Οι μέγιστοι συμμετέχοντες πρέπει να είναι μεταξύ 2 και 100.',
  createAlertUploadTitle: 'Αποτυχία ανεβάσματος',
  createAlertUploadBody: 'Δεν ήταν δυνατό το ανέβασμα εξώφυλλου. Η εκδήλωση θα δημιουργηθεί χωρίς αυτό.',
  createAlertSaveError: 'Σφάλμα',
  createPrivateLabel: 'Ιδιωτική Εκδήλωση',
  createPrivateHint: 'Μόνο με πρόσκληση',

  profileTitle: 'Προφίλ',
  profileEdit: 'Επεξεργασία',
  profileSave: 'Αποθήκευση',
  profileCancel: 'Ακύρωση',
  profileLabelName: 'Όνομα',
  profileLabelBio: 'Βιογραφικό',
  profileBioPlaceholder: 'Πες στον κόσμο για σένα...',
  profileBioEmpty: 'Πάτα Επεξεργασία για να προσθέσεις βιογραφικό',
  profileLabelUniversity: 'Πανεπιστήμιο',
  profileLabelDepartment: 'Τμήμα',
  profileRemovePhoto: 'Αφαίρεση φωτογραφίας',
  profileStreakEvents: (n) => n === 1 ? '1 εκδήλωση αυτή την εβδομάδα' : `${n} εκδηλώσεις αυτή την εβδομάδα`,
  profileStreakEmpty: 'Συμμετέχε σε μια εκδήλωση για να ανάψεις τη φλόγα!',
  profileStreakFire: 'Είσαι φωτιά! 🔥',
  profileStreakKeepUp: 'Συνέχισε έτσι!',
  profileStatCreated: 'Δημιούργησα',
  profileStatJoined: 'Συμμετείχα',
  profileStatTotal: 'Σύνολο',
  profileBadgesTitle: '🏅 Διακρίσεις',
  badgeFirstStep: 'Πρώτο βήμα',
  badgeVeteran: 'Βετεράνος',
  badgeSocial: 'Κοινωνικός',
  badgeOrganizer: 'Διοργανωτής',
  badgeOnFire: 'Φωτιά',
  badgeMegaphone: 'Μεγάφωνο',
  badgeFirstStepDesc: 'Συμμετέχεις στην πρώτη σου εκδήλωση στο Keno.',
  badgeVeteranDesc: 'Παρευρίσκεσαι σε 5 ή παραπάνω εκδηλώσεις.',
  badgeSocialDesc: 'Ακολουθείς 5 ή παραπάνω άτομα.',
  badgeOrganizerDesc: 'Δημιουργείς 3 ή παραπάνω εκδηλώσεις.',
  badgeOnFireDesc: 'Πηγαίνεις σε εκδηλώσεις 3 εβδομάδες σερί.',
  badgeMegaphoneDesc: 'Δημιουργείς την πρώτη σου εκδήλωση.',
  badgeEarned: '✓ Απόκτηθηκε',
  badgeNotEarned: 'Δεν έχει αποκτηθεί ακόμα',
  profileTabUpcoming: (n) => `📅 Επερχόμενα (${n})`,
  profileTabPast: (n) => `🗂️ Παλαιά (${n})`,
  profileTabSaved: (n) => `🔖 Αποθηκευμένα (${n})`,
  profileEmptyUpcoming: 'Κανένα επερχόμενο — εξερεύνησε!',
  profileEmptyPast: 'Κανένα παλαιό ακόμα',
  profileEmptySaved: 'Πάτα 🏷️ σε εκδήλωση για αποθήκευση',
  profileSettings: 'Ρυθμίσεις',
  profileAlertNameTitle: 'Απαιτείται όνομα',
  profileAlertNameBody: 'Παρακαλώ εισάγετε το όνομά σας.',
  profileAlertBioTitle: 'Το βιογραφικό μπλοκαρίστηκε',
  profileAlertPermTitle: 'Απαιτείται άδεια',
  profileAlertPermBody: 'Παρακαλώ επιτρέψτε πρόσβαση στη φωτοθήκη σας.',
  profileAlertPhotoTitle: 'Αποτυχία ανεβάσματος',
  profileAlertPhotoBody: 'Δεν ήταν δυνατό το ανέβασμα. Οι άλλες αλλαγές σας θα αποθηκευτούν.',
  profileNudgeTitle: 'Συμπλήρωσε το προφίλ σου',
  profileNudgeBio: 'Πρόσθεσε βιογραφικό',
  profileNudgePhoto: 'Πρόσθεσε φωτογραφία',
  profileNudgeInterests: 'Επίλεξε ενδιαφέροντα',

  groupChatTitle: 'Συνομιλία',
  groupChatEmpty: 'Κανένα μήνυμα ακόμα — πες κάτι!',
  groupChatPlaceholder: 'Μήνυμα στην ομάδα...',

  settingsTitle: 'Ρυθμίσεις',
  settingsSectionAppearance: 'Εμφάνιση',
  settingsDarkMode: 'Σκοτεινή λειτουργία',
  settingsSectionLanguage: 'Γλώσσα',
  settingsSectionAccount: 'Λογαριασμός',
  settingsUniDept: 'Πανεπιστήμιο & Τμήμα',
  settingsSectionInterests: 'Ενδιαφέροντα',
  settingsInterestsEdit: 'Επεξεργασία ενδιαφερόντων',
  settingsSectionDanger: 'Επικίνδυνη ζώνη',
  settingsSignOut: 'Αποσύνδεση',
  settingsDeleteAccount: 'Διαγραφή λογαριασμού',
  settingsTagline: 'Keno · φτιαγμένο για Έλληνες φοιτητές 🇬🇷',
  settingsUniPlaceholder: 'Όνομα πανεπιστημίου',
  settingsDeptPlaceholder: 'Τμήμα',
  settingsBtnCancel: 'Ακύρωση',
  settingsBtnSave: 'Αποθήκευση',
  settingsBtnSaving: 'Αποθήκευση…',
  settingsAlertSignOutTitle: 'Αποσύνδεση',
  settingsAlertSignOutBody: 'Είσαι σίγουρος ότι θέλεις να αποσυνδεθείς;',
  settingsAlertSignOutBtn: 'Αποσύνδεση',
  settingsAlertDeleteTitle: 'Διαγραφή λογαριασμού',
  settingsAlertDeleteBody: 'Αυτό θα διαγράψει μόνιμα τον λογαριασμό σου και όλα τα δεδομένα σου. Δεν μπορεί να αναιρεθεί.',
  settingsAlertDeleteBtn: 'Διαγραφή',
  settingsAlertReauthTitle: 'Απαιτείται επαναπιστοποίηση',
  settingsAlertReauthBody: 'Για λόγους ασφαλείας, αποσυνδέσου και ξανά-συνδέσου πριν διαγράψεις τον λογαριασμό σου.',

  searchPlaceholder: 'Αναζήτηση ονόματος ή πανεπιστημίου...',
  searchEmptyHint: 'Αναζήτηση φοιτητών βάσει ονόματος, πανεπιστημίου ή τμήματος',
  searchNotFound: (q) => `Δεν βρέθηκαν χρήστες για "${q}"`,
  searchFollow: '+ Ακολούθησε',
  searchFollowing: '✓ Ακολουθείς',

  eventShareBtn: 'Κοινοποίηση',
  eventEditBtn: 'Επεξ/σία',
  eventDeleteBtn: 'Διαγραφή',
  eventReportBtn: 'Αναφορά',
  eventReportTitle: 'Αναφορά Εκδήλωσης',
  eventReportSpam: 'Spam',
  eventReportInappropriate: 'Ακατάλληλο περιεχόμενο',
  eventReportMisinformation: 'Παραπληροφόρηση',
  eventReportSubmitted: 'Η αναφορά υποβλήθηκε',
  eventReportSubmittedBody: 'Ευχαριστούμε. Θα εξετάσουμε αυτή την εκδήλωση.',
  eventTapToReact: 'Αντίδρασε',
  eventSaved: 'Αποθηκεύτηκε',
  eventSaveBtn: 'Αποθήκευση',
  eventInCalendar: 'Στο ημερολόγιο',
  eventAddToCalendar: 'Ημερολόγιο',
  eventShareAction: 'Κοινοποίηση',
  eventMetaDateTime: 'Ημ/νία & Ώρα',
  eventMetaLocation: 'Τοποθεσία',
  eventMetaAttendees: 'Συμμετέχοντες',
  eventFull: 'Η εκδήλωση είναι πλήρης',
  eventSpotsLeft: (n) => n === 1 ? '1 ελεύθερη θέση' : `${n} ελεύθερες θέσεις`,
  eventGoing: (n, max) => `${n} / ${max} πηγαίνουν`,
  eventWaitlistCount: (n) => `${n} στη λίστα αναμονής`,
  eventAbout: 'Σχετικά',
  eventWhosGoing: 'Ποιος πηγαίνει',
  eventRestrictions: 'Περιορισμοί',
  eventChatTitle: 'Συνομιλία',
  eventChatEmpty: 'Κανένα μήνυμα ακόμα — πες κάτι!',
  eventChatPlaceholder: 'Πες κάτι...',
  eventChatLocked: (n) => `Συμμετέχε για να δεις ${n} μήνυμα${n !== 1 ? 'τα' : ''}`,
  eventBtnJoin: 'Συμμετοχή',
  eventBtnLeave: 'Αποχώρηση',
  eventBtnWaitlist: (n) => `Λίστα αναμονής (${n})`,
  eventBtnOnWaitlist: (n) => `✓ Στη λίστα (${n})`,
  eventWaitlistHint: 'Θα ειδοποιηθείς αν ανοίξει θέση',
  eventYou: 'Εσύ',
  eventGenderAny: 'Οποιοδήποτε',
  eventGenderMaleOnly: 'Μόνο άντρες',
  eventGenderFemaleOnly: 'Μόνο γυναίκες',
  eventDeleteTitle: 'Διαγραφή εκδήλωσης',
  eventDeleteBody: 'Αυτό θα διαγράψει μόνιμα την εκδήλωση για όλους τους συμμετέχοντες.',
  eventReactionHype: 'Φωτιά',
  eventReactionFunny: 'Αστείο',
  eventReactionInterested: 'Ενδιαφέρον',
  eventJoined: '✓ Εγγεγραμμένος',
  eventFilterAge: 'Ηλικία',
  eventShareCta: 'Βρες το στο Keno!',
  eventTyping1: (name) => `Ο/Η ${name} γράφει...`,
  eventTypingMany: (n) => `${n} άτομα γράφουν...`,
  eventWaitlistSpotOpened: (title) => `Άνοιξε θέση στο "${title}"!`,
  eventFriendGoing: (n) => `${n} φίλος${n !== 1 ? 'οι' : ''} πηγαίνει`,
  eventQrTitle: 'QR Είσοδος',
  eventQrShowBtn: 'Εμφάνιση QR',
  eventCommentsTitle: 'Σχόλια',
  eventCommentsEmpty: 'Χωρίς σχόλια ακόμα — γράψε το πρώτο!',
  eventCommentsPlaceholder: 'Πρόσθεσε σχόλιο...',
  eventAnalyticsTitle: 'Στατιστικά',
  eventAnalyticsViews: 'Προβολές',
  eventAnalyticsSaves: 'Αποθηκεύτηκε',
  eventCoHostsTitle: 'Συν-διοργανωτές',
  eventMakeCoHost: '+ Συν-δ/τής',
  eventRemoveCoHost: 'Αφαίρεση',
  eventCoHostBadge: 'Συν-δ/τής',
  eventShareCard: 'Κοινοποίηση κάρτας',
  eventShareWhatsApp: 'WhatsApp',
  eventPhotoWall: 'Φωτογραφίες',
  eventPhotoWallEmpty: 'Δεν υπάρχουν φωτογραφίες ακόμα. Μοιράσου μια στιγμή!',
  mutualFriends: (n) => `${n} κοινοί`,
  dmTitle: 'Μηνύματα',
  dmEmpty: 'Δεν υπάρχουν συνομιλίες ακόμα',
  dmPlaceholder: 'Μήνυμα...',
  dmNewMessage: '+ Νέο',
  searchUserMeta: (followers, events) => `${followers} ακόλουθοι · ${events} εκδηλώσεις`,
  onboardingBioPlaceholder: (dept, uni) => `${dept} @ ${uni}. Πες τι σε κάνει εσένα...`,
  groupNamePlaceholder: 'π.χ. Ομάδα ΑΣΟΕΕ',
  groupUniversityPlaceholder: 'π.χ. ΑΣΟΕΕ',

  validNameRequired: 'Το όνομα είναι υποχρεωτικό.',
  validNameMin: 'Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες.',
  validEmailRequired: 'Το email είναι υποχρεωτικό.',
  validEmailInvalid: 'Χρησιμοποίησε το email του πανεπιστημίου (πρέπει να τελειώνει σε .gr).',
  validEmailUnrecognised: (domain) => `Το "@${domain}" δεν αναγνωρίζεται. Επικοινώνησε με την υποστήριξη αν λείπει το πανεπιστήμιό σου.`,
  validPasswordRequired: 'Ο κωδικός είναι υποχρεωτικός.',
  validPasswordMin: 'Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.',
  validContentBlocked: 'Αυτό περιέχει γλώσσα που δεν επιτρέπουμε. Παρακαλούμε διατύπωσέ το διαφορετικά.',

  reminderTitle: (title) => `Ξεκινά σύντομα: ${title}`,
  reminderBody: (location) => `📌 ${location} — σε 1 ώρα`,

  groupsTitle: 'Κοινότητες',
  groupsNewBtn: '+ Νέα',
  groupsTabDiscover: '🔍 Ανακάλυψη',
  groupsTabMine: (n) => `👥 Δικές μου (${n})`,
  groupsSearchPlaceholder: 'Αναζήτηση κοινοτήτων...',
  groupsEmptyMine: 'Δεν έχεις γίνει μέλος σε καμία κοινότητα ακόμα',
  groupsEmptyDiscover: 'Καμία κοινότητα ακόμα — δημιούργησε την πρώτη!',
  groupsEmptySearch: 'Δεν βρέθηκαν κοινότητες',
  groupsMemberBadge: '✓ Μέλος',
  groupsMembers: (n) => n === 1 ? '1 μέλος' : `${n} μέλη`,
  groupsEvents: (n) => n === 1 ? '1 εκδήλωση' : `${n} εκδηλώσεις`,

  notifTitle: 'Ειδοποιήσεις',
  notifEmptyTitle: 'Όλα εντάξει!',
  notifEmptyBody: 'Όταν κάποιος σε ακολουθεί, συμμετέχει στην εκδήλωσή σου ή στέλνει μήνυμα, θα εμφανιστεί εδώ.',
  notifFollow: (name) => `Ο/Η ${name} σε ακολούθησε`,
  notifEventJoin: (name, title) => `Ο/Η ${name} συμμετείχε στην εκδήλωσή σου "${title}"`,
  notifEventMessage: (name, title) => `Ο/Η ${name} έστειλε μήνυμα στο "${title}"`,
  notifEventInvite: (name, title) => `Ο/Η ${name} σε κάλεσε στο "${title}"`,
  notifWaitlistPromoted: (title) => `Μπήκες! Αφαιρέθηκες από τη λίστα αναμονής — "${title}" είναι δικό σου!`,
  notifEventCancelled: (title) => `Το "${title}" ακυρώθηκε από τον διοργανωτή.`,
  notifEventReminder: (title) => `Υπενθύμιση! Το "${title}" ξεκινά σύντομα.`,
  notifGroupInvite: (name, title) => `Ο/Η ${name} σε κάλεσε στην κοινότητα "${title}".`,

  groupInviteTitle: 'Πρόσκληση μελών',
  groupInviteSearch: 'Αναζήτηση με όνομα…',
  groupInviteBtn: 'Πρόσκληση',
  groupInviteSent: 'Στάλθηκε ✓',
  groupPrivateOnly: '🔒 Αυτή η κοινότητα είναι μόνο για προσκεκλημένους.',

  userProfileTitle: 'Προφίλ',
  userNotFound: 'Ο χρήστης δεν βρέθηκε',
  userFollowing: '✓ Ακολουθείς',
  userFollow: '+ Ακολούθησε',
  userInvite: '✉️ Πρόσκληση',
  userFollowers: ' ακόλουθοι',
  userFollowing2: ' ακολουθείς',
  userAbout: 'Σχετικά',
  userStatCreated: 'Δημιούργησε',
  userStatJoined: 'Συμμετείχε',
  userUpcoming: '📅 Επερχόμενα',
  userNoUpcoming: 'Δεν υπάρχουν επερχόμενα',
  userInviteTo: (name) => `Κάλεσε τον/την ${name} σε…`,
  userInviteSentTitle: 'Απεστάλη!',
  userInviteSentBody: (name, title) => `Ο/Η ${name} προσκλήθηκε στο "${title}".`,
  userInviteErrorTitle: 'Σφάλμα',
  userInviteErrorBody: 'Δεν ήταν δυνατή η αποστολή πρόσκλησης. Δοκίμασε ξανά.',

  editEventTitle: 'Επεξεργασία εκδήλωσης',
  editEventBack: '← Πίσω',
  editEventCoverPhoto: 'Αλλαγή εξώφυλλου',
  editEventChangeCover: 'Αλλαγή εξώφυλλου',
  editEventSave: 'Αποθήκευση αλλαγών',
  editEventSaving: (p) => `Ανέβασμα... ${p}%`,
  editEventType: 'Τύπος εκδήλωσης',

  onboardingWelcome: (name) => `Καλώς ήρθες στο Keno${name ? `, ${name}` : ''}!`,
  onboardingWelcomeSub: 'Βγες έξω, γνώρισε νέους ανθρώπους, διασκέδασε.',
  onboardingFeature1: 'Ανακάλυψε εκδηλώσεις κοντά σου',
  onboardingFeature2: 'Γνώρισε ανθρώπους από το campus σου',
  onboardingFeature3: 'Εξερεύνησε στον χάρτη',
  onboardingFeature4: 'Μην χάσεις ό,τι σου αξίζει',
  onboardingInterestsTitle: 'Τι σε ενδιαφέρει;',
  onboardingInterestsSub: 'Επίλεξε τουλάχιστον 3 ενδιαφέροντα και θα σου δείξουμε πιο σχετικές εκδηλώσεις.',
  onboardingInterestsPick: (n) => `Επίλεξε ${n} ακόμα για να συνεχίσεις`,
  onboardingPersonaliseTitle: 'Κάνε το δικό σου',
  onboardingPersonaliseSub: 'Επίλεξε χρώμα προφίλ και γράψε ένα μικρό βιογραφικό.',
  onboardingPickColor: 'Επίλεξε χρώμα',
  onboardingBioLabel: 'Βιογραφικό (προαιρετικό)',
  onboardingDoneTitle: 'Είσαι έτοιμος!',
  onboardingDoneSub: 'Το προφίλ σου είναι έτοιμο. Ξεκίνα να εξερευνάς εκδηλώσεις στο campus σου τώρα.',
  onboardingBtnGetStarted: 'Ξεκίνα',
  onboardingBtnContinue: 'Συνέχεια →',
  onboardingBtnBack: '← Πίσω',
  onboardingBtnFinish: 'Πάμε! 🎉',
  onboardingBtnSaving: 'Αποθήκευση...',

  authSignInTitle: 'Σύνδεση',
  authTagline: 'less scrolling, more living',
  authEmailLabel: 'Πανεπιστημιακό Email',
  authPasswordLabel: 'Κωδικός',
  authSignInBtn: 'Σύνδεση',
  authNoAccount: 'Δεν έχεις λογαριασμό; ',
  authSignUpLink: 'Εγγραφή',
  authSignUpTitle: 'Δημιουργία λογαριασμού',
  authSignUpSubtitle: 'Μόνο επαληθευμένοι φοιτητές μπορούν να γίνουν μέλη',
  authNameLabel: 'Πλήρες Όνομα',
  authUniLabel: 'Πανεπιστήμιο',
  authDeptLabel: 'Τμήμα',
  authPasswordMin: 'Τουλ. 8 χαρακτήρες',
  authUniHint: 'Πρέπει να είναι αναγνωρισμένο ελληνικό email (.gr)',
  authCreateBtn: 'Δημιουργία λογαριασμού',
  authHaveAccount: 'Έχεις ήδη λογαριασμό; ',
  authSignInLink: 'Σύνδεση',
  authUniRequired: 'Το όνομα πανεπιστημίου είναι υποχρεωτικό.',
  authDeptRequired: 'Το τμήμα είναι υποχρεωτικό.',
  authErrWrongCredentials: 'Λάθος email ή κωδικός.',
  authErrEmailInUse: 'Αυτό το email είναι ήδη καταχωρημένο.',
  authErrWeakPassword: 'Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.',
  authErrInvalidEmail: 'Μη έγκυρη διεύθυνση email.',
  authErrTooManyRequests: 'Πολλές προσπάθειες. Δοκίμασε αργότερα.',
  authErrNetwork: 'Δεν υπάρχει σύνδεση στο διαδίκτυο.',
  authErrGeneric: 'Κάτι πήγε στραβά. Δοκίμασε ξανά.',
  authForgotLink: 'Ξέχασες τον κωδικό;',
  authForgotTitle: 'Επαναφορά κωδικού',
  authForgotSubtitle: 'Εισάγαγε το πανεπιστημιακό σου email και θα σου στείλουμε σύνδεσμο επαναφοράς.',
  authForgotBtn: 'Αποστολή συνδέσμου',
  authForgotSent: 'Έλεγξε το email σου',
  authForgotSentBody: 'Αν υπάρχει λογαριασμός με αυτή τη διεύθυνση, ο σύνδεσμος επαναφοράς είναι καθ\' οδόν.',
  authForgotErrNotFound: 'Δεν βρέθηκε λογαριασμός με αυτό το email.',
  privacyPolicy: 'Πολιτική Απορρήτου',
  termsOfService: 'Όροι Χρήσης',
  settingsPrivacy: 'Απόρρητο & Όροι Χρήσης',

  groupStatMembers: 'Μέλη',
  groupStatEvents: 'Εκδηλώσεις',
  groupStatPrivate: 'Ιδιωτική',
  groupStatPublic: 'Δημόσια',
  groupBtnJoin: '+ Εγγραφή',
  groupBtnLeave: '✓ Μέλος · Αποχώρηση',
  groupPastEvents: '🕐 Παλαιές εκδηλώσεις',
  groupNoEvents: 'Καμία εκδήλωση ακόμα σε αυτή την κοινότητα',

  groupNewTitle: 'Νέα Κοινότητα',
  groupPreviewName: 'Όνομα κοινότητας',
  groupLabelIcon: 'Εικονίδιο',
  groupLabelColour: 'Χρώμα',
  groupLabelName: 'Όνομα *',
  groupLabelDescription: 'Περιγραφή *',
  groupDescriptionPlaceholder: 'Για τι πρόκειται αυτή η κοινότητα;',
  groupLabelUniversity: 'Πανεπιστήμιο (προαιρετικό)',
  groupPrivateLabel: 'Ιδιωτική κοινότητα',
  groupPrivateSub: 'Ορατή μόνο σε προσκεκλημένα μέλη',
  groupCreateBtn: 'Δημιουργία κοινότητας 🎉',

  verifyTitle: 'Έλεγξε το inbox σου',
  verifyBody: 'Στείλαμε σύνδεσμο επαλήθευσης στο πανεπιστημιακό σου email. Πάτησέ τον για να ενεργοποιήσεις τον λογαριασμό σου στο Keno.',
  verifyResent: '✓  Email απεστάλη — έλεγξε το inbox σου.',
  verifyResendError: 'Δεν στάλθηκε το email — ίσως έστειλες πολλά αιτήματα. Δοκίμασε ξανά σε λίγο.',
  verifyBtnCheck: 'Επαλήθευσα το email μου',
  verifyBtnResend: 'Επαναποστολή email επαλήθευσης',
  verifyBtnSignOut: 'Αποσύνδεση',

  interestSports: 'Αθλητισμός',
  interestMusic: 'Μουσική',
  interestGaming: 'Gaming',
  interestStudy: 'Μελέτη',
  interestCoffee: 'Καφέ',
  interestArt: 'Τέχνη',
  interestParties: 'Πάρτι',
  interestHiking: 'Πεζοπορία',
  interestCinema: 'Σινεμά',
  interestCooking: 'Μαγειρική',
  interestTravel: 'Ταξίδια',
  interestTech: 'Τεχνολογία',
  interestReading: 'Ανάγνωση',
  interestDance: 'Χορός',
  interestFitness: 'Γυμναστική',
  interestChess: 'Σκάκι',

  countdownEnded: 'τελείωσε',
  countdownMins: (n) => `σε ${n}λ`,
  countdownHours: (n) => `σε ${n}ω`,
  countdownTomorrow: 'αύριο',
  countdownDays: (n) => `σε ${n}μ`,
  timeNow: 'τώρα',
  timeMinsAgo: (n) => `${n}λ πριν`,
  timeHoursAgo: (n) => `${n}ω πριν`,
  timeYesterday: 'χθες',
};

const translations: Record<AppLanguage, Translations> = { en, el };

export function getTranslations(): Translations {
  return translations[useLanguageStore.getState().language];
}

export function useTranslation(): Translations {
  const { language } = useLanguageStore();
  return translations[language];
}

export const LANGUAGE_LABELS: Record<AppLanguage, { flag: string; label: string }> = {
  en: { flag: '🇬🇧', label: 'English' },
  el: { flag: '🇬🇷', label: 'Ελληνικά' },
};
