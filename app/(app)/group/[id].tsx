import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { uploadGroupChatImage } from '@/core/utils/uploadImage';
import { pickImage } from '@/core/utils/imagePicker';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';
import { useKeyboardOffset } from '@/core/hooks/useKeyboardOffset';
import { AnimatedPressable as ListItemPressable } from '@/components/ui/AnimatedPressable';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteField, doc, getDocs, limit, onSnapshot, orderBy, query, Timestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { UIFont, TitleFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { useGroupsStore } from '@/features/groups/presentation/store/groups.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { groupsRepository } from '@/features/groups/data/repositories/groups.repository.impl';
import { GroupEntity } from '@/features/groups/domain/entities/group.entity';
import { EventCard } from '@/components/ui/EventCard';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { formatMessageTime } from '@/core/utils/time';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { universityLabel } from '@/core/constants/universities';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { isLeft } from '@/core/utils/either';
import { notificationsRepository } from '@/features/notifications/notifications.repository';
import { isEventPast } from '@/features/events/domain/entities/event.entity';
import { queryUsersByNamePrefix } from '@/core/utils/userSearch';
import { haptics } from '@/core/utils/haptics';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { useIsAdmin } from '@/core/utils/adminRole';

interface UserResult { uid: string; name: string; universityName: string; avatarColor: string; }

async function searchUsers(q: string): Promise<UserResult[]> {
  const docs = await queryUsersByNamePrefix(q);
  return docs.map((d) => ({ uid: d.id, name: d.data().name ?? '', universityName: d.data().universityName ?? '', avatarColor: d.data().avatarColor ?? '#B8482A' }));
}

interface GroupMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  imageUri?: string;
  timestamp: Date;
  reactions?: Record<string, string[]>;
  editedAt?: Date;
  isDeleted?: boolean;
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOffset = useKeyboardOffset();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useIsAdmin();
  const events = useEventsStore((s) => s.events);
  const joinGroup = useGroupsStore((s) => s.joinGroup);
  const leaveGroup = useGroupsStore((s) => s.leaveGroup);
  const backAnim = usePressAnimation(0.9);
  const editAnim = usePressAnimation(0.9);
  const eventsTabAnim = usePressAnimation(0.95);
  const chatTabAnim = usePressAnimation(0.95);
  const inviteToGroup = useGroupsStore((s) => s.inviteToGroup);
  const t = useTranslation();

  const { language } = useLanguageStore();
  const [group, setGroup] = useState<GroupEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'chat'>('events');
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [msgReactionPicker, setMsgReactionPicker] = useState<string | null>(null);
  const [selectedMsgForActions, setSelectedMsgForActions] = useState<GroupMessage | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgText, setEditingMsgText] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [chatSelectedImage, setChatSelectedImage] = useState<string | null>(null);
  const [uploadingChatImage, setUploadingChatImage] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<UserResult[]>([]);
  const [invitedUids, setInvitedUids] = useState<Set<string>>(new Set());
  const [inviteSearching, setInviteSearching] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, UserProfile>>({});

  // Blocked users' messages disappear from the chat instantly.
  const visibleMessages = useMemo(
    () => messages.filter((m) => !user?.blockedUserIds?.includes(m.userId)),
    [messages, user?.blockedUserIds],
  );
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [requestingJoin, setRequestingJoin] = useState(false);

  useEffect(() => {
    if (activeTab === 'chat') {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [activeTab]);
  const [requesterProfiles, setRequesterProfiles] = useState<Record<string, UserProfile>>({});
  const scrollRef = useRef<ScrollView>(null);
  const requestToJoinGroup = useGroupsStore((s) => s.requestToJoinGroup);
  const decideGroupJoinRequest = useGroupsStore((s) => s.decideGroupJoinRequest);

  useEffect(() => {
    if (!id) return;
    groupsRepository.getGroup(id).then((res) => {
      if (res._tag === 'Right') setGroup(res.right);
      setLoading(false);
    });
    const unsub = groupsRepository.subscribeToGroup(id, setGroup);
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!group || group.memberIds.length === 0) return;
    fetchUserProfiles(group.memberIds).then(setMemberProfiles);
  }, [group?.memberIds.join(',')]);

  useEffect(() => {
    const uids = Object.keys(group?.joinRequests ?? {});
    if (uids.length === 0) return;
    fetchUserProfiles(uids).then(setRequesterProfiles);
  }, [Object.keys(group?.joinRequests ?? {}).join(',')]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'groups', id, 'messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: GroupMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId as string,
          userName: data.userName as string,
          text: data.text as string,
          imageUri: data.imageUri as string | undefined,
          timestamp: (data.timestamp as Timestamp)?.toDate() ?? new Date(),
          reactions: data.reactions ?? {},
          editedAt: data.editedAt ? (data.editedAt as Timestamp).toDate() : undefined,
          isDeleted: data.isDeleted as boolean | undefined,
        };
      });
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
    }, () => {});
    return unsub;
  }, [id]);

  const handleSendMessage = useCallback(async () => {
    if (!id || !user || !chatDraft.trim()) return;
    if (containsBlockedContent(chatDraft)) {
      Alert.alert(t.groupChatTitle, t.validContentBlocked);
      return;
    }
    setSendingMsg(true);
    const text = chatDraft.trim();
    setChatDraft('');
    try {
      await addDoc(collection(db, 'groups', id, 'messages'), {
        userId: user.id,
        userName: user.name,
        text,
        timestamp: Timestamp.now(),
        reactions: {},
      });
      if (group && group.creatorId !== user.id) {
        notificationsRepository.create({
          toUid: group.creatorId,
          fromUid: user.id,
          fromName: user.name,
          fromAvatarColor: user.avatarColor,
          fromPhotoUri: user.photoUri,
          type: 'group_message',
          eventId: id,
          eventTitle: group.name,
        }).catch(() => {});
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setChatDraft(text);
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
    setSendingMsg(false);
  }, [id, user, chatDraft, group]);

  const handlePickChatImage = async () => {
    const uri = await pickImage({ aspect: [1, 1], quality: 0.7 });
    if (uri) setChatSelectedImage(uri);
  };

  const handleSendChatImage = useCallback(async () => {
    if (!id || !user || !chatSelectedImage) return;
    setUploadingChatImage(true);
    try {
      const imageUrl = await uploadGroupChatImage(chatSelectedImage);
      await addDoc(collection(db, 'groups', id, 'messages'), {
        userId: user.id,
        userName: user.name,
        text: '',
        imageUri: imageUrl,
        timestamp: Timestamp.now(),
        reactions: {},
      });
      if (group && group.creatorId !== user.id) {
        notificationsRepository.create({
          toUid: group.creatorId,
          fromUid: user.id,
          fromName: user.name,
          fromAvatarColor: user.avatarColor,
          fromPhotoUri: user.photoUri,
          type: 'group_message',
          eventId: id,
          eventTitle: group.name,
        }).catch(() => {});
      }
      setChatSelectedImage(null);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
    setUploadingChatImage(false);
  }, [id, user, group, chatSelectedImage]);

  const handleMsgReact = useCallback(async (messageId: string, emoji: string) => {
    if (!id || !user) return;
    haptics.light();
    setMsgReactionPicker(null);
    const msg = messages.find((m) => m.id === messageId);
    const alreadyReacted = msg?.reactions?.[emoji]?.includes(user.id);
    const ref = doc(db, 'groups', id, 'messages', messageId);
    await updateDoc(ref, {
      [`reactions.${emoji}`]: alreadyReacted ? arrayRemove(user.id) : arrayUnion(user.id),
    });
  }, [id, user, messages]);

  const handleEditMsg = useCallback(async () => {
    if (!id || !editingMsgId || !editingMsgText.trim()) return;
    await updateDoc(doc(db, 'groups', id, 'messages', editingMsgId), {
      text: editingMsgText.trim(),
      editedAt: Timestamp.now(),
    });
    setEditingMsgId(null);
    setEditingMsgText('');
  }, [id, editingMsgId, editingMsgText]);

  const handleDeleteMsg = useCallback((messageId: string) => {
    if (!id) return;
    Alert.alert(t.eventDeleteMsgTitle, t.eventDeleteMsgBody, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: t.eventDeleteBtn, style: 'destructive',
        onPress: () => updateDoc(doc(db, 'groups', id, 'messages', messageId), {
          isDeleted: true, text: deleteField(), imageUri: deleteField(),
        }),
      },
    ]);
  }, [id, t]);

  const handleInviteSearch = useCallback(async (text: string) => {
    setInviteSearch(text);
    if (text.trim().length < 2) { setInviteResults([]); return; }
    setInviteSearching(true);
    const results = await searchUsers(text);
    setInviteResults(results.filter((u) => u.uid !== user?.id && !group?.memberIds.includes(u.uid)));
    setInviteSearching(false);
  }, [user?.id, group?.memberIds]);

  const handleInvite = useCallback(async (target: UserResult) => {
    if (!user || !group) return;
    const ok = await inviteToGroup(group.id, target.uid, user.id, user.name, group.name, user.avatarColor, user.photoUri);
    if (ok) setInvitedUids((prev) => new Set([...prev, target.uid]));
  }, [user, group, inviteToGroup]);

  if (loading || !group) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const isMember = user ? group.memberIds.includes(user.id) : false;
  const isCreator = user?.id === group.creatorId;
  const isAdminUser = isAdmin;
  const isInvited = user ? group.invitedUserIds.includes(user.id) : false;
  const canJoin = !group.isPrivate || isInvited;
  const groupEvents = events.filter((e) => group.eventIds.includes(e.id));
  const upcomingEvents = groupEvents.filter((e) => !isEventPast(e));
  const pastEvents = groupEvents.filter((e) => isEventPast(e));

  const handleToggleVerifiedOrganiser = async () => {
    const next = !group.isVerifiedOrganiser;
    const result = await groupsRepository.setVerifiedOrganiser(group.id, next);
    if (!isLeft(result)) {
      setGroup((g) => (g ? { ...g, isVerifiedOrganiser: next } : g));
    }
  };

  const handleJoinLeave = async () => {
    if (!user) return;
    setJoining(true);
    try {
      let ok = true;
      if (isMember && !isCreator) {
        ok = await leaveGroup(group.id, user.id);
      } else if (!isMember) {
        ok = await joinGroup(group.id, user.id);
      }
      if (!ok) Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    } finally {
      setJoining(false);
    }
  };

  const handleKickMember = (uid: string, name: string) => {
    if (!group) return;
    Alert.alert(t.groupKickTitle, t.groupKickBody(name), [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: t.groupKickBtn,
        style: 'destructive',
        // Deliberately calls the repository directly rather than the
        // groups-store leaveGroup action — that action also strips the
        // group out of the *caller's* own myGroups cache, which is only
        // correct when the caller is the one leaving, not when the leader
        // is removing someone else. The live subscribeToGroup listener
        // above refreshes memberIds for everyone regardless.
        onPress: async () => {
          const result = await groupsRepository.leaveGroup(group.id, uid);
          if (isLeft(result)) Alert.alert(t.createAlertSaveError, t.authErrGeneric);
        },
      },
    ]);
  };

  const alreadyRequestedGroup = !!user && Object.prototype.hasOwnProperty.call(group.joinRequests ?? {}, user.id);

  const handleSubmitGroupJoinRequest = async () => {
    if (!user || !requestMessage.trim()) return;
    setRequestingJoin(true);
    const ok = await requestToJoinGroup(group.id, user.id, requestMessage.trim());
    setRequestingJoin(false);
    if (ok) {
      notificationsRepository.create({
        toUid: group.creatorId,
        fromUid: user.id,
        fromName: user.name,
        fromAvatarColor: user.avatarColor,
        fromPhotoUri: user.photoUri,
        type: 'group_join_request',
        eventId: group.id,
        eventTitle: group.name,
      }).catch(() => {});
      setRequestModalVisible(false);
      setRequestMessage('');
    } else {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
  };

  const handleGroupJoinDecision = async (uid: string, accept: boolean) => {
    if (!user) return;
    const ok = await decideGroupJoinRequest(group.id, uid, accept);
    if (!ok) { Alert.alert(t.createAlertSaveError, t.authErrGeneric); return; }
    if (accept) {
      notificationsRepository.create({
        toUid: uid,
        fromUid: user.id,
        fromName: user.name,
        fromAvatarColor: user.avatarColor,
        fromPhotoUri: user.photoUri,
        type: 'group_join_accepted',
        eventId: group.id,
        eventTitle: group.name,
      }).catch(() => {});
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }, Platform.OS === 'android' && { paddingBottom: keyboardOffset }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Fixed header — always visible, never scrolls */}
      <View style={{ paddingTop: insets.top + 12 }}>
        <View style={styles.headerRow}>
          <AnimatedPressable
            onPress={() => router.back()}
            onPressIn={backAnim.onPressIn}
            onPressOut={backAnim.onPressOut}
            style={[styles.headerBtn, { borderColor: colors.border }, backAnim.animatedStyle]}
          >
            <Icon name="back" size={16} color={colors.textPrimary} />
          </AnimatedPressable>
          {isCreator ? (
            <AnimatedPressable
              onPress={() => router.push(`/(app)/group/edit/${group.id}` as any)}
              onPressIn={editAnim.onPressIn}
              onPressOut={editAnim.onPressOut}
              style={[styles.headerBtn, { borderColor: colors.border }, editAnim.animatedStyle]}
            >
              <Text style={styles.headerBtnText}>✏️</Text>
            </AnimatedPressable>
          ) : (
            <View style={[styles.headerBtn, { borderColor: 'transparent' }]} />
          )}
        </View>

        {/* Icon + name (matches profile-page layout) */}
        <View style={styles.iconSection}>
          <View style={[styles.groupIcon, { backgroundColor: group.coverColor, borderColor: colors.border }]}>
            {group.coverPhotoUri ? (
              <Image source={{ uri: group.coverPhotoUri }} style={styles.groupIconPhoto} />
            ) : (
              <Text style={styles.groupIconEmoji}>{group.emoji}</Text>
            )}
          </View>
          <Text style={[styles.groupName, { color: colors.textPrimary }]}>{group.name}</Text>
          {group.universityName && (
            <Text style={[styles.groupUniText, { color: colors.textSecondary }]}>🎓 {universityLabel(group.universityName, language)}</Text>
          )}
          {group.isVerifiedOrganiser && (
            <View style={{ marginTop: 6 }}>
              <VerifiedBadge label={t.verifiedOrganiserBadgeLabel} />
            </View>
          )}
          {isAdminUser && (
            <AnimatedPressable
              onPress={handleToggleVerifiedOrganiser}
              style={[styles.adminVerifyBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.adminVerifyBtnText, { color: colors.textSecondary }]}>
                {group.isVerifiedOrganiser ? t.groupUnmarkVerified : t.groupMarkVerified}
              </Text>
            </AnimatedPressable>
          )}
        </View>

        {/* Tab switcher */}
        {isMember && (
          <View style={[styles.tabRow, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, marginHorizontal: Spacing.lg }]}>
            <AnimatedPressable
              onPress={() => setActiveTab('events')}
              onPressIn={eventsTabAnim.onPressIn}
              onPressOut={eventsTabAnim.onPressOut}
              style={[styles.tabBtn, activeTab === 'events' && { backgroundColor: colors.surface, borderColor: colors.border }, eventsTabAnim.animatedStyle]}
            >
              <Text style={[styles.tabBtnText, { color: activeTab === 'events' ? colors.primary : colors.textSecondary }]}>
                📅 {t.userUpcoming}
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              onPress={() => setActiveTab('chat')}
              onPressIn={chatTabAnim.onPressIn}
              onPressOut={chatTabAnim.onPressOut}
              style={[styles.tabBtn, activeTab === 'chat' && { backgroundColor: colors.surface, borderColor: colors.border }, chatTabAnim.animatedStyle]}
            >
              <Text style={[styles.tabBtnText, { color: activeTab === 'chat' ? colors.primary : colors.textSecondary }]}>
                💬 {t.groupChatTitle} {visibleMessages.length > 0 ? `(${visibleMessages.length})` : ''}
              </Text>
            </AnimatedPressable>
          </View>
        )}
      </View>

      {activeTab === 'chat' && isMember ? (
        /* Chat view — this is the only thing that scrolls; header/tabs stay put */
        <View style={styles.chatSectionFull}>
          <ScrollView
            ref={scrollRef}
            style={styles.chatMessages}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
            nestedScrollEnabled
          >
            {visibleMessages.length === 0 ? (
              <View style={styles.chatEmpty}>
                <Icon name="chat" size={30} color={colors.textDecor} />
                <Text style={[styles.chatEmptyText, { color: colors.textHint }]}>{t.groupChatEmpty}</Text>
              </View>
            ) : (
              visibleMessages.map((msg) => {
                const isMe = msg.userId === user?.id;
                const msgProfile = memberProfiles[msg.userId];
                const msgReactions = Object.entries(msg.reactions ?? {}).filter(([, uids]) => uids.length > 0);
                const showPicker = msgReactionPicker === msg.id;
                if (msg.isDeleted) {
                  return (
                    <View key={msg.id} style={[styles.msgRow, isMe && styles.msgRowMe]}>
                      <Text style={[styles.msgDeletedText, { color: colors.textHint }]}>{t.eventMsgDeleted}</Text>
                    </View>
                  );
                }
                return (
                  <View key={msg.id}>
                    <AnimatedPressable
                      onLongPress={() => setMsgReactionPicker(showPicker ? null : msg.id)}
                      onPress={() => { if (isMe) setSelectedMsgForActions(msg); }}
                      style={[styles.msgRow, isMe && styles.msgRowMe]}
                    >
                      {!isMe && (
                        <Pressable onPress={() => router.push(`/(app)/user/${msg.userId}` as any)}>
                          {msgProfile?.photoUri ? (
                            <Image source={{ uri: msgProfile.photoUri }} style={styles.msgAvatarImg} />
                          ) : (
                            <View style={[styles.msgAvatar, { backgroundColor: msgProfile?.avatarColor ?? colors.surfaceVariant }]}>
                              <Text style={styles.msgAvatarText}>{msg.userName.charAt(0).toUpperCase()}</Text>
                            </View>
                          )}
                        </Pressable>
                      )}
                      <View style={[
                        styles.msgBubble,
                        msg.imageUri
                          ? { padding: 0, backgroundColor: 'transparent', borderColor: colors.border }
                          : { backgroundColor: isMe ? group.coverColor : colors.surfaceVariant, borderColor: colors.border },
                      ]}>
                        {msg.imageUri ? (
                          <View style={styles.msgImageWrap}>
                            <Image source={{ uri: msg.imageUri }} style={styles.msgImage} />
                            <View style={[styles.msgImageFooter, { backgroundColor: isMe ? group.coverColor : colors.surfaceVariant }]}>
                              {!isMe && <Text style={[styles.msgName, { color: colors.textHint }]}>{msg.userName}</Text>}
                              <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.65)' : colors.textHint }]}>
                                {formatMessageTime(msg.timestamp, language)}
                              </Text>
                            </View>
                          </View>
                        ) : (
                          <>
                            {!isMe && <Text style={[styles.msgName, { color: colors.textHint }]}>{msg.userName}</Text>}
                            <Text style={[styles.msgText, { color: isMe ? '#fff' : colors.textPrimary }]}>{msg.text}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              {msg.editedAt && (
                                <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.5)' : colors.textHint }]}>
                                  {t.eventMsgEdited}
                                </Text>
                              )}
                              <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.65)' : colors.textHint }]}>
                                {formatMessageTime(msg.timestamp, language)}
                              </Text>
                            </View>
                          </>
                        )}
                      </View>
                    </AnimatedPressable>
                    {showPicker && (
                      <View style={[styles.emojiPicker, isMe && styles.emojiPickerMe, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {['❤️', '😂', '🔥', '👍', '😮', '😢'].map((e) => (
                          <AnimatedPressable key={e} onPress={() => handleMsgReact(msg.id, e)} style={styles.emojiPickerBtn}>
                            <Text style={styles.emojiPickerIcon}>{e}</Text>
                          </AnimatedPressable>
                        ))}
                      </View>
                    )}
                    {msgReactions.length > 0 && (
                      <View style={[styles.msgReactionsRow, isMe && styles.msgReactionsRowMe]}>
                        {msgReactions.map(([emoji, uids]) => (
                          <AnimatedPressable
                            key={emoji}
                            onPress={() => handleMsgReact(msg.id, emoji)}
                            style={[styles.msgReactionChip, {
                              backgroundColor: uids.includes(user?.id ?? '') ? colors.primary : colors.surfaceVariant,
                              borderColor: colors.border,
                            }]}
                          >
                            <Text style={styles.msgReactionChipText}>{emoji} {uids.length}</Text>
                          </AnimatedPressable>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Selected image preview */}
          {chatSelectedImage && (
            <View style={[styles.chatImagePreview, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
              <Image source={{ uri: chatSelectedImage }} style={styles.chatPreviewImg} />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="camera" size={15} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontWeight: FontWeight.bold, fontFamily: UIFont }}>{t.chatPhotoLabel}</Text>
                {uploadingChatImage && <ActivityIndicator color={colors.primary} />}
              </View>
              <AnimatedPressable
                onPress={() => setChatSelectedImage(null)}
                disabled={uploadingChatImage}
                style={[styles.chatRemoveImgBtn, { borderColor: colors.border }]}
              >
                <Icon name="x" size={14} color={colors.textSecondary} />
              </AnimatedPressable>
            </View>
          )}

          <View style={[styles.chatInputRow, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: insets.bottom + 8 }]}>
            {chatSelectedImage ? (
              <Button
                label={uploadingChatImage ? '...' : `${t.chatSendBtn} ✈️`}
                onPress={handleSendChatImage}
                disabled={uploadingChatImage}
                style={{ backgroundColor: group.coverColor, borderColor: colors.border, flex: 1 }}
              />
            ) : (
              <>
                <AnimatedPressable
                  onPress={handlePickChatImage}
                  style={[styles.chatPhotoBtn, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
                >
                  <Icon name="camera" size={16} color={colors.textSecondary} />
                </AnimatedPressable>
                <TextInput
                  style={[styles.chatInput, { color: colors.textPrimary }]}
                  value={chatDraft}
                  onChangeText={setChatDraft}
                  placeholder={t.groupChatPlaceholder}
                  placeholderTextColor={colors.textHint}
                  returnKeyType="send"
                  onSubmitEditing={handleSendMessage}
                  multiline={false}
                />
                <Button
                  label="✈️"
                  onPress={handleSendMessage}
                  disabled={!chatDraft.trim() || sendingMsg}
                  shape="circle"
                  size="sm"
                  style={{ backgroundColor: chatDraft.trim() ? group.coverColor : colors.surfaceVariant, borderColor: colors.border }}
                  labelStyle={{ fontSize: 16 }}
                />
              </>
            )}
          </View>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
          {/* Stats row */}
          <View style={[styles.statsRow, { borderColor: colors.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{group.memberIds.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.groupStatMembers}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{group.eventIds.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.groupStatEvents}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>
                {group.isPrivate ? '🔒' : '🌐'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {group.isPrivate ? t.groupStatPrivate : t.groupStatPublic}
              </Text>
            </View>
          </View>

          {/* Join/Leave button */}
          {user && !isCreator && (
            isMember || canJoin ? (
              <Button
                label={isMember ? t.groupBtnLeave : t.groupBtnJoin}
                onPress={handleJoinLeave}
                loading={joining}
                shape="pill"
                fullWidth
                style={{ backgroundColor: isMember ? colors.surfaceVariant : group.coverColor, borderColor: colors.border }}
                labelStyle={{ color: isMember ? colors.textPrimary : '#fff' }}
              />
            ) : (
              <View style={{ gap: Spacing.sm }}>
                <View style={[styles.privateMsg, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                  <Text style={[styles.privateMsgText, { color: colors.textSecondary }]}>{t.groupPrivateOnly}</Text>
                </View>
                <Button
                  label={alreadyRequestedGroup ? t.eventRequestSent : t.eventRequestJoin}
                  onPress={() => setRequestModalVisible(true)}
                  disabled={alreadyRequestedGroup}
                  shape="pill"
                  fullWidth
                  style={{ backgroundColor: group.coverColor, borderColor: colors.border }}
                  labelStyle={{ color: '#fff' }}
                />
              </View>
            )
          )}

          {/* Description */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.userAbout}</Text>
            <Text style={[styles.descText, { color: colors.textSecondary }]}>{group.description}</Text>
          </View>

          {/* Members */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              {t.groupMembersTitle} ({group.memberIds.length})
            </Text>
            <View style={styles.membersList}>
              {group.memberIds.map((uid) => {
                const profile = memberProfiles[uid];
                return (
                  <View key={uid} style={[styles.memberRow, { borderColor: colors.border }]}>
                    <AnimatedPressable
                      onPress={() => router.push(`/(app)/user/${uid}`)}
                      style={styles.memberRowMain}
                    >
                      {profile?.photoUri ? (
                        <Image source={{ uri: profile.photoUri }} style={styles.memberAvatarImg} />
                      ) : (
                        <View style={[styles.memberAvatar, { backgroundColor: profile?.avatarColor ?? '#999' }]}>
                          <Text style={styles.memberAvatarText}>{(profile?.name ?? '?').charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={[styles.memberName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {profile?.name ?? '...'}
                      </Text>
                      {uid === group.creatorId && (
                        <Text style={styles.memberOwnerTag}>👑</Text>
                      )}
                    </AnimatedPressable>
                    {isCreator && uid !== group.creatorId && (
                      <AnimatedPressable
                        onPress={() => handleKickMember(uid, profile?.name ?? '...')}
                        style={styles.memberKickBtn}
                        hitSlop={8}
                      >
                        <Icon name="x" size={14} color={colors.error} />
                      </AnimatedPressable>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {/* Pending join requests (creator only) */}
          {isCreator && group.isPrivate && Object.keys(group.joinRequests ?? {}).length > 0 && (
            <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.eventJoinRequestsTitle}</Text>
              {Object.entries(group.joinRequests ?? {}).map(([uid, message]) => {
                const profile = requesterProfiles[uid];
                return (
                  <View key={uid} style={styles.joinRequestRow}>
                    <AnimatedPressable onPress={() => router.push(`/(app)/user/${uid}`)} style={styles.joinRequestUser}>
                      {profile?.photoUri ? (
                        <Image source={{ uri: profile.photoUri }} style={styles.memberAvatarImg} />
                      ) : (
                        <View style={[styles.memberAvatar, { backgroundColor: profile?.avatarColor ?? '#999' }]}>
                          <Text style={styles.memberAvatarText}>{(profile?.name ?? '?').charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.memberName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {profile?.name ?? 'User'}
                        </Text>
                        <Text style={[styles.joinRequestMessage, { color: colors.textSecondary }]} numberOfLines={2}>
                          {message}
                        </Text>
                      </View>
                    </AnimatedPressable>
                    <View style={styles.joinRequestActions}>
                      <AnimatedPressable
                        onPress={() => handleGroupJoinDecision(uid, false)}
                        style={[styles.joinRequestBtn, { borderColor: colors.border }]}
                      >
                        <Text style={[styles.joinRequestBtnText, { color: colors.textSecondary }]}>{t.eventRequestDecline}</Text>
                      </AnimatedPressable>
                      <AnimatedPressable
                        onPress={() => handleGroupJoinDecision(uid, true)}
                        style={[styles.joinRequestBtn, { backgroundColor: group.coverColor, borderColor: group.coverColor }]}
                      >
                        <Text style={[styles.joinRequestBtnText, { color: '#fff' }]}>{t.eventRequestAccept}</Text>
                      </AnimatedPressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Invite section — creator of private group only */}
          {isCreator && group.isPrivate && (
            <View style={[styles.inviteSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.groupInviteTitle}</Text>
              <View style={[styles.inviteInputRow, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                <Icon name="search" size={14} color={colors.textHint} />
                <TextInput
                  style={[styles.inviteInput, { color: colors.textPrimary }]}
                  placeholder={t.groupInviteSearch}
                  placeholderTextColor={colors.textHint}
                  value={inviteSearch}
                  onChangeText={handleInviteSearch}
                />
                {inviteSearching && <ActivityIndicator size="small" color={colors.textHint} />}
              </View>
              {inviteResults.map((u) => {
                const alreadyInvited = invitedUids.has(u.uid) || group.invitedUserIds.includes(u.uid);
                return (
                  <View key={u.uid} style={[styles.inviteRow, { borderColor: colors.border }]}>
                    <View style={[styles.inviteAvatar, { backgroundColor: u.avatarColor }]}>
                      <Text style={styles.inviteAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.inviteInfo}>
                      <Text style={[styles.inviteName, { color: colors.textPrimary }]} numberOfLines={1}>{u.name}</Text>
                      {u.universityName ? <Text style={[styles.inviteUni, { color: colors.textHint }]} numberOfLines={1}>🎓 {universityLabel(u.universityName, language)}</Text> : null}
                    </View>
                    <ListItemPressable
                      onPress={() => handleInvite(u)}
                      disabled={alreadyInvited}
                      scaleTo={0.9}
                      style={[styles.inviteBtn, { backgroundColor: alreadyInvited ? colors.surfaceVariant : group.coverColor, borderColor: colors.border }]}
                    >
                      <Text style={[styles.inviteBtnText, { color: alreadyInvited ? colors.textHint : '#fff' }]}>
                        {alreadyInvited ? t.groupInviteSent : t.groupInviteBtn}
                      </Text>
                    </ListItemPressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Upcoming events */}
          {upcomingEvents.length > 0 && (
            <View style={styles.eventsSection}>
              <Text style={[styles.eventsSectionTitle, { color: colors.textPrimary }]}>
                {t.userUpcoming}
              </Text>
              {upcomingEvents.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  onPress={() => router.push(`/(app)/event/${e.id}`)}
                />
              ))}
            </View>
          )}

          {pastEvents.length > 0 && (
            <View style={styles.eventsSection}>
              <Text style={[styles.eventsSectionTitle, { color: colors.textSecondary }]}>
                {t.groupPastEvents}
              </Text>
              {pastEvents.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  onPress={() => router.push(`/(app)/event/${e.id}`)}
                  faded
                />
              ))}
            </View>
          )}

          {groupEvents.length === 0 && (
            <View style={styles.noEvents}>
              <Icon name="cal" size={30} color={colors.textDecor} />
              <Text style={[styles.noEventsText, { color: colors.textSecondary }]}>
                {t.groupNoEvents}
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={requestModalVisible} transparent animationType="fade" onRequestClose={() => setRequestModalVisible(false)}>
        <View style={styles.requestModalBackdrop}>
          <View style={[styles.requestModalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.requestModalTitle, { color: colors.textPrimary }]}>{t.eventRequestJoin}</Text>
            <Text style={[styles.requestModalHint, { color: colors.textSecondary }]}>{t.eventRequestMessageHint}</Text>
            <TextInput
              style={[styles.requestModalInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={requestMessage}
              onChangeText={setRequestMessage}
              placeholder={t.eventRequestMessagePlaceholder}
              placeholderTextColor={colors.textHint}
              multiline
              numberOfLines={4}
              maxLength={300}
            />
            <View style={styles.requestModalActions}>
              <AnimatedPressable
                onPress={() => setRequestModalVisible(false)}
                disabled={requestingJoin}
                style={[styles.requestModalBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.requestModalBtnText, { color: colors.textSecondary }]}>{t.settingsBtnCancel}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleSubmitGroupJoinRequest}
                disabled={requestingJoin || !requestMessage.trim()}
                style={[styles.requestModalBtn, { backgroundColor: group.coverColor, borderColor: group.coverColor }]}
              >
                {requestingJoin ? <ActivityIndicator color="#fff" /> : (
                  <Text style={[styles.requestModalBtnText, { color: '#fff' }]}>{t.eventRequestSendBtn}</Text>
                )}
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Chat message actions (own messages only): edit / delete */}
      <Modal
        visible={!!selectedMsgForActions}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMsgForActions(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedMsgForActions(null)} />
        <View style={[styles.actionSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {!selectedMsgForActions?.imageUri && (
            <AnimatedPressable
              onPress={() => {
                if (selectedMsgForActions) {
                  setEditingMsgId(selectedMsgForActions.id);
                  setEditingMsgText(selectedMsgForActions.text || '');
                }
                setSelectedMsgForActions(null);
              }}
              style={styles.actionButton}
            >
              <Icon name="edit" size={17} color={colors.textPrimary} />
              <Text style={[styles.actionText, { color: colors.textPrimary }]}>{t.editAction}</Text>
            </AnimatedPressable>
          )}
          <AnimatedPressable
            onPress={() => {
              const msgId = selectedMsgForActions?.id;
              setSelectedMsgForActions(null);
              if (msgId) handleDeleteMsg(msgId);
            }}
            style={styles.actionButton}
          >
            <Icon name="trash" size={17} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>{t.eventDeleteBtn}</Text>
          </AnimatedPressable>
        </View>
      </Modal>

      {/* Edit chat message modal */}
      <Modal
        visible={!!editingMsgId}
        transparent
        animationType="fade"
        onRequestClose={() => { setEditingMsgId(null); setEditingMsgText(''); }}
      >
        <Pressable style={styles.modalOverlay} onPress={() => { setEditingMsgId(null); setEditingMsgText(''); }}>
          <View style={[styles.editModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.editTitle, { color: colors.textPrimary }]}>{t.editAction}</Text>
            <TextInput
              style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={editingMsgText}
              onChangeText={setEditingMsgText}
              placeholder={t.groupChatPlaceholder}
              placeholderTextColor={colors.textHint}
              multiline
              maxLength={500}
            />
            <View style={styles.editButtonRow}>
              <AnimatedPressable
                onPress={() => { setEditingMsgId(null); setEditingMsgText(''); }}
                style={[styles.editBtn, { backgroundColor: colors.surfaceVariant }]}
              >
                <Text style={[styles.editBtnLabel, { color: colors.textPrimary }]}>{t.settingsBtnCancel}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleEditMsg}
                disabled={!editingMsgText.trim()}
                style={[styles.editBtn, { backgroundColor: editingMsgText.trim() ? group.coverColor : colors.surfaceVariant }]}
              >
                <Text style={[styles.editBtnLabel, { color: editingMsgText.trim() ? '#fff' : colors.textHint }]}>{t.eventEditSave}</Text>
              </AnimatedPressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg },
  headerBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerBtnText: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  iconSection: { alignItems: 'center', gap: 4, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  groupIcon: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  groupIconPhoto: { ...StyleSheet.absoluteFillObject },
  groupIconEmoji: { fontSize: 40 },
  groupName: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, fontFamily: TitleFont, marginTop: Spacing.sm, textAlign: 'center' },
  groupUniText: { fontSize: FontSize.sm, fontFamily: UIFont },
  adminVerifyBtn: { marginTop: 8, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: 10, paddingVertical: 6 },
  adminVerifyBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  body: { padding: Spacing.lg, gap: Spacing.md },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.xl, borderWidth: 1,
    overflow: 'hidden',
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  statNum: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  statLabel: { fontSize: FontSize.xs },
  statDivider: { width: 1, height: 40 },
  section: {
    borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.md, gap: 6,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  descText: { fontSize: FontSize.sm, lineHeight: 20 },
  membersList: { gap: 2 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6 },
  memberRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  memberKickBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  memberAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  memberAvatarText: { color: '#fff', fontSize: 13, fontWeight: FontWeight.bold },
  memberName: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flex: 1 },
  memberOwnerTag: { fontSize: 14 },
  joinRequestRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, justifyContent: 'space-between' },
  joinRequestUser: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  joinRequestMessage: { fontSize: FontSize.xs, marginTop: 1 },
  joinRequestActions: { flexDirection: 'row', gap: 6 },
  joinRequestBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1 },
  joinRequestBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  requestModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  requestModalCard: { width: '100%', maxWidth: 380, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: 10},
  requestModalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  requestModalHint: { fontSize: FontSize.sm, lineHeight: 20 },
  requestModalInput: { borderWidth: 1.5, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSize.sm, minHeight: 90, textAlignVertical: 'top' },
  requestModalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  requestModalBtn: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.full, paddingVertical: 10, alignItems: 'center' },
  requestModalBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  eventsSection: { gap: Spacing.sm },
  eventsSectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  noEvents: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  noEventsEmoji: { fontSize: 36 },
  noEventsText: { fontSize: FontSize.sm, textAlign: 'center' },
  tabRow: { flexDirection: 'row', borderRadius: BorderRadius.lg, borderWidth: 1.5, overflow: 'hidden' },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: BorderRadius.lg, borderWidth: 0 },
  tabBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  chatSectionFull: { flex: 1, gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  chatMessages: { flex: 1, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'transparent' },
  chatEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  chatEmptyEmoji: { fontSize: 32 },
  chatEmptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  msgRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  msgAvatarImg: { width: 28, height: 28, borderRadius: 14, flexShrink: 0 },
  msgAvatarText: { fontSize: 13, fontWeight: FontWeight.bold, color: '#fff' },
  msgBubble: { maxWidth: '75%', borderRadius: 16, borderWidth: 1, padding: Spacing.sm, gap: 2 },
  msgName: { fontSize: 10, fontWeight: FontWeight.bold },
  msgText: { fontSize: FontSize.sm, lineHeight: 18 },
  msgTime: { fontSize: 9, marginTop: 2 },
  msgDeletedText: { fontSize: FontSize.sm, fontStyle: 'italic', paddingVertical: 4 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  actionSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, borderTopWidth: 1, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, gap: Spacing.md },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  actionText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  editModal: { marginHorizontal: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
  editTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  editInput: { borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.base, maxHeight: 120, minHeight: 100 },
  editButtonRow: { flexDirection: 'row', gap: Spacing.md },
  editBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  editBtnLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  msgImageWrap: { borderRadius: 14, overflow: 'hidden' },
  msgImage: { width: 180, height: 180 },
  msgImageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4, gap: 6 },
  msgReactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: 36, marginTop: -4, marginBottom: 4 },
  msgReactionsRowMe: { flexDirection: 'row', justifyContent: 'flex-end', marginLeft: 0, marginRight: 0 },
  msgReactionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  msgReactionChipText: { fontSize: 12 },
  emojiPicker: { flexDirection: 'row', gap: 4, marginLeft: 36, marginBottom: 4, padding: 6, borderRadius: BorderRadius.lg, borderWidth: 1, alignSelf: 'flex-start' },
  emojiPickerMe: { alignSelf: 'flex-end', marginLeft: 0, marginRight: 0 },
  emojiPickerBtn: { padding: 4 },
  emojiPickerIcon: { fontSize: 22 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: BorderRadius.lg, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  chatInput: { flex: 1, fontSize: FontSize.base, minHeight: 36 },
  chatPhotoBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  chatImagePreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.sm, marginBottom: Spacing.sm },
  chatPreviewImg: { width: 44, height: 44, borderRadius: BorderRadius.md },
  chatRemoveImgBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  privateMsg: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.md, alignItems: 'center' },
  privateMsgText: { fontSize: FontSize.sm, fontFamily: UIFont },
  inviteSection: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm},
  inviteInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.full, borderWidth: 1.5, paddingHorizontal: Spacing.md, height: 40, gap: 8 },
  inviteInputIcon: { fontSize: 13 },
  inviteInput: { flex: 1, fontSize: FontSize.sm },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1 },
  inviteAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inviteAvatarText: { color: '#fff', fontSize: 15, fontWeight: FontWeight.bold },
  inviteInfo: { flex: 1, gap: 1 },
  inviteName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  inviteUni: { fontSize: FontSize.xs },
  inviteBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1 },
  inviteBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
});
