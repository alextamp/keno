import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';
import { AnimatedPressable as ListItemPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDoc, getDocs, doc, addDoc, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { EventEntity, isAttending, isEventPast } from '@/features/events/domain/entities/event.entity';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { notificationsRepository } from '@/features/notifications/notifications.repository';
import { haptics } from '@/core/utils/haptics';
import { isLeft } from '@/core/utils/either';
import { EventCard } from '@/components/ui/EventCard';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';
import { getLevel, isBetaTesterUser, getReliabilityBadge, isVerifiedUser, isRegularUser } from '@/core/constants/gamification';
import { REVIEW_EMOJI } from '@/features/reviews/domain/entities/review.entity';
import { LevelsModal } from '@/components/ui/LevelsModal';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';

interface PublicProfile {
  uid: string;
  name: string;
  bio?: string;
  avatarColor?: string;
  photoUri?: string;
  universityName: string;
  department: string;
  createdEvents: string[];
  joinedEvents: string[];
  following: string[];
  followers: string[];
  xp: number;
  reliabilityScore?: number;
  checkInCount?: number;
  currentStreak?: number;
  reviewSummary?: { count: number };
  isBetaTester?: boolean;
  createdAt?: Date;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function UserProfileScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const followUser = useAuthStore((s) => s.followUser);
  const unfollowUser = useAuthStore((s) => s.unfollowUser);
  const blockUser = useAuthStore((s) => s.blockUser);
  const unblockUser = useAuthStore((s) => s.unblockUser);
  const feedEvents = useEventsStore((s) => s.events);
  const t = useTranslation();
  const { language } = useLanguageStore();
  const reportAnim = usePressAnimation(0.9);
  const levelAnim = usePressAnimation(0.95);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<EventEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);

  const isFollowing = currentUser?.following?.includes(uid) ?? false;
  const isBlocked = currentUser?.blockedUserIds?.includes(uid) ?? false;

  useEffect(() => {
    if (!uid) return;
    loadProfile();
  }, [uid]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        setProfile({
          uid,
          name: data.name ?? 'Unknown',
          bio: data.bio,
          avatarColor: data.avatarColor ?? '#B8482A',
          photoUri: data.photoUri,
          universityName: data.universityName ?? '',
          department: data.department ?? '',
          createdEvents: data.createdEvents ?? [],
          joinedEvents: data.joinedEvents ?? [],
          following: data.following ?? [],
          followers: data.followers ?? [],
          xp: data.xp ?? 0,
          isBetaTester: data.isBetaTester ?? false,
          reliabilityScore: data.reliabilityScore ?? 0,
          checkInCount: data.checkInCount ?? 0,
          currentStreak: data.currentStreak ?? 0,
          reviewSummary: data.reviewSummary,
          createdAt: data.createdAt?.toDate?.() ?? undefined,
        });
      }
      // Load reviews for this user
      try {
        const reviewsSnap = await getDocs(collection(db, 'users', uid, 'reviews'));
        setProfile((p) => p ? { ...p, reviewSummary: { count: reviewsSnap.docs.length } } : p);
      } catch (e) {}


      const result = await eventsRepository.getEventsByAttendee(uid);
      if (!isLeft(result)) {
        setUpcomingEvents(result.right.filter((e) => !isEventPast(e)));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || !profile || currentUser.id === uid) return;
    haptics.medium();
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(uid);
        setProfile((p) => p ? { ...p, followers: p.followers.filter((id) => id !== currentUser.id) } : p);
        haptics.light();
      } else {
        await followUser(uid, profile.name, profile.avatarColor);
        setProfile((p) => p ? { ...p, followers: [...p.followers, currentUser.id] } : p);
        haptics.success();
      }
    } catch {
      Alert.alert(t.userInviteErrorTitle, t.authErrGeneric);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleInvite = async (event: EventEntity) => {
    if (!currentUser || !profile) return;
    haptics.light();
    try {
      await notificationsRepository.create({
        toUid: uid,
        fromUid: currentUser.id,
        fromName: currentUser.name,
        fromAvatarColor: currentUser.avatarColor,
        fromPhotoUri: currentUser.photoUri,
        type: 'event_invite',
        eventId: event.id,
        eventTitle: event.title,
      });
      // Referral credit — see event/[id].tsx's mirrored invite flow for the
      // full explanation of onCheckInCreated's Plus One reward. referredBy
      // isn't client-writable — claimReferral (Cloud Function) records it
      // server-side instead.
      eventsRepository.claimReferral(event.id, uid).catch(() => {});
      setInviteModal(false);
      Alert.alert(t.userInviteSentTitle, t.userInviteSentBody(profile.name, event.title));
    } catch {
      Alert.alert(t.userInviteErrorTitle, t.userInviteErrorBody);
    }
  };

  const handleMoreMenu = () => {
    Alert.alert(
      t.userMoreMenuTitle,
      undefined,
      [
        { text: t.userReportBtn, onPress: handleReport },
        isBlocked
          ? { text: t.userUnblockBtn, onPress: handleUnblock }
          : { text: t.userBlockBtn, style: 'destructive', onPress: handleBlockPrompt },
        { text: t.cancel, style: 'cancel' },
      ],
    );
  };

  const handleReport = () => {
    Alert.alert(
      t.userReportTitle,
      t.userReportPrompt,
      [
        { text: t.userReportSpam, onPress: () => submitReport('spam') },
        { text: t.userReportInappropriate, onPress: () => submitReport('inappropriate') },
        { text: t.userReportFake, onPress: () => submitReport('fake') },
        { text: t.cancel, style: 'cancel' },
      ],
    );
  };

  const submitReport = async (reason: string) => {
    if (!currentUser) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reportedUid: uid,
        reporterUid: currentUser.id,
        reason,
        createdAt: new Date(),
      });
      Alert.alert(t.userReportSubmitted, t.userReportSubmittedBody);
    } catch {
      Alert.alert(t.userReportFailed, t.userReportFailedBody);
    }
  };

  const handleBlockPrompt = () => {
    Alert.alert(
      t.userBlockTitle,
      t.userBlockPrompt,
      [
        { text: t.userReportSpam, onPress: () => confirmBlock('spam') },
        { text: t.userReportInappropriate, onPress: () => confirmBlock('inappropriate') },
        { text: t.userReportFake, onPress: () => confirmBlock('fake') },
        { text: t.userBlockOther, onPress: () => confirmBlock('other') },
        { text: t.cancel, style: 'cancel' },
      ],
    );
  };

  const confirmBlock = async (reason: string) => {
    if (!profile) return;
    try {
      await blockUser(uid, reason);
      haptics.success();
      Alert.alert(t.userBlockedTitle, t.userBlockedBody(profile.name));
    } catch {
      Alert.alert(t.userReportFailed, t.userReportFailedBody);
    }
  };

  const handleUnblock = async () => {
    try {
      await unblockUser(uid);
      haptics.light();
    } catch {
      Alert.alert(t.userReportFailed, t.userReportFailedBody);
    }
  };

  if (loading) return <LoadingScreen />;

  if (!profile) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="back" size={16} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.errorText, { color: colors.textHint }]}>{t.userNotFound}</Text>
      </View>
    );
  }

  const initials = profile.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  const bs = colors.border;
  const profileLevel = getLevel(profile.xp, uid);
  const mutualCount = currentUser
    ? (currentUser.following ?? []).filter((f) => profile.followers.includes(f) || profile.following.includes(f)).length
    : 0;
  const myUpcomingCreated = feedEvents.filter(
    (e) => e.creatorId === currentUser?.id && !isEventPast(e),
  );

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <ScreenHeader
        title={t.userProfileTitle}
        titleStyle={{ fontSize: 24 }}
        right={
          <AnimatedPressable onPress={handleMoreMenu} onPressIn={reportAnim.onPressIn} onPressOut={reportAnim.onPressOut} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: bs }, reportAnim.animatedStyle]}>
            <Icon name="more" size={16} color={colors.textHint} />
          </AnimatedPressable>
        }
      />

      {/* Avatar */}
      <View style={styles.avatarSection}>
        {profile.photoUri ? (
          <Image source={{ uri: profile.photoUri }} style={[styles.avatarPhoto, { borderColor: bs }]} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: profile.avatarColor ?? colors.primary, borderColor: bs }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
        )}
        <Text style={[styles.name, { color: colors.textPrimary }]}>{profile.name}</Text>
        {isBetaTesterUser(profile) && (
          <View style={[styles.uniBadge, { backgroundColor: '#FCE96A', borderColor: bs }]}>
            <Text style={[styles.uniText, { color: '#5b2a04' }]}>{t.userBetaTesterBadge}</Text>
          </View>
        )}
        {!!profile.universityName && (
          <View style={[styles.uniBadge, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
            <Text style={[styles.uniText, { color: colors.textSecondary }]}>{universityLabel(profile.universityName, language)}</Text>
          </View>
        )}
        {/* Level badge */}
        <AnimatedPressable
          onPress={() => setShowLevelModal(true)}
          onPressIn={levelAnim.onPressIn}
          onPressOut={levelAnim.onPressOut}
          style={[styles.levelBadge, { backgroundColor: profileLevel.color + '18', borderColor: profileLevel.color }, levelAnim.animatedStyle]}
        >
          <Icon name={profileLevel.icon} size={14} color={profileLevel.color} />
          <Text style={[styles.levelBadgeName, { color: profileLevel.color }]}>{profileLevel.name}</Text>
          <Text style={[styles.levelBadgeXP, { color: profileLevel.color }]}>{profile.xp} XP</Text>
        </AnimatedPressable>

        {/* Verified badge — checked in to 5+ events, so this shows on the
            PUBLIC profile (not just your own), which is the whole point:
            proof to others that this person actually shows up. */}
        {isVerifiedUser(profile.checkInCount) && <VerifiedBadge />}
        {isRegularUser(profile.currentStreak) && <VerifiedBadge label={t.regularBadgeLabel} icon="flame" />}

        {/* Reliability badge - Anti-Flake system */}
        {(profile.reliabilityScore ?? 0) > 0 && (
          <View style={[styles.uniBadge, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
            <Text style={[styles.uniText, { color: getReliabilityBadge(profile.reliabilityScore ?? 0).color }]}>
              {Math.round(profile.reliabilityScore ?? 0)}% Reliable
            </Text>
          </View>
        )}
        {/* Review summary badge */}
        {(profile.reviewSummary?.count ?? 0) > 0 && (
          <View style={[styles.uniBadge, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
            <Text style={[styles.uniText, { color: colors.textSecondary }]}>
              {REVIEW_EMOJI} {t.userReviewCount(profile.reviewSummary?.count ?? 0)}
            </Text>
          </View>
        )}
        {!!profile.department && (
          <Text style={[styles.dept, { color: colors.textHint }]}>{profile.department}</Text>
        )}

        {/* Action buttons */}
        {isBlocked ? (
          <View style={[styles.blockedBanner, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
            <Text style={[styles.blockedBannerText, { color: colors.textSecondary }]}>{t.userBlockedBanner}</Text>
            <Button
              label={t.userUnblockBtn}
              onPress={handleUnblock}
              shape="pill"
              size="sm"
              style={{ backgroundColor: colors.surface, borderColor: bs }}
              labelStyle={{ color: colors.textPrimary }}
            />
          </View>
        ) : (
          <View style={styles.actionRow}>
            {currentUser?.id !== uid && (
              <Button
                label={isFollowing ? t.userFollowing : t.userFollow}
                onPress={handleFollow}
                loading={followLoading}
                shape="pill"
                size="sm"
                style={{ backgroundColor: isFollowing ? colors.surfaceVariant : colors.primary, borderColor: bs }}
                labelStyle={{ color: isFollowing ? colors.textPrimary : '#fff' }}
              />
            )}

            {currentUser && currentUser.id !== uid && (
              <Button
                label={t.dmTitle}
                onPress={() => router.push(`/(app)/dm/${uid}` as any)}
                shape="pill"
                size="sm"
                style={{ backgroundColor: colors.surfaceVariant, borderColor: bs }}
                labelStyle={{ color: colors.textPrimary }}
              />
            )}
            {currentUser?.id !== uid && myUpcomingCreated.length > 0 && (
              <Button
                label={t.userInvite}
                onPress={() => setInviteModal(true)}
                shape="pill"
                size="sm"
                style={{ backgroundColor: colors.surfaceVariant, borderColor: bs }}
                labelStyle={{ color: colors.textPrimary }}
              />
            )}
          </View>
        )}

        {/* Follower counts */}
        <View style={styles.followStats}>
          <Pressable onPress={() => router.push(`/(app)/user/connections/${uid}?type=followers` as any)}>
            <Text style={[styles.followStat, { color: colors.textSecondary }]}>
              <Text style={[styles.followNum, { color: colors.textPrimary }]}>
                {profile.followers?.length ?? 0}
              </Text>
              {t.userFollowers}
            </Text>
          </Pressable>
          <Text style={[styles.followDot, { color: colors.textHint }]}>·</Text>
          <Pressable onPress={() => router.push(`/(app)/user/connections/${uid}?type=following` as any)}>
            <Text style={[styles.followStat, { color: colors.textSecondary }]}>
              <Text style={[styles.followNum, { color: colors.textPrimary }]}>
                {profile.following?.length ?? 0}
              </Text>
              {t.userFollowing2}
            </Text>
          </Pressable>
        </View>
        {mutualCount > 0 && (
          <View style={[styles.mutualChip, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
            <Icon name="users" size={12} color={colors.textSecondary} />
            <Text style={[styles.mutualText, { color: colors.textSecondary }]}>{t.mutualFriends(mutualCount)}</Text>
          </View>
        )}
      </View>

      {/* Bio */}
      {!!profile.bio && (
        <View style={[styles.bioCard, { backgroundColor: colors.surface, borderColor: bs }]}>
          <Text style={[styles.bioLabel, { color: colors.textHint }]}>{t.userAbout}</Text>
          <Text style={[styles.bioText, { color: colors.textPrimary }]}>{profile.bio}</Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { n: profile.createdEvents.length, label: t.userStatCreated },
          { n: (profile.joinedEvents ?? []).filter((id) => !profile.createdEvents.includes(id)).length, label: t.userStatJoined },
        ].map(({ n, label }) => (
          <View key={label} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: bs }]}>
            <Text style={[styles.statNumber, { color: colors.primary }]}>{n}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Upcoming events */}
      {upcomingEvents.length > 0 ? (
        <View style={styles.eventsSection}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.userUpcoming}</Text>
          <View style={styles.eventsList}>
            {upcomingEvents.map((e) => (
              <EventCard
                key={e.id}
                event={e}
                isJoined={currentUser ? isAttending(e, currentUser.id) : false}
                onPress={() => router.push(`/(app)/event/${e.id}`)}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: bs }]}>
          <Icon name="cal" size={30} color={colors.textDecor} />
          <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.userNoUpcoming}</Text>
        </View>
      )}

      <LevelsModal visible={showLevelModal} xp={profile.xp} uid={uid} onClose={() => setShowLevelModal(false)} />

      {/* Invite modal */}
      <Modal visible={inviteModal} transparent animationType="slide" onRequestClose={() => setInviteModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInviteModal(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.surface, borderColor: bs }]} onPress={() => {}}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {t.userInviteTo(profile.name)}
            </Text>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {myUpcomingCreated.map((e) => (
                <ListItemPressable
                  key={e.id}
                  onPress={() => handleInvite(e)}
                  scaleTo={0.97}
                  style={[styles.inviteRow, { borderColor: bs, backgroundColor: colors.background }]}
                >
                  <Text style={[styles.inviteTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {e.title}
                  </Text>
                  <Text style={[styles.inviteDate, { color: colors.textHint }]}>
                    {e.dateTime.toLocaleDateString('el-GR', { day: 'numeric', month: 'short' })}
                  </Text>
                </ListItemPressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.lg },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  errorText: { fontSize: FontSize.base },
  backBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarSection: { alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  avatarPhoto: { width: 84, height: 84, borderRadius: 42 },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: FontWeight.bold },
  name: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.4, marginTop: Spacing.sm },
  uniBadge: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 6, borderWidth: 1 },
  uniText: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  dept: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  blockedBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 8, marginTop: Spacing.xs },
  blockedBannerText: { fontSize: FontSize.sm, fontFamily: UIFontLight, flexShrink: 1 },
  followStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  followStat: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  followNum: { fontWeight: FontWeight.bold, fontFamily: UIFont },
  followDot: { fontSize: FontSize.sm },
  bioCard: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6 },
  bioLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.4 },
  bioText: { fontSize: FontSize.base, fontFamily: UIFontLight, lineHeight: 21 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: 4 },
  statNumber: { fontSize: FontSize.xxxl, fontWeight: FontWeight.bold, letterSpacing: -1, fontFamily: TitleFont },
  statLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  eventsSection: { gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  eventsList: { gap: 14 },
  emptyCard: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  emptyText: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,14,10,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.xl, paddingBottom: 40, gap: Spacing.md, maxHeight: '70%' },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.sm },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: TitleFont },
  modalList: { flexGrow: 0 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 14, marginBottom: Spacing.sm },
  inviteTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont, flex: 1 },
  inviteDate: { fontSize: FontSize.sm },
  mutualChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 5, borderWidth: 1 },
  mutualText: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 7 },
  levelBadgeName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  levelBadgeXP: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, opacity: 0.75 },
});
