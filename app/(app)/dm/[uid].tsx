import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc, collection, doc, getDoc, onSnapshot,
  orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { formatMessageTime } from '@/core/utils/time';
import { haptics } from '@/core/utils/haptics';
import { containsBlockedContent } from '@/core/utils/contentModeration';

interface DmMessage {
  id: string;
  senderId: string;
  text: string;
  createdAt: Date;
}

function conversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export default function DmScreen() {
  const { uid: otherUid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { language } = useLanguageStore();
  const t = useTranslation();

  const [otherName, setOtherName] = useState('');
  const [otherAvatarColor, setOtherAvatarColor] = useState('#C94D0A');
  const [otherPhotoUri, setOtherPhotoUri] = useState<string | undefined>();
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const convoId = user ? conversationId(user.id, otherUid) : '';

  useEffect(() => {
    if (!otherUid) return;
    getDoc(doc(db, 'users', otherUid)).then((snap) => {
      if (snap.exists()) {
        setOtherName(snap.data().name ?? 'User');
        setOtherAvatarColor(snap.data().avatarColor ?? '#C94D0A');
        setOtherPhotoUri(snap.data().photoUri);
      }
    }).catch(() => {});
  }, [otherUid]);

  useEffect(() => {
    if (!convoId) return;
    const q = query(collection(db, 'conversations', convoId, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({
        id: d.id,
        senderId: d.data().senderId as string,
        text: d.data().text as string,
        createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
      })));
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 80);
    }, () => {});
    return unsub;
  }, [convoId]);

  const handleSend = useCallback(async () => {
    if (!user || !convoId || !draft.trim()) return;
    if (containsBlockedContent(draft)) {
      Alert.alert(t.dmNewMessage, t.validContentBlocked);
      return;
    }
    haptics.light();
    setSending(true);
    const text = draft.trim();
    setDraft('');
    try {
      // Ensure conversation document exists
      await setDoc(doc(db, 'conversations', convoId), {
        participantIds: [user.id, otherUid],
        lastMessage: text,
        lastAt: serverTimestamp(),
      }, { merge: true });
      await addDoc(collection(db, 'conversations', convoId, 'messages'), {
        senderId: user.id,
        text,
        createdAt: serverTimestamp(),
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setDraft(text);
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
    setSending(false);
  }, [user, convoId, draft, otherUid]);

  const bs = colors.borderStrong;
  const initials = otherName ? otherName[0].toUpperCase() : '?';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: bs }]}>
        <AnimatedPressable onPress={() => router.back()} style={[styles.backBtn, { borderColor: bs }]}>
          <Text style={[styles.backIcon, { color: colors.textPrimary }]}>←</Text>
        </AnimatedPressable>
        <View style={[styles.headerAvatar, { backgroundColor: otherAvatarColor }]}>
          {otherPhotoUri ? (
            <Image source={{ uri: otherPhotoUri }} style={styles.headerAvatarImg} />
          ) : (
            <Text style={styles.headerAvatarInitial}>{initials}</Text>
          )}
        </View>
        <Text style={[styles.headerName, { color: colors.textPrimary }]} numberOfLines={1}>{otherName}</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={[styles.msgList, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👋</Text>
            <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.dmPlaceholder}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMe = item.senderId === user?.id;
          return (
            <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
              <View style={[
                styles.bubble,
                { backgroundColor: isMe ? colors.primary : colors.surface, borderColor: bs },
              ]}>
                <Text style={[styles.bubbleText, { color: isMe ? '#fff' : colors.textPrimary }]}>{item.text}</Text>
                <Text style={[styles.bubbleTime, { color: isMe ? 'rgba(255,255,255,0.65)' : colors.textHint }]}>
                  {formatMessageTime(item.createdAt, language)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      {/* Input */}
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: bs, paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={[styles.input, { color: colors.textPrimary, borderColor: bs }]}
          value={draft}
          onChangeText={setDraft}
          placeholder={t.dmNewMessage}
          placeholderTextColor={colors.textHint}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          multiline={false}
        />
        <AnimatedPressable
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          style={[styles.sendBtn, { backgroundColor: draft.trim() ? colors.primary : colors.surfaceVariant, borderColor: bs }]}
        >
          <Text style={[styles.sendIcon, { color: draft.trim() ? '#fff' : colors.textHint }]}>✈️</Text>
        </AnimatedPressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 2.5, gap: Spacing.sm,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  headerAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarInitial: { color: '#fff', fontSize: 15, fontWeight: FontWeight.bold },
  headerName: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  msgList: { paddingHorizontal: Spacing.lg, paddingTop: 12, gap: 8 },
  msgRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  msgRowMe: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '75%', borderRadius: 16, borderWidth: 2, padding: Spacing.sm, gap: 3 },
  bubbleText: { fontSize: FontSize.sm, lineHeight: 18 },
  bubbleTime: { fontSize: 9 },
  inputBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm,
    borderTopWidth: 2.5,
  },
  input: {
    flex: 1, fontSize: FontSize.base,
    borderRadius: BorderRadius.full, borderWidth: 2.5,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    minHeight: 42,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  sendIcon: { fontSize: 16 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
});
