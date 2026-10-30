import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Icon } from '@/components/ui/Icon';
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, Modal } from 'react-native';
import { pickImage } from '@/core/utils/imagePicker';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteField, doc, getDoc, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { formatMessageTime } from '@/core/utils/time';
import { haptics } from '@/core/utils/haptics';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { notificationsRepository } from '@/features/notifications/notifications.repository';
import { uploadDmImage } from '@/core/utils/uploadImage';
import { useKeyboardOffset } from '@/core/hooks/useKeyboardOffset';
import { beaconsRepository } from '@/features/beacons/beacons.repository';
import { BeaconEntity } from '@/features/beacons/beacon.entity';
import { remainingLabel } from '@/components/ui/BeaconCard';

interface DmMessage {
  id: string;
  senderId: string;
  text?: string;
  imageUri?: string;
  createdAt: Date;
  editedAt?: Date;
  isDeleted?: boolean;
  reactions?: Record<string, string[]>;
}

function conversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export default function DmScreen() {
  const { uid: otherUid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOffset = useKeyboardOffset();
  const user = useAuthStore((s) => s.user);
  const { language } = useLanguageStore();
  const t = useTranslation();

  const [otherName, setOtherName] = useState('');
  const [otherAvatarColor, setOtherAvatarColor] = useState('#B8482A');
  const [otherPhotoUri, setOtherPhotoUri] = useState<string | undefined>();
  const [otherBlockedMe, setOtherBlockedMe] = useState(false);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<DmMessage | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [msgReactionPicker, setMsgReactionPicker] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  // "Έχω κενό" context banner — rendered above the thread, not stored as an
  // actual message, so it never pollutes real chat history and just stops
  // showing once the beacon expires.
  const [otherBeacon, setOtherBeacon] = useState<BeaconEntity | null>(null);
  const [beaconNow, setBeaconNow] = useState(() => Date.now());

  useEffect(() => {
    if (!otherUid) return;
    return beaconsRepository.subscribeForUser(otherUid, setOtherBeacon);
  }, [otherUid]);

  useEffect(() => {
    if (!otherBeacon) return;
    const id = setInterval(() => setBeaconNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [otherBeacon?.id]);

  const convoId = user ? conversationId(user.id, otherUid) : '';
  const [otherLastReadAt, setOtherLastReadAt] = useState<Date | null>(null);

  // Instagram-style read receipts: conversations/{id}.lastReadAt is a
  // {uid: Timestamp} map. Stamping mine on mount and whenever a new message
  // lands (while I'm sitting in the thread) is what makes "Seen" appear on
  // the other person's screen. The doc only exists once a message has been
  // sent by either side, so guard on messages.length to avoid a create-time
  // permission error (the create rule requires participantIds on the doc).
  useEffect(() => {
    if (!convoId || !user || messages.length === 0) return;
    updateDoc(doc(db, 'conversations', convoId), {
      [`lastReadAt.${user.id}`]: serverTimestamp(),
    }).catch(() => {});
  }, [convoId, user?.id, messages.length]);

  // Live-subscribe to the other participant's read timestamp so "Seen"
  // updates in real time, like Instagram.
  useEffect(() => {
    if (!convoId || !otherUid) return;
    const unsub = onSnapshot(doc(db, 'conversations', convoId), (snap) => {
      const readAt = snap.data()?.lastReadAt?.[otherUid] as Timestamp | undefined;
      setOtherLastReadAt(readAt ? readAt.toDate() : null);
    }, () => {});
    return unsub;
  }, [convoId, otherUid]);

  useEffect(() => {
    if (!otherUid) return;
    getDoc(doc(db, 'users', otherUid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setOtherName(d.name ?? 'User');
        setOtherAvatarColor(d.avatarColor ?? '#B8482A');
        setOtherPhotoUri(d.photoUri);
        setOtherBlockedMe(user ? (d.blockedUserIds ?? []).includes(user.id) : false);
      }
    }).catch(() => {});
  }, [otherUid, user?.id]);

  const iBlockedThem = user?.blockedUserIds?.includes(otherUid) ?? false;
  const isBlockedEitherWay = iBlockedThem || otherBlockedMe;

  useEffect(() => {
    if (!convoId) return;
    const q = query(collection(db, 'conversations', convoId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({
        id: d.id,
        senderId: d.data().senderId as string,
        text: d.data().text as string | undefined,
        imageUri: d.data().imageUri as string | undefined,
        createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
        editedAt: d.data().editedAt ? (d.data().editedAt as Timestamp).toDate() : undefined,
        isDeleted: d.data().isDeleted as boolean | undefined,
        reactions: d.data().reactions ?? {},
      })));
    }, () => {});
    return unsub;
  }, [convoId]);

  const handleSend = useCallback(async () => {
    if (!user || !convoId || !draft.trim() || isBlockedEitherWay) return;
    if (containsBlockedContent(draft)) {
      Alert.alert(t.dmNewMessage, t.validContentBlocked);
      return;
    }
    haptics.light();
    setSending(true);
    const text = draft.trim();
    setDraft('');
    try {
      // Ensure conversation document exists. hiddenFor resets on every new
      // message — a "deleted" thread (see messages.tsx) is really just
      // hidden from one side's list, and a fresh message should surface it
      // again, Instagram-style.
      await setDoc(doc(db, 'conversations', convoId), {
        participantIds: [user.id, otherUid],
        lastMessage: text,
        lastSenderId: user.id,
        lastAt: serverTimestamp(),
        hiddenFor: [],
      }, { merge: true });
      await addDoc(collection(db, 'conversations', convoId, 'messages'), {
        senderId: user.id,
        text,
        createdAt: serverTimestamp(),
      });
      // Send notification to recipient — messagePreview carries the actual
      // text into the push notification body (Instagram-style), instead of
      // a generic "sent you a message".
      notificationsRepository.create({
        toUid: otherUid,
        fromUid: user.id,
        fromName: user.name,
        fromAvatarColor: user.avatarColor,
        fromPhotoUri: user.photoUri,
        type: 'dm_message',
        messagePreview: text,
      }).catch(() => {});
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setDraft(text);
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
    setSending(false);
  }, [user, convoId, draft, otherUid, isBlockedEitherWay]);

  const handlePickImage = async () => {
    const uri = await pickImage({ aspect: [1, 1], quality: 0.7 });
    if (uri) setSelectedImage(uri);
  };

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!convoId) return;
    try {
      await updateDoc(doc(db, 'conversations', convoId, 'messages', messageId), {
        isDeleted: true,
        text: deleteField(),
        imageUri: deleteField(),
      });
      setSelectedMessage(null);
    } catch (e) {
      Alert.alert(t.createAlertSaveError, `Failed to delete message: ${String(e).slice(0, 100)}`);
    }
  }, [convoId]);

  const handleMsgReact = useCallback(async (messageId: string, emoji: string) => {
    if (!user || !convoId) return;
    haptics.light();
    setMsgReactionPicker(null);
    const msg = messages.find((m) => m.id === messageId);
    const alreadyReacted = msg?.reactions?.[emoji]?.includes(user.id);
    const ref = doc(db, 'conversations', convoId, 'messages', messageId);
    await updateDoc(ref, {
      [`reactions.${emoji}`]: alreadyReacted ? arrayRemove(user.id) : arrayUnion(user.id),
    });
  }, [user, convoId, messages]);

  const handleEditMessage = useCallback(async () => {
    if (!editingMessageId || !convoId || !editingText.trim()) {
      return;
    }
    try {
      const msgRef = doc(db, 'conversations', convoId, 'messages', editingMessageId);
      await updateDoc(msgRef, {
        text: editingText.trim(),
        editedAt: serverTimestamp(),
      });
      setEditingMessageId(null);
      setEditingText('');
      setSelectedMessage(null);
    } catch (e) {
      console.error('Edit failed:', e);
      Alert.alert(t.createAlertSaveError, `Error: ${String(e).slice(0, 150)}`);
    }
  }, [editingMessageId, convoId, editingText]);

  const handleSendImage = async () => {
    if (!user || !selectedImage || !convoId) return;
    if (isBlockedEitherWay) {
      Alert.alert(t.dmBlockedAlertTitle, iBlockedThem ? t.dmBlockedByMe : t.dmBlockedByThem);
      return;
    }
    setUploadingImage(true);
    try {
      const imageUrl = await uploadDmImage(selectedImage);
      await setDoc(doc(db, 'conversations', convoId), {
        participantIds: [user.id, otherUid],
        lastMessage: '📷 Photo',
        lastSenderId: user.id,
        lastAt: serverTimestamp(),
        hiddenFor: [],
      }, { merge: true });
      await addDoc(collection(db, 'conversations', convoId, 'messages'), {
        senderId: user.id,
        imageUri: imageUrl,
        createdAt: serverTimestamp(),
      });
      setSelectedImage(null);
      notificationsRepository.create({
        toUid: otherUid,
        fromUid: user.id,
        fromName: user.name,
        fromAvatarColor: user.avatarColor,
        fromPhotoUri: user.photoUri,
        type: 'dm_message',
        messagePreview: '📷 Photo',
      }).catch(() => {});
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      Alert.alert(t.createAlertSaveError, t.dmSendImageError);
    }
    setUploadingImage(false);
  };

  const initials = otherName ? otherName[0].toUpperCase() : '?';

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={[{ flex: 1 }, Platform.OS === 'android' && { paddingBottom: keyboardOffset }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <AnimatedPressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="back" size={17} color={colors.textPrimary} />
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => router.push(`/(app)/user/${otherUid}` as any)}
          style={styles.headerProfileLink}
        >
          <View style={[styles.headerAvatar, { backgroundColor: otherAvatarColor }]}>
            {otherPhotoUri ? (
              <Image source={{ uri: otherPhotoUri }} style={styles.headerAvatarImg} />
            ) : (
              <Text style={styles.headerAvatarInitial}>{initials}</Text>
            )}
          </View>
          <Text style={[styles.headerName, { color: colors.textPrimary }]} numberOfLines={1}>{otherName}</Text>
        </AnimatedPressable>
      </View>

      {otherBeacon && (
        <View style={[styles.beaconBanner, { backgroundColor: colors.accentSoft }]}>
          <View style={styles.beaconBannerRow}>
            <Icon name="coffee" size={14} color={colors.primary} />
            <Text style={[styles.beaconBannerText, { color: colors.accentInk }]} numberOfLines={2}>
              {t.beaconContextBubble(otherName)} · {remainingLabel(otherBeacon.expiresAt, beaconNow)}
            </Text>
          </View>
          <AnimatedPressable onPress={() => setDraft(t.beaconQuickReply)} style={[styles.beaconQuickReplyChip, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <Text style={[styles.beaconQuickReplyText, { color: colors.primary }]}>{t.beaconQuickReply}</Text>
          </AnimatedPressable>
        </View>
      )}

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.msgList, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="chat" size={36} color={colors.textDecor} />
            <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.dmPlaceholder}</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const isMe = item.senderId === user?.id;
          const hasImage = item.imageUri;
          const isLast = index === messages.length - 1;
          const isSeen = isMe && !item.isDeleted && !!otherLastReadAt && otherLastReadAt.getTime() >= item.createdAt.getTime();
          if (item.isDeleted) {
            return (
              <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                <Text style={[styles.deletedText, { color: colors.textHint }]}>{t.dmMessageDeleted}</Text>
              </View>
            );
          }
          // Warm Paper bubbles (spec §4): theirs = white + border, radius 14
          // with a smaller bottom-left corner; mine = accent bg, white text,
          // smaller bottom-right corner.
          const bubbleCorner = isMe
            ? { borderBottomRightRadius: 4 }
            : { borderBottomLeftRadius: 4 };
          const msgReactions = Object.entries<string[]>(item.reactions ?? {}).filter(([, uids]) => uids.length > 0);
          const showPicker = msgReactionPicker === item.id;
          return (
            <View>
              <AnimatedPressable
                onLongPress={() => setMsgReactionPicker(showPicker ? null : item.id)}
                onPress={() => { if (isMe) setSelectedMessage(item); }}
                style={[styles.msgRow, isMe && styles.msgRowMe]}
              >
                <View style={[
                  styles.bubble,
                  bubbleCorner,
                  hasImage && { padding: 0, backgroundColor: 'transparent', borderWidth: 0 },
                  !hasImage && { backgroundColor: isMe ? colors.primary : colors.surface, borderColor: colors.border },
                ]}>
                  {hasImage ? (
                    <View style={[{ borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }, styles.bubbleRadius, bubbleCorner]}>
                      <Image source={{ uri: item.imageUri }} style={{ width: 180, height: 180 }} />
                      <View style={{ padding: 4, backgroundColor: isMe ? colors.primary : colors.surface }}>
                        {item.editedAt && (
                          <Text style={[styles.editedIndicator, { color: isMe ? 'rgba(255,255,255,0.5)' : colors.textHint }]}>
                            edited
                          </Text>
                        )}
                        <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.65)' : colors.textHint }]}>
                          {formatMessageTime(item.createdAt, language)}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.bubbleText, { color: isMe ? '#fff' : colors.textPrimary }]}>{item.text}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        {item.editedAt && (
                          <Text style={[styles.editedIndicator, { color: isMe ? 'rgba(255,255,255,0.5)' : colors.textHint }]}>
                            edited
                          </Text>
                        )}
                        <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.65)' : colors.textHint }]}>
                          {formatMessageTime(item.createdAt, language)}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </AnimatedPressable>
              {showPicker && (
                <View style={[styles.emojiPicker, isMe && styles.emojiPickerMe, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {['❤️', '😂', '🔥', '👍', '😮', '😢'].map((e) => (
                    <AnimatedPressable key={e} onPress={() => handleMsgReact(item.id, e)} style={styles.emojiPickerBtn}>
                      <Text style={styles.emojiPickerIcon}>{e}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
              )}
              {msgReactions.length > 0 && (
                <View style={[styles.msgReactionsRow, isMe && styles.msgReactionsRowMe]}>
                  {msgReactions.map(([emoji, uids]) => {
                    const active = uids.includes(user?.id ?? '');
                    return (
                      <AnimatedPressable
                        key={emoji}
                        onPress={() => handleMsgReact(item.id, emoji)}
                        style={[styles.msgReactionChip, {
                          backgroundColor: active ? colors.accentSoft : colors.surfaceVariant,
                          borderColor: active ? colors.primary : colors.border,
                        }]}
                      >
                        <Text style={[styles.msgReactionChipText, { color: active ? colors.accentInk : colors.textSecondary }]}>{emoji} {uids.length}</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              )}
              {isLast && isSeen && (
                <Text style={[styles.seenText, { color: colors.textHint }]}>{t.dmSeenLabel}</Text>
              )}
            </View>
          );
        }}
      />

      {/* Input */}
      {isBlockedEitherWay ? (
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <Text style={[styles.blockedNotice, { color: colors.textHint }]}>
            {iBlockedThem ? t.dmBlockedByMe : t.dmBlockedByThem}
          </Text>
        </View>
      ) : (
        <View style={{ borderTopColor: colors.border, borderTopWidth: 1 }}>
          {/* Image preview */}
          {selectedImage && (
            <View style={[styles.imagePreview, { backgroundColor: colors.surfaceVariant, borderBottomColor: colors.border }]}>
              <Image source={{ uri: selectedImage }} style={styles.previewImg} />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="camera" size={15} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontWeight: FontWeight.bold, fontFamily: UIFont }}>{t.chatPhotoLabel}</Text>
                {uploadingImage && <ActivityIndicator color={colors.primary} />}
              </View>
              <AnimatedPressable
                onPress={() => setSelectedImage(null)}
                disabled={uploadingImage}
                style={[styles.removeBtn, { borderColor: colors.border }]}
              >
                <Icon name="x" size={14} color={colors.textSecondary} />
              </AnimatedPressable>
            </View>
          )}

          <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
            {selectedImage ? (
              <AnimatedPressable
                onPress={handleSendImage}
                disabled={uploadingImage}
                style={[styles.sendBtn, { backgroundColor: uploadingImage ? colors.surfaceVariant : colors.primary, flex: 1, width: undefined, flexDirection: 'row', gap: 8 }]}
              >
                {uploadingImage ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Icon name="send" size={16} color="#fff" />
                    <Text style={[styles.sendLabel, { color: '#fff' }]}>{t.chatSendBtn}</Text>
                  </>
                )}
              </AnimatedPressable>
            ) : (
              <>
                <AnimatedPressable
                  onPress={handlePickImage}
                  style={[styles.photoBtn, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
                >
                  <Icon name="camera" size={18} color={colors.textSecondary} />
                </AnimatedPressable>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={t.dmPlaceholder}
                  placeholderTextColor={colors.textHint}
                  returnKeyType="send"
                  onSubmitEditing={handleSend}
                  multiline={false}
                />
                <AnimatedPressable
                  onPress={handleSend}
                  disabled={!draft.trim() || sending}
                  style={[styles.sendBtn, { backgroundColor: draft.trim() ? colors.primary : colors.surfaceVariant }]}
                >
                  <Icon name="send" size={17} color={draft.trim() ? '#fff' : colors.textHint} />
                </AnimatedPressable>
              </>
            )}
          </View>
        </View>
      )}

      {/* Message actions modal */}
      <Modal
        visible={!!selectedMessage}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessage(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedMessage(null)}
        />
        <View style={[styles.actionSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {selectedMessage?.text && !selectedMessage?.imageUri && (
            <AnimatedPressable
              onPress={() => {
                setSelectedMessage(null);
                setEditingMessageId(selectedMessage.id);
                setEditingText(selectedMessage.text || '');
              }}
              style={styles.actionButton}
            >
              <Icon name="edit" size={17} color={colors.textPrimary} />
              <Text style={[styles.actionText, { color: colors.textPrimary }]}>{t.editAction}</Text>
            </AnimatedPressable>
          )}
          <AnimatedPressable
            onPress={() => {
              setSelectedMessage(null);
              Alert.alert(t.eventDeleteMsgTitle, t.eventDeleteMsgBody, [
                { text: t.cancel },
                {
                  text: t.eventDeleteBtn,
                  onPress: () => {
                    if (selectedMessage) handleDeleteMessage(selectedMessage.id);
                  },
                },
              ]);
            }}
            style={styles.actionButton}
          >
            <Icon name="trash" size={17} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>{t.eventDeleteBtn}</Text>
          </AnimatedPressable>
        </View>
      </Modal>

      {/* Edit message modal */}
      <Modal
        visible={!!editingMessageId}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setEditingMessageId(null);
          setEditingText('');
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setEditingMessageId(null);
            setEditingText('');
          }}
        >
          <View style={[styles.editModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.editTitle, { color: colors.textPrimary }]}>{t.editAction}</Text>
            <TextInput
              style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={editingText}
              onChangeText={setEditingText}
              placeholder={t.dmPlaceholder}
              placeholderTextColor={colors.textHint}
              multiline
              maxLength={500}
            />
            <View style={styles.editButtonRow}>
              <AnimatedPressable
                onPress={() => {
                  setEditingMessageId(null);
                  setEditingText('');
                }}
                style={[styles.editBtn, { backgroundColor: colors.surfaceVariant }]}
              >
                <Text style={[styles.editBtnLabel, { color: colors.textPrimary }]}>{t.cancel}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={handleEditMessage}
                disabled={!editingText.trim()}
                style={[styles.editBtn, { backgroundColor: editingText.trim() ? colors.primary : colors.surfaceVariant }]}
              >
                <Text style={[styles.editBtnLabel, { color: editingText.trim() ? '#fff' : colors.textHint }]}>{t.eventEditSave}</Text>
              </AnimatedPressable>
            </View>
          </View>
        </Pressable>
      </Modal>
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, gap: Spacing.sm,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerProfileLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headerAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarInitial: { color: '#fff', fontSize: 15, fontWeight: FontWeight.bold, fontFamily: UIFont },
  headerName: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  beaconBanner: { marginHorizontal: Spacing.lg, marginTop: Spacing.sm, borderRadius: BorderRadius.md, padding: Spacing.sm, gap: 8 },
  beaconBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  beaconBannerText: { flex: 1, fontSize: FontSize.sm, fontFamily: UIFontLight, lineHeight: 17 },
  beaconQuickReplyChip: { alignSelf: 'flex-start', borderWidth: 1.5, borderRadius: BorderRadius.full, paddingHorizontal: 12, paddingVertical: 6 },
  beaconQuickReplyText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  msgList: { paddingHorizontal: Spacing.lg, paddingTop: 12, gap: 8 },
  msgRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  msgRowMe: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '75%', borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.sm, gap: 3 },
  bubbleRadius: { borderRadius: BorderRadius.lg },
  bubbleText: { fontSize: FontSize.base, fontFamily: UIFontLight, lineHeight: 19 },
  bubbleTime: { fontSize: FontSize.xs, fontFamily: UIFontLight },
  seenText: { alignSelf: 'flex-end', fontSize: FontSize.xs, fontFamily: UIFontLight, marginTop: 2, marginRight: 4 },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  blockedNotice: { flex: 1, fontSize: FontSize.sm, fontFamily: UIFontLight, textAlign: 'center', paddingVertical: 12 },
  input: {
    flex: 1, fontSize: FontSize.base, fontFamily: UIFontLight,
    borderRadius: BorderRadius.full, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    minHeight: 42,
  },
  sendBtn: { width: 42, height: 42, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center' },
  sendLabel: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  photoBtn: { width: 42, height: 42, borderRadius: BorderRadius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  imagePreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  previewImg: { width: 60, height: 60, borderRadius: BorderRadius.xs },
  removeBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyText: { fontSize: FontSize.sm, fontFamily: UIFontLight, textAlign: 'center' },
  deletedText: { fontSize: FontSize.sm, fontFamily: UIFontLight, fontStyle: 'italic' },
  emojiPicker: { flexDirection: 'row', gap: 4, marginLeft: 0, marginBottom: 4, padding: 6, borderRadius: BorderRadius.lg, borderWidth: 1, alignSelf: 'flex-start' },
  emojiPickerMe: { alignSelf: 'flex-end' },
  emojiPickerBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  emojiPickerIcon: { fontSize: 20 },
  msgReactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 4 },
  msgReactionsRowMe: { flexDirection: 'row', justifyContent: 'flex-end' },
  msgReactionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  msgReactionChipText: { fontSize: 12, fontFamily: UIFont },
  editedIndicator: { fontSize: FontSize.xs, fontFamily: UIFontLight, marginRight: 4 },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  actionSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, borderTopWidth: 1, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, gap: Spacing.md },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  actionText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  editModal: { marginHorizontal: Spacing.lg, borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
  editTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  editInput: { borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, fontSize: FontSize.base, fontFamily: UIFontLight, maxHeight: 120, minHeight: 100 },
  editButtonRow: { flexDirection: 'row', gap: Spacing.md },
  editBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  editBtnLabel: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
});
