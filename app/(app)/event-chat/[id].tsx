import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Icon } from '@/components/ui/Icon';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { pickImage } from '@/core/utils/imagePicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { formatMessageTime } from '@/core/utils/time';
import { haptics } from '@/core/utils/haptics';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { notificationsRepository } from '@/features/notifications/notifications.repository';
import { uploadEventChatImage } from '@/core/utils/uploadImage';
import { chatRepository } from '@/features/events/data/repositories/chat.repository';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { EventEntity, ChatMessage, isAttending } from '@/features/events/domain/entities/event.entity';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { isRight } from '@/core/utils/either';
import { useKeyboardOffset } from '@/core/hooks/useKeyboardOffset';

function Avatar({ profile, size = 28 }: { profile?: UserProfile; size?: number }) {
  const name = profile?.name ?? '?';
  const initial = name.charAt(0).toUpperCase();
  const bg = profile?.avatarColor ?? '#999';
  if (profile?.photoUri) {
    return <Image source={{ uri: profile.photoUri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

export default function EventChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOffset = useKeyboardOffset();
  const user = useAuthStore((s) => s.user);
  const { language } = useLanguageStore();
  const t = useTranslation();

  const [event, setEvent] = useState<EventEntity | null>(null);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUids, setTypingUids] = useState<string[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [chatSelectedImage, setChatSelectedImage] = useState<string | null>(null);
  const [uploadingChatImage, setUploadingChatImage] = useState(false);
  const [msgReactionPicker, setMsgReactionPicker] = useState<string | null>(null);
  const [selectedMsgForActions, setSelectedMsgForActions] = useState<ChatMessage | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgText, setEditingMsgText] = useState('');

  const chatScrollRef = useRef<ScrollView>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    eventsRepository.getEvent(id).then((result) => {
      if (isRight(result)) setEvent(result.right);
    });
  }, [id]);

  const attending = !!(event && user && isAttending(event, user.id));
  // Auto-expiring chat (research doc #8) — closes 24h after the event
  // starts. Also enforced server-side (firestore.rules) so a modified
  // client can't keep posting once the UI has closed the composer; the
  // actual message backlog gets deleted later by sweepExpiredChats.
  const chatExpired = !!event && Date.now() >= event.dateTime.getTime() + 24 * 3600_000;

  useEffect(() => {
    if (!id) return;
    const unsub = chatRepository.subscribeToMessages(id, (msgs) => {
      setMessages(msgs);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: false }), 80);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    const unsub = chatRepository.subscribeToTyping(id, user.id, setTypingUids);
    return () => {
      unsub();
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      if (typingDebounce.current) clearTimeout(typingDebounce.current);
    };
  }, [id, user?.id]);

  // Chat messages can come from anyone who was ever an attendee — backfill
  // any sender profile that isn't in the attendee-seeded map yet.
  useEffect(() => {
    if (!event) return;
    fetchUserProfiles(event.attendeeIds).then(setProfiles);
  }, [event?.id]);

  useEffect(() => {
    if (messages.length === 0) return;
    const missing = [...new Set(messages.map((m) => m.userId))].filter((uid) => !profiles[uid]);
    if (missing.length === 0) return;
    fetchUserProfiles(missing).then((loaded) => setProfiles((prev) => ({ ...prev, ...loaded })));
  }, [messages, profiles]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => !user?.blockedUserIds?.includes(m.userId)),
    [messages, user?.blockedUserIds],
  );

  const handleChatDraftChange = useCallback((text: string) => {
    setChatDraft(text);
    if (!event || !user) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (text.trim()) {
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
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    chatRepository.setTyping(event.id, user.id, false);
    try {
      await chatRepository.sendMessage(event.id, user.id, text);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
      if (event.creatorId !== user.id) {
        notificationsRepository.create({
          toUid: event.creatorId,
          fromUid: user.id,
          fromName: user.name,
          fromAvatarColor: user.avatarColor,
          fromPhotoUri: user.photoUri,
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

  const handlePickChatImage = async () => {
    const uri = await pickImage({ aspect: [1, 1], quality: 0.7 });
    if (uri) setChatSelectedImage(uri);
  };

  const handleSendChatImage = async () => {
    if (!event || !user || !chatSelectedImage) return;
    setUploadingChatImage(true);
    try {
      const imageUrl = await uploadEventChatImage(chatSelectedImage);
      await chatRepository.sendImageMessage(event.id, user.id, imageUrl);
      setChatSelectedImage(null);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
    setUploadingChatImage(false);
  };

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

  const handleEditMsg = async () => {
    if (!event || !editingMsgId || !editingMsgText.trim()) return;
    await chatRepository.editMessage(event.id, editingMsgId, editingMsgText.trim());
    setEditingMsgId(null);
    setEditingMsgText('');
  };

  const handleDeleteMsg = (messageId: string) => {
    if (!event) return;
    Alert.alert(t.eventDeleteMsgTitle, t.eventDeleteMsgBody, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      { text: t.eventDeleteBtn, style: 'destructive', onPress: () => chatRepository.deleteMessage(event.id, messageId) },
    ]);
  };

  if (!event) return <View style={[styles.root, { backgroundColor: colors.background }]} />;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }, Platform.OS === 'android' && { paddingBottom: keyboardOffset }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 52 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <AnimatedPressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="back" size={17} color={colors.textPrimary} />
        </AnimatedPressable>
        <AnimatedPressable
          onPress={() => router.push(`/(app)/event/${event.id}`)}
          style={styles.headerTitleWrap}
        >
          <Text style={[styles.headerName, { color: colors.textPrimary }]} numberOfLines={1}>{event.title}</Text>
          <Text style={[styles.headerSub, { color: colors.textHint }]} numberOfLines={1}>{t.eventChatTitle}</Text>
        </AnimatedPressable>
      </View>

      {!attending ? (
        <View style={styles.empty}>
          <Icon name="lock" size={36} color={colors.textDecor} />
          <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.eventChatLocked(visibleMessages.length)}</Text>
        </View>
      ) : (
        <>
          <ScrollView
            ref={chatScrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.msgList}
            showsVerticalScrollIndicator={false}
          >
            {visibleMessages.length === 0 ? (
              <View style={styles.empty}>
                <Icon name="chat" size={36} color={colors.textDecor} />
                <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.eventChatEmpty}</Text>
              </View>
            ) : (
              visibleMessages.map((msg) => {
                const msgProfile = profiles[msg.userId];
                const name = msgProfile?.name ?? 'User';
                const isMe = msg.userId === user?.id;
                const msgReactions = Object.entries<string[]>(msg.reactions ?? {}).filter(([, uids]) => uids.length > 0);
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
                        <Pressable onPress={() => router.push(`/(app)/user/${msg.userId}`)}>
                          <Avatar profile={msgProfile} size={28} />
                        </Pressable>
                      )}
                      <View style={[
                        styles.msgBubble,
                        isMe ? styles.msgBubbleMe : styles.msgBubbleThem,
                        msg.imageUri
                          ? { padding: 0, backgroundColor: 'transparent', borderColor: colors.border }
                          : { backgroundColor: isMe ? colors.primary : colors.surface, borderColor: isMe ? colors.primary : colors.border },
                      ]}>
                        {msg.imageUri ? (
                          <View style={styles.msgImageWrap}>
                            <Image source={{ uri: msg.imageUri }} style={styles.msgImage} />
                            <View style={[styles.msgImageFooter, { backgroundColor: isMe ? colors.primary : colors.surface }]}>
                              {!isMe && <Text style={[styles.msgName, { color: colors.textHint }]}>{name}</Text>}
                              <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.65)' : colors.textHint }]}>
                                {formatMessageTime(msg.timestamp, language)}
                              </Text>
                            </View>
                          </View>
                        ) : (
                          <>
                            {!isMe && <Text style={[styles.msgName, { color: colors.textHint }]}>{name}</Text>}
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
                        {msgReactions.map(([emoji, uids]) => {
                          const active = uids.includes(user?.id ?? '');
                          return (
                            <AnimatedPressable
                              key={emoji}
                              onPress={() => handleMsgReact(msg.id, emoji)}
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
                  </View>
                );
              })
            )}
            {typingUids.length > 0 && (
              <View style={styles.msgRow}>
                <View style={[styles.typingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.typingText, { color: colors.textHint }]}>
                    {typingUids.length === 1
                      ? t.eventTyping1(profiles[typingUids[0]]?.name ?? '...')
                      : t.eventTypingMany(typingUids.length)}
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          {chatExpired ? (
            <View style={[styles.chatClosedNote, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
              <Icon name="lock" size={14} color={colors.textHint} />
              <Text style={[styles.chatClosedText, { color: colors.textHint }]}>{t.eventChatClosedNote}</Text>
            </View>
          ) : (
          <>
          {chatSelectedImage && (
            <View style={[styles.imagePreview, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
              <Image source={{ uri: chatSelectedImage }} style={styles.previewImg} />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="camera" size={15} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontWeight: FontWeight.bold, fontFamily: UIFont }}>{t.chatPhotoLabel}</Text>
                {uploadingChatImage && <ActivityIndicator color={colors.primary} />}
              </View>
              <AnimatedPressable
                onPress={() => setChatSelectedImage(null)}
                disabled={uploadingChatImage}
                style={[styles.removeBtn, { borderColor: colors.border }]}
              >
                <Icon name="x" size={14} color={colors.textSecondary} />
              </AnimatedPressable>
            </View>
          )}

          <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
            {chatSelectedImage ? (
              <AnimatedPressable
                onPress={handleSendChatImage}
                disabled={uploadingChatImage}
                style={[styles.sendBtn, { backgroundColor: uploadingChatImage ? colors.surfaceVariant : colors.primary, flex: 1, width: undefined, flexDirection: 'row', gap: 8 }]}
              >
                {uploadingChatImage ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Icon name="send" size={16} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: FontWeight.bold, fontFamily: UIFont }}>{t.chatSendBtn}</Text>
                  </>
                )}
              </AnimatedPressable>
            ) : (
              <>
                <AnimatedPressable
                  onPress={handlePickChatImage}
                  style={[styles.photoBtn, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
                >
                  <Icon name="camera" size={18} color={colors.textSecondary} />
                </AnimatedPressable>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
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
                  style={[styles.sendBtn, { backgroundColor: chatDraft.trim() ? colors.primary : colors.surfaceVariant }]}
                >
                  <Icon name="send" size={17} color={chatDraft.trim() ? '#fff' : colors.textHint} />
                </AnimatedPressable>
              </>
            )}
          </View>
          </>
          )}
        </>
      )}

      {/* Message actions (own messages only): edit / delete */}
      <Modal visible={!!selectedMsgForActions} transparent animationType="fade" onRequestClose={() => setSelectedMsgForActions(null)}>
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

      {/* Edit message modal */}
      <Modal visible={!!editingMsgId} transparent animationType="fade" onRequestClose={() => { setEditingMsgId(null); setEditingMsgText(''); }}>
        <Pressable style={styles.modalOverlay} onPress={() => { setEditingMsgId(null); setEditingMsgText(''); }}>
          <View style={[styles.editModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.editTitle, { color: colors.textPrimary }]}>{t.editAction}</Text>
            <TextInput
              style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={editingMsgText}
              onChangeText={setEditingMsgText}
              placeholder={t.eventChatPlaceholder}
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
                style={[styles.editBtn, { backgroundColor: editingMsgText.trim() ? colors.primary : colors.surfaceVariant }]}
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
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 1, gap: Spacing.sm,
  },
  backBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1 },
  headerName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  headerSub: { fontSize: FontSize.xs, fontFamily: UIFontLight, marginTop: 1 },
  avatarCircle: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontWeight: FontWeight.bold, fontFamily: UIFont },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md, paddingHorizontal: Spacing.xl },
  emptyText: { fontSize: FontSize.sm, fontFamily: UIFontLight, textAlign: 'center' },
  msgList: { paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 16, gap: 8 },
  msgRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgBubble: { maxWidth: '75%', borderRadius: 16, borderWidth: 1, padding: Spacing.sm, gap: 2 },
  msgBubbleMe: { borderBottomRightRadius: 4 },
  msgBubbleThem: { borderBottomLeftRadius: 4 },
  msgName: { fontSize: 10, fontWeight: FontWeight.bold },
  msgText: { fontSize: FontSize.sm, lineHeight: 18 },
  msgTime: { fontSize: 9, marginTop: 2 },
  msgDeletedText: { fontSize: FontSize.sm, fontStyle: 'italic', paddingVertical: 4 },
  msgImageWrap: { borderRadius: 14, overflow: 'hidden' },
  msgImage: { width: 180, height: 180 },
  msgImageFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingVertical: 4, gap: 6 },
  emojiPicker: { flexDirection: 'row', gap: 4, marginBottom: 4, padding: 6, borderRadius: BorderRadius.lg, borderWidth: 1, alignSelf: 'flex-start' },
  emojiPickerMe: { alignSelf: 'flex-end' },
  emojiPickerBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  emojiPickerIcon: { fontSize: 20 },
  msgReactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: 36, marginTop: -4, marginBottom: 4 },
  msgReactionsRowMe: { flexDirection: 'row', justifyContent: 'flex-end', marginLeft: 0, marginRight: 0 },
  msgReactionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  msgReactionChipText: { fontSize: 12, fontFamily: UIFont },
  typingBubble: { borderRadius: 16, borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: 8 },
  typingText: { fontSize: FontSize.xs, fontFamily: UIFontLight, fontStyle: 'italic' },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1, fontSize: FontSize.base, fontFamily: UIFontLight,
    borderRadius: BorderRadius.full, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    minHeight: 42,
  },
  sendBtn: { width: 42, height: 42, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center' },
  photoBtn: { width: 42, height: 42, borderRadius: BorderRadius.full, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chatClosedNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1 },
  chatClosedText: { fontSize: FontSize.xs, fontFamily: UIFontLight },
  imagePreview: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 1 },
  previewImg: { width: 60, height: 60, borderRadius: BorderRadius.xs },
  removeBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
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
});
