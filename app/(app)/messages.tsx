import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { DuotoneScene } from '@/components/ui/DuotoneScene';
import { Tag } from '@/components/ui/Tag';
import { Alert, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { arrayUnion, collection, getDoc, doc, onSnapshot, orderBy, query, updateDoc, where, Timestamp } from 'firebase/firestore';
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
const EVENT_CHAT_HIDDEN_KEY = 'keno:eventChatHidden';
const GROUP_CHAT_HIDDEN_KEY = 'keno:groupChatHidden';

interface ConversationPreview {
  conversationId: string;
  otherUid: string;
  otherName: string;
  otherAvatarColor: string;
  otherPhotoUri?: string;
  lastMessage: string;
  lastAt: Date;
  unreadCount: number;
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

  // ---- Personal DMs ----
  // Unread count per conversation now mirrors the event/group thread
  // pattern below: one live listener on the thread's own messages
  // subcollection per conversation, counted against a Firestore-backed
  // per-user "last read" timestamp (conversations/{id}.lastReadAt, stamped
  // by the DM screen itself on open/receipt) rather than a local-only
  // AsyncStorage flag — that's also what lets the other participant see a
  // real "Seen" receipt in the thread itself.
  const [convos, setConvos] = useState<ConversationPreview[]>([]);
  const profileCache = useRef<Record<string, { name: string; avatarColor: string; photoUri?: string }>>({});
  const dmMetaRef = useRef<Record<string, { otherUid: string; lastMessage: string; lastAt: Date; myLastReadAt: number }>>({});
  const dmMsgsRef = useRef<Record<string, { senderId: string; createdAtMs: number }[]>>({});
  const dmUnreadRef = useRef<Record<string, number>>({});
  const dmMsgUnsubsRef = useRef<Record<string, () => void>>({});

  const recomputeDmUnread = (convoId: string) => {
    if (!user) return;
    const meta = dmMetaRef.current[convoId];
    if (!meta) return;
    const msgs = dmMsgsRef.current[convoId] ?? [];
    dmUnreadRef.current[convoId] = msgs.filter(
      (m) => m.senderId !== user.id && m.createdAtMs > meta.myLastReadAt,
    ).length;
  };

  const rebuildDmThreads = () => {
    const list: ConversationPreview[] = Object.entries(dmMetaRef.current)
      .map(([conversationId, meta]) => {
        const cached = profileCache.current[meta.otherUid];
        return {
          conversationId,
          otherUid: meta.otherUid,
          otherName: cached?.name ?? 'User',
          otherAvatarColor: cached?.avatarColor ?? '#B8482A',
          otherPhotoUri: cached?.photoUri,
          lastMessage: meta.lastMessage,
          lastAt: meta.lastAt,
          unreadCount: dmUnreadRef.current[conversationId] ?? 0,
        };
      })
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
    setConvos(list);
  };

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.id),
      orderBy('lastAt', 'desc'),
    );
    const unsub = onSnapshot(q, async (snap) => {
      // "Deleting" a conversation (see handleDeleteDm below) just adds my
      // uid to hiddenFor rather than actually removing the doc — messages
      // can't be hard-deleted by rule (allow delete: if false, deliberately,
      // for moderation trails), and a new message from the other side
      // resets hiddenFor so the thread reappears, Instagram-style. Filter
      // those out before the listener-count cap so hidden threads don't
      // waste one of the 25 live slots.
      const visibleDocs = snap.docs.filter((d) => !((d.data().hiddenFor as string[] | undefined) ?? []).includes(user.id));
      const docs = visibleDocs.slice(0, 25);

      const uncachedUids = docs
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

      const nextIds = new Set<string>();
      docs.forEach((d) => {
        const data = d.data();
        const otherUid = (data.participantIds as string[]).find((id) => id !== user.id) ?? '';
        const lastReadAt = data.lastReadAt as Record<string, Timestamp> | undefined;
        dmMetaRef.current[d.id] = {
          otherUid,
          lastMessage: data.lastMessage ?? '',
          lastAt: (data.lastAt as Timestamp)?.toDate() ?? new Date(),
          myLastReadAt: lastReadAt?.[user.id]?.toMillis() ?? 0,
        };
        nextIds.add(d.id);
        recomputeDmUnread(d.id);

        if (!dmMsgUnsubsRef.current[d.id]) {
          const mq = query(collection(db, 'conversations', d.id, 'messages'), orderBy('createdAt', 'asc'));
          dmMsgUnsubsRef.current[d.id] = onSnapshot(mq, (msnap) => {
            dmMsgsRef.current[d.id] = msnap.docs.map((md) => {
              const mdata = md.data();
              return {
                senderId: mdata.senderId as string,
                createdAtMs: (mdata.createdAt as Timestamp)?.toMillis() ?? 0,
              };
            });
            recomputeDmUnread(d.id);
            rebuildDmThreads();
          }, () => {});
        }
      });

      // Drop listeners for conversations that fell out of the active window
      Object.keys(dmMsgUnsubsRef.current).forEach((id) => {
        if (!nextIds.has(id)) {
          dmMsgUnsubsRef.current[id]();
          delete dmMsgUnsubsRef.current[id];
          delete dmMsgsRef.current[id];
          delete dmUnreadRef.current[id];
          delete dmMetaRef.current[id];
        }
      });

      rebuildDmThreads();
    }, () => {});
    return () => {
      unsub();
      Object.values(dmMsgUnsubsRef.current).forEach((u) => u());
      dmMsgUnsubsRef.current = {};
    };
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
  // Deleting an event/group thread (see handleDeleteEventThread below)
  // can't mean "leave the event" — it's just hiding a stale chat from this
  // inbox, same idea as hiding a DM. There's no server-side per-thread doc
  // to flag here, so it's tracked locally (AsyncStorage: eventId -> ISO
  // timestamp of when it was hidden) and a message newer than that
  // timestamp brings the thread back, mirroring the DM "reappears on new
  // message" behavior.
  const eventHiddenRef = useRef<Record<string, string>>({});
  const eventMsgsRef = useRef<Record<string, { event: EventEntity; msgs: ChatMessage[] }>>({});
  const eventSenderCache = useRef<Record<string, string>>({});

  const rebuildEventThreads = () => {
    const list: EventThreadPreview[] = Object.values(eventMsgsRef.current)
      .filter((entry) => entry.msgs.length > 0)
      .filter((entry) => {
        const hiddenAt = eventHiddenRef.current[entry.event.id];
        if (!hiddenAt) return true;
        return entry.msgs[entry.msgs.length - 1].timestamp.getTime() > new Date(hiddenAt).getTime();
      })
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
    const unsubs: (() => void)[] = [];

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(EVENT_CHAT_SEEN_KEY);
        eventSeenRef.current = raw ? JSON.parse(raw) : {};
      } catch {
        eventSeenRef.current = {};
      }
      try {
        const raw = await AsyncStorage.getItem(EVENT_CHAT_HIDDEN_KEY);
        eventHiddenRef.current = raw ? JSON.parse(raw) : {};
      } catch {
        eventHiddenRef.current = {};
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

  const hideEventThread = (eventId: string) => {
    eventHiddenRef.current[eventId] = new Date().toISOString();
  };
  const persistEventHidden = () => {
    AsyncStorage.setItem(EVENT_CHAT_HIDDEN_KEY, JSON.stringify(eventHiddenRef.current)).catch(() => {});
    rebuildEventThreads();
  };
  const handleDeleteEventThread = (eventId: string) => {
    hideEventThread(eventId);
    persistEventHidden();
  };

  // ---- Group chat threads ("Ομάδες") ----
  // Mirrors the event-thread synthesis above but sourced from groups the
  // user is a member of (group/{id}/messages), opened through the group's
  // own chat tab.
  const [groupThreads, setGroupThreads] = useState<GroupThreadPreview[]>([]);
  const groupSeenRef = useRef<Record<string, string>>({});
  const groupHiddenRef = useRef<Record<string, string>>({});
  const groupMsgsRef = useRef<Record<string, { group: GroupEntity; msgs: ChatMessage[] }>>({});
  const groupSenderCache = useRef<Record<string, string>>({});

  const rebuildGroupThreads = () => {
    const list: GroupThreadPreview[] = Object.values(groupMsgsRef.current)
      .filter((entry) => entry.msgs.length > 0)
      .filter((entry) => {
        const hiddenAt = groupHiddenRef.current[entry.group.id];
        if (!hiddenAt) return true;
        return entry.msgs[entry.msgs.length - 1].timestamp.getTime() > new Date(hiddenAt).getTime();
      })
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
    const unsubs: (() => void)[] = [];

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(GROUP_SEEN_KEY);
        groupSeenRef.current = raw ? JSON.parse(raw) : {};
      } catch {
        groupSeenRef.current = {};
      }
      try {
        const raw = await AsyncStorage.getItem(GROUP_CHAT_HIDDEN_KEY);
        groupHiddenRef.current = raw ? JSON.parse(raw) : {};
      } catch {
        groupHiddenRef.current = {};
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

  const handleDeleteGroupThread = (groupId: string) => {
    groupHiddenRef.current[groupId] = new Date().toISOString();
    AsyncStorage.setItem(GROUP_CHAT_HIDDEN_KEY, JSON.stringify(groupHiddenRef.current)).catch(() => {});
    rebuildGroupThreads();
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

  // ---- Thread delete (swipe / long-press / select-all), all three tabs ----
  // Mirrors notifications.tsx's delete UX exactly on every tab.
  const [eventSelectionMode, setEventSelectionMode] = useState(false);
  const [eventSelectedIds, setEventSelectedIds] = useState<Set<string>>(new Set());
  const [groupSelectionMode, setGroupSelectionMode] = useState(false);
  const [groupSelectedIds, setGroupSelectedIds] = useState<Set<string>>(new Set());
  // A conversation can't be hard-deleted (see the hiddenFor comment above),
  // so this just hides it from my own list.
  const [dmSelectionMode, setDmSelectionMode] = useState(false);
  const [dmSelectedIds, setDmSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (tab !== 0) { setEventSelectionMode(false); setEventSelectedIds(new Set()); }
    if (tab !== 1) { setGroupSelectionMode(false); setGroupSelectedIds(new Set()); }
    if (tab !== 2) { setDmSelectionMode(false); setDmSelectedIds(new Set()); }
  }, [tab]);

  const handleLongPressDeleteEvent = (eventId: string) => {
    if (eventSelectionMode) return;
    Alert.alert(t.dmDeleteConfirmTitle, t.dmDeleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.notifDeleteBtn, style: 'destructive', onPress: () => handleDeleteEventThread(eventId) },
    ]);
  };

  const allEventIds = useMemo(() => eventThreads.map((e) => e.eventId), [eventThreads]);
  const allEventSelected = eventSelectedIds.size > 0 && eventSelectedIds.size === allEventIds.length;
  const toggleSelectAllEvent = () => setEventSelectedIds(allEventSelected ? new Set() : new Set(allEventIds));

  const handleDeleteSelectedEvent = () => {
    if (eventSelectedIds.size === 0) return;
    const ids = Array.from(eventSelectedIds);
    Alert.alert(t.dmDeleteSelectedConfirmTitle(ids.length), t.dmDeleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.notifDeleteBtn,
        style: 'destructive',
        onPress: () => {
          ids.forEach(hideEventThread);
          persistEventHidden();
          setEventSelectionMode(false);
          setEventSelectedIds(new Set());
        },
      },
    ]);
  };

  const handleEventRowTap = (item: EventThreadPreview) => {
    if (eventSelectionMode) {
      setEventSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.eventId)) next.delete(item.eventId); else next.add(item.eventId);
        return next;
      });
      return;
    }
    openEventThread(item.eventId);
  };

  const handleLongPressDeleteGroup = (groupId: string) => {
    if (groupSelectionMode) return;
    Alert.alert(t.dmDeleteConfirmTitle, t.dmDeleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.notifDeleteBtn, style: 'destructive', onPress: () => handleDeleteGroupThread(groupId) },
    ]);
  };

  const allGroupIds = useMemo(() => groupThreads.map((g) => g.groupId), [groupThreads]);
  const allGroupSelected = groupSelectedIds.size > 0 && groupSelectedIds.size === allGroupIds.length;
  const toggleSelectAllGroup = () => setGroupSelectedIds(allGroupSelected ? new Set() : new Set(allGroupIds));

  const handleDeleteSelectedGroup = () => {
    if (groupSelectedIds.size === 0) return;
    const ids = Array.from(groupSelectedIds);
    Alert.alert(t.dmDeleteSelectedConfirmTitle(ids.length), t.dmDeleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.notifDeleteBtn,
        style: 'destructive',
        onPress: () => {
          ids.forEach((id) => { groupHiddenRef.current[id] = new Date().toISOString(); });
          AsyncStorage.setItem(GROUP_CHAT_HIDDEN_KEY, JSON.stringify(groupHiddenRef.current)).catch(() => {});
          rebuildGroupThreads();
          setGroupSelectionMode(false);
          setGroupSelectedIds(new Set());
        },
      },
    ]);
  };

  const handleGroupRowTap = (item: GroupThreadPreview) => {
    if (groupSelectionMode) {
      setGroupSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.groupId)) next.delete(item.groupId); else next.add(item.groupId);
        return next;
      });
      return;
    }
    openGroupThread(item.groupId);
  };

  const handleDeleteDm = async (convoId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'conversations', convoId), { hiddenFor: arrayUnion(user.id) });
    } catch {}
  };

  const handleLongPressDeleteDm = (convoId: string) => {
    if (dmSelectionMode) return;
    Alert.alert(t.dmDeleteConfirmTitle, t.dmDeleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.notifDeleteBtn, style: 'destructive', onPress: () => handleDeleteDm(convoId) },
    ]);
  };

  const allDmIds = useMemo(() => convos.map((c) => c.conversationId), [convos]);
  const allDmSelected = dmSelectedIds.size > 0 && dmSelectedIds.size === allDmIds.length;
  const toggleSelectAllDm = () => setDmSelectedIds(allDmSelected ? new Set() : new Set(allDmIds));

  const handleDeleteSelectedDm = () => {
    if (!user || dmSelectedIds.size === 0) return;
    const ids = Array.from(dmSelectedIds);
    Alert.alert(t.dmDeleteSelectedConfirmTitle(ids.length), t.dmDeleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.notifDeleteBtn,
        style: 'destructive',
        onPress: async () => {
          await Promise.all(ids.map((id) => handleDeleteDm(id)));
          setDmSelectionMode(false);
          setDmSelectedIds(new Set());
        },
      },
    ]);
  };

  const handleDmRowTap = (item: ConversationPreview) => {
    if (dmSelectionMode) {
      setDmSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.conversationId)) next.delete(item.conversationId); else next.add(item.conversationId);
        return next;
      });
      return;
    }
    router.push(`/(app)/dm/${item.otherUid}` as any);
  };

  const activeSelectionMode = tab === 0 ? eventSelectionMode : tab === 1 ? groupSelectionMode : tab === 2 ? dmSelectionMode : false;
  const activeHasItems = tab === 0 ? eventThreads.length > 0 : tab === 1 ? groupThreads.length > 0 : tab === 2 ? convos.length > 0 : false;
  const toggleActiveSelectionMode = () => {
    if (tab === 0) { setEventSelectionMode((v) => !v); setEventSelectedIds(new Set()); }
    else if (tab === 1) { setGroupSelectionMode((v) => !v); setGroupSelectedIds(new Set()); }
    else if (tab === 2) { setDmSelectionMode((v) => !v); setDmSelectedIds(new Set()); }
  };

  const headerRight = tab < 3 && activeHasItems ? (
    <AnimatedPressable
      onPress={toggleActiveSelectionMode}
      hitSlop={10}
      style={styles.headerActionBtn}
    >
      <Text style={[styles.headerActionText, { color: colors.primary }]}>
        {activeSelectionMode ? t.cancel : t.notifSelectBtn}
      </Text>
    </AnimatedPressable>
  ) : undefined;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <ScreenHeader title={t.dmTitle} right={headerRight} />
      </View>

      <SegmentedTabs tabs={tabs} activeIndex={tab} onChange={setTab} small style={styles.tabsRow} />

      {tab === 0 && eventSelectionMode && (
        <View style={styles.selectionBar}>
          <AnimatedPressable onPress={toggleSelectAllEvent} style={styles.toggleLink}>
            <Text style={[styles.toggleLinkText, { color: colors.primary }]}>
              {allEventSelected ? t.notifDeselectAllBtn : t.notifSelectAllBtn}
            </Text>
          </AnimatedPressable>
          <Text style={[styles.selectionCount, { color: colors.textHint }]}>{t.notifSelectedCount(eventSelectedIds.size)}</Text>
          <AnimatedPressable
            onPress={handleDeleteSelectedEvent}
            disabled={eventSelectedIds.size === 0}
            hitSlop={10}
            style={[styles.deleteSelectedBtn, { opacity: eventSelectedIds.size === 0 ? 0.4 : 1 }]}
          >
            <Icon name="trash" size={22} color={colors.error} />
          </AnimatedPressable>
        </View>
      )}

      {tab === 1 && groupSelectionMode && (
        <View style={styles.selectionBar}>
          <AnimatedPressable onPress={toggleSelectAllGroup} style={styles.toggleLink}>
            <Text style={[styles.toggleLinkText, { color: colors.primary }]}>
              {allGroupSelected ? t.notifDeselectAllBtn : t.notifSelectAllBtn}
            </Text>
          </AnimatedPressable>
          <Text style={[styles.selectionCount, { color: colors.textHint }]}>{t.notifSelectedCount(groupSelectedIds.size)}</Text>
          <AnimatedPressable
            onPress={handleDeleteSelectedGroup}
            disabled={groupSelectedIds.size === 0}
            hitSlop={10}
            style={[styles.deleteSelectedBtn, { opacity: groupSelectedIds.size === 0 ? 0.4 : 1 }]}
          >
            <Icon name="trash" size={22} color={colors.error} />
          </AnimatedPressable>
        </View>
      )}

      {tab === 2 && dmSelectionMode && (
        <View style={styles.selectionBar}>
          <AnimatedPressable onPress={toggleSelectAllDm} style={styles.toggleLink}>
            <Text style={[styles.toggleLinkText, { color: colors.primary }]}>
              {allDmSelected ? t.notifDeselectAllBtn : t.notifSelectAllBtn}
            </Text>
          </AnimatedPressable>
          <Text style={[styles.selectionCount, { color: colors.textHint }]}>{t.notifSelectedCount(dmSelectedIds.size)}</Text>
          <AnimatedPressable
            onPress={handleDeleteSelectedDm}
            disabled={dmSelectedIds.size === 0}
            hitSlop={10}
            style={[styles.deleteSelectedBtn, { opacity: dmSelectedIds.size === 0 ? 0.4 : 1 }]}
          >
            <Icon name="trash" size={22} color={colors.error} />
          </AnimatedPressable>
        </View>
      )}

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
          renderItem={({ item }) => {
            const selected = eventSelectedIds.has(item.eventId);
            const row = (
              <AnimatedPressable
                onPress={() => handleEventRowTap(item)}
                onLongPress={() => handleLongPressDeleteEvent(item.eventId)}
                style={[styles.row, { backgroundColor: colors.surface }]}
              >
                {eventSelectionMode && (
                  <View style={[
                    styles.checkCircle,
                    { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' },
                  ]}>
                    {selected && <Icon name="check" size={12} color="#fff" />}
                  </View>
                )}
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
            );
            if (eventSelectionMode) return row;
            return (
              <Swipeable
                renderRightActions={() => (
                  <AnimatedPressable
                    onPress={() => handleDeleteEventThread(item.eventId)}
                    style={[styles.deleteAction, { backgroundColor: colors.error }]}
                  >
                    <Icon name="trash" size={19} color="#fff" />
                  </AnimatedPressable>
                )}
                overshootRight={false}
              >
                {row}
              </Swipeable>
            );
          }}
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
          renderItem={({ item }) => {
            const selected = groupSelectedIds.has(item.groupId);
            const row = (
              <AnimatedPressable
                onPress={() => handleGroupRowTap(item)}
                onLongPress={() => handleLongPressDeleteGroup(item.groupId)}
                style={[styles.row, { backgroundColor: colors.surface }]}
              >
                {groupSelectionMode && (
                  <View style={[
                    styles.checkCircle,
                    { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' },
                  ]}>
                    {selected && <Icon name="check" size={12} color="#fff" />}
                  </View>
                )}
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
            );
            if (groupSelectionMode) return row;
            return (
              <Swipeable
                renderRightActions={() => (
                  <AnimatedPressable
                    onPress={() => handleDeleteGroupThread(item.groupId)}
                    style={[styles.deleteAction, { backgroundColor: colors.error }]}
                  >
                    <Icon name="trash" size={19} color="#fff" />
                  </AnimatedPressable>
                )}
                overshootRight={false}
              >
                {row}
              </Swipeable>
            );
          }}
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
          renderItem={({ item }) => {
            const selected = dmSelectedIds.has(item.conversationId);
            const row = (
              <AnimatedPressable
                onPress={() => handleDmRowTap(item)}
                onLongPress={() => handleLongPressDeleteDm(item.conversationId)}
                style={[styles.row, { backgroundColor: colors.surface }]}
              >
                {dmSelectionMode && (
                  <View style={[
                    styles.checkCircle,
                    { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' },
                  ]}>
                    {selected && <Icon name="check" size={12} color="#fff" />}
                  </View>
                )}
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
                {item.unreadCount > 0 && <Tag label={String(item.unreadCount)} />}
              </AnimatedPressable>
            );
            if (dmSelectionMode) return row;
            return (
              <Swipeable
                renderRightActions={() => (
                  <AnimatedPressable
                    onPress={() => handleDeleteDm(item.conversationId)}
                    style={[styles.deleteAction, { backgroundColor: colors.error }]}
                  >
                    <Icon name="trash" size={19} color="#fff" />
                  </AnimatedPressable>
                )}
                overshootRight={false}
              >
                {row}
              </Swipeable>
            );
          }}
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
  headerActionBtn: { minWidth: 32, minHeight: 32, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 4 },
  headerActionText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  selectionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  toggleLink: { paddingVertical: 4 },
  toggleLinkText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  selectionCount: { fontSize: FontSize.xs },
  deleteSelectedBtn: { padding: 6 },
  checkCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  deleteAction: {
    width: 64, alignItems: 'center', justifyContent: 'center',
  },
});
