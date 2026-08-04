import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { DuotoneScene } from '@/components/ui/DuotoneScene';
import { Tag } from '@/components/ui/Tag';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, getDoc, doc, onSnapshot, orderBy, query, where, Timestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { formatMessageTime } from '@/core/utils/time';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { chatRepository } from '@/features/events/data/repositories/chat.repository';
import { EventEntity, ChatMessage } from '@/features/events/domain/entities/event.entity';
import { groupsRepository } from '@/features/groups/data/repositories/groups.repository.impl';
import { GroupEntity } from '@/features/groups/domain/entities/group.entity';
import { isRight } from '@/core/utils/either';
import { useNotificationsStore } from '@/features/notifications/notifications.store';
import { NotificationEntity } from '@/features/notifications/notification.entity';

const EVENT_CHAT_SEEN_KEY = 'keno:eventChatSeen';
const GROUP_SEEN_KEY = 'keno:groupChatSeen';

interface ConversationPreview {
  conversationId: string;
  otherUid: string;
  otherName: string;
  otherAvatarColor: string;
  otherPhotoUri?: string;
  lastMessage: string;
  lastAt: Date;
  unread: boolean;
}

interface EventThreadPreview {
  eventId: string;
  title: string;
  event: EventEntity;
  lastMessage: string;
  lastSenderName: string;
  lastAt: Date;
  unreadCount: number;
}

interface GroupThreadPreview {
  groupId: string;
  name: string;
  group: GroupEntity;
  lastMessage: string;
  lastSenderName: string;
  lastAt: Date;
  unreadCount: number;
}

export default function MessagesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { language } = useLanguageStore();
  const t = useTranslation();
  const [tab, setTab] = useState(0);

  // ---- Personal DMs (unchanged data source/logic) ----
  const [convos, setConvos] = useState<ConversationPreview[]>([]);
  const profileCache = useRef<Record<string, { name: string; avatarColor: string; photoUri?: string }>>({});

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.id),
      orderBy('lastAt', 'desc'),
    );
    const unsub = onSnapshot(q, async (snap) => {
      // Only fetch profiles we haven't cached yet
      const uncachedUids = snap.docs
        .map((d) => (d.data().participantIds as string[]).find((id) => id !== user.id) ?? '')
        .filter((uid) => uid && !profileCache.current[uid]);

      if (uncachedUids.length > 0) {
        await Promise.all(
          uncachedUids.map(async (uid) => {
            try {
              const snap = await getDoc(doc(db, 'users', uid));
              if (snap.exists()) {
                profileCache.current[uid] = {
                  name: snap.data().name ?? 'User',
                  avatarColor: snap.data().avatarColor ?? '#B8482A',
                  photoUri: snap.data().photoUri,
                };
              }
            } catch {}
          }),
        );
      }

      const list: ConversationPreview[] = snap.docs.map((d) => {
        const data = d.data();
        const otherUid = (data.participantIds as string[]).find((id) => id !== user.id) ?? '';
        const cached = profileCache.current[otherUid];
        return {
          conversationId: d.id,
          otherUid,
          otherName: cached?.name ?? 'User',
          otherAvatarColor: cached?.avatarColor ?? '#B8482A',
          otherPhotoUri: cached?.photoUri,
          lastMessage: data.lastMessage ?? '',
          lastAt: (data.lastAt as Timestamp)?.toDate() ?? new Date(),
          unread: false,
        };
      });
      setConvos(list);
    }, () => {});
    return unsub;
  }, [user?.id]);

  // ---- Event chat threads ("Events") ----
  // Chat lives per-event (events/{id}/messages via chatRepository, opened
  // through its own /(app)/event-chat/[id] screen — no longer inline on the
  // event detail page). We synthesize the thread list from events the user
  // has joined, subscribing to each one's message subcollection for a
  // last-message preview. Unread counts are tracked client-side
  // (AsyncStorage: eventId -> last-seen ISO string), set when the user taps
  // into a thread — there's no server-side read-state for event chat today.
  const [eventThreads, setEventThreads] = useState<EventThreadPreview[]>([]);
  const eventSeenRef = useRef<Record<string, string>>({});
  const eventMsgsRef = useRef<Record<string, { event: EventEntity; msgs: ChatMessage[] }>>({});
  const eventSenderCache = useRef<Record<string, string>>({});

  const rebuildEventThreads = () => {
    const list: EventThreadPreview[] = Object.values(eventMsgsRef.current)
      .filter((entry) => entry.msgs.length > 0)
      .map(({ event, msgs }) => {
        const last = msgs[msgs.length - 1];
        const seenAt = eventSeenRef.current[event.id];
        const seenTime = seenAt ? new Date(seenAt).getTime() : 0;
        const unreadCount = msgs.filter(
          (m) => m.userId !== user?.id && m.timestamp.getTime() > seenTime,
        ).length;
        const lastSenderPrefix = eventSenderCache.current[last.userId]
          ? `${eventSenderCache.current[last.userId]}: `
          : '';
        return {
          eventId: event.id,
          title: event.title,
          event,
          lastMessage: `${lastSenderPrefix}${last.imageUri ? '📷 Photo' : last.text}`,
          lastSenderName: eventSenderCache.current[last.userId] ?? '',
          lastAt: last.timestamp,
          unreadCount,
        };
      })
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
    setEventThreads(list);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(EVENT_CHAT_SEEN_KEY);
        eventSeenRef.current = raw ? JSON.parse(raw) : {};
      } catch {
        eventSeenRef.current = {};
      }

      const result = await eventsRepository.getEventsByAttendee(user.id);
      if (cancelled || !isRight(result)) return;
      // Bound the number of live listeners to the most recently-relevant events.
      const events = [...result.right]
        .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime())
        .slice(0, 25);

      events.forEach((event) => {
        const unsub = chatRepository.subscribeToMessages(event.id, async (msgs) => {
          eventMsgsRef.current[event.id] = { event, msgs };

          const uncachedSenders = [...new Set(msgs.map((m) => m.userId))].filter(
            (uid) => !eventSenderCache.current[uid],
          );
          if (uncachedSenders.length > 0) {
            await Promise.all(
              uncachedSenders.map(async (uid) => {
                try {
                  const snap = await getDoc(doc(db, 'users', uid));
                  if (snap.exists()) eventSenderCache.current[uid] = snap.data().name ?? '';
                } catch {}
              }),
            );
          }
          if (!cancelled) rebuildEventThreads();
        });
        unsubs.push(unsub);
      });
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      eventMsgsRef.current = {};
    };
  }, [user?.id]);

  const openEventThread = async (eventId: string) => {
    eventSeenRef.current[eventId] = new Date().toISOString();
    AsyncStorage.setItem(EVENT_CHAT_SEEN_KEY, JSON.stringify(eventSeenRef.current)).catch(() => {});
    rebuildEventThreads();
    router.push(`/(app)/event-chat/${eventId}` as any);
  };

  // ---- Group chat threads ("Ομάδες") ----
  // Mirrors the event-thread synthesis above but sourced from groups the
  // user is a member of (group/{id}/messages), opened through the group's
  // own chat tab.
  const [groupThreads, setGroupThreads] = useState<GroupThreadPreview[]>([]);
  const groupSeenRef = useRef<Record<string, string>>({});
  const groupMsgsRef = useRef<Record<string, { group: GroupEntity; msgs: ChatMessage[] }>>({});
  const groupSenderCache = useRef<Record<string, string>>({});

  const rebuildGroupThreads = () => {
    const list: GroupThreadPreview[] = Object.values(groupMsgsRef.current)
      .filter((entry) => entry.msgs.length > 0)
      .map(({ group, msgs }) => {
        const last = msgs[msgs.length - 1];
        const seenAt = groupSeenRef.current[group.id];
        const seenTime = seenAt ? new Date(seenAt).getTime() : 0;
        const unreadCount = msgs.filter(
          (m) => m.userId !== user?.id && m.timestamp.getTime() > seenTime,
        ).length;
        const lastSenderPrefix = groupSenderCache.current[last.userId]
          ? `${groupSenderCache.current[last.userId]}: `
          : '';
        return {
          groupId: group.id,
          name: group.name,
          group,
          lastMessage: `${lastSenderPrefix}${last.imageUri ? '📷 Photo' : last.text}`,
          lastSenderName: groupSenderCache.current[last.userId] ?? '',
          lastAt: last.timestamp,
          unreadCount,
        };
      })
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
    setGroupThreads(list);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(GROUP_SEEN_KEY);
        groupSeenRef.current = raw ? JSON.parse(raw) : {};
      } catch {
        groupSeenRef.current = {};
      }

      const result = await groupsRepository.getUserGroups(user.id);
      if (cancelled || !isRight(result)) return;
      const groups = result.right.slice(0, 25);

      groups.forEach((group) => {
        const q = query(collection(db, 'groups', group.id, 'messages'), orderBy('timestamp', 'asc'));
        const unsub = onSnapshot(q, async (snap) => {
          const msgs: ChatMessage[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: data.userId as string,
              text: data.text as string,
              imageUri: data.imageUri as string | undefined,
              timestamp: (data.timestamp as Timestamp)?.toDate() ?? new Date(),
            };
          });
          groupMsgsRef.current[group.id] = { group, msgs };

          const uncachedSenders = [...new Set(msgs.map((m) => m.userId))].filter(
            (uid) => !groupSenderCache.current[uid],
          );
          if (uncachedSenders.length > 0) {
            await Promise.all(
              uncachedSenders.map(async (uid) => {
                try {
                  const senderSnap = await getDoc(doc(db, 'users', uid));
                  if (senderSnap.exists()) groupSenderCache.current[uid] = senderSnap.data().name ?? '';
                } catch {}
              }),
            );
          }
          if (!cancelled) rebuildGroupThreads();
        }, () => {});
        unsubs.push(unsub);
      });
    })();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      groupMsgsRef.current = {};
    };
  }, [user?.id]);

  const openGroupThread = async (groupId: string) => {
    groupSeenRef.current[groupId] = new Date().toISOString();
    AsyncStorage.setItem(GROUP_SEEN_KEY, JSON.stringify(groupSeenRef.current)).catch(() => {});
    rebuildGroupThreads();
    router.push(`/(app)/group/${groupId}` as any);
  };

  // ---- Requests ("Αιτήματα") ----
  // Modeled from existing notifications: event/group join requests are the
  // only "pending action" shape the app already has (private-event and
  // private-group joinRequests maps fire these notif types to the
  // creator/admin). We reuse the already-subscribed notifications store
  // rather than re-querying groups/events join-request maps directly.
  const notifications = useNotificationsStore((s) => s.notifications);
  const requestNotifs = useMemo(
    () => notifications.filter((n) => n.type === 'event_join_request' || n.type === 'group_join_request'),
    [notifications],
  );
  const requestsUnreadCount = useMemo(() => requestNotifs.filter((n) => !n.read).length, [requestNotifs]);

  const handleRequestTap = (notif: NotificationEntity) => {
    if (!notif.eventId) return;
    if (notif.type === 'group_join_request') {
      router.push(`/(app)/group/${notif.eventId}` as any);
    } else {
      router.push(`/(app)/event/${notif.eventId}` as any);
    }
  };

  const tabs = [t.dmTabEvents, t.dmTabGroups, t.dmTabPersonal, t.dmTabRequests(requestsUnreadCount)];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <ScreenHeader title={t.dmTitle} />
      </View>

      <SegmentedTabs tabs={tabs} activeIndex={tab} onChange={setTab} style={styles.tabsRow} />

      {tab === 0 && (
        <FlatList
          data={eventThreads}
          keyExtractor={(g) => g.eventId}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="chat" size={40} color={colors.textDecor} />
              <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.dmEventEmpty}</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          renderItem={({ item }) => (
            <AnimatedPressable
              onPress={() => openEventThread(item.eventId)}
              style={[styles.row, { backgroundColor: colors.surface }]}
            >
              <View style={styles.thumbWrap}>
                {item.event.imageUri ? (
                  <Image source={{ uri: item.event.imageUri }} style={styles.thumb} resizeMode="cover" />
                ) : (
                  <DuotoneScene category={item.event.category} height={42} style={styles.thumb} />
                )}
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.rowTime, { color: colors.textHint }]}>{formatMessageTime(item.lastAt, language)}</Text>
                </View>
                <Text style={[styles.rowPreview, { color: colors.textSecondary }]} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
              {item.unreadCount > 0 && <Tag label={String(item.unreadCount)} />}
            </AnimatedPressable>
          )}
        />
      )}

      {tab === 1 && (
        <FlatList
          data={groupThreads}
          keyExtractor={(g) => g.groupId}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="users" size={40} color={colors.textDecor} />
              <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.dmGroupEmpty}</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          renderItem={({ item }) => (
            <AnimatedPressable
              onPress={() => openGroupThread(item.groupId)}
              style={[styles.row, { backgroundColor: colors.surface }]}
            >
              <View style={[styles.avatarWrap, { backgroundColor: item.group.coverColor }]}>
                {item.group.coverPhotoUri ? (
                  <Image source={{ uri: item.group.coverPhotoUri }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>{item.group.emoji}</Text>
                )}
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.rowTime, { color: colors.textHint }]}>{formatMessageTime(item.lastAt, language)}</Text>
                </View>
                <Text style={[styles.rowPreview, { color: colors.textSecondary }]} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
              {item.unreadCount > 0 && <Tag label={String(item.unreadCount)} />}
            </AnimatedPressable>
          )}
        />
      )}

      {tab === 2 && (
        <FlatList
          data={convos}
          keyExtractor={(c) => c.conversationId}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="chat" size={40} color={colors.textDecor} />
              <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.dmEmpty}</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          renderItem={({ item }) => (
            <AnimatedPressable
              onPress={() => router.push(`/(app)/dm/${item.otherUid}` as any)}
              style={[styles.row, { backgroundColor: colors.surface }]}
            >
              <View style={[styles.avatarWrap, { backgroundColor: item.otherAvatarColor }]}>
                {item.otherPhotoUri ? (
                  <Image source={{ uri: item.otherPhotoUri }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarInitial}>{item.otherName[0].toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>{item.otherName}</Text>
                  <Text style={[styles.rowTime, { color: colors.textHint }]}>{formatMessageTime(item.lastAt, language)}</Text>
                </View>
                <Text style={[styles.rowPreview, { color: colors.textSecondary }]} numberOfLines={1}>{item.lastMessage}</Text>
              </View>
              {item.unread && <Tag label="1" />}
            </AnimatedPressable>
          )}
        />
      )}

      {tab === 3 && (
        <FlatList
          data={requestNotifs}
          keyExtractor={(n) => n.id}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="lock" size={40} color={colors.textDecor} />
              <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.dmRequestsEmpty}</Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border }]} />}
          renderItem={({ item }) => (
            <AnimatedPressable
              onPress={() => handleRequestTap(item)}
              style={[styles.row, { backgroundColor: colors.surface }]}
            >
              <View style={[styles.avatarWrap, { backgroundColor: item.fromAvatarColor ?? '#B8482A' }]}>
                <Text style={styles.avatarInitial}>{item.fromName[0]?.toUpperCase() ?? '?'}</Text>
              </View>
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.type === 'group_join_request'
                      ? t.notifGroupJoinRequest(item.fromName, item.eventTitle ?? '')
                      : t.notifEventJoinRequest(item.fromName, item.eventTitle ?? '')}
                  </Text>
                </View>
                <Text style={[styles.rowPreview, { color: colors.textSecondary }]} numberOfLines={1}>
                  {formatMessageTime(item.createdAt, language)}
                </Text>
              </View>
              {!item.read && <Tag label="•" />}
            </AnimatedPressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
  },
  tabsRow: { paddingHorizontal: Spacing.lg, marginTop: 4 },
  list: { paddingTop: 8 },
  separator: { height: 1, marginHorizontal: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 14, gap: Spacing.md },
  avatarWrap: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 50, height: 50, borderRadius: 25 },
  avatarInitial: { color: '#fff', fontSize: 20, fontWeight: FontWeight.bold, fontFamily: UIFont },
  thumbWrap: { width: 50, height: 50, borderRadius: 12, overflow: 'hidden' },
  thumb: { width: 50, height: 42 },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont, flex: 1 },
  rowTime: { fontSize: FontSize.xs, fontFamily: UIFontLight },
  rowPreview: { fontSize: FontSize.sm, fontFamily: UIFontLight, lineHeight: 18 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { fontSize: FontSize.md, fontFamily: UIFontLight, textAlign: 'center' },
});
