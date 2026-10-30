import React, { useEffect, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { uploadProfilePhoto } from '@/core/utils/uploadImage';
import { pickImage } from '@/core/utils/imagePicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { isLeft } from '@/core/utils/either';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { UIFont, TitleFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { EventEntity, isEventPast } from '@/features/events/domain/entities/event.entity';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';
import { getLevel, isVerifiedUser, isRegularUser, isBetaTesterUser, isNewcomerUser } from '@/core/constants/gamification';
import { LevelsModal } from '@/components/ui/LevelsModal';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { Tag } from '@/components/ui/Tag';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ProgressTrack } from '@/components/ui/ProgressTrack';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { getChallengeDefs } from '@/core/constants/challenges';
import { ChallengeRow } from '@/components/ui/ChallengeRow';
import { computeWrapped, WRAPPED_MIN_CHECKINS } from '@/features/wrapped/wrapped';
import { semesterLabel } from '@/components/wrapped/WrappedSlides';

const AVATAR_COLORS = ['#B8482A','#7C3AED','#059669','#2563EB','#DB2777','#D97706','#DC2626','#0891B2'];

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const claimChallenge = useAuthStore((s) => s.claimChallenge);
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

  // Challenge definitions + the XP-claiming effect below both live here,
  // above the `if (!user) return` guard further down — they used to sit
  // after it, which meant signing out (user -> null, re-rendering this
  // always-mounted tab) skipped this hook entirely and React threw
  // "Rendered fewer hooks than expected." Every hook must run on every
  // render; guard clauses that change what gets *rendered* have to come
  // after all of them, not before.
  const challenges = getChallengeDefs(user, t);
  // claimedChallengeIds is built with arrayUnion (auth.store's claimChallenge),
  // which only ever appends — so its order already is completion order. Sort
  // done challenges by it so whichever one you *just* finished sinks to the
  // very bottom instead of sitting wherever its fixed definition-order slot
  // happens to be, keeping the collapsed view showing mostly what's still new.
  const claimOrder = user?.claimedChallengeIds ?? [];
  const doneChallenges = challenges
    .filter((c) => c.current >= c.target)
    .sort((a, b) => claimOrder.indexOf(a.id) - claimOrder.indexOf(b.id));
  const doneChallengeIds = doneChallenges.map((c) => c.id).join(',');

  // Pay out a challenge's XP exactly once, the moment it's newly completed —
  // previously the "+XP" shown on each card was never actually granted.
  useEffect(() => {
    if (!user) return;
    doneChallenges.forEach((c) => {
      if (!user.claimedChallengeIds?.includes(c.id)) claimChallenge(c.id, c.xp).catch(() => {});
    });
  }, [doneChallengeIds, user?.claimedChallengeIds?.join(',')]);

  const [editing, setEditing] = useState(false);
  const [draftBio, setDraftBio] = useState(user?.bio ?? '');
  const [draftName, setDraftName] = useState(user?.name ?? '');
  const [draftColor, setDraftColor] = useState(user?.avatarColor ?? '#B8482A');
  const [draftPhoto, setDraftPhoto] = useState<string | undefined>(user?.photoUri);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<{ emoji: string; label: string; description: string; earned: boolean } | null>(null);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [followList, setFollowList] = useState<'followers' | 'following' | 'connections' | null>(null);
  const [followProfiles, setFollowProfiles] = useState<Record<string, UserProfile>>({});

  const pickPhoto = async () => {
    if (!editing) return;
    const uri = await pickImage({ aspect: [1, 1] });
    if (uri) setDraftPhoto(uri);
  };

  if (!user) return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 }}>
      <Text style={{ fontSize: 48 }}>👤</Text>
      <Text style={{ fontSize: 18, fontWeight: '800', fontFamily: UIFont, color: colors.textPrimary, textAlign: 'center' }}>{t.profileErrorTitle}</Text>
      <Text style={{ fontSize: 14, color: colors.textHint, textAlign: 'center' }}>{t.profileErrorBody}</Text>
      <AnimatedPressable
        onPress={() => signOut()}
        style={{ backgroundColor: colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 999, marginTop: 8 }}
      >
        <Text style={{ color: '#fff', fontWeight: '800', fontFamily: UIFont, fontSize: 16 }}>{t.settingsSignOut}</Text>
      </AnimatedPressable>
    </View>
  );

  const createdCount = user.createdEvents.length;
  const joinedCount = user.joinedEvents.filter((id) => !user.createdEvents.includes(id)).length;
  const initials = user.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();

  const now = new Date();
  const streak = user.currentStreak ?? 0;
  const levelInfo = getLevel(user.xp ?? 0, user.id);
  const wrapped = computeWrapped(user, myEvents);

  const upcomingEvents = myEvents.filter((e) => !isEventPast(e));
  const pastEvents = myEvents.filter((e) => isEventPast(e)).sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
  const savedEvents = events.filter((e) => user.savedEventIds?.includes(e.id));

  // "Connections" (profile stat) is a *mutual* follow — someone you follow
  // who follows you back — not the raw following count used by the
  // follow_5/follow_10 challenges above.
  const connectionsCount = (user.following ?? []).filter((id) => (user.followers ?? []).includes(id)).length;

  // challenges/claimOrder/doneChallenges are computed above, before the
  // !user guard (Rules of Hooks — see the comment up there).
  const activeChallenges = challenges.filter((c) => c.current < c.target);
  const visibleChallenges = [...activeChallenges.slice(0, 3), ...doneChallenges.slice(0, 1)];

  const badges: { emoji: string; label: string; description: string; earned: boolean }[] = [
    { emoji: '🎯', label: t.badgeFirstStep,  description: t.badgeFirstStepDesc,  earned: user.joinedEvents.length >= 1 },
    { emoji: '🏆', label: t.badgeVeteran,    description: t.badgeVeteranDesc,    earned: user.joinedEvents.length >= 5 },
    { emoji: '🌟', label: t.badgeSocial,     description: t.badgeSocialDesc,     earned: (user.following?.length ?? 0) >= 5 },
    { emoji: '🎪', label: t.badgeOrganizer,  description: t.badgeOrganizerDesc,  earned: user.createdEvents.length >= 3 },
    { emoji: '🔥', label: t.badgeOnFire,     description: t.badgeOnFireDesc,     earned: streak >= 3 },
    { emoji: '🌱', label: t.badgeBetaTester, description: t.badgeBetaTesterDesc, earned: isBetaTesterUser(user) },
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
    setDraftBio(user.bio ?? ''); setDraftName(user.name); setDraftColor(user.avatarColor ?? '#B8482A');
    setDraftPhoto(user.photoUri); setEditing(false);
  };

  const openFollowList = async (type: 'followers' | 'following' | 'connections') => {
    setFollowList(type);
    const uids = type === 'followers'
      ? (user.followers ?? [])
      : type === 'following'
        ? (user.following ?? [])
        : (user.following ?? []).filter((id) => (user.followers ?? []).includes(id));
    if (uids.length === 0) return;
    const missing = uids.filter((id) => !followProfiles[id]);
    if (missing.length > 0) {
      const fetched = await fetchUserProfiles(missing);
      setFollowProfiles((prev) => ({ ...prev, ...fetched }));
    }
  };

  const bs = colors.border;

  return (
    <ScrollView style={[styles.root,{backgroundColor:colors.background}]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>

      {/* ── Top bar ── */}
      <View style={styles.topRow}>
        <Text style={[styles.pageTitle,{color:colors.textPrimary}]}>{t.profileTitle}</Text>
        <View style={styles.topActions}>
          <AnimatedPressable onPress={() => editing ? handleSave() : setEditing(true)} disabled={isSaving} style={[styles.editBtn,{backgroundColor:editing?colors.primary:colors.surfaceVariant, borderColor: bs}]}>
            {isSaving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={[styles.editBtnLabel,{color:editing?'#fff':colors.textSecondary}]}>{editing ? t.profileSave : t.profileEdit}</Text>
            }
          </AnimatedPressable>
        </View>
      </View>

      {/* ── Hero: edit mode keeps the big centered avatar + color picker;
          view mode is the mock's compact avatar+name+school row (mockup 21). ── */}
      {editing ? (
        <View style={styles.heroEditing}>
          <AnimatedPressable onPress={pickPhoto} style={[styles.avatarWrap, { borderColor: bs }]}>
            {draftPhoto ? (
              <Image source={{ uri: draftPhoto }} style={styles.avatarPhoto} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: draftColor }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={[styles.photoOverlay,{backgroundColor:'rgba(0,0,0,0.4)'}]}>
              <Icon name="camera" size={20} color="#fff" />
            </View>
          </AnimatedPressable>
          <View style={styles.colorRow}>
            {AVATAR_COLORS.map((c) => (
              <AnimatedPressable key={c} onPress={() => setDraftColor(c)}
                style={[styles.colorDot,{backgroundColor:c, borderColor: bs},draftColor===c&&styles.colorDotSelected]} />
            ))}
          </View>
          <AnimatedPressable onPress={() => setDraftPhoto(undefined)}>
            <Text style={[styles.removePhotoLabel,{color:colors.textHint}]}>{t.profileRemovePhoto}</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <View style={styles.heroView}>
          <View style={[styles.avatarWrapSm, { borderColor: bs }]}>
            {user.photoUri ? (
              <Image source={{ uri: user.photoUri }} style={styles.avatarPhotoSm} />
            ) : (
              <View style={[styles.avatarSm, { backgroundColor: user.avatarColor ?? colors.primary }]}>
                <Text style={styles.avatarTextSm}>{initials}</Text>
              </View>
            )}
          </View>
          <View style={styles.heroInfo}>
            <Text style={[styles.heroName,{color:colors.textPrimary}]} numberOfLines={1}>{user.name}</Text>
            {!!user.universityName && (
              <Text style={[styles.heroUni,{color:colors.textHint}]} numberOfLines={1}>
                {universityLabel(user.universityName, language)}{user.department ? ` · ${user.department}` : ''}
              </Text>
            )}
            <View style={styles.pillRow}>
              <AnimatedPressable onPress={() => setShowLevelModal(true)}>
                <Tag label={levelInfo.name} />
              </AnimatedPressable>
              {isNewcomerUser(user.checkInCount) && <VerifiedBadge label={t.newcomerBadgeLabel} icon="star" />}
              {isVerifiedUser(user.checkInCount) && <VerifiedBadge />}
              {isRegularUser(user.currentStreak) && <VerifiedBadge label={t.regularBadgeLabel} icon="flame" />}
            </View>
          </View>
        </View>
      )}

      <LevelsModal visible={showLevelModal} xp={user.xp ?? 0} uid={user.id} onClose={() => setShowLevelModal(false)} />

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

      {/* ── Level / XP progress card (mockup 21) — tapping it opens the same
          LevelsModal roadmap as the "ΕΣΥ" pill in the hero row. ── */}
      {!editing && (
        <AnimatedPressable onPress={() => setShowLevelModal(true)}>
          <Card padded style={styles.levelCard}>
            <View style={styles.levelCardHeader}>
              <SectionLabel label={t.profileLevelProgressLabel(levelInfo.name)} />
              <Text style={[styles.levelCardFraction, { color: colors.textHint }]}>
                {levelInfo.next ? `${levelInfo.xpInLevel}/${levelInfo.xpNeeded}` : levelInfo.xpInLevel}
              </Text>
            </View>
            <ProgressTrack progress={levelInfo.progress} style={styles.levelCardTrack} />
            <Text style={[styles.levelCardCaption, { color: colors.textHint }]}>
              {levelInfo.next ? t.profileLevelXpToNext(levelInfo.xpNeeded - levelInfo.xpInLevel) : t.profileLevelMaxed}
            </Text>
          </Card>
        </AnimatedPressable>
      )}

      {/* ── Keno Wrapped — computed from the same attended-events list this
          screen already loads (myEvents), so the card costs no extra read. ── */}
      {!editing && (
        <AnimatedPressable onPress={() => router.push('/(app)/wrapped' as any)}>
          <View style={[styles.wrappedCard, { backgroundColor: colors.primary }]}>
            <View style={styles.wrappedCardText}>
              <Text style={styles.wrappedCardKicker}>{t.wrappedCardLabel}</Text>
              <Text style={styles.wrappedCardTitle}>{semesterLabel(wrapped.semesterId, t)}</Text>
              <Text style={styles.wrappedCardCaption}>
                {wrapped.eventsAttended >= WRAPPED_MIN_CHECKINS
                  ? t.wrappedCardOpen
                  : t.wrappedCardLocked(WRAPPED_MIN_CHECKINS - wrapped.eventsAttended)}
              </Text>
            </View>
            <View style={styles.wrappedCardIcon}>
              <Icon name={wrapped.eventsAttended >= WRAPPED_MIN_CHECKINS ? 'fwd' : 'lock'} size={18} color="#FAF7F2" />
            </View>
          </View>
        </AnimatedPressable>
      )}

      {!editing && user.createdEvents.length > 0 && (
        <AnimatedPressable onPress={() => router.push('/(app)/organiser-stats' as any)}>
          <Card padded style={styles.orgStatsRow}>
            <Icon name="trophy" size={18} color={colors.primary} />
            <Text style={[styles.orgStatsText, { color: colors.textPrimary }]}>{t.orgStatsTitle}</Text>
            <Icon name="fwd" size={15} color={colors.textDecor} />
          </Card>
        </AnimatedPressable>
      )}

      {/* ── Stats row (mockup 21): 3 equal columns, 1px vertical rules, no boxes.
          Followers aren't shown here (only 3 slots in the mock) — "Meetups"
          reuses the existing following-count/list, closest available proxy
          for "people you know" without adding a new data field. ── */}
      {!editing && (
        <Card style={styles.statsCard}>
          {[
            { n: createdCount + joinedCount, label: t.profileStatEvents, onPress: undefined as (() => void) | undefined },
            { n: connectionsCount,           label: t.profileStatMeetups, onPress: () => openFollowList('connections') },
            { n: streak,                     label: t.profileStatStreak, onPress: undefined as (() => void) | undefined },
          ].map(({ n, label, onPress }, i, arr) => (
            <React.Fragment key={label}>
              <AnimatedPressable onPress={onPress} disabled={!onPress} style={styles.statCell}>
                <Text style={[styles.statNum, { color: colors.textPrimary }]}>{n}</Text>
                <Text style={[styles.statLbl, { color: colors.textHint }]}>{label.toUpperCase()}</Text>
              </AnimatedPressable>
              {i < arr.length - 1 && <View style={[styles.statDivider, { backgroundColor: colors.border }]} />}
            </React.Fragment>
          ))}
        </Card>
      )}

      {/* ── Followers / Following sheet ── */}
      <Modal visible={!!followList} transparent animationType="slide" onRequestClose={() => setFollowList(null)}>
        <AnimatedPressable style={styles.sheetOverlay} onPress={() => setFollowList(null)}>
          <AnimatedPressable style={[styles.sheetContainer, { backgroundColor: colors.surface, borderColor: bs }]} onPress={() => {}}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
              {followList === 'followers' ? t.userFollowersTitle : followList === 'following' ? t.userFollowingTitle : t.userConnectionsTitle}
            </Text>
            {(() => {
              const uids = followList === 'followers'
                ? (user.followers ?? [])
                : followList === 'following'
                  ? (user.following ?? [])
                  : (user.following ?? []).filter((id) => (user.followers ?? []).includes(id));
              if (uids.length === 0) {
                return <Text style={[styles.sheetEmpty, { color: colors.textHint }]}>{t.userConnectionsEmpty}</Text>;
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
                        <Icon name="fwd" size={15} color={colors.textHint} />
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
                <Text style={[styles.badgeLabel, { color: b.earned ? colors.textPrimary : colors.textHint }]} numberOfLines={1}>{b.label}</Text>
              </AnimatedPressable>
            ))}
          </View>
        </View>
      )}


      {/* ── Challenges ── */}
      {!editing && (
        <View style={[styles.challengesCard, { backgroundColor: colors.surface, borderColor: bs }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.profileChallengesTitle}</Text>
          {visibleChallenges.map((c) => <ChallengeRow key={c.id} challenge={c} />)}
          {challenges.length > visibleChallenges.length && (
            <AnimatedPressable onPress={() => router.push('/(app)/challenges' as any)} style={styles.showMoreBtn}>
              <Text style={[styles.showMoreText, { color: colors.primary }]}>
                {t.profileChallengesSeeAll}
              </Text>
            </AnimatedPressable>
          )}
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

      {/* Upcoming/past/saved used to render their full lists inline here —
          now they're just links out to a dedicated page each, to keep the
          profile itself short. */}
      {!editing && (
        <View style={styles.eventsSection}>
          <AnimatedPressable onPress={() => router.push('/(app)/profile/events/upcoming' as any)} style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: bs }]}>
            <View style={styles.settingLeft}>
              <Icon name="cal" size={18} color={colors.textPrimary} />
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t.profileTabUpcoming(upcomingEvents.length)}</Text>
            </View>
            <Icon name="fwd" size={16} color={colors.textHint} />
          </AnimatedPressable>
          <AnimatedPressable onPress={() => router.push('/(app)/profile/events/past' as any)} style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: bs }]}>
            <View style={styles.settingLeft}>
              <Icon name="clock" size={18} color={colors.textPrimary} />
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t.profileTabPast(pastEvents.length)}</Text>
            </View>
            <Icon name="fwd" size={16} color={colors.textHint} />
          </AnimatedPressable>
          <AnimatedPressable onPress={() => router.push('/(app)/profile/events/saved' as any)} style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: bs }]}>
            <View style={styles.settingLeft}>
              <Icon name="bookmark" size={18} color={colors.textPrimary} />
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t.profileTabSaved(savedEvents.length)}</Text>
            </View>
            <Icon name="fwd" size={16} color={colors.textHint} />
          </AnimatedPressable>
          <AnimatedPressable onPress={() => router.push('/(app)/profile/tickets' as any)} style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: bs }]}>
            <View style={styles.settingLeft}>
              <Icon name="ticket" size={18} color={colors.textPrimary} />
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t.profileTicketsPhotosBtn}</Text>
            </View>
            <Icon name="fwd" size={16} color={colors.textHint} />
          </AnimatedPressable>
          <AnimatedPressable onPress={() => router.push('/(app)/settings' as any)} style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: bs }]}>
            <View style={styles.settingLeft}>
              <Icon name="settings" size={18} color={colors.textPrimary} />
              <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>{t.profileSettings}</Text>
            </View>
            <Icon name="fwd" size={16} color={colors.textHint} />
          </AnimatedPressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Layout
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.lg },
  // Top bar
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.4 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1 },
  editBtnLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  // Hero — edit mode: big centered avatar + color picker
  heroEditing: { alignItems: 'center', gap: Spacing.sm },
  avatarWrap: { position: 'relative', width: 96, height: 96, borderRadius: 48, overflow: 'hidden', borderWidth: 3 },
  avatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  avatarPhoto: { width: 96, height: 96, borderRadius: 48 },
  avatarText: { color: '#fff', fontSize: 34, fontWeight: FontWeight.bold },
  photoOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },
  colorDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 1 },
  colorDotSelected: { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.18 }] },
  removePhotoLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  // Hero — view mode (mockup 21): compact avatar + name/school/pills row
  heroView: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatarWrapSm: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', borderWidth: 1 },
  avatarSm: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarPhotoSm: { width: 56, height: 56, borderRadius: 28 },
  avatarTextSm: { color: '#fff', fontSize: 20, fontWeight: FontWeight.bold },
  heroInfo: { flex: 1, minWidth: 0, gap: 2 },
  heroName: { fontSize: 16.5, fontWeight: FontWeight.semibold, fontFamily: TitleFont, letterSpacing: -0.4 },
  heroUni: { fontSize: FontSize.sm },
  pillRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  // Level / XP progress card (mockup 21)
  levelCard: { gap: 0 },
  levelCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 },
  levelCardFraction: { fontSize: 11.5 },
  levelCardTrack: { marginBottom: 7 },
  levelCardCaption: { fontSize: 11.5 },
  wrappedCard: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.lg, padding: Spacing.base, marginBottom: Spacing.md, gap: Spacing.md },
  wrappedCardText: { flex: 1, gap: 2 },
  wrappedCardKicker: { fontSize: 10.5, letterSpacing: 2, fontFamily: UIFont, fontWeight: FontWeight.bold, color: 'rgba(250,247,242,0.75)' },
  wrappedCardTitle: { fontSize: FontSize.xl, fontFamily: TitleFont, fontWeight: FontWeight.bold, color: '#FAF7F2' },
  wrappedCardCaption: { fontSize: FontSize.sm, color: 'rgba(250,247,242,0.85)' },
  orgStatsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  orgStatsText: { flex: 1, fontSize: FontSize.base, fontFamily: UIFont, fontWeight: FontWeight.bold },
  wrappedCardIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,247,242,0.18)' },
  // Edit block
  editBlock: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6},
  editLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  editInput: { fontSize: FontSize.base, fontWeight: FontWeight.medium, paddingVertical: 4 },
  editDivider: { height: 1.5, marginVertical: 6 },
  cancelBtn: { alignItems: 'center' },
  cancelLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  // Bio
  bio: { fontSize: FontSize.md, lineHeight: 22, textAlign: 'center' },
  // Stats row (mockup 21): 3 equal columns, vertical rules, no boxes
  statsCard: { flexDirection: 'row' },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, gap: 2 },
  statNum: { fontSize: 19, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.5 },
  statLbl: { fontSize: 9.5, fontWeight: FontWeight.semibold, fontFamily: UIFont, letterSpacing: 0.4 },
  statDivider: { width: 1 },
  // Badges
  badgesCard: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm},
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, justifyContent: 'space-between' },
  badge: { alignItems: 'center', gap: 2, width: 44 },
  badgeEmoji: { fontSize: 22 },
  badgeLabel: { fontSize: 8.5, fontFamily: UIFont, textAlign: 'center' },
  // Badge modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  modalCard: { width: '100%', maxWidth: 300, borderWidth: 1, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md},
  modalEmoji: { fontSize: 52 },
  modalBadgeName: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, fontFamily: UIFont, textAlign: 'center' },
  modalDesc: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  modalStatus: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1.5, marginTop: 4 },
  modalStatusText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  // Challenges
  challengesCard: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.md},
  showMoreBtn: { alignItems: 'center', paddingTop: 4 },
  showMoreText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  // Events section
  eventsSection: { gap: Spacing.sm },
  // Settings
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 14},
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  settingIcon: { fontSize: 20 },
  settingLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium, fontFamily: UIFont },
  settingChevron: { fontSize: 20, fontWeight: FontWeight.bold },
  // Follow sheet
  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheetContainer: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderBottomWidth: 0, padding: Spacing.lg, maxHeight: '75%' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
  sheetTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, fontFamily: UIFont, marginBottom: Spacing.md },
  sheetEmpty: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.xl },
  sheetList: {},
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, borderBottomWidth: 1.5 },
  personAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  personInitials: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.bold },
  personInfo: { flex: 1, gap: 2 },
  personName: { fontSize: FontSize.base, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  personUni: { fontSize: FontSize.xs },
  personChevron: { fontSize: 20, fontWeight: FontWeight.bold },
});
