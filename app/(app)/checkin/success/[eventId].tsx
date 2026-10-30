import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { arrayRemove, arrayUnion, collection, doc, increment, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Ticket } from '@/components/ui/Ticket';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { BorderRadius, FontSize, FontWeight, Spacing, TitleFont, UIFont } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';
import { useTranslation, getDateLocale, useLanguageStore } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { EventEntity } from '@/features/events/domain/entities/event.entity';
import { isLeft } from '@/core/utils/either';
import { haptics } from '@/core/utils/haptics';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { universityLabel } from '@/core/constants/universities';
import { XP_VALUES, isNewcomerUser } from '@/core/constants/gamification';
import { NewcomerMilestoneModal } from '@/components/ui/NewcomerMilestoneModal';
import { cancelEventReminder } from '@/core/utils/eventReminders';

interface CheckedInRow {
  uid: string;
}

// Check-in success screen (mockup 17): halo/check, the Ticket consumer (plan
// section B), and a live "who else is here" list sourced from the same
// checkIns subcollection the QR scan just wrote to.
export default function CheckInSuccessScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const dateLocale = getDateLocale(language);
  const user = useAuthStore((s) => s.user);

  const [event, setEvent] = useState<EventEntity | null>(null);
  const [checkedInUids, setCheckedInUids] = useState<string[]>([]);
  const [kudos, setKudos] = useState<Record<string, string[]>>({});
  const [ownArrivedSolo, setOwnArrivedSolo] = useState<boolean | undefined>(undefined);
  const [ownIsPlusOne, setOwnIsPlusOne] = useState(false);
  const [ownIsGroupBonus, setOwnIsGroupBonus] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [showNewcomerExit, setShowNewcomerExit] = useState(false);

  // Check-in already gets a sound + haptic buzz the instant the QR scan
  // resolves (checkin/[eventId].tsx, right before it routes here) — this
  // screen's job is the visual half: a halo that pops in, then the rest of
  // the ticket settling in just after.
  const haloScale = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(14);

  useEffect(() => {
    if (loading) return;
    haloScale.value = withSequence(
      withSpring(1.15, { damping: 9, stiffness: 260 }),
      withSpring(1, { damping: 14, stiffness: 260 }),
    );
    contentOpacity.value = withDelay(120, withTiming(1, { duration: 320 }));
    contentTranslateY.value = withDelay(120, withSpring(0, { damping: 16, stiffness: 220 }));
  }, [loading]);

  const haloAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: haloScale.value }] }));
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  // Already here — a "starting soon" reminder for this event would be noise.
  useEffect(() => {
    if (eventId) cancelEventReminder(eventId).catch(() => {});
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    eventsRepository.getEvent(eventId).then((result) => {
      if (!isLeft(result)) setEvent(result.right);
      setLoading(false);
    });
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;
    const q = query(collection(db, 'events', eventId, 'checkIns'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setCheckedInUids(snap.docs.map((d) => d.id));
      setKudos(Object.fromEntries(snap.docs.map((d) => [d.id, (d.data().kudos as string[] | undefined) ?? []])));
      const ownDoc = user ? snap.docs.find((d) => d.id === user.id) : undefined;
      setOwnArrivedSolo(ownDoc ? (ownDoc.data().arrivedSolo as boolean | undefined) : undefined);
      // Flipped true by the onCheckInCreated Cloud Function, slightly after
      // this doc is first created — set by the server, not the client,
      // since it also pays out the referral XP bonus (research doc #17).
      setOwnIsPlusOne(!!ownDoc?.data().isPlusOne);
      setOwnIsGroupBonus(!!ownDoc?.data().isGroupBonus);
    }, () => {});
    return unsub;
  }, [eventId, user?.id]);

  // Strava-Kudos-style lightweight acknowledgment: a single tap, no emoji
  // picker, toggled per-viewer — the point is "I see you showed up," not a
  // social feed.
  const toggleKudos = async (targetUid: string) => {
    if (!user || !eventId || targetUid === user.id) return;
    const alreadyGiven = (kudos[targetUid] ?? []).includes(user.id);
    try {
      await updateDoc(doc(db, 'events', eventId, 'checkIns', targetUid), {
        kudos: alreadyGiven ? arrayRemove(user.id) : arrayUnion(user.id),
      });
    } catch {}
  };

  // Restores the "did you come alone?" signal the solo-buddy-matching Cloud
  // Function trigger reads (see functions/src/index.ts's onCheckIn) — the QR
  // scan itself has no UI room to ask this, so it's collected right after,
  // as a one-time optional chip, per the plan's note to keep this feature
  // alive without gating check-in on it.
  const answerArrivedSolo = async (solo: boolean) => {
    if (!user || !eventId) return;
    setOwnArrivedSolo(solo);
    try {
      await updateDoc(doc(db, 'events', eventId, 'checkIns', user.id), { arrivedSolo: solo });
    } catch {}
    // First-ever solo attendance earns a one-time XP bonus and a distinct
    // ticket label on this specific event going forward (see tickets.tsx /
    // this screen's Ticket topLabel) — never re-triggers on later solo visits.
    if (solo && !user.firstSoloAttendanceEventId) {
      try {
        await updateDoc(doc(db, 'users', user.id), {
          firstSoloAttendanceEventId: eventId,
          xp: increment(XP_VALUES.firstSoloAttendance),
        });
        useAuthStore.setState((s) => (s.user ? {
          user: { ...s.user, firstSoloAttendanceEventId: eventId, xp: (s.user.xp ?? 0) + XP_VALUES.firstSoloAttendance },
        } : {}));
      } catch {}
    }
  };

  useEffect(() => {
    const missing = checkedInUids.filter((uid) => !profiles[uid]);
    if (missing.length === 0) return;
    fetchUserProfiles(missing).then((fetched) => setProfiles((prev) => ({ ...prev, ...fetched })));
  }, [checkedInUids]);

  // "Νέος στην πόλη" (newcomer mode) ends on the very first real check-in.
  // On the self check-in path `user.checkInCount` is never optimistically
  // bumped (see checkInWithToken), so it still reads the PRE-increment value
  // here — `=== 0` reliably means "this is that first check-in," and
  // firstCheckInEventId guards against paying the bonus twice if this effect
  // somehow re-fires before a reload picks up the real incremented count.
  useEffect(() => {
    if (loading || !user || !eventId) return;
    if (user.firstCheckInEventId || !isNewcomerUser(user.checkInCount)) return;
    (async () => {
      try {
        await updateDoc(doc(db, 'users', user.id), {
          firstCheckInEventId: eventId,
          xp: increment(XP_VALUES.newcomerFirstCheckinBonus),
        });
        useAuthStore.setState((s) => (s.user ? {
          user: { ...s.user, firstCheckInEventId: eventId, xp: (s.user.xp ?? 0) + XP_VALUES.newcomerFirstCheckinBonus },
        } : {}));
        setShowNewcomerExit(true);
      } catch {}
    })();
  }, [loading, user?.id, eventId]);

  if (loading || !event) return <LoadingScreen />;

  const attendeeProfiles = event.attendeeIds
    .slice(0, 2)
    .map((uid) => profiles[uid])
    .filter((p): p is UserProfile => !!p)
    .map((p) => ({ uid: p.uid, name: p.name, avatarColor: p.avatarColor, photoUri: p.photoUri }));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
        <Animated.View style={[styles.halo, { backgroundColor: colors.accentSoft }, haloAnimatedStyle]}>
          <Icon name="check" size={34} color={colors.primary} />
        </Animated.View>

        <Animated.View style={contentAnimatedStyle}>
          <View style={styles.centerBlock}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t.checkinSuccessTitle}</Text>
            <Text style={[styles.subtitle, { color: colors.textHint }]}>
              {format(new Date(), 'HH:mm')} · {event.location}
            </Text>
          </View>

          {/* Find-your-group (research doc #9) — only rendered when the
              creator actually filled it in (CreateTab / edit screen); plain
              check-in is unaffected otherwise. */}
          {(event.checkInInfo?.text || event.checkInInfo?.photoUri) && (
            <View style={[styles.findGroupCard, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}>
              <View style={styles.findGroupHeaderRow}>
                <Icon name="pin" size={15} color={colors.accentInk} />
                <Text style={[styles.findGroupTitle, { color: colors.accentInk }]}>{t.checkinFindYourGroupTitle}</Text>
              </View>
              {!!event.checkInInfo?.text && (
                <Text style={[styles.findGroupText, { color: colors.accentInk }]}>{event.checkInInfo.text}</Text>
              )}
              {!!event.checkInInfo?.photoUri && (
                <Image source={{ uri: event.checkInInfo.photoUri }} style={styles.findGroupPhoto} resizeMode="cover" />
              )}
            </View>
          )}

          <Ticket
            topLabel={
              ownIsPlusOne
                ? t.ticketPlusOneLabel
                : ownIsGroupBonus
                  ? t.ticketGroupBonusLabel
                  : ownArrivedSolo && user?.firstSoloAttendanceEventId === eventId
                    ? t.ticketFirstSoloLabel
                    : (user?.checkInCount ?? 0) <= 1
                      ? t.ticketWelcomeLabel
                      : t.ticketLabel
            }
            title={event.title}
            number={user?.checkInCount ?? 1}
            footerLeft={format(event.dateTime, 'd MMM · HH:mm', { locale: dateLocale })}
            attendees={attendeeProfiles}
            attendeesTotal={event.attendeeIds.length}
            xpLabel={`+${XP_VALUES.checkinBonus} XP`}
            style={styles.ticket}
          />

          {/* Warm, non-comparative stat (plan: "ticket earned, XP, streak,
              one warm stat") — only shown once there's an actual streak to
              celebrate, never a guilt nudge about a missing one. */}
          {(user?.currentStreak ?? 0) > 1 && (
            <View style={styles.streakRow}>
              <Icon name="flame" size={14} color={colors.primary} />
              <Text style={[styles.streakText, { color: colors.textSecondary }]}>
                {t.checkinStreakStat(user!.currentStreak!)}
              </Text>
            </View>
          )}
        </Animated.View>

        {ownArrivedSolo === undefined && (
          <View style={[styles.soloRow, { borderColor: colors.border }]}>
            <Text style={[styles.soloText, { color: colors.textPrimary }]}>{t.checkinArrivedSoloQuestion}</Text>
            <View style={styles.soloBtns}>
              <Button label={t.checkinArrivedSoloYes} onPress={() => answerArrivedSolo(true)} variant="soft" size="sm" />
              <Button label={t.checkinArrivedSoloNo} onPress={() => answerArrivedSolo(false)} variant="outline" size="sm" />
            </View>
          </View>
        )}

        <Text style={[styles.hereLabel, { color: colors.textHint }]}>
          {t.checkinHereNow(checkedInUids.length)}
        </Text>

        {checkedInUids.map((uid) => {
          const p = profiles[uid];
          const isOrganizer = uid === event.creatorId;
          return (
            <Pressable key={uid} onPress={() => router.push(`/(app)/user/${uid}`)} style={styles.personRow}>
              {p?.photoUri ? (
                <Image source={{ uri: p.photoUri }} style={styles.personAvatar} />
              ) : (
                <View style={[styles.personAvatar, { backgroundColor: p?.avatarColor ?? '#D6C3AB' }]}>
                  <Text style={styles.personInitial}>{(p?.name?.[0] ?? '?').toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.personInfo}>
                <Text style={[styles.personName, { color: colors.textPrimary }]}>{p?.name ?? '…'}</Text>
                <Text style={[styles.personMeta, { color: colors.textHint }]}>
                  {p?.university ? universityLabel(p.university, language) : ''}
                  {isOrganizer ? ` · ${t.checkinOrganizerTag}` : ''}
                </Text>
              </View>
              {uid !== user?.id && (
                <Pressable
                  onPress={(e) => { e.stopPropagation?.(); haptics.light(); toggleKudos(uid); }}
                  hitSlop={8}
                  style={styles.kudosBtn}
                >
                  <Icon
                    name="heart"
                    size={16}
                    filled={(kudos[uid] ?? []).includes(user?.id ?? '')}
                    color={(kudos[uid] ?? []).includes(user?.id ?? '') ? colors.primary : colors.textHint}
                  />
                  {(kudos[uid] ?? []).length > 0 && (
                    <Text style={[styles.kudosCount, { color: colors.textHint }]}>{(kudos[uid] ?? []).length}</Text>
                  )}
                </Pressable>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 16 }]}>
        <Button label={t.checkinSeeWhoBtn} onPress={() => router.replace(`/(app)/event/${eventId}`)} variant="primary" fullWidth />
      </View>

      <NewcomerMilestoneModal
        visible={showNewcomerExit}
        variant="exitMode"
        xpAmount={XP_VALUES.checkinBonus + XP_VALUES.newcomerFirstCheckinBonus}
        onContinue={() => setShowNewcomerExit(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.sm },
  halo: {
    width: 64, height: 64, borderRadius: 32, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  centerBlock: { alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontSize: FontSize.display, fontFamily: TitleFont, fontWeight: FontWeight.bold, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.base, marginTop: 6 },
  ticket: { marginBottom: Spacing.lg },
  findGroupCard: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.lg },
  findGroupHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  findGroupTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.2, textTransform: 'uppercase' },
  findGroupText: { fontSize: FontSize.base, lineHeight: 20 },
  findGroupPhoto: { width: '100%', height: 140, borderRadius: BorderRadius.sm },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: -Spacing.md, marginBottom: Spacing.lg },
  streakText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  soloRow: {
    borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md,
    marginBottom: Spacing.lg, gap: Spacing.sm,
  },
  soloText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  soloBtns: { flexDirection: 'row', gap: Spacing.sm },
  hereLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont,
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 4,
  },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 9 },
  personAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  personInitial: { color: '#3A2E22', fontWeight: FontWeight.bold, fontFamily: UIFont },
  personInfo: { flex: 1, minWidth: 0 },
  personName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  personMeta: { fontSize: FontSize.sm, marginTop: 1 },
  kudosBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 4 },
  kudosCount: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  footer: { borderTopWidth: 1, paddingHorizontal: Spacing.gutter, paddingTop: Spacing.md },
});
