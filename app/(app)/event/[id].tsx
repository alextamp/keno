import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  Alert, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable,
  ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadEventImage } from '@/core/utils/uploadImage';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import { addDoc, arrayRemove, arrayUnion, collection, doc, increment, onSnapshot, orderBy, query, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTabNavigation } from '@/core/tabNavigation';
import { format } from 'date-fns';
import { useTheme } from '@/core/theme';
import { BorderRadius, DrawFont, FontSize, FontWeight, LogoFont, Shadow, Spacing } from '@/core/constants/theme';
import {
  EventEntity, EventCategory, EVENT_CATEGORY_COLORS,
  GenderFilter, isAttending, isEventFull, isOnWaitlist, spotsLeft,
} from '@/features/events/domain/entities/event.entity';

interface PublicComment {
  id: string;
  userId: string;
  userName: string;
  userAvatarColor: string;
  userPhotoUri?: string;
  text: string;
  createdAt: Date;
}

const CATEGORY_KEYS: Record<EventCategory, string> = {
  [EventCategory.Party]: 'catParty',
  [EventCategory.Sports]: 'catSports',
  [EventCategory.Study]: 'catStudy',
  [EventCategory.Chill]: 'catChill',
  [EventCategory.Coffee]: 'catCoffee',
  [EventCategory.Other]: 'catOther',
};
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { chatRepository } from '@/features/events/data/repositories/chat.repository';
import { addEventToCalendar, isEventInCalendar, removeEventFromCalendar } from '@/core/utils/calendar';
import { isLeft } from '@/core/utils/either';
import { getCountdown, formatMessageTime } from '@/core/utils/time';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { notificationsRepository } from '@/features/notifications/notifications.repository';
import { scheduleEventReminder, cancelEventReminder } from '@/core/utils/eventReminders';
import { haptics } from '@/core/utils/haptics';
import { sounds } from '@/core/utils/sounds';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useTranslation, getDateLocale, useLanguageStore } from '@/core/i18n';

function Avatar({ profile, size = 44 }: { profile?: UserProfile; size?: number }) {
  const name = profile?.name ?? '?';
  const initial = name.charAt(0).toUpperCase();
  const bg = profile?.avatarColor ?? '#999';
  if (profile?.photoUri) {
    return <Image source={{ uri: profile.photoUri }} style={[styles.avatarImg, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}


export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { goToTab } = useTabNavigation();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const saveEvent = useAuthStore((s) => s.saveEvent);
  const unsaveEvent = useAuthStore((s) => s.unsaveEvent);
  const addJoinedEvent = useAuthStore((s) => s.addJoinedEvent);
  const removeJoinedEvent = useAuthStore((s) => s.removeJoinedEvent);
  const upsertEvent = useEventsStore((s) => s.upsertEvent);
  const removeEvent = useEventsStore((s) => s.removeEvent);
  const t = useTranslation();
  const { language } = useLanguageStore();
  const dateLocale = getDateLocale(language);
  const GENDER_LABELS: Record<GenderFilter, string> = { any: t.eventGenderAny, male: t.eventGenderMaleOnly, female: t.eventGenderFemaleOnly };
  const insets = useSafeAreaInsets();

  const [event, setEvent] = useState<EventEntity | null>(null);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [messages, setMessages] = useState<import('@/features/events/domain/entities/event.entity').ChatMessage[]>([]);
  const [typingUids, setTypingUids] = useState<string[]>([]);
  const [msgReactionPicker, setMsgReactionPicker] = useState<string | null>(null);
  const [inCalendar, setInCalendar] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [wallPhotos, setWallPhotos] = useState<{ id: string; uri: string; uploaderName: string; uploaderAvatarColor: string }[]>([]);
  const [uploadingWallPhoto, setUploadingWallPhoto] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const isFirstMessagesSnapshot = useRef(true);
  const shareCardRef = useRef<View>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (id) loadEvent(); }, [id]);
  useEffect(() => { if (id) isEventInCalendar(id).then(setInCalendar); }, [id]);

  // Increment view count once per session per event
  useEffect(() => {
    if (!id) return;
    const sessionKey = `viewed_${id}`;
    if ((globalThis as any)[sessionKey]) return;
    (globalThis as any)[sessionKey] = true;
    updateDoc(doc(db, 'events', id), { viewCount: increment(1) }).catch(() => {});
  }, [id]);

  // Subscribe to public comments
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'events', id, 'comments'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({
        id: d.id,
        userId: d.data().userId as string,
        userName: d.data().userName as string,
        userAvatarColor: d.data().userAvatarColor as string,
        userPhotoUri: d.data().userPhotoUri as string | undefined,
        text: d.data().text as string,
        createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
      })));
    }, () => {});
    return unsub;
  }, [id]);

  // Subscribe to photo wall
  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'events', id, 'photos'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setWallPhotos(snap.docs.map((d) => ({
        id: d.id,
        uri: d.data().uri as string,
        uploaderName: d.data().uploaderName as string,
        uploaderAvatarColor: d.data().uploaderAvatarColor as string,
      })));
    }, () => {});
    return unsub;
  }, [id]);

  // Subscribe to real-time messages subcollection
  useEffect(() => {
    if (!id) return;
    isFirstMessagesSnapshot.current = true;
    const unsub = chatRepository.subscribeToMessages(id, (msgs) => {
      setMessages(msgs);
      if (isFirstMessagesSnapshot.current) {
        isFirstMessagesSnapshot.current = false;
        return;
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
    });
    return unsub;
  }, [id]);

  // Subscribe to typing indicators once attending is known
  useEffect(() => {
    if (!id || !user) return;
    const unsub = chatRepository.subscribeToTyping(id, user.id, setTypingUids);
    return () => {
      unsub();
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (typingDebounce.current) clearTimeout(typingDebounce.current);
    };
  }, [id, user?.id]);

  const loadEvent = async () => {
    setLoading(true);
    const result = await eventsRepository.getEvent(id);
    if (isLeft(result)) {
      Alert.alert(t.createAlertSaveError, result.left.message, [{ onPress: () => router.back() }]);
    } else {
      const ev = result.right;
      setEvent(ev);
      const allUids = [...new Set(ev.attendeeIds)];
      const loaded = await fetchUserProfiles(allUids);
      setProfiles(loaded);
    }
    setLoading(false);
  };

  const handleJoinLeave = async () => {
    if (!event || !user) return;
    const attending = isAttending(event, user.id);
    haptics.medium();
    setActionLoading(true);
    const result = attending
      ? await eventsRepository.leaveEvent(event.id, user.id)
      : await eventsRepository.joinEvent(event.id, user.id);
    if (isLeft(result)) Alert.alert(t.createAlertSaveError, result.left.message);
    else {
      const updated: EventEntity = {
        ...event,
        attendeeIds: attending
          ? event.attendeeIds.filter((uid) => uid !== user.id)
          : [...event.attendeeIds, user.id],
      };
      setEvent(updated);
      upsertEvent(updated);
      if (attending) {
        removeJoinedEvent(event.id);
        cancelEventReminder(event.id).catch(() => {});
        haptics.light();
        // Notify first person on waitlist that a spot opened
        const firstWaiting = event.waitlistIds?.[0];
        if (firstWaiting) {
          notificationsRepository.create({
            toUid: firstWaiting,
            fromUid: user.id,
            fromName: user.name,
            fromAvatarColor: user.avatarColor,
            type: 'event_join',
            eventId: event.id,
            eventTitle: t.eventWaitlistSpotOpened(event.title),
          }).catch(() => {});
        }
      } else {
        addJoinedEvent(event.id);
        scheduleEventReminder(updated).catch(() => {});
        haptics.success();
        sounds.play('success');
        if (event.creatorId !== user.id) {
          notificationsRepository.create({
            toUid: event.creatorId,
            fromUid: user.id,
            fromName: user.name,
            fromAvatarColor: user.avatarColor,
            type: 'event_join',
            eventId: event.id,
            eventTitle: event.title,
          }).catch(() => {});
        }
      }
    }
    setActionLoading(false);
  };

  const handleSendMessage = async () => {
    if (!event || !user || !chatDraft.trim()) return;
    if (containsBlockedContent(chatDraft)) {
      Alert.alert(t.eventChatTitle, t.validContentBlocked);
      return;
    }
    haptics.light();
    setSendingMsg(true);
    const text = chatDraft;
    setChatDraft('');
    // Clear typing indicator
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    chatRepository.setTyping(event.id, user.id, false);
    try {
      await chatRepository.sendMessage(event.id, user.id, text);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      if (event.creatorId !== user.id) {
        notificationsRepository.create({
          toUid: event.creatorId,
          fromUid: user.id,
          fromName: user.name,
          fromAvatarColor: user.avatarColor,
          type: 'event_message',
          eventId: event.id,
          eventTitle: event.title,
        }).catch(() => {});
      }
    } catch {
      // Silently ignore
    }
    setSendingMsg(false);
  };

  const handleChatDraftChange = useCallback((text: string) => {
    setChatDraft(text);
    if (!event || !user) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (text.trim()) {
      // Debounce the setTyping(true) write — fire at most once per 2 seconds
      if (!typingDebounce.current) {
        chatRepository.setTyping(event.id, user.id, true);
        typingDebounce.current = setTimeout(() => { typingDebounce.current = null; }, 2000);
      }
      typingTimeout.current = setTimeout(() => {
        chatRepository.setTyping(event.id!, user.id, false);
        typingDebounce.current = null;
      }, 4000);
    } else {
      if (typingDebounce.current) { clearTimeout(typingDebounce.current); typingDebounce.current = null; }
      chatRepository.setTyping(event.id, user.id, false);
    }
  }, [event?.id, user?.id]);

  const handleMsgReact = async (messageId: string, emoji: string) => {
    if (!event || !user) return;
    haptics.light();
    setMsgReactionPicker(null);
    const msg = messages.find((m) => m.id === messageId);
    const alreadyReacted = msg?.reactions?.[emoji]?.includes(user.id);
    if (alreadyReacted) {
      await chatRepository.removeReaction(event.id, messageId, user.id, emoji);
    } else {
      await chatRepository.reactToMessage(event.id, messageId, user.id, emoji);
    }
  };

  const handleSendComment = async () => {
    if (!user || !id || !commentDraft.trim()) return;
    if (containsBlockedContent(commentDraft)) {
      Alert.alert(t.eventChatTitle, t.validContentBlocked);
      return;
    }
    haptics.light();
    setSendingComment(true);
    const text = commentDraft.trim();
    setCommentDraft('');
    try {
      await addDoc(collection(db, 'events', id, 'comments'), {
        userId: user.id,
        userName: user.name,
        userAvatarColor: user.avatarColor ?? '#999',
        userPhotoUri: user.photoUri ?? null,
        text,
        createdAt: Timestamp.now(),
      });
    } catch {
      setCommentDraft(text);
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
    setSendingComment(false);
  };

  const handleUploadWallPhoto = async () => {
    if (!user || !id) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploadingWallPhoto(true);
    try {
      const uri = await uploadEventImage(result.assets[0].uri);
      await addDoc(collection(db, 'events', id, 'photos'), {
        uri,
        uploaderUid: user.id,
        uploaderName: user.name,
        uploaderAvatarColor: user.avatarColor ?? '#999',
        createdAt: Timestamp.now(),
      });
      haptics.success();
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
    setUploadingWallPhoto(false);
  };

  const handleToggleCoHost = async (uid: string) => {
    if (!event || !user || user.id !== event.creatorId) return;
    haptics.medium();
    const isCoHost = (event.coHostIds ?? []).includes(uid);
    const label = isCoHost ? t.eventRemoveCoHost : t.eventMakeCoHost;
    Alert.alert(label, isCoHost ? undefined : undefined, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: label,
        onPress: async () => {
          const updated: EventEntity = {
            ...event,
            coHostIds: isCoHost
              ? (event.coHostIds ?? []).filter((id) => id !== uid)
              : [...(event.coHostIds ?? []), uid],
          };
          try {
            await updateDoc(doc(db, 'events', id), {
              coHostIds: isCoHost ? arrayRemove(uid) : arrayUnion(uid),
            });
            setEvent(updated);
            upsertEvent(updated);
          } catch {
            Alert.alert(t.createAlertSaveError, t.authErrGeneric);
          }
        },
      },
    ]);
  };

  const handleShareAsImage = async () => {
    if (!shareCardRef.current) return;
    haptics.light();
    try {
      const uri = await captureRef(shareCardRef, { format: 'png', quality: 0.95 });
      await Share.share({ url: uri, title: event?.title ?? '' });
    } catch {}
  };

  const handleDelete = () => {
    if (!event || !user) return;
    Alert.alert(t.eventDeleteTitle, t.eventDeleteBody, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: t.eventDeleteBtn, style: 'destructive',
        onPress: async () => {
          const result = await eventsRepository.deleteEvent(event.id, user.id);
          if (isLeft(result)) Alert.alert(t.createAlertSaveError, result.left.message);
          else { removeEvent(event.id); router.back(); }
        },
      },
    ]);
  };


  const handleReport = () => {
    if (!event || !user) return;
    Alert.alert(t.eventReportTitle, undefined, [
      { text: t.eventReportSpam, onPress: () => submitReport('spam') },
      { text: t.eventReportInappropriate, onPress: () => submitReport('inappropriate') },
      { text: t.eventReportMisinformation, onPress: () => submitReport('misinformation') },
      { text: t.settingsBtnCancel, style: 'cancel' },
    ]);
  };

  const submitReport = async (reason: string) => {
    if (!event || !user) return;
    try {
      await addDoc(collection(db, 'reports'), {
        reportedEventId: event.id,
        reportedUid: event.creatorId,
        reporterUid: user.id,
        reason,
        createdAt: new Date(),
      });
      Alert.alert(t.eventReportSubmitted, t.eventReportSubmittedBody);
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
  };

  const handleWaitlist = async () => {
    if (!event || !user) return;
    haptics.medium();
    const onList = isOnWaitlist(event, user.id);
    setActionLoading(true);
    const result = onList
      ? await eventsRepository.leaveWaitlist(event.id, user.id)
      : await eventsRepository.joinWaitlist(event.id, user.id);
    if (isLeft(result)) Alert.alert(t.createAlertSaveError, result.left.message);
    else {
      const updated: EventEntity = {
        ...event,
        waitlistIds: onList
          ? event.waitlistIds.filter((id) => id !== user.id)
          : [...(event.waitlistIds ?? []), user.id],
      };
      setEvent(updated);
      upsertEvent(updated);
      if (!onList) haptics.success();
    }
    setActionLoading(false);
  };

  const handleShare = async () => {
    if (!event) return;
    haptics.light();
    const dateStr = format(event.dateTime, 'EEE d MMM, HH:mm', { locale: dateLocale });
    await Share.share({
      title: event.title,
      message: `🎉 ${event.title}\n📌 ${event.location}\n⏰ ${dateStr}\n\n${t.eventShareCta}`,
    });
  };

  const handleSave = () => {
    if (!user || !event) return;
    haptics.light();
    const saved = user.savedEventIds?.includes(event.id) ?? false;
    (saved ? unsaveEvent(event.id) : saveEvent(event.id)).catch(() => {});
  };

  const handleCalendar = async () => {
    if (!event) return;
    haptics.light();
    if (inCalendar) {
      const ok = await removeEventFromCalendar(event.id);
      if (ok) setInCalendar(false);
    } else {
      const ok = await addEventToCalendar(event);
      if (ok) setInCalendar(true);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!event) return null;

  const isInvited = !event.isPrivate || user?.id === event.creatorId || (event.invitedUserIds ?? []).includes(user?.id ?? '');

  // Private event lock screen for non-invited users
  if (event.isPrivate && !isInvited) {
    return (
      <View style={[{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }]}>
        <AnimatedPressable onPress={() => router.back()} style={{ position: 'absolute', top: insets.top + 12, left: 20, width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, color: colors.textPrimary }}>←</Text>
        </AnimatedPressable>
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={{ fontSize: 22, fontWeight: '900', fontFamily: DrawFont, color: colors.textPrimary, textAlign: 'center' }}>Private Event</Text>
        <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center' }}>This event is invite-only. Ask the organiser to invite you.</Text>
      </View>
    );
  }

  const attending = user ? isAttending(event, user.id) : false;
  const onWaitlist = user ? isOnWaitlist(event, user.id) : false;
  const full = isEventFull(event);
  const spots = spotsLeft(event);
  const isCreator = user?.id === event.creatorId;
  const categoryColor = EVENT_CATEGORY_COLORS[event.category];
  const bs = colors.borderStrong;
  const countdown = getCountdown(event.dateTime);

  const hasFilters = (event.genderFilter && event.genderFilter !== 'any') || event.minAge || event.maxAge || (event.allowedUniversities?.length ?? 0) > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top banner — always shown, same style regardless of image */}
      <View style={[styles.topBanner, { backgroundColor: categoryColor, paddingTop: insets.top + 12, borderBottomColor: bs }]}>
        <AnimatedPressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </AnimatedPressable>
        <Text style={styles.categoryLabelWhite}>{t[CATEGORY_KEYS[event.category] as keyof typeof t] as string}</Text>
        {!isCreator && (
          <AnimatedPressable onPress={handleReport} style={[styles.deleteBtn, { backgroundColor: 'rgba(220,50,50,0.3)' }]}>
            <Text style={styles.deleteBtnText}>{t.eventReportBtn}</Text>
          </AnimatedPressable>
        )}
        {isCreator && (
          <>
            <AnimatedPressable onPress={handleDelete} style={[styles.deleteBtn, { backgroundColor: 'rgba(220,50,50,0.4)' }]}>
              <Text style={styles.deleteBtnText}>{t.eventDeleteBtn}</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => router.push(`/(app)/event/edit/${event.id}`)} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>{t.eventEditBtn}</Text>
            </AnimatedPressable>
            <AnimatedPressable onPress={() => setShowQr(true)} style={[styles.deleteBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.deleteBtnText}>{t.eventQrShowBtn}</Text>
            </AnimatedPressable>
          </>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: isCreator ? insets.bottom + 40 : insets.bottom + 140 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title + countdown */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.textPrimary, flex: 1 }]}>{event.title}</Text>
          <View style={[styles.countdownBadge, {
            backgroundColor: countdown.urgent ? colors.primary : colors.surfaceVariant,
            borderColor: bs,
          }]}>
            <Text style={[styles.countdownText, { color: countdown.urgent ? '#fff' : colors.textSecondary }]}>
              ⏰ {countdown.label}
            </Text>
          </View>
        </View>

        {/* Private event invite banner (creator only) */}
        {event.isPrivate && isCreator && (
          <AnimatedPressable
            onPress={() => {
              Alert.alert(
                '🔒 Private Event',
                `Share this event ID with people you want to invite:\n\n${event.id}\n\nThey can enter it in Search to find the event.`,
                [
                  { text: 'Copy & Share', onPress: () => Share.share({ message: `You're invited to "${event.title}" on Keno! Event ID: ${event.id}` }) },
                  { text: 'OK' },
                ],
              );
            }}
            style={[styles.privateBanner, { backgroundColor: '#1a1a2e', borderColor: '#6c63ff' }]}
          >
            <Text style={styles.privateBannerEmoji}>🔒</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.privateBannerTitle, { color: '#fff' }]}>Private Event</Text>
              <Text style={[styles.privateBannerSub, { color: 'rgba(255,255,255,0.6)' }]}>Tap to share invite link with guests</Text>
            </View>
            <Text style={{ color: '#6c63ff', fontWeight: '900' }}>→</Text>
          </AnimatedPressable>
        )}

        {/* Cover photo — below title */}
        {event.imageUri && (
          <View style={styles.coverImageWrap}>
            <Image source={{ uri: event.imageUri }} style={styles.coverImage} resizeMode="cover" />
          </View>
        )}

        {/* Creator analytics */}
        {isCreator && (
          <View style={[styles.analyticsCard, { backgroundColor: colors.surface, borderColor: bs }]}>
            <Text style={[styles.analyticsSectionTitle, { color: colors.textHint }]}>{t.eventAnalyticsTitle}</Text>
            <View style={styles.analyticsRow}>
              <View style={styles.analyticsStat}>
                <Text style={[styles.analyticsValue, { color: colors.textPrimary }]}>{event.viewCount ?? 0}</Text>
                <Text style={[styles.analyticsLabel, { color: colors.textHint }]}>{t.eventAnalyticsViews}</Text>
              </View>
              <View style={[styles.analyticsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.analyticsStat}>
                <Text style={[styles.analyticsValue, { color: colors.textPrimary }]}>{event.attendeeIds.length}</Text>
                <Text style={[styles.analyticsLabel, { color: colors.textHint }]}>{t.eventGoing(event.attendeeIds.length, event.maxAttendees)}</Text>
              </View>
              <View style={[styles.analyticsDivider, { backgroundColor: colors.border }]} />
              <View style={styles.analyticsStat}>
                <Text style={[styles.analyticsValue, { color: colors.textPrimary }]}>{(event.coHostIds ?? []).length + 1}</Text>
                <Text style={[styles.analyticsLabel, { color: colors.textHint }]}>{t.eventCoHostsTitle}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Quick actions row */}
        {user && (
          <View style={styles.quickActionsRow}>
            <AnimatedPressable
              onPress={handleSave}
              style={[styles.quickActionBtn, {
                backgroundColor: (user.savedEventIds?.includes(event.id) ?? false) ? colors.primary : colors.surface,
                borderColor: bs,
              }]}
            >
              <Text style={styles.quickActionEmoji}>{(user.savedEventIds?.includes(event.id) ?? false) ? '🔖' : '🏷️'}</Text>
              <Text style={[styles.quickActionText, { color: (user.savedEventIds?.includes(event.id) ?? false) ? '#fff' : colors.textSecondary }]}>
                {(user.savedEventIds?.includes(event.id) ?? false) ? t.eventSaved : t.eventSaveBtn}
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={handleCalendar}
              style={[styles.quickActionBtn, {
                backgroundColor: inCalendar ? colors.primary : colors.surface,
                borderColor: bs,
              }]}
            >
              <Text style={styles.quickActionEmoji}>{inCalendar ? '✅' : '📅'}</Text>
              <Text style={[styles.quickActionText, { color: inCalendar ? '#fff' : colors.textSecondary }]}>
                {inCalendar ? t.eventInCalendar : t.eventAddToCalendar}
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={handleShare}
              style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: bs }]}
            >
              <Text style={styles.quickActionEmoji}>📤</Text>
              <Text style={[styles.quickActionText, { color: colors.textSecondary }]}>{t.eventShareAction}</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={handleShareAsImage}
              style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: bs }]}
            >
              <Text style={styles.quickActionEmoji}>🖼️</Text>
              <Text style={[styles.quickActionText, { color: colors.textSecondary }]}>{t.eventShareCard}</Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => {
                const dateStr = format(event.dateTime, 'EEE d MMM, HH:mm', { locale: dateLocale });
                const text = `🎉 ${event.title}\n📌 ${event.location}\n⏰ ${dateStr}\n\nFound on Keno 🔥`;
                Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}`).catch(() =>
                  Share.share({ message: text }),
                );
              }}
              style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: bs }]}
            >
              <Text style={styles.quickActionEmoji}>💬</Text>
              <Text style={[styles.quickActionText, { color: colors.textSecondary }]}>{t.eventShareWhatsApp ?? 'WhatsApp'}</Text>
            </AnimatedPressable>
          </View>
        )}

        {/* Meta card */}
        <View style={[styles.metaCard, { backgroundColor: colors.surface, borderColor: bs }]}>
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>⏰</Text>
            <View style={styles.metaBody}>
              <Text style={[styles.metaLabel, { color: colors.textHint }]}>{t.eventMetaDateTime}</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{format(event.dateTime, 'EEEE, d MMMM yyyy', { locale: dateLocale })}</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{format(event.dateTime, 'HH:mm')}</Text>
            </View>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📌</Text>
            <View style={styles.metaBody}>
              <Text style={[styles.metaLabel, { color: colors.textHint }]}>{t.eventMetaLocation}</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{event.location}</Text>
            </View>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: colors.border }]} />
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>👥</Text>
            <View style={styles.metaBody}>
              <Text style={[styles.metaLabel, { color: colors.textHint }]}>{t.eventMetaAttendees}</Text>
              <Text style={[styles.metaValue, { color: full && !attending ? colors.error : colors.textPrimary }]}>
                {full && !attending ? t.eventFull : t.eventSpotsLeft(spots)}
              </Text>
              <Text style={[styles.metaSubValue, { color: colors.textSecondary }]}>{t.eventGoing(event.attendeeIds.length, event.maxAttendees)}</Text>
              {full && (event.waitlistIds?.length ?? 0) > 0 && (
                <Text style={[styles.metaSubValue, { color: colors.textHint }]}>
                  {t.eventWaitlistCount(event.waitlistIds.length)}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Description */}
        {!!event.description && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.eventAbout}</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{event.description}</Text>
          </View>
        )}

        {/* Who's going */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.eventWhosGoing}</Text>
          <View style={styles.participantsGrid}>
            {event.attendeeIds.map((uid) => {
              const profile = profiles[uid];
              const name = profile?.name ?? 'User';
              const uni = (profile as any)?.university ?? '';
              const isMe = uid === user?.id;
              const isCoHostUid = (event.coHostIds ?? []).includes(uid);
              const isCreatorUid = uid === event.creatorId;
              return (
                <AnimatedPressable
                  key={uid}
                  onPress={() => {
                    if (uid === user?.id) {
                      router.navigate('/(app)');
                      // PagerView.setPage() is unreliable while the tab screen isn't
                      // focused/visible yet — give the navigation a tick to land first.
                      setTimeout(() => goToTab(4), 50);
                    } else router.push(`/(app)/user/${uid}`);
                  }}
                  onLongPress={() => {
                    if (isCreator && !isCreatorUid && !isMe) handleToggleCoHost(uid);
                  }}
                  style={[styles.participantCard, { backgroundColor: colors.surface, borderColor: bs }]}
                >
                  <View style={styles.participantTop}>
                    <Avatar profile={profile} size={40} />
                    {isMe && (
                      <View style={[styles.meBadge, { backgroundColor: colors.primary, borderColor: bs }]}>
                        <Text style={styles.meBadgeText}>{t.eventYou}</Text>
                      </View>
                    )}
                    {!isMe && isCoHostUid && (
                      <View style={[styles.meBadge, { backgroundColor: '#CC6B00', borderColor: bs }]}>
                        <Text style={styles.meBadgeText}>{t.eventCoHostBadge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.participantName, { color: colors.textPrimary }]} numberOfLines={1}>{name}</Text>
                  <Text style={[styles.participantUni, { color: colors.textHint }]}>{uni}</Text>
                </AnimatedPressable>
              );
            })}
          </View>
        </View>

        {/* Restrictions */}
        {hasFilters && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.eventRestrictions}</Text>
            <View style={[styles.filtersCard, { backgroundColor: colors.surface, borderColor: bs }]}>
              {event.genderFilter && event.genderFilter !== 'any' && (
                <View style={styles.filterRow}>
                  <Text style={styles.filterIcon}>👤</Text>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{GENDER_LABELS[event.genderFilter]}</Text>
                </View>
              )}
              {(event.minAge || event.maxAge) && (
                <View style={styles.filterRow}>
                  <Text style={styles.filterIcon}>🎂</Text>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{t.eventFilterAge} {event.minAge ?? 18}–{event.maxAge ?? '∞'}</Text>
                </View>
              )}
              {event.allowedUniversities && event.allowedUniversities.length > 0 && (
                <View style={styles.filterRow}>
                  <Text style={styles.filterIcon}>🎓</Text>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{event.allowedUniversities.join(', ')}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Chat ── (only for attendees) */}
        {attending && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t.eventChatTitle} {messages.length > 0 ? `(${messages.length})` : ''}
            </Text>

            {messages.length === 0 ? (
              <View style={[styles.chatEmpty, { backgroundColor: colors.surface, borderColor: bs }]}>
                <Text style={styles.chatEmptyEmoji}>💬</Text>
                <Text style={[styles.chatEmptyText, { color: colors.textHint }]}>{t.eventChatEmpty}</Text>
              </View>
            ) : (
              <View style={[styles.chatMessages, { backgroundColor: colors.surface, borderColor: bs }]}>
                {messages.map((msg) => {
                  const msgProfile = profiles[msg.userId];
                  const name = msgProfile?.name ?? 'User';
                  const isMe = msg.userId === user?.id;
                  const msgReactions = Object.entries(msg.reactions ?? {}).filter(([, uids]) => uids.length > 0);
                  const showPicker = msgReactionPicker === msg.id;
                  return (
                    <View key={msg.id}>
                      <AnimatedPressable
                        onLongPress={() => setMsgReactionPicker(showPicker ? null : msg.id)}
                        style={[styles.msgRow, isMe && styles.msgRowMe]}
                      >
                        {!isMe && <Avatar profile={msgProfile} size={28} />}
                        <View style={[
                          styles.msgBubble,
                          { backgroundColor: isMe ? colors.primary : colors.surfaceVariant, borderColor: bs },
                        ]}>
                          {!isMe && <Text style={[styles.msgName, { color: colors.textHint }]}>{name}</Text>}
                          <Text style={[styles.msgText, { color: isMe ? '#fff' : colors.textPrimary }]}>{msg.text}</Text>
                          <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.65)' : colors.textHint }]}>
                            {formatMessageTime(msg.timestamp, language)}
                          </Text>
                        </View>
                      </AnimatedPressable>
                      {/* Inline reaction picker */}
                      {showPicker && (
                        <View style={[styles.emojiPicker, isMe && styles.emojiPickerMe, { backgroundColor: colors.surface, borderColor: bs }]}>
                          {['❤️', '😂', '🔥', '👍', '😮', '😢'].map((e) => (
                            <AnimatedPressable key={e} onPress={() => handleMsgReact(msg.id, e)} style={styles.emojiPickerBtn}>
                              <Text style={styles.emojiPickerIcon}>{e}</Text>
                            </AnimatedPressable>
                          ))}
                        </View>
                      )}
                      {/* Reaction chips */}
                      {msgReactions.length > 0 && (
                        <View style={[styles.msgReactionsRow, isMe && styles.msgReactionsRowMe]}>
                          {msgReactions.map(([emoji, uids]) => (
                            <AnimatedPressable
                              key={emoji}
                              onPress={() => handleMsgReact(msg.id, emoji)}
                              style={[styles.msgReactionChip, {
                                backgroundColor: uids.includes(user?.id ?? '') ? colors.primary : colors.surfaceVariant,
                                borderColor: bs,
                              }]}
                            >
                              <Text style={styles.msgReactionChipText}>{emoji} {uids.length}</Text>
                            </AnimatedPressable>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
                {/* Typing indicator */}
                {typingUids.length > 0 && (
                  <View style={styles.msgRow}>
                    <View style={[styles.typingBubble, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
                      <Text style={[styles.typingText, { color: colors.textHint }]}>
                        {typingUids.length === 1
                          ? t.eventTyping1(profiles[typingUids[0]]?.name ?? '...')
                          : t.eventTypingMany(typingUids.length)}
                      </Text>
                      <View style={styles.typingDots}>
                        {[0, 1, 2].map((i) => (
                          <View key={i} style={[styles.typingDot, { backgroundColor: colors.textHint }]} />
                        ))}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Message input */}
            <View style={[styles.chatInputRow, { backgroundColor: colors.surface, borderColor: bs }]}>
              <Avatar profile={user?.id ? profiles[user.id] : undefined} size={30} />
              <TextInput
                style={[styles.chatInput, { color: colors.textPrimary }]}
                value={chatDraft}
                onChangeText={handleChatDraftChange}
                placeholder={t.eventChatPlaceholder}
                placeholderTextColor={colors.textHint}
                returnKeyType="send"
                onSubmitEditing={handleSendMessage}
                multiline={false}
              />
              <AnimatedPressable
                onPress={handleSendMessage}
                disabled={!chatDraft.trim() || sendingMsg}
                style={[styles.sendBtn, {
                  backgroundColor: chatDraft.trim() ? colors.primary : colors.surfaceVariant,
                  borderColor: bs,
                }]}
              >
                <Text style={[styles.sendBtnText, { color: chatDraft.trim() ? '#fff' : colors.textHint }]}>✈️</Text>
              </AnimatedPressable>
            </View>
          </View>
        )}

        {/* Teaser for non-attendees */}
        {!attending && messages.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.eventChatTitle}</Text>
            <View style={[styles.chatLocked, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
              <Text style={styles.chatLockedEmoji}>🔒</Text>
              <Text style={[styles.chatLockedText, { color: colors.textSecondary }]}>
                {t.eventChatLocked(messages.length)}
              </Text>
            </View>
          </View>
        )}

        {/* Public comments (visible to all) */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {t.eventCommentsTitle}{comments.length > 0 ? ` (${comments.length})` : ''}
          </Text>
          {comments.length === 0 ? (
            <View style={[styles.chatEmpty, { backgroundColor: colors.surface, borderColor: bs }]}>
              <Text style={styles.chatEmptyEmoji}>💬</Text>
              <Text style={[styles.chatEmptyText, { color: colors.textHint }]}>{t.eventCommentsEmpty}</Text>
            </View>
          ) : (
            <View style={[styles.chatMessages, { backgroundColor: colors.surface, borderColor: bs }]}>
              {comments.map((c) => {
                const isMe = c.userId === user?.id;
                return (
                  <View key={c.id} style={[styles.msgRow, isMe && styles.msgRowMe]}>
                    <View style={[styles.commentAvatar, { backgroundColor: c.userAvatarColor }]}>
                      {c.userPhotoUri ? (
                        <Image source={{ uri: c.userPhotoUri }} style={styles.commentAvatarImg} />
                      ) : (
                        <Text style={styles.commentAvatarInitial}>{c.userName[0].toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={[styles.msgBubble, { backgroundColor: isMe ? colors.primary : colors.surfaceVariant, borderColor: bs }]}>
                      {!isMe && <Text style={[styles.msgName, { color: colors.textHint }]}>{c.userName}</Text>}
                      <Text style={[styles.msgText, { color: isMe ? '#fff' : colors.textPrimary }]}>{c.text}</Text>
                      <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.65)' : colors.textHint }]}>
                        {formatMessageTime(c.createdAt, language)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
          {user && (
            <View style={[styles.chatInputRow, { backgroundColor: colors.surface, borderColor: bs }]}>
              <Avatar profile={user ? { name: user.name, avatarColor: user.avatarColor, photoUri: user.photoUri } as any : undefined} size={30} />
              <TextInput
                style={[styles.chatInput, { color: colors.textPrimary }]}
                value={commentDraft}
                onChangeText={setCommentDraft}
                placeholder={t.eventCommentsPlaceholder}
                placeholderTextColor={colors.textHint}
                returnKeyType="send"
                onSubmitEditing={handleSendComment}
                multiline={false}
              />
              <AnimatedPressable
                onPress={handleSendComment}
                disabled={!commentDraft.trim() || sendingComment}
                style={[styles.sendBtn, {
                  backgroundColor: commentDraft.trim() ? colors.primary : colors.surfaceVariant,
                  borderColor: bs,
                }]}
              >
                <Text style={[styles.sendBtnText, { color: commentDraft.trim() ? '#fff' : colors.textHint }]}>✈️</Text>
              </AnimatedPressable>
            </View>
          )}
        </View>

        {/* Photo wall */}
        {(wallPhotos.length > 0 || (attending && event.dateTime < new Date())) && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                📸 {t.eventPhotoWall ?? 'Photo Wall'}{wallPhotos.length > 0 ? ` (${wallPhotos.length})` : ''}
              </Text>
              {attending && (
                <AnimatedPressable
                  onPress={handleUploadWallPhoto}
                  disabled={uploadingWallPhoto}
                  style={[styles.photoWallAddBtn, { backgroundColor: colors.primary, borderColor: bs }]}
                >
                  <Text style={styles.photoWallAddText}>{uploadingWallPhoto ? '...' : '+ Add'}</Text>
                </AnimatedPressable>
              )}
            </View>
            {wallPhotos.length === 0 ? (
              <View style={[styles.chatEmpty, { backgroundColor: colors.surface, borderColor: bs }]}>
                <Text style={styles.chatEmptyEmoji}>📷</Text>
                <Text style={[styles.chatEmptyText, { color: colors.textHint }]}>
                  {t.eventPhotoWallEmpty ?? 'No photos yet. Be the first to share a moment!'}
                </Text>
              </View>
            ) : (
              <View style={styles.photoGrid}>
                {wallPhotos.map((p) => (
                  <View key={p.id} style={[styles.photoGridItem, { borderColor: bs }]}>
                    <Image source={{ uri: p.uri }} style={styles.photoGridImg} resizeMode="cover" />
                    <View style={[styles.photoGridFooter, { backgroundColor: p.uploaderAvatarColor }]}>
                      <Text style={styles.photoGridName} numberOfLines={1}>{p.uploaderName.split(' ')[0]}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Hidden share card (captured by ViewShot) */}
        <View style={styles.shareCardContainer}>
          <View
            ref={shareCardRef}
            style={[styles.shareCard, { backgroundColor: event.imageUri ? '#000' : categoryColor }]}
            collapsable={false}
          >
            {event.imageUri && (
              <Image source={{ uri: event.imageUri }} style={styles.shareCardBgImage} resizeMode="cover" />
            )}
            <View style={styles.shareCardFloatWrap}>
              <View style={styles.shareCardFloat}>
                <Text style={styles.shareCardTime}>{format(event.dateTime, 'HH:mm')}</Text>
                <View style={styles.shareCardDivider} />
                <Text style={styles.shareCardTitleHighlight}>{event.title}</Text>
                <Text style={styles.shareCardFloatMeta}>📌 {event.location}</Text>
              </View>
            </View>
            <Text style={styles.shareCardApp}>KeNo.</Text>
          </View>
        </View>
      </ScrollView>

      {/* QR Check-in modal (creator only) */}
      <Modal visible={showQr} transparent animationType="fade" onRequestClose={() => setShowQr(false)}>
        <AnimatedPressable style={styles.qrOverlay} onPress={() => setShowQr(false)}>
          <AnimatedPressable style={[styles.qrCard, { backgroundColor: colors.surface, borderColor: bs }]} onPress={() => {}}>
            <Text style={[styles.qrTitle, { color: colors.textPrimary }]}>{t.eventQrTitle}</Text>
            <View style={[styles.qrBox, { backgroundColor: '#fff' }]}>
              <QRCode value={`keno:event:${event.id}`} size={200} />
            </View>
            <Text style={[styles.qrHint, { color: colors.textHint }]}>{event.title}</Text>
          </AnimatedPressable>
        </AnimatedPressable>
      </Modal>

      {!isCreator && (
        <View style={[styles.cta, { backgroundColor: colors.background, borderTopColor: bs, paddingBottom: insets.bottom + 16 }]}>
          {attending ? (
            <Button label={t.eventBtnLeave} onPress={handleJoinLeave} variant="outline" loading={actionLoading} fullWidth />
          ) : full ? (
            <View style={styles.ctaStack}>
              <Button
                label={onWaitlist ? t.eventBtnOnWaitlist(event.waitlistIds.length) : t.eventBtnWaitlist(event.waitlistIds.length)}
                onPress={handleWaitlist}
                variant={onWaitlist ? 'outline' : 'primary'}
                loading={actionLoading}
                fullWidth
              />
              <Text style={[styles.waitlistHint, { color: colors.textHint }]}>
                {t.eventWaitlistHint}
              </Text>
            </View>
          ) : (
            <Button label={t.eventBtnJoin} onPress={handleJoinLeave} variant="primary" loading={actionLoading} fullWidth />
          )}
        </View>
      )}

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  coverImageWrap: { width: '100%', aspectRatio: 16 / 9, borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: Spacing.md },
  coverImage: { width: '100%', height: '100%' },
  topBanner: { paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderBottomWidth: 2.5 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  backIcon: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  categoryLabelWhite: { flex: 1, color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  deleteBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm, backgroundColor: 'rgba(255,255,255,0.25)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' },
  deleteBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  title: { fontSize: 26, fontWeight: FontWeight.extrabold, lineHeight: 32, fontFamily: DrawFont },
  countdownBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full, borderWidth: 2, marginTop: 4 },
  countdownText: { fontSize: 12, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  // Quick actions
  quickActionsRow: { flexDirection: 'row', gap: Spacing.sm },
  quickActionBtn: { flex: 1, flexDirection: 'column', alignItems: 'center', gap: 3, paddingVertical: 10, borderRadius: BorderRadius.lg, borderWidth: 2, ...Shadow.sm },
  quickActionEmoji: { fontSize: 18 },
  quickActionText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: DrawFont, textAlign: 'center' },
  // Reactions
  reactionsCard: { borderRadius: BorderRadius.lg, borderWidth: 2.5, padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm },
  reactionsHint: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  reactionsRow: { flexDirection: 'row', gap: Spacing.sm },
  reactionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 2.5 },
  reactionBtnEmoji: { fontSize: 18 },
  reactionBtnLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  reactionCount: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8 },
  reactionCountText: { fontSize: 11, fontWeight: FontWeight.bold },
  // Meta card
  metaCard: { borderRadius: BorderRadius.lg, borderWidth: 2.5, paddingHorizontal: Spacing.md, ...Shadow.sm },
  metaRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.md, alignItems: 'flex-start' },
  metaDivider: { height: 1.5 },
  metaIcon: { fontSize: 20, marginTop: 2 },
  metaBody: { flex: 1, gap: 2 },
  metaLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  metaSubValue: { fontSize: FontSize.sm },
  // Sections
  section: { gap: Spacing.sm },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  photoWallAddBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: BorderRadius.full, borderWidth: 2 },
  photoWallAddText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.extrabold },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photoGridItem: { width: '47%', borderRadius: BorderRadius.md, overflow: 'hidden', borderWidth: 2 },
  photoGridImg: { width: '100%', aspectRatio: 4 / 3 },
  photoGridFooter: { paddingHorizontal: 8, paddingVertical: 4 },
  photoGridName: { color: '#fff', fontSize: 11, fontWeight: FontWeight.bold },
  privateBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 2.5, borderRadius: BorderRadius.lg, padding: Spacing.md },
  privateBannerEmoji: { fontSize: 22 },
  privateBannerTitle: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  privateBannerSub: { fontSize: 11 },
  description: { fontSize: FontSize.md, lineHeight: 22 },
  // Participants
  participantsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  participantCard: { width: '30%', borderRadius: BorderRadius.md, borderWidth: 2.5, padding: Spacing.sm, alignItems: 'center', gap: 4, ...Shadow.sm },
  participantTop: { position: 'relative' },
  meBadge: { position: 'absolute', bottom: -4, right: -8, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1, borderWidth: 1.5 },
  meBadgeText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold },
  participantName: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textAlign: 'center', fontFamily: DrawFont },
  participantUni: { fontSize: 10, textAlign: 'center' },
  // Filters
  filtersCard: { borderRadius: BorderRadius.md, borderWidth: 2.5, padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  filterIcon: { fontSize: 16 },
  filterLabel: { fontSize: FontSize.sm },
  // Chat
  chatEmpty: { borderRadius: BorderRadius.lg, borderWidth: 2.5, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  chatEmptyEmoji: { fontSize: 32 },
  chatEmptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  chatMessages: { borderRadius: BorderRadius.lg, borderWidth: 2.5, padding: Spacing.md, gap: Spacing.md },
  msgRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgBubble: { maxWidth: '75%', borderRadius: 16, borderWidth: 2, padding: Spacing.sm, gap: 2 },
  msgName: { fontSize: 10, fontWeight: FontWeight.bold },
  msgText: { fontSize: FontSize.sm, lineHeight: 18 },
  msgTime: { fontSize: 9, marginTop: 2 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: BorderRadius.lg, borderWidth: 2.5, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  chatInput: { flex: 1, fontSize: FontSize.base, minHeight: 36 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  sendBtnText: { fontSize: 14 },
  chatLocked: { borderRadius: BorderRadius.lg, borderWidth: 2.5, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  chatLockedEmoji: { fontSize: 20 },
  chatLockedText: { fontSize: FontSize.sm, flex: 1 },
  // Typing indicator
  typingBubble: { borderRadius: 16, borderWidth: 2, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  typingText: { fontSize: FontSize.xs },
  typingDots: { flexDirection: 'row', gap: 3 },
  typingDot: { width: 5, height: 5, borderRadius: 2.5, opacity: 0.6 },
  // Message reactions
  msgReactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: 36, marginTop: -4, marginBottom: 4 },
  msgReactionsRowMe: { flexDirection: 'row', justifyContent: 'flex-end', marginLeft: 0, marginRight: 0 },
  msgReactionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  msgReactionChipText: { fontSize: 12 },
  // Emoji picker
  emojiPicker: { flexDirection: 'row', gap: 4, marginLeft: 36, marginBottom: 4, padding: 6, borderRadius: BorderRadius.lg, borderWidth: 2, alignSelf: 'flex-start' },
  emojiPickerMe: { alignSelf: 'flex-end', marginLeft: 0, marginRight: 0 },
  emojiPickerBtn: { padding: 4 },
  emojiPickerIcon: { fontSize: 22 },
  // Avatars
  avatarCircle: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontWeight: FontWeight.bold },
  avatarImg: {},
  // CTA
  cta: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 2.5 },
  ctaStack: { gap: 6 },
  waitlistHint: { fontSize: FontSize.xs, textAlign: 'center' },
  // QR modal
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  qrCard: { width: '100%', maxWidth: 300, borderWidth: 2.5, borderRadius: BorderRadius.xl, padding: Spacing.xl, alignItems: 'center', gap: Spacing.md },
  qrTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  qrBox: { padding: Spacing.md, borderRadius: BorderRadius.md },
  qrHint: { fontSize: FontSize.sm, textAlign: 'center' },
  // Analytics
  analyticsCard: { borderRadius: BorderRadius.lg, borderWidth: 2.5, padding: Spacing.md, ...Shadow.sm },
  analyticsSectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  analyticsRow: { flexDirection: 'row', alignItems: 'center' },
  analyticsStat: { flex: 1, alignItems: 'center', gap: 2 },
  analyticsValue: { fontSize: 22, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  analyticsLabel: { fontSize: FontSize.xs, textAlign: 'center' },
  analyticsDivider: { width: 1.5, height: 40, marginHorizontal: 8 },
  // Comments
  commentAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  commentAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  commentAvatarInitial: { color: '#fff', fontSize: 12, fontWeight: FontWeight.bold },
  // Share card
  shareCardContainer: { position: 'absolute', top: -9999, left: 0, right: 0 },
  // 360x640 @3x device pixel ratio = 1080x1920, Instagram Story's exact recommended size
  shareCard: { width: 360, height: 640, borderRadius: 24, overflow: 'hidden' },
  shareCardBgImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  shareCardFloatWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 36 },
  shareCardFloat: {
    backgroundColor: '#FFFDF7',
    borderRadius: 18,
    padding: 14,
    gap: 4,
    ...(Shadow.md as any),
  },
  shareCardTime: { fontSize: 24, fontWeight: FontWeight.semibold, color: '#181818', fontFamily: DrawFont },
  shareCardDivider: { height: 1, backgroundColor: '#e8e4d8', marginVertical: 4 },
  shareCardTitleHighlight: {
    alignSelf: 'flex-start',
    fontSize: 16,
    fontWeight: FontWeight.bold,
    fontFamily: DrawFont,
    color: '#5b2a04',
    backgroundColor: '#FCE96A',
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  shareCardFloatMeta: { fontSize: 12, fontWeight: FontWeight.semibold, color: '#666' },
  shareCardApp: {
    position: 'absolute', top: 20, left: 20,
    fontSize: 15, fontWeight: FontWeight.bold, fontFamily: LogoFont, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
});
