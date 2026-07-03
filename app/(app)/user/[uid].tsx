import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';
import { AnimatedPressable as ListItemPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getDoc, doc, addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { EventEntity, isAttending } from '@/features/events/domain/entities/event.entity';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { notificationsRepository } from '@/features/notifications/notifications.repository';
import { haptics } from '@/core/utils/haptics';
import { isLeft } from '@/core/utils/either';
import { EventCard } from '@/components/ui/EventCard';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';
import { getLevel } from '@/core/constants/gamification';
import { LevelsModal } from '@/components/ui/LevelsModal';

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
          avatarColor: data.avatarColor ?? '#C94D0A',
          photoUri: data.photoUri,
          universityName: data.universityName ?? '',
          department: data.department ?? '',
          createdEvents: data.createdEvents ?? [],
          joinedEvents: data.joinedEvents ?? [],
          following: data.following ?? [],
          followers: data.followers ?? [],
          xp: data.xp ?? 0,
        });
      }
      const result = await eventsRepository.getEventsByAttendee(uid);
      if (!isLeft(result)) {
        const now = new Date();
        setUpcomingEvents(result.right.filter((e) => e.dateTime >= now));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUser || !profile) return;
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
        type: 'event_invite',
        eventId: event.id,
        eventTitle: event.title,
      });
      setInviteModal(false);
      Alert.alert(t.userInviteSentTitle, t.userInviteSentBody(profile.name, event.title));
    } catch {
      Alert.alert(t.userInviteErrorTitle, t.userInviteErrorBody);
    }
  };

  const handleReport = () => {
    Alert.alert(
      'Report User',
      'Why are you reporting this account?',
      [
        { text: 'Spam', onPress: () => submitReport('spam') },
        { text: 'Inappropriate content', onPress: () => submitReport('inappropriate') },
        { text: 'Fake account', onPress: () => submitReport('fake') },
        { text: 'Cancel', style: 'cancel' },
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
      Alert.alert('Report submitted', "Thanks for letting us know. We'll review this account.");
    } catch {
      Alert.alert('Report failed', 'Something went wrong sending your report. Please try again.');
    }
  };

  if (loading) return <LoadingScreen />;

  if (!profile) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} style={[styles.backBtn, { borderColor: colors.borderStrong }]}>
          <Text style={[styles.backIcon, { color: colors.textPrimary }]}>←</Text>
        </Pressable>
        <Text style={[styles.errorText, { color: colors.textHint }]}>{t.userNotFound}</Text>
      </View>
    );
  }

  const initials = profile.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  const bs = colors.borderStrong;
  const profileLevel = getLevel(profile.xp);
  const now = new Date();
  const mutualCount = currentUser
    ? (currentUser.following ?? []).filter((f) => profile.followers.includes(f) || profile.following.includes(f)).length
    : 0;
  const myUpcomingCreated = feedEvents.filter(
    (e) => e.creatorId === currentUser?.id && e.dateTime >= now,
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
          <AnimatedPressable onPress={handleReport} onPressIn={reportAnim.onPressIn} onPressOut={reportAnim.onPressOut} style={[styles.backBtn, { borderColor: bs }, reportAnim.animatedStyle]}>
            <Text style={[styles.backIcon, { color: colors.textHint }]}>⋯</Text>
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
        <View style={[styles.uniBadge, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
          <Text style={[styles.uniText, { color: colors.textSecondary }]}>🎓 {universityLabel(profile.universityName, language)}</Text>
        </View>
        {/* Level badge */}
        <AnimatedPressable
          onPress={() => setShowLevelModal(true)}
          onPressIn={levelAnim.onPressIn}
          onPressOut={levelAnim.onPressOut}
          style={[styles.levelBadge, { backgroundColor: profileLevel.color + '18', borderColor: profileLevel.color }, levelAnim.animatedStyle]}
        >
          <Text style={styles.levelBadgeEmoji}>{profileLevel.emoji}</Text>
          <Text style={[styles.levelBadgeName, { color: profileLevel.color }]}>{profileLevel.name}</Text>
          <Text style={[styles.levelBadgeXP, { color: profileLevel.color }]}>{profile.xp} XP</Text>
        </AnimatedPressable>

        {!!profile.department && (
          <Text style={[styles.dept, { color: colors.textHint }]}>{profile.department}</Text>
        )}

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <Button
            label={isFollowing ? t.userFollowing : t.userFollow}
            onPress={handleFollow}
            loading={followLoading}
            shape="pill"
            size="sm"
            style={{ backgroundColor: isFollowing ? colors.surfaceVariant : colors.primary, borderColor: bs }}
            labelStyle={{ color: isFollowing ? colors.textPrimary : '#fff' }}
          />

          {currentUser && (
            <Button
              label={t.dmTitle}
              onPress={() => router.push(`/(app)/dm/${uid}` as any)}
              shape="pill"
              size="sm"
              style={{ backgroundColor: colors.surfaceVariant, borderColor: bs }}
              labelStyle={{ color: colors.textPrimary }}
            />
          )}
          {myUpcomingCreated.length > 0 && (
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

        {/* Follower counts */}
        <View style={styles.followStats}>
          <Text style={[styles.followStat, { color: colors.textSecondary }]}>
            <Text style={[styles.followNum, { color: colors.textPrimary }]}>
              {profile.followers?.length ?? 0}
            </Text>
            {t.userFollowers}
          </Text>
          <Text style={[styles.followDot, { color: colors.textHint }]}>·</Text>
          <Text style={[styles.followStat, { color: colors.textSecondary }]}>
            <Text style={[styles.followNum, { color: colors.textPrimary }]}>
              {profile.following?.length ?? 0}
            </Text>
            {t.userFollowing2}
          </Text>
        </View>
        {mutualCount > 0 && (
          <View style={[styles.mutualChip, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
            <Text style={[styles.mutualText, { color: colors.textSecondary }]}>👥 {t.mutualFriends(mutualCount)}</Text>
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
          <Text style={styles.emptyEmoji}>🌱</Text>
          <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.userNoUpcoming}</Text>
        </View>
      )}

      <LevelsModal visible={showLevelModal} xp={profile.xp} onClose={() => setShowLevelModal(false)} />

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
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  errorText: { fontSize: FontSize.base },
  backBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  avatarSection: { alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  avatarPhoto: { width: 88, height: 88, borderRadius: 44, borderWidth: 3 },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: FontWeight.bold },
  name: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, marginTop: Spacing.sm },
  uniBadge: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 6, borderWidth: 2 },
  uniText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  dept: { fontSize: FontSize.sm },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  followStats: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  followStat: { fontSize: FontSize.sm },
  followNum: { fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  followDot: { fontSize: FontSize.sm },
  bioCard: { borderWidth: 2.5, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6, ...Shadow.sm },
  bioLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  bioText: { fontSize: FontSize.md, lineHeight: 22 },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  statCard: { flex: 1, borderWidth: 2.5, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: 4, ...Shadow.sm },
  statNumber: { fontSize: 30, fontWeight: FontWeight.extrabold, letterSpacing: -1, fontFamily: DrawFont },
  statLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  eventsSection: { gap: Spacing.md },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  eventsList: { gap: 14 },
  emptyCard: { borderWidth: 2.5, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  emptyEmoji: { fontSize: 36 },
  emptyText: { fontSize: FontSize.sm },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 2.5, borderBottomWidth: 0, padding: Spacing.xl, paddingBottom: 40, gap: Spacing.md, maxHeight: '70%' },
  modalHandle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: Spacing.sm },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  modalList: { flexGrow: 0 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 14, marginBottom: Spacing.sm },
  inviteTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: DrawFont, flex: 1 },
  inviteDate: { fontSize: FontSize.sm },
  mutualChip: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 5, borderWidth: 1.5 },
  mutualText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 7 },
  levelBadgeEmoji: { fontSize: 16 },
  levelBadgeName: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  levelBadgeXP: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, opacity: 0.75 },
});
