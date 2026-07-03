import React, { useEffect, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadProfilePhoto } from '@/core/utils/uploadImage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useNotificationsStore } from '@/features/notifications/notifications.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { isLeft } from '@/core/utils/either';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { EventEntity, isAttending } from '@/features/events/domain/entities/event.entity';
import { EventCard } from '@/components/ui/EventCard';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';
import { getLevel } from '@/core/constants/gamification';
import { LevelsModal } from '@/components/ui/LevelsModal';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';

const AVATAR_COLORS = ['#C94D0A','#7C3AED','#059669','#2563EB','#DB2777','#D97706','#DC2626','#0891B2'];

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const unsaveEvent = useAuthStore((s) => s.unsaveEvent);
  const signOut = useAuthStore((s) => s.signOut);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const t = useTranslation();
  const { language } = useLanguageStore();
  const events = useEventsStore((s) => s.events);
  const setEvents = useEventsStore((s) => s.setEvents);
  const [myEvents, setMyEvents] = useState<EventEntity[]>([]);

  useEffect(() => {
    if (events.length === 0) {
      eventsRepository.getFeedEvents().then((result) => {
        if (!isLeft(result)) setEvents(result.right);
      });
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    eventsRepository.getEventsByAttendee(user.id).then((result) => {
      if (!isLeft(result)) setMyEvents(result.right);
    });
  }, [user?.id]);
  const [profileTab, setProfileTab] = useState<'upcoming' | 'past' | 'saved'>('upcoming');
  const [editing, setEditing] = useState(false);
  const [draftBio, setDraftBio] = useState(user?.bio ?? '');
  const [draftName, setDraftName] = useState(user?.name ?? '');
  const [draftColor, setDraftColor] = useState(user?.avatarColor ?? '#C94D0A');
  const [draftPhoto, setDraftPhoto] = useState<string | undefined>(user?.photoUri);
  const [isSaving, setIsSaving] = useState(false);
  const [showAllChallenges, setShowAllChallenges] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<{ emoji: string; label: string; description: string; earned: boolean } | null>(null);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [followList, setFollowList] = useState<'followers' | 'following' | null>(null);
  const [followProfiles, setFollowProfiles] = useState<Record<string, UserProfile>>({});

  const pickPhoto = async () => {
    if (!editing) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t.profileAlertPermTitle, t.profileAlertPermBody); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setDraftPhoto(result.assets[0].uri);
  };

  if (!user) return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
      <Text style={{ fontSize: 48 }}>👤</Text>
      <Text style={{ fontSize: 18, fontWeight: '800', fontFamily: DrawFont, color: colors.textPrimary, textAlign: 'center' }}>Something went wrong</Text>
      <Text style={{ fontSize: 14, color: colors.textHint, textAlign: 'center' }}>Your profile data is missing. Please sign out and sign back in.</Text>
      <AnimatedPressable
        onPress={() => signOut()}
        style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 999, marginTop: 8 }}
      >
        <Text style={{ color: '#fff', fontWeight: '800', fontFamily: DrawFont, fontSize: 16 }}>Sign Out</Text>
      </AnimatedPressable>
    </View>
  );

  const createdCount = user.createdEvents.length;
  const joinedCount = user.joinedEvents.filter((id) => !user.createdEvents.includes(id)).length;
  const initials = user.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();

  const now = new Date();
  const streak = user.currentStreak ?? 0;
  const levelInfo = getLevel(user.xp ?? 0);

  const upcomingEvents = myEvents.filter((e) => e.dateTime >= now);
  const pastEvents = myEvents.filter((e) => e.dateTime < now).sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
  const savedEvents = events.filter((e) => user.savedEventIds?.includes(e.id));

  const totalJoined = user.joinedEvents.length;
  const followingCount = user.following?.length ?? 0;

  const challenges: { id: string; emoji: string; title: string; desc: string; xp: number; current: number; target: number }[] = [
    { id: 'join_1',    emoji: '🎯', title: 'First step',      desc: 'Join your first event',    xp: 10,  current: Math.min(totalJoined, 1),    target: 1  },
    { id: 'join_5',    emoji: '⭐', title: 'Getting social',  desc: 'Join 5 events',             xp: 50,  current: Math.min(totalJoined, 5),    target: 5  },
    { id: 'join_10',   emoji: '🏆', title: 'Regular',         desc: 'Join 10 events',            xp: 100, current: Math.min(totalJoined, 10),   target: 10 },
    { id: 'join_25',   emoji: '👑', title: 'Veteran',         desc: 'Join 25 events',            xp: 250, current: Math.min(totalJoined, 25),   target: 25 },
    { id: 'create_1',  emoji: '📣', title: 'First event',     desc: 'Create your first event',   xp: 25,  current: Math.min(createdCount, 1),   target: 1  },
    { id: 'create_5',  emoji: '🎪', title: 'Organizer',       desc: 'Create 5 events',           xp: 125, current: Math.min(createdCount, 5),   target: 5  },
    { id: 'streak_3',  emoji: '🔥', title: 'On fire',         desc: '3-day attendance streak',   xp: 15,  current: Math.min(streak, 3),         target: 3  },
    { id: 'streak_7',  emoji: '💥', title: 'Unstoppable',     desc: '7-day attendance streak',   xp: 30,  current: Math.min(streak, 7),         target: 7  },
    { id: 'follow_5',  emoji: '👥', title: 'Connected',       desc: 'Follow 5 people',           xp: 15,  current: Math.min(followingCount, 5),  target: 5  },
    { id: 'follow_10', emoji: '🌐', title: 'Networker',       desc: 'Follow 10 people',          xp: 25,  current: Math.min(followingCount, 10), target: 10 },
  ];
  const activeChallenges = challenges.filter((c) => c.current < c.target);
  const doneChallenges = challenges.filter((c) => c.current >= c.target);
  const visibleChallenges = showAllChallenges ? [...activeChallenges, ...doneChallenges] : [...activeChallenges.slice(0, 3), ...doneChallenges.slice(0, 1)];

  const badges: { emoji: string; label: string; description: string; earned: boolean }[] = [
    { emoji: '🎯', label: t.badgeFirstStep,  description: t.badgeFirstStepDesc,  earned: user.joinedEvents.length >= 1 },
    { emoji: '🏆', label: t.badgeVeteran,    description: t.badgeVeteranDesc,    earned: user.joinedEvents.length >= 5 },
    { emoji: '🌟', label: t.badgeSocial,     description: t.badgeSocialDesc,     earned: (user.following?.length ?? 0) >= 5 },
    { emoji: '🎪', label: t.badgeOrganizer,  description: t.badgeOrganizerDesc,  earned: user.createdEvents.length >= 3 },
    { emoji: '🔥', label: t.badgeOnFire,     description: t.badgeOnFireDesc,     earned: streak >= 3 },
  ];
  const handleSave = async () => {
    if (!draftName.trim()) { Alert.alert(t.profileAlertNameTitle, t.profileAlertNameBody); return; }
    if (containsBlockedContent(draftName)) {
      Alert.alert(t.profileAlertNameTitle, t.validContentBlocked);
      return;
    }
    if (containsBlockedContent(draftBio)) {
      Alert.alert(t.profileAlertBioTitle, t.validContentBlocked);
      return;
    }
    setIsSaving(true);
    let finalPhotoUri = draftPhoto;
    if (draftPhoto && !draftPhoto.startsWith('http') && user) {
      try {
        finalPhotoUri = await uploadProfilePhoto(user.id, draftPhoto);
      } catch {
        Alert.alert(t.profileAlertPhotoTitle, t.profileAlertPhotoBody);
        finalPhotoUri = user.photoUri;
      }
    }
    await updateProfile({ name: draftName.trim(), bio: draftBio.trim(), avatarColor: draftColor, photoUri: finalPhotoUri });
    setIsSaving(false);
    setEditing(false);
  };
  const handleCancel = () => {
    setDraftBio(user.bio ?? ''); setDraftName(user.name); setDraftColor(user.avatarColor ?? '#C94D0A');
    setDraftPhoto(user.photoUri); setEditing(false);
  };

  const openFollowList = async (type: 'followers' | 'following') => {
    setFollowList(type);
    const uids = type === 'followers' ? (user.followers ?? []) : (user.following ?? []);
    if (uids.length === 0) return;
    const missing = uids.filter((id) => !followProfiles[id]);
    if (missing.length > 0) {
      const fetched = await fetchUserProfiles(missing);
      setFollowProfiles((prev) => ({ ...prev, ...fetched }));
    }
  };

  const bs = colors.borderStrong;

  return (
    <ScrollView style={[styles.root,{backgroundColor:colors.background}]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>

      {/* ── Top bar ── */}
      <View style={styles.topRow}>
        <Text style={[styles.pageTitle,{color:colors.textPrimary}]}>{t.profileTitle}</Text>
        <View style={styles.topActions}>
          <AnimatedPressable onPress={() => router.push('/(app)/notifications' as any)} style={[styles.topIconBtn, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
            <Text style={styles.topIconBtnText}>🔔</Text>
            {unreadCount > 0 && (
              <View style={[styles.topBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.topBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </AnimatedPressable>
          <AnimatedPressable onPress={() => router.push('/(app)/search' as any)} style={[styles.topIconBtn, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
            <Text style={styles.topIconBtnText}>👤</Text>
          </AnimatedPressable>
          <AnimatedPressable onPress={() => editing ? handleSave() : setEditing(true)} disabled={isSaving} style={[styles.editBtn,{backgroundColor:editing?colors.primary:colors.surfaceVariant, borderColor: bs}]}>
            {isSaving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={[styles.editBtnLabel,{color:editing?'#fff':colors.textSecondary}]}>{editing ? t.profileSave : t.profileEdit}</Text>
            }
          </AnimatedPressable>
        </View>
      </View>

      {/* ── Hero ── */}
      <View style={styles.hero}>
        <AnimatedPressable onPress={pickPhoto} style={[styles.avatarWrap, { borderColor: bs }]}>
          {(editing ? draftPhoto : user.photoUri) ? (
            <Image source={{ uri: editing ? draftPhoto : user.photoUri }} style={styles.avatarPhoto} />
          ) : (
            <View style={[styles.avatar,{backgroundColor:editing?draftColor:(user.avatarColor??colors.primary)}]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {editing && (
            <View style={[styles.photoOverlay,{backgroundColor:'rgba(0,0,0,0.4)'}]}>
              <Text style={styles.cameraIcon}>📷</Text>
            </View>
          )}
        </AnimatedPressable>

        {editing ? (
          <>
            <View style={styles.colorRow}>
              {AVATAR_COLORS.map((c) => (
                <AnimatedPressable key={c} onPress={() => setDraftColor(c)}
                  style={[styles.colorDot,{backgroundColor:c, borderColor: bs},draftColor===c&&styles.colorDotSelected]} />
              ))}
            </View>
            <AnimatedPressable onPress={() => setDraftPhoto(undefined)}>
              <Text style={[styles.removePhotoLabel,{color:colors.textHint}]}>{t.profileRemovePhoto}</Text>
            </AnimatedPressable>
          </>
        ) : (
          <>
            <Text style={[styles.heroName,{color:colors.textPrimary}]}>{user.name}</Text>
            <Text style={[styles.heroEmail,{color:colors.textHint}]}>{user.universityEmail}</Text>
            {!!user.universityName && (
              <Text style={[styles.heroUni,{color:colors.textSecondary}]}>🎓 {universityLabel(user.universityName, language)}{user.department ? `  ·  ${user.department}` : ''}</Text>
            )}
            <AnimatedPressable onPress={() => setShowLevelModal(true)} style={[styles.levelPill, { backgroundColor: levelInfo.color + '18', borderColor: levelInfo.color }]}>
              <Text style={styles.levelPillEmoji}>{levelInfo.emoji}</Text>
              <Text style={[styles.levelPillName, { color: levelInfo.color }]}>{levelInfo.name}</Text>
              <Text style={[styles.levelPillXP, { color: levelInfo.color }]}>{user.xp ?? 0} XP</Text>
              {levelInfo.next && (
                <View style={[styles.levelPillTrack, { backgroundColor: levelInfo.color + '30' }]}>
                  <View style={[styles.levelPillFill, { backgroundColor: levelInfo.color, width: `${Math.round(levelInfo.progress * 100)}%` as any }]} />
                </View>
              )}
            </AnimatedPressable>
          </>
        )}
      </View>

      <LevelsModal visible={showLevelModal} xp={user.xp ?? 0} onClose={() => setShowLevelModal(false)} />

      {/* ── Edit fields ── */}
      {editing && (
        <View style={[styles.editBlock,{backgroundColor:colors.surface,borderColor: bs}]}>
          <Text style={[styles.editLabel,{color:colors.textHint}]}>{t.profileLabelName}</Text>
          <TextInput value={draftName} onChangeText={setDraftName} style={[styles.editInput,{color:colors.textPrimary, borderColor: colors.border}]} placeholderTextColor={colors.textHint} maxLength={50} />
          <View style={[styles.editDivider,{backgroundColor:colors.border}]} />
          <Text style={[styles.editLabel,{color:colors.textHint}]}>{t.profileLabelBio}</Text>
          <TextInput value={draftBio} onChangeText={setDraftBio} style={[styles.editInput,{color:colors.textPrimary}]}
            placeholder={t.profileBioPlaceholder} placeholderTextColor={colors.textHint} multiline numberOfLines={3} textAlignVertical="top" maxLength={160} />
        </View>
      )}
      {editing && <AnimatedPressable onPress={handleCancel} style={styles.cancelBtn}><Text style={[styles.cancelLabel,{color:colors.textHint}]}>{t.profileCancel}</Text></AnimatedPressable>}

      {/* ── Bio (view mode) ── */}
      {!editing && (user.bio ? (
        <Text style={[styles.bio,{color:colors.textPrimary}]}>{user.bio}</Text>
      ) : null)}

      {/* ── Stats strip ── */}
      {!editing && (
        <View style={[styles.statsStrip, { backgroundColor: colors.surface, borderColor: bs }]}>
          {[
            { n: user.followers?.length ?? 0, label: 'Followers', onPress: () => openFollowList('followers') },
            { n: user.following?.length ?? 0, label: 'Following', onPress: () => openFollowList('following') },
            { n: createdCount + joinedCount,   label: 'Events',    onPress: undefined },
            { n: streak,                       label: streak >= 7 ? '💥 Streak' : streak > 0 ? '🔥 Streak' : 'Streak', onPress: undefined },
          ].map(({ n, label, onPress }, i, arr) => (
            <React.Fragment key={label}>
              <AnimatedPressable onPress={onPress ?? undefined} disabled={!onPress} style={styles.statCell}>
                <Text style={[styles.statNum, { color: colors.primary }]}>{n}</Text>
                <Text style={[styles.statLbl, { color: colors.textSecondary }]}>{label}</Text>
              </AnimatedPressable>
              {i < arr.length - 1 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </View>
      )}

      {/* ── Followers / Following sheet ── */}
      <Modal visible={!!followList} transparent animationType="slide" onRequestClose={() => setFollowList(null)}>
        <AnimatedPressable style={styles.sheetOverlay} onPress={() => setFollowList(null)}>
          <AnimatedPressable style={[styles.sheetContainer, { backgroundColor: colors.surface, borderColor: bs }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
              {followList === 'followers' ? 'Followers' : 'Following'}
            </Text>
            {(() => {
              const uids = followList === 'followers' ? (user.followers ?? []) : (user.following ?? []);
              if (uids.length === 0) {
                return <Text style={[styles.sheetEmpty, { color: colors.textHint }]}>{followList === 'followers' ? 'No followers yet' : 'Not following anyone yet'}</Text>;
              }
              return (
                <ScrollView showsVerticalScrollIndicator={false} style={styles.sheetList}>
                  {uids.map((uid) => {
                    const p = followProfiles[uid];
                    const pInitials = p ? p.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() : '?';
                    return (
                      <AnimatedPressable
                        key={uid}
                        onPress={() => { setFollowList(null); router.push(`/(app)/user/${uid}` as any); }}
                        style={[styles.personRow, { borderColor: bs }]}
                      >
                        {p?.photoUri ? (
                          <Image source={{ uri: p.photoUri }} style={[styles.personAvatar, { borderColor: bs }]} />
                        ) : (
                          <View style={[styles.personAvatar, { backgroundColor: p?.avatarColor ?? colors.primary, borderColor: bs }]}>
                            <Text style={styles.personInitials}>{pInitials}</Text>
                          </View>
                        )}
                        <View style={styles.personInfo}>
                          <Text style={[styles.personName, { color: colors.textPrimary }]}>{p?.name ?? uid}</Text>
                          {!!p?.university && <Text style={[styles.personUni, { color: colors.textHint }]}>🎓 {universityLabel(p.university, language)}</Text>}
                        </View>
                        <Text style={[styles.personChevron, { color: colors.textHint }]}>›</Text>
                      </AnimatedPressable>
                    );
                  })}
                  <View style={{ height: 20 }} />
                </ScrollView>
              );
            })()}
          </AnimatedPressable>
        </AnimatedPressable>
      </Modal>

      {/* ── Badges ── */}
      {!editing && (
        <View style={[styles.badgesCard, { backgroundColor: colors.surface, borderColor: bs }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.profileBadgesTitle}</Text>
          <View style={styles.badgesRow}>
            {badges.map((b) => (
              <AnimatedPressable key={b.label} onPress={() => setSelectedBadge(b)}
                style={[styles.badge, { opacity: b.earned ? 1 : 0.28 }]}>
                <Text style={styles.badgeEmoji}>{b.emoji}</Text>
                <Text style={[styles.badgeLabel, { color: b.earned ? colors.textPrimary : colors.textHint }]}>{b.label}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>
      )}


      {/* ── Challenges ── */}
      {!editing && (
        <View style={[styles.challengesCard, { backgroundColor: colors.surface, borderColor: bs }]}>
          <View style={styles.challengesHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>⚡ Challenges</Text>
            <Text style={[styles.challengesSub, { color: colors.textHint }]}>{doneChallenges.length}/{challenges.length} done</Text>
          </View>
          {visibleChallenges.map((c) => {
            const done = c.current >= c.target;
            const pct = done ? 1 : c.current / c.target;
            return (
              <View key={c.id} style={[styles.challengeRow, { opacity: done ? 0.5 : 1 }]}>
                <Text style={styles.challengeEmoji}>{c.emoji}</Text>
                <View style={styles.challengeBody}>
                  <View style={styles.challengeTitleRow}>
                    <Text style={[styles.challengeTitle, { color: colors.textPrimary }]}>{c.title}</Text>
                    <View style={[styles.xpPill, { backgroundColor: done ? colors.success : colors.primary + '22', borderColor: done ? colors.success : colors.primary }]}>
                      <Text style={[styles.xpPillText, { color: done ? '#fff' : colors.primary }]}>{done ? '✓' : `+${c.xp} XP`}</Text>
                    </View>
                  </View>
                  <Text style={[styles.challengeDesc, { color: colors.textHint }]}>{c.desc}</Text>
                  <View style={[styles.challengeTrack, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
                    <View style={[styles.challengeFill, { width: `${pct * 100}%` as any, backgroundColor: done ? colors.success : colors.primary }]} />
                  </View>
                  <Text style={[styles.challengeProgress, { color: colors.textHint }]}>{c.current}/{c.target}</Text>
                </View>
              </View>
            );
          })}
          {challenges.length > visibleChallenges.length || showAllChallenges ? (
            <AnimatedPressable onPress={() => setShowAllChallenges((v) => !v)} style={styles.showMoreBtn}>
              <Text style={[styles.showMoreText, { color: colors.primary }]}>
                {showAllChallenges ? 'Show less' : `Show all ${challenges.length} challenges`}
              </Text>
            </AnimatedPressable>
          ) : null}
        </View>
      )}

      {/* Badge detail modal */}
      <Modal visible={!!selectedBadge} transparent animationType="fade" onRequestClose={() => setSelectedBadge(null)}>
        <AnimatedPressable style={styles.modalOverlay} onPress={() => setSelectedBadge(null)}>
          <AnimatedPressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: bs }]} onPress={() => {}}>
            <Text style={styles.modalEmoji}>{selectedBadge?.emoji}</Text>
            <Text style={[styles.modalBadgeName, { color: colors.textPrimary }]}>{selectedBadge?.label}</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>{selectedBadge?.description}</Text>
            <View style={[styles.modalStatus, {
              backgroundColor: selectedBadge?.earned ? colors.success : colors.surfaceVariant,
              borderColor: bs,
            }]}>
              <Text style={[styles.modalStatusText, { color: selectedBadge?.earned ? '#fff' : colors.textHint }]}>
                {selectedBadge?.earned ? t.badgeEarned : t.badgeNotEarned}
              </Text>
            </View>
          </AnimatedPressable>
        </AnimatedPressable>
      </Modal>

      {/* Events tabs */}
      <View style={styles.eventsSection}>
        <View style={[styles.tabsRow, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
          {([
            { key: 'upcoming', label: t.profileTabUpcoming(upcomingEvents.length) },
            { key: 'past', label: t.profileTabPast(pastEvents.length) },
            { key: 'saved', label: t.profileTabSaved(savedEvents.length) },
          ] as const).map((tab) => (
            <AnimatedPressable
              key={tab.key}
              onPress={() => setProfileTab(tab.key)}
              style={[styles.tabBtn, profileTab === tab.key && { backgroundColor: colors.surface, borderColor: bs }]}
            >
              <Text style={[styles.tabText, { color: profileTab === tab.key ? colors.primary : colors.textSecondary }]}
                numberOfLines={1}>
                {tab.label}
              </Text>
            </AnimatedPressable>
          ))}
        </View>

        <View style={styles.eventsList}>
          {profileTab === 'upcoming' && (
            upcomingEvents.length === 0
              ? <Text style={[styles.emptyTab, { color: colors.textHint }]}>{t.profileEmptyUpcoming}</Text>
              : upcomingEvents.map((e) => (
                <EventCard key={e.id} event={e} isJoined={isAttending(e, user.id)} onPress={() => router.push(`/(app)/event/${e.id}`)} />
              ))
          )}
          {profileTab === 'past' && (
            pastEvents.length === 0
              ? <Text style={[styles.emptyTab, { color: colors.textHint }]}>{t.profileEmptyPast}</Text>
              : pastEvents.map((e) => (
                <EventCard key={e.id} event={e} isJoined={isAttending(e, user.id)} onPress={() => router.push(`/(app)/event/${e.id}`)} faded />
              ))
          )}
          {profileTab === 'saved' && (
            savedEvents.length === 0
              ? <Text style={[styles.emptyTab, { color: colors.textHint }]}>{t.profileEmptySaved}</Text>
              : savedEvents.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  isSaved
                  onSave={() => unsaveEvent(e.id).catch(() => {})}
                  onPress={() => router.push(`/(app)/event/${e.id}`)}
                />
              ))
          )}
        </View>
      </View>

      <AnimatedPressable onPress={() => router.push('/(app)/settings' as any)} style={[styles.settingRow,{backgroundColor:colors.surface,borderColor: bs}]}>
        <View style={styles.settingLeft}>
          <Text style={styles.settingIcon}>⚙️</Text>
          <Text style={[styles.settingLabel,{color:colors.textPrimary}]}>{t.profileSettings}</Text>
        </View>
        <Text style={[styles.settingChevron,{color:colors.textHint}]}>›</Text>
      </AnimatedPressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Layout
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  // Top bar
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: 28, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  topIconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  topIconBtnText: { fontSize: 18 },
  topBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  topBadgeText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.extrabold },
  editBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 2.5 },
  editBtnLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  // Hero
  hero: { alignItems: 'center', gap: Spacing.sm },
  avatarWrap: { position: 'relative', width: 96, height: 96, borderRadius: 48, overflow: 'hidden', borderWidth: 3 },
  avatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  avatarPhoto: { width: 96, height: 96, borderRadius: 48 },
  avatarText: { color: '#fff', fontSize: 34, fontWeight: FontWeight.bold },
  photoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  cameraIcon: { fontSize: 26 },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  colorDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 2 },
  colorDotSelected: { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.18 }] },
  removePhotoLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  heroName: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, marginTop: 4 },
  heroEmail: { fontSize: FontSize.sm },
  heroUni: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  // Level pill (inline in hero)
  levelPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 7, marginTop: 4 },
  levelPillEmoji: { fontSize: 16 },
  levelPillName: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  levelPillXP: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, opacity: 0.7 },
  levelPillTrack: { width: 48, height: 5, borderRadius: 3, overflow: 'hidden' },
  levelPillFill: { height: 5, borderRadius: 3 },
  // Edit block
  editBlock: { borderWidth: 2.5, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6, ...Shadow.sm },
  editLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  editInput: { fontSize: FontSize.base, fontWeight: FontWeight.medium, paddingVertical: 4 },
  editDivider: { height: 1.5, marginVertical: 6 },
  cancelBtn: { alignItems: 'center' },
  cancelLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  // Bio
  bio: { fontSize: FontSize.md, lineHeight: 22, textAlign: 'center' },
  // Stats strip
  statsStrip: { flexDirection: 'row', borderWidth: 2.5, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadow.sm },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, gap: 2 },
  statNum: { fontSize: 24, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, letterSpacing: -0.5 },
  statLbl: { fontSize: 10, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  statDivider: { width: 1.5 },
  // Badges
  badgesCard: { borderWidth: 2.5, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  badge: { alignItems: 'center', gap: 3, width: 50 },
  badgeEmoji: { fontSize: 26 },
  badgeLabel: { fontSize: 9, fontFamily: DrawFont, textAlign: 'center' },
  // Badge modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalCard: { width: '100%', maxWidth: 300, borderWidth: 2.5, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md, ...Shadow.sm },
  modalEmoji: { fontSize: 52 },
  modalBadgeName: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, textAlign: 'center' },
  modalDesc: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  modalStatus: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1.5, marginTop: 4 },
  modalStatusText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  // Challenges
  challengesCard: { borderWidth: 2.5, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.md, ...Shadow.sm },
  challengesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  challengesSub: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  challengeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  challengeEmoji: { fontSize: 22, marginTop: 2 },
  challengeBody: { flex: 1, gap: 3 },
  challengeTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  challengeTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, flex: 1 },
  xpPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  xpPillText: { fontSize: 10, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  challengeDesc: { fontSize: FontSize.xs, lineHeight: 16 },
  challengeTrack: { height: 5, borderRadius: 3, overflow: 'hidden', borderWidth: 1, marginTop: 2 },
  challengeFill: { height: 5, borderRadius: 3 },
  challengeProgress: { fontSize: 9, fontWeight: FontWeight.bold, textAlign: 'right' },
  showMoreBtn: { alignItems: 'center', paddingTop: 4 },
  showMoreText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  // Events section
  eventsSection: { gap: Spacing.md },
  tabsRow: { flexDirection: 'row', borderRadius: BorderRadius.lg, borderWidth: 1.5, overflow: 'hidden' },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: BorderRadius.lg, borderWidth: 0 },
  tabText: { fontSize: 10, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  emptyTab: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.xl },
  eventsList: { gap: 14 },
  // Settings
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2.5, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 14, ...Shadow.sm },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  settingIcon: { fontSize: 20 },
  settingLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium, fontFamily: DrawFont },
  settingChevron: { fontSize: 20, fontWeight: FontWeight.bold },
  // Follow sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheetContainer: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 2.5, borderBottomWidth: 0, padding: Spacing.lg, maxHeight: '75%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  sheetTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, marginBottom: Spacing.md },
  sheetEmpty: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.xl },
  sheetList: {},
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, borderBottomWidth: 1.5 },
  personAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  personInitials: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  personInfo: { flex: 1, gap: 2 },
  personName: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  personUni: { fontSize: FontSize.xs },
  personChevron: { fontSize: 20, fontWeight: FontWeight.bold },
});
