import React, { useEffect, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, getDoc, doc, onSnapshot, orderBy, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { formatMessageTime } from '@/core/utils/time';

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

export default function MessagesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const { language } = useLanguageStore();
  const t = useTranslation();
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
                  avatarColor: snap.data().avatarColor ?? '#C94D0A',
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
          otherAvatarColor: cached?.avatarColor ?? '#C94D0A',
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

  const bs = colors.borderStrong;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: bs }]}>
        <ScreenHeader title={t.dmTitle} />
      </View>

      <FlatList
        data={convos}
        keyExtractor={(c) => c.conversationId}
        contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.dmEmpty}</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: bs }]} />}
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
          </AnimatedPressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 2.5,
  },
  list: { paddingTop: 8 },
  separator: { height: 1.5, marginHorizontal: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 14, gap: Spacing.md },
  avatarWrap: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: 50, height: 50, borderRadius: 25 },
  avatarInitial: { color: '#fff', fontSize: 20, fontWeight: FontWeight.bold },
  rowBody: { flex: 1, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowName: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: DrawFont, flex: 1 },
  rowTime: { fontSize: FontSize.xs },
  rowPreview: { fontSize: FontSize.sm, lineHeight: 18 },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: FontSize.md, textAlign: 'center' },
});
