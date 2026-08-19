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
      line1: 'Λιγότερο scrolling,',
      line2: 'περισσότερη ζωή.',
    };
  }
  return {
    line1: 'Less scrolling,',
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
  feedForYouHint: string;
  feedFindPeople: string;
  profileErrorTitle: string;
  profileErrorBody: string;
  leaderboardTitle: string;
  leaderboardSubtitle: string;
  leaderboardSubtitleStudents: string;
  leaderboardSubtitleUniversities: string;
  leaderboardUniversities: string;
  leaderboardTopStudents: string;
  leaderboardEmpty: string;
  leaderboardGoing: (count: number) => string;
  leaderboardEvents: (count: number) => string;
  leaderboardMeetups: (count: number) => string;
  leaderboardBehindLeader: (gap: number, leader: string) => string;
  leaderboardLeadingUni: string;
  leaderboardXpNote: string;
  leaderboardExplainer: string;
  leaderboardExplainerStudents: string;
  leaderboardExplainerUniversities: string;
  leaderboardRankGap: (xp: number, rank: number) => string;
  leaderboardYourSchool: string;
  leaderboardYourUniversityScope: (universityName: string) => string;
  leaderboardAllGreece: string;
  leaderboardNoUniData: string;
  leaderboardQuests: string;
  questsStreakLine: (weeks: number) => string;
  questsStreakBest: (best: number) => string;
  questsFreezeNote: string;
  questsPauseBtn: (pausesLeft: number) => string;
  questsPauseAlreadySafe: string;
  questsSectionLabel: string;
  questJoinEvents: string;
  questMeetPeople: string;
  questHostEvent: string;
  questCheckinEvent: string;
  questSaveEvents: string;
  questFollowPeople: string;
  questsProgressOf: (progress: number, target: number) => string;
  questsNotStarted: string;
  questsCompletedLabel: string;
  questsCompletedText: string;
  questsMysteryTitle: string;
  questsMysteryReward: string;
  questsMysteryGoal: (target: number) => string;
  questsMysteryUnlocked: string;
  feedForYou: string;
  feedSearchPlaceholder: string;
  feedSearchTypePlaceholder: string;
  feedEmptyFriendsTitle: string;
  feedEmptyFriendsBody: string;
  feedEmptySearchBody: string;
  feedEmptyTitle: string;
  feedEmptyBody: string;
  feedOpeningSoonLabel: string;
  feedFlagshipLabel: string;
  feedLeaderboardTitle: string;
  feedZeroWelcome: (name: string) => string;
  feedZeroSubtitle: string;

  // Filter sheet
  filterSheetTitle: string;
  filterSheetClear: string;
  filterDistanceLabel: string;
  filterWhenLabel: string;
  filterWhoLabel: string;
  filterRadius1: string;
  filterRadius5: string;
  filterRadius10: string;
  filterRadiusAll: string;
  filterWhenToday: string;
  filterWhenTomorrow: string;
  filterWhenWeekend: string;
  filterWhoUni: string;
  filterWhoSolo: string;
  filterShowEvents: (n: number) => string;

  // Map
  mapEvents: (n: number) => string;
  mapEmptyTitle: string;
  mapEmptyBody: string;
  mapAllCities: string;

  // Create
  createLabelEventOptions: string;
  createPrivateLabel: string;
  createPrivateHint: string;
  createSoloFriendlyLabel: string;
  createSoloFriendlyHint: string;
  eventSoloFriendlyTag: string;
  createCheckInInfoLabel: string;
  createCheckInInfoHint: string;
  createCheckInInfoPlaceholder: string;
  createCheckInInfoPhotoBtn: string;
  createNoFiltersLabel: string;
  createNoFiltersHint: string;
  createStakeLabel: string;
  createStakeHint: string;
  createLocationGeneral: string;
  createLocationExact: string;
  createLocationNameLabel: string;
  createPinPlaced: string;
  createPinTap: string;
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
  createSafetyNote: string;
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

  // Crash fallback (top-level Error Boundary)
  errorBoundaryTitle: string;
  errorBoundaryBody: string;
  errorBoundaryRetryBtn: string;

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
  profileStatEvents: string;
  profileStatMeetups: string;
  profileStatStreak: string;
  profileLevelProgressLabel: (name: string) => string;
  profileLevelXpToNext: (xp: number) => string;
  profileLevelMaxed: string;
  levelsYouTag: string;
  levelsXpToUnlock: (xp: number) => string;
  levelsXpToNext: (xp: number, name: string) => string;
  levelsCeoOnly: string;
  profileTicketsSection: (n: number) => string;
  profileBadgesTitle: string;
  badgeFirstStep: string;
  badgeVeteran: string;
  badgeSocial: string;
  badgeOrganizer: string;
  badgeOnFire: string;
  badgeMegaphone: string;
  badgeBetaTester: string;
  badgeFirstStepDesc: string;
  badgeVeteranDesc: string;
  badgeSocialDesc: string;
  badgeOrganizerDesc: string;
  badgeOnFireDesc: string;
  badgeMegaphoneDesc: string;
  badgeBetaTesterDesc: string;
  badgeEarned: string;
  badgeNotEarned: string;
  challengeJoin1Title: string;
  challengeJoin1Desc: string;
  challengeJoin5Title: string;
  challengeJoin5Desc: string;
  challengeJoin10Title: string;
  challengeJoin10Desc: string;
  challengeJoin25Title: string;
  challengeJoin25Desc: string;
  challengeCreate1Title: string;
  challengeCreate1Desc: string;
  challengeCreate5Title: string;
  challengeCreate5Desc: string;
  challengeStreak3Title: string;
  challengeStreak3Desc: string;
  challengeStreak7Title: string;
  challengeStreak7Desc: string;
  challengeFollow5Title: string;
  challengeFollow5Desc: string;
  challengeFollow10Title: string;
  challengeFollow10Desc: string;
  profileTabUpcoming: (n: number) => string;
  profileTabPast: (n: number) => string;
  profileTabSaved: (n: number) => string;
  profileEventsUpcomingTitle: string;
  profileEventsPastTitle: string;
  profileEventsSavedTitle: string;
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
  settingsSectionPreferences: string;
  settingsSoundEffects: string;
  settingsDynamicHero: string;
  settingsDynamicHeroHint: string;
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
  imagePickerTitle: string;
  imagePickerCamera: string;
  imagePickerLibrary: string;
  verifiedBadgeLabel: string;
  verifiedOrganiserBadgeLabel: string;
  regularBadgeLabel: string;
  groupMarkVerified: string;
  groupUnmarkVerified: string;
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
  settingsDeletePasswordTitle: string;
  settingsDeletePasswordBody: string;
  settingsDeletePasswordRequired: string;

  // Settings — screen 30 additions (verification tag, notifications, privacy, report-issue)
  settingsVerification: string;
  settingsVerifiedWith: (uni: string) => string;
  settingsVerifiedGeneric: string;
  settingsSectionNotifications: string;
  settingsNotifEventReminders: string;
  settingsNotifGroupMessages: string;
  settingsNotifSuggestions: string;
  settingsThemeAuto: string;
  settingsThemeLight: string;
  settingsThemeDark: string;
  settingsSectionSafety: string;
  settingsWhoSeesMe: string;
  settingsVisibilityStudents: string;
  settingsVisibilityConnections: string;
  settingsReportIssue: string;
  settingsEmergencyContact: string;
  settingsEmergencyNotSet: string;
  settingsEmergencyNameLabel: string;
  settingsEmergencyNamePlaceholder: string;
  settingsEmergencyPhoneLabel: string;
  settingsEmergencyPhonePlaceholder: string;
  settingsSafetyNote: string;
  settingsReportIssueTitle: string;
  settingsReportIssueBody: string;
  settingsReportIssuePlaceholder: string;
  settingsReportIssueAddScreenshot: string;
  settingsReportIssueRemoveScreenshot: string;
  settingsReportIssueSubmit: string;
  settingsReportIssueEmptyError: string;
  settingsReportIssueSuccessTitle: string;
  settingsReportIssueSuccessBody: string;
  adminReportsIssueLabel: string;
  adminReportsDescriptionLabel: string;
  adminReportsScreenshotLabel: string;

  // Admin (only shown to the admin account)
  settingsSectionAdmin: string;
  settingsAdminReports: string;
  adminReportsTitle: string;
  adminReportsEmpty: string;
  adminReportsEmptyBody: string;
  adminReportsEventLabel: string;
  adminReportsUserLabel: string;
  adminReportsReporterLabel: string;
  adminReportsDeleteBtn: string;
  adminReportsDismissBtn: string;
  adminReportsViewBtn: string;
  adminReportsConfirmDeleteTitle: string;
  adminReportsConfirmDeleteBody: string;
  adminReportsEventGone: string;
  settingsAdminVerifications: string;
  adminVerificationsTitle: string;
  adminVerificationsEmpty: string;
  adminVerificationsEmptyBody: string;
  adminVerificationsApprove: string;
  adminVerificationsReject: string;

  // Search
  searchPlaceholder: string;
  searchPeopleLabel: string;
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
  eventReportFake: string;
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
  eventMutualConnections: (n: number) => string;
  eventWaitlistCount: (n: number) => string;
  eventAbout: string;
  eventWhosGoing: string;
  eventInviteFriendBtn: string;
  eventInviteFriendTitle: string;
  eventLiveModeTitle: string;
  eventLiveTellFriendBtn: string;
  eventLiveTellFriendMessage: (title: string, location: string, time: string) => string;
  eventLiveAddPhotoBtn: string;
  eventLiveEndEventBtn: string;
  eventLiveEndEventConfirmTitle: string;
  eventLiveEndEventConfirmBody: string;
  eventLiveSafetyBtn: string;
  eventLiveSafetyTitle: string;
  eventLiveSafetyMessageBtn: (contact: string) => string;
  eventLiveSafetyCall112: string;
  eventLiveSafetyNoContactTitle: string;
  eventLiveSafetyNoContactBody: string;
  eventLiveSafetySetupBtn: string;
  eventFeedbackQuestion: string;
  eventFeedbackGood: string;
  eventFeedbackBad: string;
  eventRestrictions: string;
  eventChatTitle: string;
  eventChatEmpty: string;
  eventChatClosedNote: string;
  eventMsgDeleted: string;
  eventMsgEdited: string;
  eventEditSave: string;
  eventDeleteMsgTitle: string;
  eventDeleteMsgBody: string;
  editAction: string;
  eventChatPlaceholder: string;
  eventChatLocked: (n: number) => string;
  eventBtnJoin: string;
  eventStakeXpLink: string;
  eventStakeRequiredHint: (xp: number) => string;
  eventStakeNotEnoughXp: (xp: number) => string;
  eventStakeModalTitle: string;
  eventStakeModalTitleRequired: string;
  eventStakeModalHint: string;
  eventStakeModalHintRequired: string;
  eventStakeBtn: (xp: number) => string;
  eventBtnLeave: string;
  eventBtnWaitlist: (n: number) => string;
  eventWaitlistHint: string;
  eventWaitlistCardTitle: string;
  eventWaitlistPositionTag: (n: number) => string;
  eventWaitlistFullCopy: (filled: number, max: number) => string;
  eventWaitlistRestrictionsTitle: string;
  eventWaitlistCancelBtn: string;
  eventRecapShareTitle: string;
  eventRecapShareStory: string;
  eventRecapSaveDevice: string;
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
  eventJoinedNote: string;
  eventFilterAge: string;
  eventNotEligibleAge: string;
  eventNotEligibleUniversity: string;
  eventShareCta: string;
  eventTyping1: (name: string) => string;
  eventTypingMany: (n: number) => string;
  eventWaitlistSpotOpened: (title: string) => string;
  eventFriendGoing: (n: number) => string;
  eventPrivateTitle: string;
  eventPrivateBody: string;
  eventPrivateBannerSub: string;
  eventRequestJoin: string;
  eventRequestSent: string;
  eventRequestMessageHint: string;
  eventRequestMessagePlaceholder: string;
  eventRequestSendBtn: string;
  eventJoinRequestsTitle: string;
  eventRequestAccept: string;
  eventRequestDecline: string;
  notifEventJoinRequest: (name: string, title: string) => string;
  notifEventJoinAccepted: (title: string) => string;
  notifGroupJoinRequest: (name: string, title: string) => string;
  notifGroupJoinAccepted: (title: string) => string;
  eventQrTitle: string;
  eventQrShowBtn: string;
  eventQrRotateHint: string;
  eventShareRecapBtn: string;
  checkinTitle: string;
  checkinScanHint: string;
  checkinScanSub: string;
  checkinCantFindTitle: string;
  checkinCantFindBody: string;
  checkinBack: string;
  checkinInvalidTitle: string;
  checkinInvalidBody: string;
  checkinWrongEventBody: string;
  checkinPermissionTitle: string;
  checkinPermissionBody: string;
  checkinPermissionBtn: string;
  checkinSuccessTitle: string;
  checkinSeeWhoBtn: string;
  checkinHereNow: (n: number) => string;
  checkinOrganizerTag: string;
  checkinArrivedSoloQuestion: string;
  checkinArrivedSoloYes: string;
  checkinArrivedSoloNo: string;
  checkinFindYourGroupTitle: string;
  ticketLabel: string;
  ticketFirstSoloLabel: string;
  ticketWelcomeLabel: string;
  ticketPlusOneLabel: string;
  ticketGroupBonusLabel: string;
  checkinStreakStat: (weeks: number) => string;
  ticketWithCount: (n: number) => string;
  profileTicketsPageTitle: string;
  profileTicketsPageSub: string;
  profileTicketsPhotosBtn: string;
  profilePhotosSection: string;
  profilePhotosEmpty: string;
  profileTicketsSeeAll: string;
  eventAnalyticsTitle: string;
  eventAnalyticsViews: string;
  eventAnalyticsSaves: string;
  eventCoHostsTitle: string;
  eventMakeCoHost: string;
  eventRemoveCoHost: string;
  eventCoHostBadge: string;
  eventHostMissingTitle: string;
  eventHostMissingBody: string;
  eventClaimHostBtn: string;
  eventClaimHostTooEarly: string;
  eventClaimHostError: string;
  eventStandInBadge: string;
  eventStandInAnnounce: (name: string) => string;
  eventShareCard: string;
  eventShareCardScanHint: string;
  eventPhotoWall: string;
  eventPhotoWallEmpty: string;
  eventPhotoWallRetentionHint: string;
  eventPhotoSaveBtn: string;
  eventPhotoSavePermissionDenied: string;
  eventPhotoSaveError: string;
  mutualFriends: (n: number) => string;
  userReviewCount: (n: number) => string;
  dmTitle: string;
  dmEmpty: string;
  dmTabEvents: string;
  dmTabGroups: string;
  dmTabPersonal: string;
  dmTabRequests: (count: number) => string;
  dmEventEmpty: string;
  dmGroupEmpty: string;
  dmRequestsEmpty: string;
  dmPlaceholder: string;
  dmBlockedByMe: string;
  dmBlockedByThem: string;
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
  validAgeRequired: string;
  validAgeRange: string;

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
  groupsMySection: string;
  groupsSuggestedSection: string;
  groupsJoinBtn: string;

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
  notifGroupMessage: (name: string, title: string) => string;
  notifLevelUp: (levelName: string) => string;
  notifFriendGoing: (fromName: string, eventTitle: string) => string;
  notifReferralReward: (fromName: string, eventTitle: string) => string;
  notifSectionToday: string;
  notifSectionYesterday: string;
  notifSectionEarlier: string;

  // Notification-permission screen (shown once, after first event join)
  notifPermTitle: string;
  notifPermBody: string;
  notifPermItemReminder: string;
  notifPermItemGroupMsg: string;
  notifPermItemSuggestions: string;
  notifPermItemInactive: string;
  notifPermEnableBtn: string;
  notifPermSkipBtn: string;

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
  userFollowersTitle: string;
  userFollowingTitle: string;
  userConnectionsTitle: string;
  userConnectionsEmpty: string;
  userBetaTesterBadge: string;
  userReportSubmitted: string;
  userReportSubmittedBody: string;
  userReportFailed: string;
  userReportFailedBody: string;
  cancel: string;
  userMoreMenuTitle: string;
  userReportBtn: string;
  userReportTitle: string;
  userReportPrompt: string;
  userReportSpam: string;
  userReportInappropriate: string;
  userReportFake: string;
  userBlockBtn: string;
  userUnblockBtn: string;
  userBlockTitle: string;
  userBlockPrompt: string;
  userBlockOther: string;
  userBlockedTitle: string;
  userBlockedBody: (name: string) => string;
  userBlockedBanner: string;
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
  editEventFlagshipLabel: string;
  editEventFlagshipHint: string;
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
  onboardingInterestsCount: (n: number) => string;
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
  welcomeTagline: string;
  welcomeBody: string;
  welcomeGetStarted: string;
  welcomeHaveAccount: string;
  welcomeTermsNotice: string;
  authNameLabel: string;
  authUniLabel: string;
  authDeptLabel: string;
  authAgeLabel: string;
  authNoUniEmailLink: string;
  authNoUniEmailBanner: string;
  authEmailDeclinedBanner: string;
  authEmailDeclinedTryAgain: string;
  authGenericEmailHint: string;
  authUseUniEmailLink: string;
  authIdPhotoLabel: string;
  authIdPhotoHint: string;
  authIdPhotoRequired: string;
  authTermsRequired: string;
  authTermsPrefix: string;
  authTermsAnd: string;
  authIdPhotoBtnAdd: string;
  authIdPhotoBtnChange: string;
  pendingVerificationTitle: string;
  pendingVerificationBody: string;
  pendingVerificationRejectedTitle: string;
  pendingVerificationRejectedBody: string;
  pendingVerificationResubmitBtn: string;
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
  settingsFeedback: string;
  settingsBlockedUsers: string;
  blockedUsersTitle: string;
  blockedUsersEmpty: string;
  blockedUsersEmptyBody: string;

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
  groupLabelPhoto: string;
  groupAddPhoto: string;
  groupRemovePhoto: string;
  groupLabelName: string;
  groupLabelDescription: string;
  groupDescriptionPlaceholder: string;
  groupLabelUniversity: string;
  groupPrivateLabel: string;
  groupPrivateSub: string;
  groupCreateBtn: string;
  groupEditTitle: string;
  groupSaveBtn: string;
  groupDeleteTitle: string;
  groupDeleteBody: string;
  groupDeleteBtn: string;
  groupMembersTitle: string;
  groupKickTitle: string;
  groupKickBody: (name: string) => string;
  groupKickBtn: string;

  // Verify email screen
  verifyTitle: string;
  verifyBody: string;
  verifySpamHint: string;
  verifyResent: string;
  verifyResendError: string;
  verifyBtnCheck: string;
  verifyBtnResend: string;
  verifyBtnSignOut: string;
  verifyTroubleLink: string;
  verifyFallbackTitle: string;
  verifyFallbackBody: string;
  verifyFallbackEmailLabel: string;
  verifyFallbackBtnSubmit: string;
  verifyFallbackBtnCancel: string;
  verifyFallbackSentTitle: string;
  verifyFallbackSentBody: (email: string) => string;
  verifyFallbackError: string;

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

  // Reconnect checklist — screen 28 (post-event "Θα ξαναβρεθείτε;")
  reconnectTitle: string;
  reconnectSubtitle: string;
  reconnectEmpty: string;
  reconnectAllDone: string;
  reconnectSuggestedLabel: string;
  reconnectSendBtn: string;
  reconnectSkipBtn: string;
  reconnectError: string;
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
  feedForYouHint: 'Add interests in your profile to get personalized events',
  feedFindPeople: 'Find people →',
  profileErrorTitle: 'Something went wrong',
  profileErrorBody: 'Your profile data is missing. Please sign out and sign back in.',
  leaderboardTitle: 'Leaderboard',
  leaderboardSubtitle: 'Rankings reset every week',
  leaderboardSubtitleStudents: 'See who\'s showing up the most this week',
  leaderboardSubtitleUniversities: 'Which campus is most active this week',
  leaderboardUniversities: 'Universities',
  leaderboardTopStudents: 'Top Students',
  leaderboardEmpty: 'No data yet this week',
  leaderboardGoing: (count) => `${count} going`,
  leaderboardEvents: (count) => `${count} event${count === 1 ? '' : 's'}`,
  leaderboardMeetups: (count) => `${count} meetups`,
  leaderboardBehindLeader: (gap, leader) => `${gap} behind ${leader}`,
  leaderboardLeadingUni: 'In the lead',
  leaderboardXpNote: 'XP only comes from showing up or hosting — never from time spent in the app.',
  leaderboardExplainer: 'This ranks students (and schools) by real-world events joined this week — not app usage. Climb it by joining events, showing up, or hosting your own; rankings reset every week so there’s always a fresh shot at the top.',
  leaderboardExplainerStudents: 'Ranked by real check-ins this week, not app usage or RSVPs. Show up to climb — rankings reset every week so there\'s always a fresh shot at the top.',
  leaderboardExplainerUniversities: 'Ranked by total check-ins across all students at each university this week. Every event your campus shows up to counts toward its score.',
  leaderboardRankGap: (xp, rank) => `${xp} XP from ${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} place`,
  leaderboardYourSchool: 'YOUR SCHOOL',
  leaderboardYourUniversityScope: (universityName) => `YOUR UNIVERSITY · ${universityName.toUpperCase()}`,
  leaderboardAllGreece: 'ALL OF GREECE',
  leaderboardNoUniData: 'Add your university in Settings to see this',
  leaderboardQuests: 'Quests',
  questsStreakLine: (weeks) => `${weeks}-week streak`,
  questsStreakBest: (best) => `Best: ${best}`,
  questsFreezeNote: 'A freeze token automatically covers a missed week, so your streak doesn’t break.',
  questsPauseBtn: (pausesLeft) => `Pause streak this week (${pausesLeft} left this semester)`,
  questsPauseAlreadySafe: 'This week is already protected',
  questsSectionLabel: 'THIS WEEK',
  questJoinEvents: 'Join 2 events',
  questMeetPeople: 'Meet 3 new people',
  questHostEvent: 'Host an event',
  questCheckinEvent: 'Check into an event',
  questSaveEvents: 'Save 2 events',
  questFollowPeople: 'Follow 2 people',
  questsProgressOf: (progress, target) => `${progress} of ${target}`,
  questsNotStarted: 'Not started',
  questsCompletedLabel: 'COMPLETED',
  questsCompletedText: 'Completed',
  questsMysteryTitle: 'Mystery quest',
  questsMysteryReward: 'Verified badge',
  questsMysteryGoal: (target) => `Check in to ${target} events`,
  questsMysteryUnlocked: "Unlocked — you're verified",
  feedForYou: 'For You',
  feedSearchPlaceholder: 'Search events, places...',
  feedSearchTypePlaceholder: 'Search by type — yoga, debate, hiking...',
  feedEmptyFriendsTitle: 'No friends events',
  feedEmptyFriendsBody: 'Follow people to see their events here!',
  feedEmptySearchBody: 'Try a different search term, or create this type of event yourself!',
  feedEmptyTitle: 'Nothing here yet',
  feedEmptyBody: 'Be the first to post something for your campus!',
  feedOpeningSoonLabel: 'Opening soon',
  feedFlagshipLabel: 'This week\'s Keno ritual',
  feedLeaderboardTitle: 'Top Universities This Week',
  feedZeroWelcome: (name) => `Welcome,\n${name ? `${name}.` : 'you.'}`,
  feedZeroSubtitle: 'Three things are happening near you, within 5 km. Check one out — the rest will follow.',

  filterSheetTitle: 'Filters',
  filterSheetClear: 'Clear',
  filterDistanceLabel: 'Distance',
  filterWhenLabel: 'When',
  filterWhoLabel: 'Who',
  filterRadius1: '1 km',
  filterRadius5: '5 km',
  filterRadius10: '10 km',
  filterRadiusAll: 'Everywhere',
  filterWhenToday: 'Today',
  filterWhenTomorrow: 'Tomorrow',
  filterWhenWeekend: 'Weekend',
  filterWhoUni: 'From my university',
  filterWhoSolo: 'Solo-friendly',
  filterShowEvents: (n) => `Show ${n} event${n !== 1 ? 's' : ''}`,

  mapEvents: (n) => `${n} event${n !== 1 ? 's' : ''}`,
  mapEmptyTitle: 'No pinned events nearby',
  mapEmptyBody: 'Events show up here once someone drops a pin for an exact spot. Try a different filter or check back later.',
  mapAllCities: 'All cities',

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
  createSafetyNote: 'As the organizer you\'re responsible for your event. Reports are reviewed within 24 hours.',
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

  errorBoundaryTitle: 'Something went wrong',
  errorBoundaryBody: "Sorry about that — the app hit an unexpected error. Give it another try, and if it keeps happening, let us know from Settings.",
  errorBoundaryRetryBtn: 'Try again',

  createLabelEventOptions: 'Options',
  createPrivateLabel: 'Private Event',
  createPrivateHint: 'Only invited people can join',
  createSoloFriendlyLabel: 'Good to attend alone',
  createSoloFriendlyHint: 'Let people know it\'s totally fine to show up solo',
  eventSoloFriendlyTag: '🙋 Good to attend alone',
  createCheckInInfoLabel: 'After check-in (optional)',
  createCheckInInfoHint: 'Shown to attendees the moment they check in — a table number, what to look for, or a photo of the spot.',
  createCheckInInfoPlaceholder: 'e.g. "Look for the red umbrellas by the fountain"',
  createCheckInInfoPhotoBtn: 'Add a photo of the meeting spot',
  createNoFiltersLabel: 'No filters',
  createNoFiltersHint: 'Anyone can join without providing age or university',
  createStakeLabel: 'Require XP stake',
  createStakeHint: 'Members must stake XP to join — they lose it (plus a penalty) if they flake',
  createLocationGeneral: 'General',
  createLocationExact: 'Exact spot',
  createLocationNameLabel: 'Location name',
  createPinPlaced: 'Pin placed — tap to move it',
  createPinTap: 'Tap the map to drop a pin',

  profileTitle: 'Profile',
  profileEdit: 'Edit',
  profileSave: 'Save',
  profileCancel: 'Cancel',
  profileLabelName: 'Name',
  profileLabelBio: 'Bio',
  profileBioPlaceholder: 'So, who are you?',
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
  profileStatEvents: 'Events',
  profileStatMeetups: 'Connections',
  profileStatStreak: 'Streak',
  profileLevelProgressLabel: (name) => `LEVEL: ${name.toUpperCase()}`,
  profileLevelXpToNext: (xp) => `${xp} XP to next level`,
  profileLevelMaxed: "You've hit the top level!",
  levelsYouTag: 'YOU',
  levelsXpToUnlock: (xp) => `+${xp} XP to unlock`,
  levelsXpToNext: (xp, name) => `${xp} XP to ${name}`,
  levelsCeoOnly: 'Only the CEO can have this level',
  profileTicketsSection: (n) => `MY TICKETS · ${n}`,
  profileBadgesTitle: '🏅 Badges',
  badgeFirstStep: 'First step',
  badgeVeteran: 'Veteran',
  badgeSocial: 'Social',
  badgeOrganizer: 'Organizer',
  badgeOnFire: 'On fire',
  badgeMegaphone: 'Megaphone',
  badgeBetaTester: 'Beta Tester',
  badgeFirstStepDesc: 'Join your first event on keno..',
  badgeVeteranDesc: 'Attend 5 or more events.',
  badgeSocialDesc: 'Follow 5 or more people.',
  badgeOrganizerDesc: 'Create 3 or more events.',
  badgeOnFireDesc: 'Attend events 3 weeks in a row.',
  badgeMegaphoneDesc: 'Create your first event.',
  badgeBetaTesterDesc: 'One of the first people on keno., before it left beta.',
  badgeEarned: '✓ Earned',
  badgeNotEarned: 'Not yet earned',
  challengeJoin1Title: 'First step',
  challengeJoin1Desc: 'Join your first event',
  challengeJoin5Title: 'Getting social',
  challengeJoin5Desc: 'Join 5 events',
  challengeJoin10Title: 'Regular',
  challengeJoin10Desc: 'Join 10 events',
  challengeJoin25Title: 'Veteran',
  challengeJoin25Desc: 'Join 25 events',
  challengeCreate1Title: 'First event',
  challengeCreate1Desc: 'Create your first event',
  challengeCreate5Title: 'Organizer',
  challengeCreate5Desc: 'Create 5 events',
  challengeStreak3Title: 'On fire',
  challengeStreak3Desc: '3-week attendance streak',
  challengeStreak7Title: 'Unstoppable',
  challengeStreak7Desc: '7-week attendance streak',
  challengeFollow5Title: 'Connected',
  challengeFollow5Desc: 'Follow 5 people',
  challengeFollow10Title: 'Networker',
  challengeFollow10Desc: 'Follow 10 people',
  profileTabUpcoming: (n) => `📅 Upcoming (${n})`,
  profileTabPast: (n) => `🗂️ Past (${n})`,
  profileTabSaved: (n) => `🔖 Saved (${n})`,
  profileEventsUpcomingTitle: 'Upcoming events',
  profileEventsPastTitle: 'Past events',
  profileEventsSavedTitle: 'Saved events',
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
  settingsSectionPreferences: 'Preferences',
  settingsSoundEffects: 'Sound effects',
  settingsDynamicHero: 'Dynamic card expand',
  settingsDynamicHeroHint: 'Touching a card grows it into the big featured card. Turn off to keep the feed static.',
  settingsSectionLanguage: 'Language',
  settingsSectionAccount: 'Account',
  settingsUniDept: 'University & department',
  settingsSectionInterests: 'Interests',
  settingsInterestsEdit: 'Edit your interests',
  settingsSectionDanger: 'Danger zone',
  settingsSignOut: 'Sign out',
  settingsDeleteAccount: 'Delete account',
  settingsTagline: 'keno. · built for Greek students 🇬🇷',
  settingsUniPlaceholder: 'University name',
  settingsDeptPlaceholder: 'Department',
  settingsBtnCancel: 'Cancel',
  imagePickerTitle: 'Add a photo',
  imagePickerCamera: 'Take photo',
  imagePickerLibrary: 'Choose from library',
  verifiedBadgeLabel: 'Verified',
  verifiedOrganiserBadgeLabel: 'Verified organiser',
  regularBadgeLabel: 'Regular',
  groupMarkVerified: 'Mark as verified organiser',
  groupUnmarkVerified: 'Remove verified organiser',
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
  settingsDeletePasswordTitle: 'Confirm your password',
  settingsDeletePasswordBody: 'For your security, enter your password to permanently delete your account.',
  settingsDeletePasswordRequired: 'Enter your password to continue.',

  settingsVerification: 'Verification',
  settingsVerifiedWith: (uni) => `${uni} ✓`,
  settingsVerifiedGeneric: 'Verified ✓',
  settingsSectionNotifications: 'Notifications',
  settingsNotifEventReminders: 'Event reminders',
  settingsNotifGroupMessages: 'Group messages',
  settingsNotifSuggestions: 'Suggestions for you',
  settingsThemeAuto: 'Auto',
  settingsThemeLight: 'Day',
  settingsThemeDark: 'Night',
  settingsSectionSafety: 'Safety & Privacy',
  settingsWhoSeesMe: 'Who can see me',
  settingsVisibilityStudents: 'Students',
  settingsVisibilityConnections: 'Connections',
  settingsReportIssue: 'Report an issue',
  settingsEmergencyContact: 'Emergency contact',
  settingsEmergencyNotSet: 'Not set',
  settingsEmergencyNameLabel: 'Contact name',
  settingsEmergencyNamePlaceholder: 'e.g. Mom, roommate...',
  settingsEmergencyPhoneLabel: 'Phone number',
  settingsEmergencyPhonePlaceholder: '+30 69...',
  settingsSafetyNote: 'Every report is reviewed within 24 hours. A second violation means account suspension.',
  settingsReportIssueTitle: 'Report an issue',
  settingsReportIssueBody: "Tell us what went wrong — a bug, unsafe behaviour, or anything else. We'll take a look.",
  settingsReportIssuePlaceholder: 'Describe the issue…',
  settingsReportIssueAddScreenshot: 'Add a screenshot',
  settingsReportIssueRemoveScreenshot: 'Remove screenshot',
  settingsReportIssueSubmit: 'Submit',
  settingsReportIssueEmptyError: 'Write a short description first.',
  settingsReportIssueSuccessTitle: 'Thanks!',
  settingsReportIssueSuccessBody: "Your report has been submitted — we'll review it within 24 hours.",
  adminReportsIssueLabel: 'App issue',
  adminReportsDescriptionLabel: 'Description',
  adminReportsScreenshotLabel: 'View screenshot',

  settingsSectionAdmin: 'Admin',
  settingsAdminReports: 'Review reports',
  adminReportsTitle: 'Reports',
  adminReportsEmpty: 'All clear',
  adminReportsEmptyBody: 'No open reports right now.',
  adminReportsEventLabel: 'Reported event',
  adminReportsUserLabel: 'Reported user',
  adminReportsReporterLabel: 'Reported by',
  adminReportsDeleteBtn: 'Delete event',
  adminReportsDismissBtn: 'Dismiss',
  adminReportsViewBtn: 'View',
  adminReportsConfirmDeleteTitle: 'Delete event?',
  adminReportsConfirmDeleteBody: 'This will permanently delete the reported event for all attendees.',
  adminReportsEventGone: '(event already deleted)',
  settingsAdminVerifications: 'Review ID verifications',
  adminVerificationsTitle: 'ID verifications',
  adminVerificationsEmpty: 'All clear',
  adminVerificationsEmptyBody: 'No pending student ID verifications right now.',
  adminVerificationsApprove: 'Approve',
  adminVerificationsReject: 'Reject',

  searchPlaceholder: 'Search by name or university...',
  searchPeopleLabel: 'People',
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
  eventReportFake: 'Fake account',
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
  eventMutualConnections: (n) => (n === 1 ? '1 mutual connection' : `${n} mutual connections`),
  eventWaitlistCount: (n) => `${n} on waitlist`,
  eventAbout: 'About',
  eventWhosGoing: "Who's going",
  eventInviteFriendBtn: 'Invite',
  eventInviteFriendTitle: 'Invite a friend',
  eventLiveModeTitle: '🔴 Live now',
  eventLiveTellFriendBtn: 'Tell a friend',
  eventLiveTellFriendMessage: (title, location, time) => `I'm at "${title}" right now — ${location}, ${time}`,
  eventLiveAddPhotoBtn: 'Add photo',
  eventLiveEndEventBtn: 'End event now',
  eventLiveEndEventConfirmTitle: 'End this event?',
  eventLiveEndEventConfirmBody: 'This marks the event as over for everyone right now, instead of waiting for it to time out on its own.',
  eventLiveSafetyBtn: '🆘 Safety',
  eventLiveSafetyTitle: 'Need to reach someone?',
  eventLiveSafetyMessageBtn: (contact) => `Message ${contact}`,
  eventLiveSafetyCall112: 'Call 112',
  eventLiveSafetyNoContactTitle: 'No emergency contact set',
  eventLiveSafetyNoContactBody: 'Add one in Settings so this button can message them your location fast.',
  eventLiveSafetySetupBtn: 'Set up in Settings',
  eventFeedbackQuestion: 'How was it?',
  eventFeedbackGood: '🙂 Good time',
  eventFeedbackBad: '😕 Not great',
  eventRestrictions: 'Restrictions',
  eventChatTitle: 'Chat',
  eventChatEmpty: 'No messages yet — say something!',
  eventChatClosedNote: 'This chat closed 24h after the event started — history is still here to read.',
  eventMsgDeleted: 'Message deleted',
  eventMsgEdited: 'edited',
  eventEditSave: 'Save',
  eventDeleteMsgTitle: 'Delete message?',
  eventDeleteMsgBody: 'This cannot be undone.',
  editAction: 'Edit',
  eventChatPlaceholder: 'Say something...',
  eventChatLocked: (n) => `Join the event to see ${n} message${n !== 1 ? 's' : ''}`,
  eventBtnJoin: 'Join event',
  eventStakeXpLink: 'Stake XP to commit (optional)',
  eventStakeRequiredHint: (xp) => `Requires staking ${xp} XP to join`,
  eventStakeNotEnoughXp: (xp) => `You need at least ${xp} XP to join this event`,
  eventStakeModalTitle: 'Stake XP to RSVP',
  eventStakeModalTitleRequired: 'Stake XP to join',
  eventStakeModalHint: "Stake XP to show you're serious about attending. You get it back + a bonus if you check in!",
  eventStakeModalHintRequired: "Since you've got the XP, staking is how you join — it keeps people honest about showing up. You'll get it back + a bonus if you check in, but you'll lose it, plus an extra penalty, if you don't.",
  eventStakeBtn: (xp) => `Stake ${xp} XP`,
  eventBtnLeave: 'Leave event',
  eventBtnWaitlist: (n) => `Join waitlist (${n})`,
  eventWaitlistHint: "You'll be notified if a spot opens up",
  eventWaitlistCardTitle: 'Waitlist',
  eventWaitlistPositionTag: (n) => `#${n}`,
  eventWaitlistFullCopy: (filled, max) => `${filled} of ${max} spots taken. If someone cancels, you're added automatically and we'll notify you.`,
  eventWaitlistRestrictionsTitle: 'Who can join',
  eventWaitlistCancelBtn: 'Cancel',
  eventRecapShareTitle: 'Share the night',
  eventRecapShareStory: 'Share',
  eventRecapSaveDevice: 'Save to device',
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
  eventJoinedNote: "You're in. We'll remind you before it starts.",
  eventFilterAge: 'Age',
  eventNotEligibleAge: "You don't meet this event's age range.",
  eventNotEligibleUniversity: "This event is restricted to specific universities.",
  eventShareCta: 'Join on keno.!',
  eventTyping1: (name) => `${name} is typing...`,
  eventTypingMany: (n) => `${n} people are typing...`,
  eventWaitlistSpotOpened: (title) => `A spot opened in "${title}"!`,
  eventFriendGoing: (n) => `${n} friend${n !== 1 ? 's' : ''} going`,
  eventPrivateTitle: 'Private Event',
  eventPrivateBody: "This event is invite-only. Send a request and the organiser can let you in.",
  eventPrivateBannerSub: 'Tap to share invite link with guests',
  eventRequestJoin: 'Request to join',
  eventRequestSent: 'Request sent ✓',
  eventRequestMessageHint: 'Tell the organiser why you\'d like to join.',
  eventRequestMessagePlaceholder: 'e.g. I\'m a friend of a friend, saw this and would love to come!',
  eventRequestSendBtn: 'Send request',
  eventJoinRequestsTitle: 'Join requests',
  eventRequestAccept: 'Accept',
  eventRequestDecline: 'Decline',
  notifEventJoinRequest: (name, title) => `${name} asked to join "${title}"`,
  notifEventJoinAccepted: (title) => `You're in! Your request to join "${title}" was accepted.`,
  notifGroupJoinRequest: (name, title) => `${name} asked to join "${title}"`,
  notifGroupJoinAccepted: (title) => `You're in! Your request to join "${title}" was accepted.`,
  eventQrTitle: 'QR Check-in',
  eventQrShowBtn: 'Show QR',
  eventQrRotateHint: 'Refreshes every 30s — a screenshot won\'t work for long',
  eventShareRecapBtn: 'Share recap',
  checkinTitle: 'Check-in',
  checkinScanHint: 'Scan the code',
  checkinScanSub: 'The organizer shows it at the meeting point',
  checkinCantFindTitle: "Can't find the code",
  checkinCantFindBody: 'Ask the organizer to check you in manually from their side, or come back and scan when they show it.',
  checkinBack: 'Go back',
  checkinInvalidTitle: 'Invalid code',
  checkinInvalidBody: "This code isn't valid or has expired. Ask the organizer to show it again.",
  checkinWrongEventBody: "This code is for a different event.",
  checkinPermissionTitle: 'Camera access needed',
  checkinPermissionBody: 'keno. needs your camera to scan the check-in code.',
  checkinPermissionBtn: 'Enable camera',
  checkinSuccessTitle: "You're in.",
  checkinSeeWhoBtn: "See who's here",
  checkinHereNow: (n) => `HERE NOW · ${n}`,
  checkinFindYourGroupTitle: 'Find your group',
  checkinOrganizerTag: 'organizer',
  checkinArrivedSoloQuestion: 'Did you come alone?',
  checkinArrivedSoloYes: 'Yes',
  checkinArrivedSoloNo: 'No',
  ticketLabel: 'TICKET',
  ticketFirstSoloLabel: 'FIRST SOLO',
  ticketWelcomeLabel: 'WELCOME',
  ticketPlusOneLabel: 'PLUS ONE',
  ticketGroupBonusLabel: 'SQUAD',
  checkinStreakStat: (weeks) => `${weeks}-week streak going`,
  ticketWithCount: (n) => `with ${n} others`,
  profileTicketsPageTitle: 'My tickets',
  profileTicketsPageSub: "Every check-in leaves one. They're never lost.",
  profileTicketsPhotosBtn: 'Tickets & photos',
  profilePhotosSection: 'My photos',
  profilePhotosEmpty: "No photos yet — add one from an event's photo wall.",
  profileTicketsSeeAll: 'All',
  eventAnalyticsTitle: 'Your stats',
  eventAnalyticsViews: 'Views',
  eventAnalyticsSaves: 'Saves',
  eventCoHostsTitle: 'Co-hosts',
  eventMakeCoHost: '+ Co-host',
  eventRemoveCoHost: 'Remove',
  eventCoHostBadge: 'Co-host',
  eventHostMissingTitle: "The organizer hasn't arrived yet",
  eventHostMissingBody: 'Take over as host so everyone can still check in.',
  eventClaimHostBtn: 'Take over as host',
  eventClaimHostTooEarly: "It's still early — give the organizer a bit more time.",
  eventClaimHostError: "Couldn't take over as host. Try again in a moment.",
  eventStandInBadge: "You're standing in as host",
  eventStandInAnnounce: (name: string) => `${name} took over as host`,
  eventShareCard: 'Share card',
  eventShareCardScanHint: 'Scan to open in keno.',
  eventPhotoWall: 'Photo Wall',
  eventPhotoWallEmpty: 'No photos yet. Be the first to share a moment!',
  eventPhotoWallRetentionHint: 'Photos are kept for 30 days — tap one to save it to your device before then.',
  eventPhotoSaveBtn: 'Save',
  eventPhotoSavePermissionDenied: 'Keno needs permission to save photos to your library.',
  eventPhotoSaveError: 'Failed to save photo.',
  mutualFriends: (n) => `${n} mutual`,
  userReviewCount: (n) => `${n} ${n === 1 ? 'person thinks' : 'people think'} you're awesome`,
  dmTitle: 'Messages',
  dmEmpty: 'No conversations yet',
  dmTabEvents: 'Events',
  dmTabGroups: 'Groups',
  dmTabPersonal: 'Personal',
  dmTabRequests: (count) => (count > 0 ? `Requests · ${count}` : 'Requests'),
  dmEventEmpty: 'No event chats yet — join an event to start one',
  dmGroupEmpty: 'No group chats yet — join a group to start one',
  dmRequestsEmpty: 'No pending requests',
  dmPlaceholder: 'Message...',
  dmBlockedByMe: "You've blocked this user. Unblock them from their profile to send messages.",
  dmBlockedByThem: 'You can no longer message this user.',
  dmNewMessage: '+ New',
  searchUserMeta: (followers, events) => `${followers} followers · ${events} events`,
  onboardingBioPlaceholder: (dept, uni) => `${dept} @ ${uni}. So, who are you?`,
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
  validAgeRequired: 'Age is required.',
  validAgeRange: 'You must be between 16 and 100.',

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
  groupsMySection: 'MY GROUPS',
  groupsSuggestedSection: 'SUGGESTED',
  groupsJoinBtn: 'Join',

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
  notifGroupMessage: (name, title) => `${name} sent a message in "${title}"`,
  notifLevelUp: (levelName) => `You reached Level ${levelName}. Keep your streak going!`,
  notifFriendGoing: (fromName, eventTitle) => `${fromName} is going to "${eventTitle}"`,
  notifReferralReward: (fromName, eventTitle) => `${fromName} checked in to "${eventTitle}" — you both earned a Plus One ticket!`,
  notifSectionToday: 'Today',
  notifSectionYesterday: 'Yesterday',
  notifSectionEarlier: 'Earlier',

  notifPermTitle: "We'll keep you posted?",
  notifPermBody: 'Just two things: a reminder 2 hours before your event, and when someone messages the event chat.',
  notifPermItemReminder: 'Event reminders',
  notifPermItemGroupMsg: 'Group messages',
  notifPermItemSuggestions: 'Suggestions & news',
  notifPermItemInactive: 'Inactive',
  notifPermEnableBtn: 'Enable notifications',
  notifPermSkipBtn: 'Not now',

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
  userFollowersTitle: 'Followers',
  userFollowingTitle: 'Following',
  userConnectionsTitle: 'Connections',
  userConnectionsEmpty: 'Nobody here yet.',
  userBetaTesterBadge: 'Beta Tester',
  userReportSubmitted: 'Report submitted',
  userReportSubmittedBody: "Thanks for letting us know. We'll review this account.",
  userReportFailed: 'Report failed',
  userReportFailedBody: 'Something went wrong sending your report. Please try again.',
  cancel: 'Cancel',
  userMoreMenuTitle: 'More options',
  userReportBtn: 'Report user',
  userReportTitle: 'Report user',
  userReportPrompt: 'Why are you reporting this account?',
  userReportSpam: 'Spam',
  userReportInappropriate: 'Inappropriate content',
  userReportFake: 'Fake account',
  userBlockBtn: 'Block user',
  userUnblockBtn: 'Unblock',
  userBlockTitle: 'Block user',
  userBlockPrompt: "They won't be able to see your content or contact you, and this will be reported to our team. Why are you blocking this account?",
  userBlockOther: 'Other',
  userBlockedTitle: 'User blocked',
  userBlockedBody: (name) => `${name} is blocked. Their content is now hidden from you.`,
  userBlockedBanner: 'You have blocked this user.',
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
  editEventFlagshipLabel: '🗓️ Flagship "Keno ritual"',
  editEventFlagshipHint: 'Pins this event above every filter on the Feed — admin only, use sparingly.',
  editEventType: 'Event type',

  onboardingWelcome: (name) => `Welcome to keno.${name ? `, ${name}` : ''}!`,
  onboardingWelcomeSub: 'Go outside, meet new people, have fun.',
  onboardingFeature1: 'Discover events near you',
  onboardingFeature2: 'Meet people from your campus',
  onboardingFeature3: 'Explore on the map',
  onboardingFeature4: 'Get notified about what interests you',
  onboardingInterestsTitle: 'What are you into?',
  onboardingInterestsSub: "Pick at least 3 interests and we'll show you more relevant events.",
  onboardingInterestsPick: (n) => `Pick ${n} more to continue`,
  onboardingInterestsCount: (n) => `${n} selected`,
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
  authTagline: 'less scrolling, more living.',
  authEmailLabel: 'University Email',
  authPasswordLabel: 'Password',
  authSignInBtn: 'Sign in',
  authNoAccount: "Don't have an account? ",
  authSignUpLink: 'Sign up',
  authSignUpTitle: 'Create account',
  authSignUpSubtitle: 'Only verified university students can join',
  welcomeTagline: 'Less scrolling,\nmore living.',
  welcomeBody: "See what's happening near you today and go. With students from your own university.",
  welcomeGetStarted: 'Get started',
  welcomeHaveAccount: 'I already have an account',
  welcomeTermsNotice: 'By continuing you agree to our terms of use',
  authNameLabel: 'Full Name',
  authUniLabel: 'University',
  authDeptLabel: 'Department',
  authAgeLabel: 'Age',
  authNoUniEmailLink: "Don't have a university email? Sign up with your student ID instead",
  authNoUniEmailBanner: "No problem — use any email you have access to, then upload a photo of your student ID below. An admin reviews it manually, usually within a day, before you get full access.",
  authEmailDeclinedBanner: "We couldn't recognize that as one of our university emails, so we've switched you to ID verification instead — upload a photo of your student ID below and we'll check it manually, usually within a day.",
  authEmailDeclinedTryAgain: 'Try a different university email',
  authGenericEmailHint: 'Any email you can access — you’ll need it to verify your account.',
  authUseUniEmailLink: 'I have a university email instead',
  authIdPhotoLabel: 'Student ID photo',
  authIdPhotoHint: "We'll manually review this before giving you full access — usually within a day.",
  authIdPhotoRequired: 'A photo of your student ID is required.',
  authTermsRequired: 'You need to agree to the Terms of Service and Privacy Policy to continue.',
  authTermsPrefix: 'I agree to the',
  authTermsAnd: 'and',
  authIdPhotoBtnAdd: 'Add photo',
  authIdPhotoBtnChange: 'Change photo',
  pendingVerificationTitle: 'Almost there',
  pendingVerificationBody: "We're reviewing the photo of your student ID. This usually takes less than a day — you'll be let in automatically once it's approved, even if you close the app and come back later.",
  pendingVerificationRejectedTitle: "We couldn't verify you",
  pendingVerificationRejectedBody: "We couldn't confirm your student status from the photo you submitted. Add a clearer photo below and we'll take another look.",
  pendingVerificationResubmitBtn: 'Submit new photo',
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
  settingsFeedback: 'Send feedback',
  settingsBlockedUsers: 'Blocked users',
  blockedUsersTitle: 'Blocked users',
  blockedUsersEmpty: "You haven't blocked anyone",
  blockedUsersEmptyBody: 'Accounts you block will show up here — you can unblock them any time.',

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
  groupLabelPhoto: 'Cover photo',
  groupAddPhoto: 'Add photo',
  groupRemovePhoto: 'Remove photo',
  groupLabelName: 'Name *',
  groupLabelDescription: 'Description *',
  groupDescriptionPlaceholder: "What's this community about?",
  groupLabelUniversity: 'University (optional)',
  groupPrivateLabel: 'Private community',
  groupPrivateSub: 'Only visible to invited members',
  groupCreateBtn: 'Create community 🎉',
  groupEditTitle: 'Edit community',
  groupSaveBtn: 'Save changes',
  groupDeleteTitle: 'Delete community',
  groupDeleteBody: 'This will permanently delete the community for all members. This cannot be undone.',
  groupDeleteBtn: 'Delete community',
  groupMembersTitle: 'Members',
  groupKickTitle: 'Remove member?',
  groupKickBody: (name) => `${name} will be removed from this group.`,
  groupKickBtn: 'Remove',

  verifyTitle: 'Check your inbox',
  verifyBody: "We sent a verification link to your university email. Tap it to activate your keno. account, then come back here.",
  verifySpamHint: "Don't see it? Check your spam/junk folder — verification emails sometimes end up there.",
  verifyResent: '✓  Email resent — check your inbox.',
  verifyResendError: "Couldn't resend the email — you may be sending too many requests. Try again in a bit.",
  verifyBtnCheck: "I've verified my email",
  verifyBtnResend: 'Resend verification email',
  verifyBtnSignOut: 'Sign out',
  verifyTroubleLink: "Not getting the email?",
  verifyFallbackTitle: 'Switch to photo verification',
  verifyFallbackBody: "Some university mail servers never deliver our verification email at all. Switch to any other email you can access, plus a photo of your student ID — we'll review it manually, usually within a day.",
  verifyFallbackEmailLabel: 'Email you can access',
  verifyFallbackBtnSubmit: 'Send new verification link',
  verifyFallbackBtnCancel: 'Cancel',
  verifyFallbackSentTitle: 'Check your new inbox',
  verifyFallbackSentBody: (email) => `We sent a new verification link to ${email}. Once you confirm it, an admin will review your ID photo — usually within a day.`,
  verifyFallbackError: "Couldn't switch email — that address might already be in use, or something went wrong. Try again.",

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

  reconnectTitle: 'Will you meet again?',
  reconnectSubtitle: "Pick who you'd like to reconnect with. No one finds out unless they pick you too.",
  reconnectEmpty: 'No one new to reconnect with',
  reconnectAllDone: "Done! We'll let you know if it's a match.",
  reconnectSuggestedLabel: 'SUGGESTED',
  reconnectSendBtn: 'Send the invite',
  reconnectSkipBtn: 'Not now',
  reconnectError: 'Failed to record your pick',
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
  feedForYouHint: 'Πρόσθεσε ενδιαφέροντα στο προφίλ σου για εξατομικευμένες εκδηλώσεις',
  feedFindPeople: 'Βρες κόσμο →',
  profileErrorTitle: 'Κάτι πήγε στραβά',
  profileErrorBody: 'Τα δεδομένα του προφίλ σου λείπουν. Αποσυνδέσου και συνδέσου ξανά.',
  leaderboardTitle: 'Κατάταξη',
  leaderboardSubtitle: 'Η κατάταξη μηδενίζεται κάθε εβδομάδα',
  leaderboardSubtitleStudents: 'Δες ποιοι εμφανίζονται περισσότερο αυτή την εβδομάδα',
  leaderboardSubtitleUniversities: 'Ποια σχολή είναι πιο ενεργή αυτή την εβδομάδα',
  leaderboardUniversities: 'Πανεπιστήμια',
  leaderboardTopStudents: 'Κορυφαίοι Φοιτητές',
  leaderboardEmpty: 'Δεν υπάρχουν δεδομένα ακόμα αυτή την εβδομάδα',
  leaderboardGoing: (count) => `${count} πάνε`,
  leaderboardEvents: (count) => `${count} εκδηλώσ${count === 1 ? 'η' : 'εις'}`,
  leaderboardMeetups: (count) => `${count} συναντήσεις`,
  leaderboardBehindLeader: (gap, leader) => `${gap} πίσω από το ${leader}`,
  leaderboardLeadingUni: 'Στην κορυφή',
  leaderboardXpNote: 'XP παίρνεις μόνο όταν εμφανίζεσαι ή διοργανώνεις — ποτέ για χρόνο στην εφαρμογή.',
  leaderboardExplainer: 'Εδώ κατατάσσονται φοιτητές (και σχολές) με βάση τις πραγματικές εκδηλώσεις στις οποίες συμμετείχαν αυτή την εβδομάδα — όχι τη χρήση της εφαρμογής. Ανεβαίνεις συμμετέχοντας σε εκδηλώσεις, εμφανιζόμενος, ή διοργανώνοντας τη δική σου· η κατάταξη μηδενίζεται κάθε εβδομάδα, οπότε πάντα έχεις μια νέα ευκαιρία για την κορυφή.',
  leaderboardExplainerStudents: 'Κατατάσσεσαι με βάση τα πραγματικά check-in αυτή την εβδομάδα — όχι τη χρήση της εφαρμογής ή τις δηλώσεις συμμετοχής. Εμφανίσου για να ανέβεις· η κατάταξη μηδενίζεται κάθε εβδομάδα, οπότε πάντα έχεις μια νέα ευκαιρία.',
  leaderboardExplainerUniversities: 'Κατατάσσονται με βάση το σύνολο των check-in όλων των φοιτητών κάθε σχολής αυτή την εβδομάδα. Κάθε εκδήλωση στην οποία εμφανίζεται η σχολή σου μετράει στο σκορ της.',
  leaderboardRankGap: (xp, rank) => `${xp} XP από την ${rank}η θέση`,
  leaderboardYourSchool: 'Η ΣΧΟΛΗ ΣΟΥ',
  leaderboardYourUniversityScope: (universityName) => `ΤΟ ΠΑΝΕΠΙΣΤΗΜΙΟ ΣΟΥ · ${universityName.toUpperCase()}`,
  leaderboardAllGreece: 'ΟΛΗ Η ΕΛΛΑΔΑ',
  leaderboardNoUniData: 'Πρόσθεσε το πανεπιστήμιό σου στις Ρυθμίσεις για να το δεις',
  leaderboardQuests: 'Αποστολές',
  questsStreakLine: (weeks) => `${weeks} εβδομάδες σερί`,
  questsStreakBest: (best) => `Το καλύτερό σου: ${best}`,
  questsFreezeNote: 'Ένα token παγώματος καλύπτει αυτόματα μία εβδομάδα που έχασες, ώστε το σερί σου να μη σπάσει.',
  questsPauseBtn: (pausesLeft) => `Παγώστε το σερί αυτή την εβδομάδα (${pausesLeft} απομένουν αυτό το εξάμηνο)`,
  questsPauseAlreadySafe: 'Αυτή η εβδομάδα είναι ήδη προστατευμένη',
  questsSectionLabel: 'ΑΥΤΗ ΤΗ ΒΔΟΜΑΔΑ',
  questJoinEvents: 'Πήγαινε σε 2 events',
  questMeetPeople: 'Γνώρισε 3 νέα άτομα',
  questHostEvent: 'Διοργάνωσε ένα event',
  questCheckinEvent: 'Κάνε check-in σε ένα event',
  questSaveEvents: 'Αποθήκευσε 2 events',
  questFollowPeople: 'Ακολούθησε 2 άτομα',
  questsProgressOf: (progress, target) => `${progress} από ${target}`,
  questsNotStarted: 'Δεν ξεκίνησε',
  questsCompletedLabel: 'ΟΛΟΚΛΗΡΩΜΕΝΕΣ',
  questsCompletedText: 'Ολοκληρώθηκε',
  questsMysteryTitle: 'Μυστική αποστολή',
  questsMysteryReward: 'Σήμα επαλήθευσης',
  questsMysteryGoal: (target) => `Κάνε check-in σε ${target} events`,
  questsMysteryUnlocked: 'Ξεκλειδώθηκε — είσαι επαληθευμένος/η',
  feedForYou: 'Για σένα',
  feedSearchPlaceholder: 'Αναζήτηση εκδηλώσεων...',
  feedSearchTypePlaceholder: 'Τύπος εκδήλωσης — γιόγκα, debate, πεζοπορία...',
  feedEmptyFriendsTitle: 'Καμία εκδήλωση φίλων',
  feedEmptyFriendsBody: 'Ακολούθησε κόσμο για να δεις τις εκδηλώσεις τους!',
  feedEmptySearchBody: 'Δοκίμασε άλλο όρο ή δημιούργησε αυτό το είδος εκδήλωσης!',
  feedEmptyTitle: 'Τίποτα εδώ ακόμα',
  feedEmptyBody: 'Γίνε ο πρώτος που θα ποστάρει για το campus σου!',
  feedOpeningSoonLabel: 'Ξεκινούν σύντομα',
  feedFlagshipLabel: 'Το τελετουργικό της εβδομάδας',
  feedLeaderboardTitle: 'Κορυφαία Πανεπιστήμια Αυτή την Εβδομάδα',
  feedZeroWelcome: (name) => `Καλώς ήρθες,\n${name ? `${name}.` : 'φίλε.'}`,
  feedZeroSubtitle: 'Τρία πράγματα γίνονται κοντά σου, σε ακτίνα 5 χλμ. Δες ένα — τα υπόλοιπα έρχονται μόνα τους.',

  filterSheetTitle: 'Φίλτρα',
  filterSheetClear: 'Καθαρισμός',
  filterDistanceLabel: 'Απόσταση',
  filterWhenLabel: 'Πότε',
  filterWhoLabel: 'Ποιοι',
  filterRadius1: '1 χλμ',
  filterRadius5: '5 χλμ',
  filterRadius10: '10 χλμ',
  filterRadiusAll: 'Παντού',
  filterWhenToday: 'Σήμερα',
  filterWhenTomorrow: 'Αύριο',
  filterWhenWeekend: 'Σαββατοκύριακο',
  filterWhoUni: 'Από τη σχολή μου',
  filterWhoSolo: 'Έρχονται μόνοι',
  filterShowEvents: (n) => n === 1 ? 'Δείξε 1 event' : `Δείξε ${n} events`,

  mapEvents: (n) => n === 1 ? '1 εκδήλωση' : `${n} εκδηλώσεις`,
  mapEmptyTitle: 'Δεν υπάρχουν καρφιτσωμένες εκδηλώσεις κοντά',
  mapEmptyBody: 'Οι εκδηλώσεις εμφανίζονται εδώ όταν κάποιος καρφιτσώνει ακριβή τοποθεσία. Δοκίμασε άλλο φίλτρο ή ξανάρθε αργότερα.',
  mapAllCities: 'Όλες οι πόλεις',

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
  createSafetyNote: 'Ως διοργανωτής είσαι υπεύθυνος για την παρέα σου. Αναφορές εξετάζονται σε 24 ώρες.',
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

  errorBoundaryTitle: 'Κάτι πήγε στραβά',
  errorBoundaryBody: 'Συγγνώμη — η εφαρμογή συνάντησε ένα απρόσμενο σφάλμα. Δοκίμασε ξανά, και αν συνεχίσει να συμβαίνει, ενημέρωσέ μας από τις Ρυθμίσεις.',
  errorBoundaryRetryBtn: 'Δοκίμασε ξανά',

  createLabelEventOptions: 'Ρυθμίσεις',
  createPrivateLabel: 'Ιδιωτική Εκδήλωση',
  createPrivateHint: 'Μόνο με πρόσκληση',
  createCheckInInfoLabel: 'Μετά το check-in (προαιρετικό)',
  createCheckInInfoHint: 'Εμφανίζεται στους συμμετέχοντες μόλις κάνουν check-in — αριθμός τραπεζιού, τι να ψάξουν, ή φωτογραφία του σημείου συνάντησης.',
  createCheckInInfoPlaceholder: 'π.χ. "Ψάξε τις κόκκινες ομπρέλες δίπλα στο σιντριβάνι"',
  createCheckInInfoPhotoBtn: 'Πρόσθεσε φωτογραφία του σημείου συνάντησης',
  createSoloFriendlyLabel: 'Καλό να πας μόνος/η',
  createSoloFriendlyHint: 'Δείξε ότι είναι εντάξει να έρθει κάποιος μόνος/η του/της',
  eventSoloFriendlyTag: '🙋 Καλό να πας μόνος/η',
  createNoFiltersLabel: 'Χωρίς φίλτρα',
  createNoFiltersHint: 'Όλοι μπορούν να μπουν χωρίς ηλικία ή σχολή',
  createStakeLabel: 'Απαίτηση XP',
  createStakeHint: 'Τα μέλη ποντάρουν XP για να μπουν — και τα χάνουν (μαζί με ποινή) αν δεν εμφανιστούν',
  createLocationGeneral: 'Γενικά',
  createLocationExact: 'Ακριβές σημείο',
  createLocationNameLabel: 'Όνομα τοποθεσίας',
  createPinPlaced: 'Η καρφίτσα μπήκε — πάτα ξανά για να τη μετακινήσεις',
  createPinTap: 'Πάτα στον χάρτη για να καρφιτσώσεις',

  profileTitle: 'Προφίλ',
  profileEdit: 'Επεξεργασία',
  profileSave: 'Αποθήκευση',
  profileCancel: 'Ακύρωση',
  profileLabelName: 'Όνομα',
  profileLabelBio: 'Βιογραφικό',
  profileBioPlaceholder: 'Λοιπόν, ποιος είσαι;',
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
  profileStatEvents: 'Events',
  profileStatMeetups: 'Γνωριμίες',
  profileStatStreak: 'Σερί',
  profileLevelProgressLabel: (name) => `ΕΠΙΠΕΔΟ: ${name.toUpperCase()}`,
  profileLevelXpToNext: (xp) => `${xp} XP για το επόμενο επίπεδο`,
  profileLevelMaxed: 'Έφτασες στο ανώτατο επίπεδο!',
  levelsYouTag: 'ΕΣΥ',
  levelsXpToUnlock: (xp) => `+${xp} XP για ξεκλείδωμα`,
  levelsXpToNext: (xp, name) => `${xp} XP για ${name}`,
  levelsCeoOnly: 'Μόνο ο CEO μπορεί να έχει αυτό το επίπεδο',
  profileTicketsSection: (n) => `ΤΑ ΕΙΣΙΤΗΡΙΑ ΜΟΥ · ${n}`,
  profileBadgesTitle: '🏅 Διακρίσεις',
  badgeFirstStep: 'Πρώτο βήμα',
  badgeVeteran: 'Βετεράνος',
  badgeSocial: 'Κοινωνικός',
  badgeOrganizer: 'Διοργανωτής',
  badgeOnFire: 'Φωτιά',
  badgeMegaphone: 'Μεγάφωνο',
  badgeBetaTester: 'Beta Tester',
  badgeFirstStepDesc: 'Συμμετέχεις στην πρώτη σου εκδήλωση στο keno..',
  badgeVeteranDesc: 'Παρευρίσκεσαι σε 5 ή παραπάνω εκδηλώσεις.',
  badgeSocialDesc: 'Ακολουθείς 5 ή παραπάνω άτομα.',
  badgeOrganizerDesc: 'Δημιουργείς 3 ή παραπάνω εκδηλώσεις.',
  badgeOnFireDesc: 'Πηγαίνεις σε εκδηλώσεις 3 εβδομάδες σερί.',
  badgeMegaphoneDesc: 'Δημιουργείς την πρώτη σου εκδήλωση.',
  badgeBetaTesterDesc: 'Ήσουν από τους πρώτους στο keno., πριν βγει από το beta.',
  badgeEarned: '✓ Απόκτηθηκε',
  badgeNotEarned: 'Δεν έχει αποκτηθεί ακόμα',
  challengeJoin1Title: 'Πρώτο βήμα',
  challengeJoin1Desc: 'Συμμετοχή στην πρώτη σου εκδήλωση',
  challengeJoin5Title: 'Κοινωνικός',
  challengeJoin5Desc: 'Συμμετοχή σε 5 εκδηλώσεις',
  challengeJoin10Title: 'Σταθερός',
  challengeJoin10Desc: 'Συμμετοχή σε 10 εκδηλώσεις',
  challengeJoin25Title: 'Βετεράνος',
  challengeJoin25Desc: 'Συμμετοχή σε 25 εκδηλώσεις',
  challengeCreate1Title: 'Πρώτη εκδήλωση',
  challengeCreate1Desc: 'Δημιούργησε την πρώτη σου εκδήλωση',
  challengeCreate5Title: 'Διοργανωτής',
  challengeCreate5Desc: 'Δημιούργησε 5 εκδηλώσεις',
  challengeStreak3Title: 'Φωτιά',
  challengeStreak3Desc: 'Σερί παρουσίας 3 εβδομάδων',
  challengeStreak7Title: 'Ασταμάτητος',
  challengeStreak7Desc: 'Σερί παρουσίας 7 εβδομάδων',
  challengeFollow5Title: 'Συνδεδεμένος',
  challengeFollow5Desc: 'Ακολούθησε 5 άτομα',
  challengeFollow10Title: 'Δικτυωμένος',
  challengeFollow10Desc: 'Ακολούθησε 10 άτομα',
  profileTabUpcoming: (n) => `📅 Επερχόμενα (${n})`,
  profileTabPast: (n) => `🗂️ Παλαιά (${n})`,
  profileTabSaved: (n) => `🔖 Αποθηκευμένα (${n})`,
  profileEventsUpcomingTitle: 'Επερχόμενες εκδηλώσεις',
  profileEventsPastTitle: 'Παλαιές εκδηλώσεις',
  profileEventsSavedTitle: 'Αποθηκευμένες εκδηλώσεις',
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
  settingsSectionPreferences: 'Προτιμήσεις',
  settingsSoundEffects: 'Ηχητικά εφέ',
  settingsDynamicHero: 'Δυναμική μεγέθυνση κάρτας',
  settingsDynamicHeroHint: 'Το άγγιγμα μιας κάρτας τη μεγαλώνει σε προτεινόμενη κάρτα. Απενεργοποίησέ το για στατική ροή.',
  settingsSectionLanguage: 'Γλώσσα',
  settingsSectionAccount: 'Λογαριασμός',
  settingsUniDept: 'Πανεπιστήμιο & Τμήμα',
  settingsSectionInterests: 'Ενδιαφέροντα',
  settingsInterestsEdit: 'Επεξεργασία ενδιαφερόντων',
  settingsSectionDanger: 'Επικίνδυνη ζώνη',
  settingsSignOut: 'Αποσύνδεση',
  settingsDeleteAccount: 'Διαγραφή λογαριασμού',
  settingsTagline: 'keno. · φτιαγμένο για Έλληνες φοιτητές 🇬🇷',
  settingsUniPlaceholder: 'Όνομα πανεπιστημίου',
  settingsDeptPlaceholder: 'Τμήμα',
  settingsBtnCancel: 'Ακύρωση',
  imagePickerTitle: 'Προσθήκη φωτογραφίας',
  imagePickerCamera: 'Λήψη φωτογραφίας',
  imagePickerLibrary: 'Επιλογή από τη συλλογή',
  verifiedBadgeLabel: 'Επαληθευμένο',
  verifiedOrganiserBadgeLabel: 'Επαληθευμένος διοργανωτής',
  regularBadgeLabel: 'Τακτικός',
  groupMarkVerified: 'Σήμανση ως επαληθευμένος διοργανωτής',
  groupUnmarkVerified: 'Αφαίρεση επαλήθευσης διοργανωτή',
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
  settingsDeletePasswordTitle: 'Επιβεβαίωσε τον κωδικό σου',
  settingsDeletePasswordBody: 'Για ασφάλεια, γράψε τον κωδικό σου για να διαγράψεις μόνιμα τον λογαριασμό σου.',
  settingsDeletePasswordRequired: 'Γράψε τον κωδικό σου για να συνεχίσεις.',

  settingsVerification: 'Επαλήθευση',
  settingsVerifiedWith: (uni) => `${uni} ✓`,
  settingsVerifiedGeneric: 'Επαλήθευση ✓',
  settingsSectionNotifications: 'Ειδοποιήσεις',
  settingsNotifEventReminders: 'Υπενθυμίσεις εκδηλώσεων',
  settingsNotifGroupMessages: 'Μηνύματα ομάδων',
  settingsNotifSuggestions: 'Προτάσεις για εσένα',
  settingsThemeAuto: 'Αυτόματο',
  settingsThemeLight: 'Ημέρα',
  settingsThemeDark: 'Νύχτα',
  settingsSectionSafety: 'Ασφάλεια & Απόρρητο',
  settingsWhoSeesMe: 'Ποιοι με βλέπουν',
  settingsVisibilityStudents: 'Φοιτητές',
  settingsVisibilityConnections: 'Συνδέσεις',
  settingsReportIssue: 'Αναφορά προβλήματος',
  settingsEmergencyContact: 'Επαφή έκτακτης ανάγκης',
  settingsEmergencyNotSet: 'Δεν έχει οριστεί',
  settingsEmergencyNameLabel: 'Όνομα επαφής',
  settingsEmergencyNamePlaceholder: 'π.χ. Μαμά, συγκάτοικος...',
  settingsEmergencyPhoneLabel: 'Τηλέφωνο',
  settingsEmergencyPhonePlaceholder: '+30 69...',
  settingsSafetyNote: 'Κάθε αναφορά εξετάζεται μέσα σε 24 ώρες. Δεύτερη παράβαση σημαίνει αναστολή λογαριασμού.',
  settingsReportIssueTitle: 'Αναφορά προβλήματος',
  settingsReportIssueBody: 'Πες μας τι πήγε στραβά — bug, μη ασφαλής συμπεριφορά, ή οτιδήποτε άλλο. Θα το δούμε.',
  settingsReportIssuePlaceholder: 'Περιέγραψε το πρόβλημα…',
  settingsReportIssueAddScreenshot: 'Προσθήκη screenshot',
  settingsReportIssueRemoveScreenshot: 'Αφαίρεση screenshot',
  settingsReportIssueSubmit: 'Αποστολή',
  settingsReportIssueEmptyError: 'Γράψε πρώτα μια σύντομη περιγραφή.',
  settingsReportIssueSuccessTitle: 'Ευχαριστούμε!',
  settingsReportIssueSuccessBody: 'Η αναφορά σου καταχωρήθηκε — θα την εξετάσουμε μέσα σε 24 ώρες.',
  adminReportsIssueLabel: 'Πρόβλημα εφαρμογής',
  adminReportsDescriptionLabel: 'Περιγραφή',
  adminReportsScreenshotLabel: 'Προβολή screenshot',

  settingsSectionAdmin: 'Διαχείριση',
  settingsAdminReports: 'Έλεγχος αναφορών',
  adminReportsTitle: 'Αναφορές',
  adminReportsEmpty: 'Όλα καθαρά',
  adminReportsEmptyBody: 'Δεν υπάρχουν ανοιχτές αναφορές αυτή τη στιγμή.',
  adminReportsEventLabel: 'Αναφερθείσα εκδήλωση',
  adminReportsUserLabel: 'Αναφερθείς χρήστης',
  adminReportsReporterLabel: 'Αναφέρθηκε από',
  adminReportsDeleteBtn: 'Διαγραφή εκδήλωσης',
  adminReportsDismissBtn: 'Απόρριψη',
  adminReportsViewBtn: 'Προβολή',
  adminReportsConfirmDeleteTitle: 'Διαγραφή εκδήλωσης;',
  adminReportsConfirmDeleteBody: 'Αυτό θα διαγράψει μόνιμα την αναφερθείσα εκδήλωση για όλους τους συμμετέχοντες.',
  adminReportsEventGone: '(η εκδήλωση έχει ήδη διαγραφεί)',
  settingsAdminVerifications: 'Έλεγχος φοιτητικών ταυτοτήτων',
  adminVerificationsTitle: 'Επαλήθευση ταυτότητας',
  adminVerificationsEmpty: 'Όλα καθαρά',
  adminVerificationsEmptyBody: 'Δεν υπάρχουν εκκρεμείς επαληθεύσεις φοιτητικής ταυτότητας.',
  adminVerificationsApprove: 'Έγκριση',
  adminVerificationsReject: 'Απόρριψη',

  searchPlaceholder: 'Αναζήτηση ονόματος ή πανεπιστημίου...',
  searchPeopleLabel: 'Άτομα',
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
  eventReportFake: 'Ψεύτικος λογαριασμός',
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
  eventMutualConnections: (n) => (n === 1 ? '1 κοινή σύνδεση' : `${n} κοινές συνδέσεις`),
  eventWaitlistCount: (n) => `${n} στη λίστα αναμονής`,
  eventAbout: 'Σχετικά',
  eventWhosGoing: 'Ποιος πηγαίνει',
  eventInviteFriendBtn: 'Πρόσκληση',
  eventInviteFriendTitle: 'Προσκάλεσε φίλο',
  eventLiveModeTitle: '🔴 Ζωντανά τώρα',
  eventLiveTellFriendBtn: 'Πες το σε φίλο',
  eventLiveTellFriendMessage: (title, location, time) => `Είμαι στο "${title}" αυτή τη στιγμή — ${location}, ${time}`,
  eventLiveAddPhotoBtn: 'Πρόσθεσε φωτογραφία',
  eventLiveEndEventBtn: 'Τερμάτισε την εκδήλωση τώρα',
  eventLiveEndEventConfirmTitle: 'Τερματισμός εκδήλωσης;',
  eventLiveEndEventConfirmBody: 'Η εκδήλωση θα σημειωθεί ως ολοκληρωμένη για όλους αμέσως, αντί να περιμένει να λήξει μόνη της.',
  eventLiveSafetyBtn: '🆘 Ασφάλεια',
  eventLiveSafetyTitle: 'Χρειάζεσαι να επικοινωνήσεις με κάποιον;',
  eventLiveSafetyMessageBtn: (contact) => `Μήνυμα σε ${contact}`,
  eventLiveSafetyCall112: 'Κλήση 112',
  eventLiveSafetyNoContactTitle: 'Δεν έχει οριστεί επαφή έκτακτης ανάγκης',
  eventLiveSafetyNoContactBody: 'Πρόσθεσε μία στις Ρυθμίσεις ώστε αυτό το κουμπί να μπορεί να της στείλει γρήγορα την τοποθεσία σου.',
  eventLiveSafetySetupBtn: 'Ρύθμιση στις Ρυθμίσεις',
  eventFeedbackQuestion: 'Πώς πήγε;',
  eventFeedbackGood: '🙂 Καλή ώρα',
  eventFeedbackBad: '😕 Όχι και τόσο',
  eventRestrictions: 'Περιορισμοί',
  eventChatTitle: 'Συνομιλία',
  eventChatEmpty: 'Κανένα μήνυμα ακόμα — πες κάτι!',
  eventChatClosedNote: 'Αυτή η συζήτηση έκλεισε 24 ώρες μετά την έναρξη της εκδήλωσης — το ιστορικό παραμένει διαθέσιμο.',
  eventMsgDeleted: 'Το μήνυμα διαγράφηκε',
  eventMsgEdited: 'επεξεργάστηκε',
  eventEditSave: 'Αποθήκευση',
  eventDeleteMsgTitle: 'Διαγραφή μηνύματος;',
  eventDeleteMsgBody: 'Δεν μπορεί να αναιρεθεί.',
  editAction: 'Επεξεργασία',
  eventChatPlaceholder: 'Πες κάτι...',
  eventChatLocked: (n) => `Συμμετέχε για να δεις ${n} μήνυμα${n !== 1 ? 'τα' : ''}`,
  eventBtnJoin: 'Συμμετοχή',
  eventStakeXpLink: 'Στοίχημα XP για δέσμευση (προαιρετικό)',
  eventStakeRequiredHint: (xp) => `Απαιτεί στοίχημα ${xp} XP για συμμετοχή`,
  eventStakeNotEnoughXp: (xp) => `Χρειάζεσαι τουλάχιστον ${xp} XP για να συμμετάσχεις`,
  eventStakeModalTitle: 'Στοίχημα XP για συμμετοχή',
  eventStakeModalTitleRequired: 'Απαιτείται στοίχημα XP',
  eventStakeModalHint: 'Ποντάρισε XP για να δείξεις ότι το εννοείς. Τα παίρνεις πίσω + μπόνους αν κάνεις check-in!',
  eventStakeModalHintRequired: 'Αφού έχεις τα XP, το στοίχημα είναι ο τρόπος συμμετοχής — κρατάει τον κόσμο συνεπή. Θα τα πάρεις πίσω + μπόνους αν κάνεις check-in, αλλά θα τα χάσεις, μαζί με επιπλέον ποινή, αν δεν εμφανιστείς.',
  eventStakeBtn: (xp) => `Στοίχημα ${xp} XP`,
  eventBtnLeave: 'Αποχώρηση',
  eventBtnWaitlist: (n) => `Λίστα αναμονής (${n})`,
  eventWaitlistHint: 'Θα ειδοποιηθείς αν ανοίξει θέση',
  eventWaitlistCardTitle: 'Λίστα αναμονής',
  eventWaitlistPositionTag: (n) => `${n}ος`,
  eventWaitlistFullCopy: (filled, max) => `${filled} από ${max} θέσεις. Αν ακυρώσει κάποιος, μπαίνεις αυτόματα και σου στέλνουμε ειδοποίηση.`,
  eventWaitlistRestrictionsTitle: 'Περιορισμοί συμμετοχής',
  eventWaitlistCancelBtn: 'Ακύρωση',
  eventRecapShareTitle: 'Μοιράσου τη βραδιά',
  eventRecapShareStory: 'Κοινοποίηση',
  eventRecapSaveDevice: 'Αποθήκευση στο κινητό',
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
  eventJoinedNote: 'Είσαι μέσα. Θα σου θυμίσουμε πριν ξεκινήσει.',
  eventFilterAge: 'Ηλικία',
  eventNotEligibleAge: 'Δεν πληροίς το ηλικιακό όριο αυτής της εκδήλωσης.',
  eventNotEligibleUniversity: 'Αυτή η εκδήλωση είναι περιορισμένη σε συγκεκριμένα πανεπιστήμια.',
  eventShareCta: 'Βρες το στο keno.!',
  eventTyping1: (name) => `Ο/Η ${name} γράφει...`,
  eventTypingMany: (n) => `${n} άτομα γράφουν...`,
  eventWaitlistSpotOpened: (title) => `Άνοιξε θέση στο "${title}"!`,
  eventFriendGoing: (n) => `${n} φίλος${n !== 1 ? 'οι' : ''} πηγαίνει`,
  eventPrivateTitle: 'Ιδιωτική Εκδήλωση',
  eventPrivateBody: 'Αυτή η εκδήλωση είναι μόνο με πρόσκληση. Στείλε αίτημα και ο διοργανωτής μπορεί να σε δεχτεί.',
  eventPrivateBannerSub: 'Πάτα για να μοιραστείς το link πρόσκλησης με καλεσμένους',
  eventRequestJoin: 'Αίτημα συμμετοχής',
  eventRequestSent: 'Το αίτημα στάλθηκε ✓',
  eventRequestMessageHint: 'Πες στον διοργανωτή γιατί θέλεις να συμμετάσχεις.',
  eventRequestMessagePlaceholder: 'π.χ. Είμαι φίλος ενός φίλου, το είδα και θα ήθελα πολύ να έρθω!',
  eventRequestSendBtn: 'Αποστολή αιτήματος',
  eventJoinRequestsTitle: 'Αιτήματα συμμετοχής',
  eventRequestAccept: 'Αποδοχή',
  eventRequestDecline: 'Απόρριψη',
  notifEventJoinRequest: (name, title) => `Ο/Η ${name} ζήτησε να συμμετάσχει στο "${title}"`,
  notifEventJoinAccepted: (title) => `Μπήκες! Το αίτημά σου για το "${title}" έγινε δεκτό.`,
  notifGroupJoinRequest: (name, title) => `Ο/Η ${name} ζήτησε να συμμετάσχει στο "${title}"`,
  notifGroupJoinAccepted: (title) => `Μπήκες! Το αίτημά σου για το "${title}" έγινε δεκτό.`,
  eventQrTitle: 'QR Είσοδος',
  eventQrShowBtn: 'Εμφάνιση QR',
  eventQrRotateHint: 'Ανανεώνεται κάθε 30″ — ένα screenshot δεν θα δουλέψει για πολύ',
  eventShareRecapBtn: 'Μοιράσου την ανάμνηση',
  checkinTitle: 'Check-in',
  checkinScanHint: 'Σκάναρε τον κωδικό',
  checkinScanSub: 'Ο διοργανωτής τον δείχνει στο σημείο συνάντησης',
  checkinCantFindTitle: 'Δεν βρίσκω τον κωδικό',
  checkinCantFindBody: 'Ζήτα από τον διοργανωτή να σε κάνει check-in χειροκίνητα, ή γύρνα πίσω και σκάναρε όταν τον δείξει.',
  checkinBack: 'Πίσω',
  checkinInvalidTitle: 'Μη έγκυρος κωδικός',
  checkinInvalidBody: 'Αυτός ο κωδικός δεν ισχύει ή έληξε. Ζήτα από τον διοργανωτή να τον δείξει ξανά.',
  checkinWrongEventBody: 'Αυτός ο κωδικός είναι για διαφορετική εκδήλωση.',
  checkinPermissionTitle: 'Χρειάζεται πρόσβαση στην κάμερα',
  checkinPermissionBody: 'Το keno. χρειάζεται την κάμερά σου για να σκανάρει τον κωδικό check-in.',
  checkinPermissionBtn: 'Ενεργοποίηση κάμερας',
  checkinSuccessTitle: 'Είσαι μέσα.',
  checkinSeeWhoBtn: 'Δες ποιοι ήρθαν',
  checkinHereNow: (n) => `ΕΔΩ ΤΩΡΑ · ${n}`,
  checkinFindYourGroupTitle: 'Βρες την παρέα σου',
  checkinOrganizerTag: 'διοργανωτής',
  checkinArrivedSoloQuestion: 'Ήρθες μόνος/η;',
  checkinArrivedSoloYes: 'Ναι',
  checkinArrivedSoloNo: 'Όχι',
  ticketLabel: 'ΕΙΣΙΤΗΡΙΟ',
  ticketFirstSoloLabel: 'ΠΡΩΤΗ ΜΟΝΟΣ/Η',
  ticketWelcomeLabel: 'ΚΑΛΩΣ ΗΡΘΕΣ',
  ticketPlusOneLabel: 'PLUS ONE',
  ticketGroupBonusLabel: 'ΠΑΡΕΑ',
  checkinStreakStat: (weeks) => `${weeks} εβδομάδες σερί`,
  ticketWithCount: (n) => `μαζί με ${n}`,
  profileTicketsPageTitle: 'Τα εισιτήρια μου',
  profileTicketsPageSub: 'Κάθε check-in αφήνει ένα. Δεν χάνονται ποτέ.',
  profileTicketsPhotosBtn: 'Εισιτήρια & φωτογραφίες',
  profilePhotosSection: 'Οι φωτογραφίες μου',
  profilePhotosEmpty: 'Δεν υπάρχουν φωτογραφίες ακόμα — πρόσθεσε μία από τον τοίχο φωτογραφιών μιας εκδήλωσης.',
  profileTicketsSeeAll: 'Όλα',
  eventAnalyticsTitle: 'Στατιστικά',
  eventAnalyticsViews: 'Προβολές',
  eventAnalyticsSaves: 'Αποθηκεύτηκε',
  eventCoHostsTitle: 'Συν-διοργανωτές',
  eventMakeCoHost: '+ Συν-δ/τής',
  eventRemoveCoHost: 'Αφαίρεση',
  eventCoHostBadge: 'Συν-δ/τής',
  eventHostMissingTitle: 'Ο διοργανωτής δεν έχει φτάσει ακόμα',
  eventHostMissingBody: 'Ανάλαβε εσύ ως host ώστε να μπορούν όλοι να κάνουν check-in.',
  eventClaimHostBtn: 'Ανάλαβε ως host',
  eventClaimHostTooEarly: 'Είναι ακόμα νωρίς — δώσε λίγο χρόνο ακόμα στον διοργανωτή.',
  eventClaimHostError: 'Δεν ήταν δυνατή η ανάληψη. Δοκίμασε ξανά σε λίγο.',
  eventStandInBadge: 'Είσαι ο προσωρινός host',
  eventStandInAnnounce: (name: string) => `${name} ανέλαβε ως host`,
  eventShareCard: 'Κοινοποίηση κάρτας',
  eventShareCardScanHint: 'Σκάναρε για να ανοίξεις στο keno.',
  eventPhotoWall: 'Φωτογραφίες',
  eventPhotoWallEmpty: 'Δεν υπάρχουν φωτογραφίες ακόμα. Μοιράσου μια στιγμή!',
  eventPhotoWallRetentionHint: 'Οι φωτογραφίες διατηρούνται για 30 ημέρες — πάτησε σε μία για να την αποθηκεύσεις στη συσκευή σου πριν λήξει ο χρόνος.',
  eventPhotoSaveBtn: 'Αποθήκευση',
  eventPhotoSavePermissionDenied: 'Το Keno χρειάζεται άδεια για αποθήκευση φωτογραφιών στη βιβλιοθήκη σου.',
  eventPhotoSaveError: 'Αποτυχία αποθήκευσης φωτογραφίας.',
  mutualFriends: (n) => `${n} κοινοί`,
  userReviewCount: (n) => `${n} ${n === 1 ? 'άτομο πιστεύει' : 'άτομα πιστεύουν'} ότι είσαι φοβερός/ή`,
  dmTitle: 'Μηνύματα',
  dmEmpty: 'Δεν υπάρχουν συνομιλίες ακόμα',
  dmTabEvents: 'Εκδηλώσεις',
  dmTabGroups: 'Ομάδες',
  dmTabPersonal: 'Προσωπικά',
  dmTabRequests: (count) => (count > 0 ? `Αιτήματα · ${count}` : 'Αιτήματα'),
  dmEventEmpty: 'Δεν υπάρχουν συνομιλίες εκδηλώσεων ακόμα — συμμετέχεις σε μια εκδήλωση για να ξεκινήσεις',
  dmGroupEmpty: 'Δεν υπάρχουν ομαδικές συζητήσεις ακόμα — γίνε μέλος σε μια ομάδα για να ξεκινήσεις',
  dmRequestsEmpty: 'Δεν υπάρχουν εκκρεμή αιτήματα',
  dmPlaceholder: 'Μήνυμα...',
  dmBlockedByMe: 'Έχεις αποκλείσει αυτόν τον χρήστη. Άρσε τον αποκλεισμό από το προφίλ του για να στείλεις μηνύματα.',
  dmBlockedByThem: 'Δεν μπορείς πλέον να στείλεις μήνυμα σε αυτόν τον χρήστη.',
  dmNewMessage: '+ Νέο',
  searchUserMeta: (followers, events) => `${followers} ακόλουθοι · ${events} εκδηλώσεις`,
  onboardingBioPlaceholder: (dept, uni) => `${dept} @ ${uni}. Λοιπόν, ποιος είσαι;`,
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
  validAgeRequired: 'Η ηλικία είναι υποχρεωτική.',
  validAgeRange: 'Πρέπει να είσαι μεταξύ 16 και 100 ετών.',

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
  groupsMySection: 'ΟΙ ΟΜΑΔΕΣ ΜΟΥ',
  groupsSuggestedSection: 'ΠΡΟΤΕΙΝΟΜΕΝΕΣ',
  groupsJoinBtn: 'Μπες',

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
  notifGroupMessage: (name, title) => `Ο/Η ${name} έστειλε μήνυμα στο "${title}"`,
  notifLevelUp: (levelName) => `Ανέβηκες στο Επίπεδο ${levelName}. Κράτα το σερί σου!`,
  notifFriendGoing: (fromName, eventTitle) => `${fromName} πηγαίνει στο "${eventTitle}"`,
  notifReferralReward: (fromName, eventTitle) => `${fromName} έκανε check-in στο "${eventTitle}" — κερδίσατε και οι δύο εισιτήριο Plus One!`,
  notifSectionToday: 'ΣΗΜΕΡΑ',
  notifSectionYesterday: 'ΧΘΕΣ',
  notifSectionEarlier: 'ΠΑΛΙΟΤΕΡΑ',

  notifPermTitle: 'Θα σου θυμίζουμε;',
  notifPermBody: 'Μόνο δύο πράγματα: μία υπενθύμιση 2 ώρες πριν το event και όταν κάποιος γράφει στο chat της παρέας.',
  notifPermItemReminder: 'Υπενθύμιση πριν το event',
  notifPermItemGroupMsg: 'Μηνύματα παρέας',
  notifPermItemSuggestions: 'Προτάσεις & νέα',
  notifPermItemInactive: 'Ανενεργό',
  notifPermEnableBtn: 'Ενεργοποίηση',
  notifPermSkipBtn: 'Όχι τώρα',

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
  userFollowersTitle: 'Ακόλουθοι',
  userFollowingTitle: 'Ακολουθείς',
  userConnectionsTitle: 'Συνδέσεις',
  userConnectionsEmpty: 'Κανείς εδώ ακόμα.',
  userBetaTesterBadge: 'Beta Tester',
  userReportSubmitted: 'Η αναφορά υποβλήθηκε',
  userReportSubmittedBody: 'Ευχαριστούμε που μας ενημέρωσες. Θα ελέγξουμε αυτόν τον λογαριασμό.',
  userReportFailed: 'Η αναφορά απέτυχε',
  userReportFailedBody: 'Κάτι πήγε στραβά κατά την αποστολή της αναφοράς. Δοκίμασε ξανά.',
  cancel: 'Άκυρο',
  userMoreMenuTitle: 'Περισσότερες επιλογές',
  userReportBtn: 'Αναφορά χρήστη',
  userReportTitle: 'Αναφορά χρήστη',
  userReportPrompt: 'Γιατί αναφέρεις αυτόν τον λογαριασμό;',
  userReportSpam: 'Spam',
  userReportInappropriate: 'Ακατάλληλο περιεχόμενο',
  userReportFake: 'Ψεύτικος λογαριασμός',
  userBlockBtn: 'Αποκλεισμός χρήστη',
  userUnblockBtn: 'Άρση αποκλεισμού',
  userBlockTitle: 'Αποκλεισμός χρήστη',
  userBlockPrompt: 'Δεν θα μπορεί να δει το περιεχόμενό σου ούτε να επικοινωνήσει μαζί σου, και αυτό θα αναφερθεί στην ομάδα μας. Γιατί αποκλείεις αυτόν τον λογαριασμό;',
  userBlockOther: 'Άλλο',
  userBlockedTitle: 'Ο χρήστης αποκλείστηκε',
  userBlockedBody: (name) => `Ο/Η ${name} έχει αποκλειστεί. Το περιεχόμενό του/της είναι πλέον κρυφό για σένα.`,
  userBlockedBanner: 'Έχεις αποκλείσει αυτόν τον χρήστη.',
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
  editEventFlagshipLabel: '🗓️ Κύρια εκδήλωση "Keno τελετουργικό"',
  editEventFlagshipHint: 'Καρφιτσώνει αυτή την εκδήλωση πάνω από κάθε φίλτρο στο Feed — μόνο για admin, χρήση με φειδώ.',
  editEventType: 'Τύπος εκδήλωσης',

  onboardingWelcome: (name) => `Καλώς ήρθες στο keno.${name ? `, ${name}` : ''}!`,
  onboardingWelcomeSub: 'Βγες έξω, γνώρισε νέους ανθρώπους, διασκέδασε.',
  onboardingFeature1: 'Ανακάλυψε εκδηλώσεις κοντά σου',
  onboardingFeature2: 'Γνώρισε ανθρώπους από το campus σου',
  onboardingFeature3: 'Εξερεύνησε στον χάρτη',
  onboardingFeature4: 'Λάβε ειδοποιήσεις για ό,τι σε ενδιαφέρει',
  onboardingInterestsTitle: 'Τι σε ενδιαφέρει;',
  onboardingInterestsSub: 'Επίλεξε τουλάχιστον 3 ενδιαφέροντα και θα σου δείξουμε πιο σχετικές εκδηλώσεις.',
  onboardingInterestsPick: (n) => `Επίλεξε ${n} ακόμα για να συνεχίσεις`,
  onboardingInterestsCount: (n) => `${n} επιλεγμένα`,
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
  authTagline: 'less scrolling, more living.',
  authEmailLabel: 'Πανεπιστημιακό Email',
  authPasswordLabel: 'Κωδικός',
  authSignInBtn: 'Σύνδεση',
  authNoAccount: 'Δεν έχεις λογαριασμό; ',
  authSignUpLink: 'Εγγραφή',
  authSignUpTitle: 'Δημιουργία λογαριασμού',
  authSignUpSubtitle: 'Μόνο επαληθευμένοι φοιτητές μπορούν να γίνουν μέλη',
  welcomeTagline: 'Λιγότερο scrolling,\nπερισσότερη ζωή.',
  welcomeBody: 'Δες τι γίνεται σήμερα κοντά σου και πήγαινε. Με φοιτητές από τη σχολή σου.',
  welcomeGetStarted: 'Ξεκίνα',
  welcomeHaveAccount: 'Έχω ήδη λογαριασμό',
  welcomeTermsNotice: 'Συνεχίζοντας αποδέχεσαι τους όρους χρήσης',
  authNameLabel: 'Πλήρες Όνομα',
  authUniLabel: 'Πανεπιστήμιο',
  authDeptLabel: 'Τμήμα',
  authAgeLabel: 'Ηλικία',
  authNoUniEmailLink: 'Δεν έχεις πανεπιστημιακό email; Κάνε εγγραφή με το πάσο σου',
  authNoUniEmailBanner: 'Κανένα πρόβλημα — χρησιμοποίησε όποιο email έχεις, και ανέβασε παρακάτω μια φωτογραφία του πάσου σου. Ένας admin θα την ελέγξει χειροκίνητα, συνήθως μέσα σε μία μέρα, πριν σου δώσει πλήρη πρόσβαση.',
  authEmailDeclinedBanner: 'Δεν αναγνωρίσαμε αυτό το email ως πανεπιστημιακό, οπότε σε περάσαμε αυτόματα σε επαλήθευση με πάσο — ανέβασε παρακάτω μια φωτογραφία του πάσου σου και θα το ελέγξουμε χειροκίνητα, συνήθως μέσα σε μία μέρα.',
  authEmailDeclinedTryAgain: 'Δοκίμασε διαφορετικό πανεπιστημιακό email',
  authGenericEmailHint: 'Οποιοδήποτε email έχεις πρόσβαση — θα το χρειαστείς για να επιβεβαιώσεις τον λογαριασμό σου.',
  authUseUniEmailLink: 'Έχω πανεπιστημιακό email',
  authIdPhotoLabel: 'Φωτογραφία φοιτητικής ταυτότητας (πάσο)',
  authIdPhotoHint: 'Θα την ελέγξουμε χειροκίνητα πριν σου δώσουμε πλήρη πρόσβαση — συνήθως μέσα σε μία μέρα.',
  authIdPhotoRequired: 'Χρειάζεται φωτογραφία της φοιτητικής σου ταυτότητας.',
  authTermsRequired: 'Πρέπει να αποδεχτείς τους Όρους Χρήσης και την Πολιτική Απορρήτου για να συνεχίσεις.',
  authTermsPrefix: 'Αποδέχομαι τους',
  authTermsAnd: 'και την',
  authIdPhotoBtnAdd: 'Πρόσθεσε φωτογραφία',
  authIdPhotoBtnChange: 'Άλλαξε φωτογραφία',
  pendingVerificationTitle: 'Σχεδόν έτοιμος',
  pendingVerificationBody: 'Ελέγχουμε τη φωτογραφία της φοιτητικής σου ταυτότητας. Συνήθως παίρνει λιγότερο από μία μέρα — θα μπεις αυτόματα μόλις εγκριθεί, ακόμα κι αν κλείσεις την εφαρμογή και επιστρέψεις αργότερα.',
  pendingVerificationRejectedTitle: 'Δεν μπορέσαμε να σε επαληθεύσουμε',
  pendingVerificationRejectedBody: 'Δεν μπορέσαμε να επιβεβαιώσουμε τη φοιτητική σου ιδιότητα από τη φωτογραφία. Πρόσθεσε μια πιο καθαρή φωτογραφία παρακάτω και θα την ξανακοιτάξουμε.',
  pendingVerificationResubmitBtn: 'Υποβολή νέας φωτογραφίας',
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
  settingsFeedback: 'Στείλε σχόλια',
  settingsBlockedUsers: 'Αποκλεισμένοι χρήστες',
  blockedUsersTitle: 'Αποκλεισμένοι χρήστες',
  blockedUsersEmpty: 'Δεν έχεις αποκλείσει κανέναν',
  blockedUsersEmptyBody: 'Οι λογαριασμοί που αποκλείεις θα εμφανίζονται εδώ — μπορείς να άρεις τον αποκλεισμό όποτε θέλεις.',

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
  groupLabelPhoto: 'Φωτογραφία εξωφύλλου',
  groupAddPhoto: 'Προσθήκη φωτογραφίας',
  groupRemovePhoto: 'Αφαίρεση φωτογραφίας',
  groupLabelName: 'Όνομα *',
  groupLabelDescription: 'Περιγραφή *',
  groupDescriptionPlaceholder: 'Για τι πρόκειται αυτή η κοινότητα;',
  groupLabelUniversity: 'Πανεπιστήμιο (προαιρετικό)',
  groupPrivateLabel: 'Ιδιωτική κοινότητα',
  groupPrivateSub: 'Ορατή μόνο σε προσκεκλημένα μέλη',
  groupCreateBtn: 'Δημιουργία κοινότητας 🎉',
  groupEditTitle: 'Επεξεργασία κοινότητας',
  groupSaveBtn: 'Αποθήκευση αλλαγών',
  groupDeleteTitle: 'Διαγραφή κοινότητας',
  groupDeleteBody: 'Αυτό θα διαγράψει μόνιμα την κοινότητα για όλα τα μέλη. Δεν μπορεί να αναιρεθεί.',
  groupDeleteBtn: 'Διαγραφή κοινότητας',
  groupMembersTitle: 'Μέλη',
  groupKickTitle: 'Αφαίρεση μέλους;',
  groupKickBody: (name) => `Ο/Η ${name} θα αφαιρεθεί από αυτή την ομάδα.`,
  groupKickBtn: 'Αφαίρεση',

  verifyTitle: 'Έλεγξε το inbox σου',
  verifyBody: 'Στείλαμε σύνδεσμο επαλήθευσης στο πανεπιστημιακό σου email. Πάτησέ τον για να ενεργοποιήσεις τον λογαριασμό σου στο keno..',
  verifySpamHint: 'Δεν το βλέπεις; Έλεγξε τον φάκελο ανεπιθύμητης αλληλογραφίας (spam) — μερικές φορές τα emails επαλήθευσης καταλήγουν εκεί.',
  verifyResent: '✓  Email απεστάλη — έλεγξε το inbox σου.',
  verifyResendError: 'Δεν στάλθηκε το email — ίσως έστειλες πολλά αιτήματα. Δοκίμασε ξανά σε λίγο.',
  verifyBtnCheck: 'Επαλήθευσα το email μου',
  verifyBtnResend: 'Επαναποστολή email επαλήθευσης',
  verifyBtnSignOut: 'Αποσύνδεση',
  verifyTroubleLink: 'Δεν λαμβάνεις το email;',
  verifyFallbackTitle: 'Αλλαγή σε επαλήθευση με φωτογραφία',
  verifyFallbackBody: 'Μερικοί διακομιστές email πανεπιστημίων δεν παραδίδουν ποτέ το email επαλήθευσής μας. Άλλαξε σε οποιοδήποτε άλλο email έχεις πρόσβαση, μαζί με φωτογραφία της φοιτητικής σου ταυτότητας — θα την ελέγξουμε χειροκίνητα, συνήθως μέσα σε μία μέρα.',
  verifyFallbackEmailLabel: 'Email που έχεις πρόσβαση',
  verifyFallbackBtnSubmit: 'Αποστολή νέου συνδέσμου επαλήθευσης',
  verifyFallbackBtnCancel: 'Άκυρο',
  verifyFallbackSentTitle: 'Έλεγξε το νέο σου inbox',
  verifyFallbackSentBody: (email) => `Στείλαμε νέο σύνδεσμο επαλήθευσης στο ${email}. Μόλις τον επιβεβαιώσεις, ένας διαχειριστής θα ελέγξει τη φωτογραφία ταυτότητάς σου — συνήθως μέσα σε μία μέρα.`,
  verifyFallbackError: 'Δεν μπορέσαμε να αλλάξουμε το email — ίσως η διεύθυνση χρησιμοποιείται ήδη, ή κάτι πήγε στραβά. Δοκίμασε ξανά.',

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

  reconnectTitle: 'Θα ξαναβρεθείτε;',
  reconnectSubtitle: 'Διάλεξε ποιους θα ήθελες να ξαναδείς. Κανείς δεν μαθαίνει τίποτα αν δεν σε διαλέξουν κι εκείνοι.',
  reconnectEmpty: 'Δεν υπάρχει κανείς νέος για επανασύνδεση',
  reconnectAllDone: 'Έγινε! Θα σε ενημερώσουμε αν είναι match.',
  reconnectSuggestedLabel: 'ΠΡΟΤΑΣΗ',
  reconnectSendBtn: 'Στείλε την πρόταση',
  reconnectSkipBtn: 'Όχι τώρα',
  reconnectError: 'Αποτυχία καταγραφής της επιλογής σου',
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
