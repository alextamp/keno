import React, { useEffect, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  ActivityIndicator, FlatList, Image, Pressable,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  collection, getDocs, limit, orderBy,
  query, startAt, endAt,
} from 'firebase/firestore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTabNavigation } from '@/core/tabNavigation';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { haptics } from '@/core/utils/haptics';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';

interface UserResult {
  uid: string;
  name: string;
  universityName: string;
  department: string;
  avatarColor: string;
  photoUri?: string;
  bio?: string;
  followersCount: number;
  eventsCount: number;
}

async function searchUsers(q: string): Promise<UserResult[]> {
  if (q.trim().length < 2) return [];
  const lower = q.trim().toLowerCase();
  try {
    // Try prefix search on nameLower first (for users who signed up after the field was added)
    const prefixQ = query(
      collection(db, 'users'),
      orderBy('nameLower'),
      startAt(lower),
      endAt(lower + ''),
      limit(30),
    );
    const snap = await getDocs(prefixQ);
    if (snap.docs.length > 0) {
      return snap.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          name: data.name ?? '',
          universityName: data.universityName ?? '',
          department: data.department ?? '',
          avatarColor: data.avatarColor ?? '#C94D0A',
          photoUri: data.photoUri,
          bio: data.bio,
          followersCount: (data.followers ?? []).length,
          eventsCount: (data.joinedEvents ?? []).length,
        };
      });
    }
  } catch {
    // nameLower index might not exist yet — fall back to full fetch + client filter
  }
  // Fallback: fetch all users and filter client-side (works for small user counts)
  const fallback = await getDocs(query(collection(db, 'users'), limit(200)));
  return fallback.docs
    .map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        name: data.name ?? '',
        universityName: data.universityName ?? '',
        department: data.department ?? '',
        avatarColor: data.avatarColor ?? '#C94D0A',
        photoUri: data.photoUri,
        bio: data.bio,
        followersCount: (data.followers ?? []).length,
        eventsCount: (data.joinedEvents ?? []).length,
      };
    })
    .filter((u) =>
      u.name.toLowerCase().includes(lower) ||
      u.universityName.toLowerCase().includes(lower) ||
      u.department.toLowerCase().includes(lower),
    )
    .slice(0, 30);
}

function UserCard({ result, isMe, isFollowing, onPress, onFollow, followLabel, followingLabel, userMetaLabel }: {
  result: UserResult;
  isMe: boolean;
  isFollowing: boolean;
  onPress: () => void;
  onFollow: () => void;
  followLabel: string;
  followingLabel: string;
  userMetaLabel: string;
}) {
  const { colors } = useTheme();
  const { language } = useLanguageStore();
  const initials = result.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AnimatedPressable onPress={onPress} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
      <View style={styles.cardLeft}>
        {result.photoUri ? (
          <Image source={{ uri: result.photoUri }} style={[styles.avatar, { borderColor: colors.border }]} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: result.avatarColor, borderColor: colors.border }]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>{result.name}</Text>
          <Text style={[styles.cardUni, { color: colors.textSecondary }]} numberOfLines={1}>
            🎓 {universityLabel(result.universityName, language)}
          </Text>
          <Text style={[styles.cardMeta, { color: colors.textHint }]}>
            {userMetaLabel}
          </Text>
        </View>
      </View>
      {!isMe && (
        <AnimatedPressable
          onPress={(e) => { e.stopPropagation?.(); onFollow(); }}
          style={[styles.followBtn, {
            backgroundColor: isFollowing ? colors.surfaceVariant : colors.primary,
            borderColor: colors.borderStrong,
          }]}
        >
          <Text style={[styles.followBtnText, { color: isFollowing ? colors.textPrimary : '#fff' }]}>
            {isFollowing ? followingLabel : followLabel}
          </Text>
        </AnimatedPressable>
      )}
    </AnimatedPressable>
  );
}

export default function SearchScreen() {
  const router = useRouter();
  const { goToTab } = useTabNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const followUser = useAuthStore((s) => s.followUser);
  const unfollowUser = useAuthStore((s) => s.unfollowUser);
  const t = useTranslation();

  const [query_, setQuery_] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query_.trim().length < 2) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      const found = await searchUsers(query_);
      setResults(found);
      setIsSearching(false);
    }, 350);
  }, [query_]);

  const handleFollow = async (result: UserResult) => {
    if (!user) return;
    haptics.light();
    const following = user.following?.includes(result.uid);
    if (following) {
      await unfollowUser(result.uid);
    } else {
      await followUser(result.uid, result.name, result.avatarColor);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.borderStrong }]}>
        <AnimatedPressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>←</Text>
        </AnimatedPressable>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={colors.textHint}
            value={query_}
            onChangeText={setQuery_}
            autoFocus
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query_.length > 0 && (
            <AnimatedPressable onPress={() => setQuery_('')}>
              <Text style={[styles.clearIcon, { color: colors.textHint }]}>✕</Text>
            </AnimatedPressable>
          )}
        </View>
      </View>

      {isSearching ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : results.length === 0 ? (
        <View style={styles.empty}>
          {query_.trim().length < 2 ? (
            <>
              <Text style={styles.emptyEmoji}>👥</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.searchEmptyHint}</Text>
            </>
          ) : (
            <>
              <Text style={styles.emptyEmoji}>🤷</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.searchNotFound(query_)}</Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 48 }]}
          renderItem={({ item }) => (
            <UserCard
              result={item}
              isMe={item.uid === user?.id}
              isFollowing={user?.following?.includes(item.uid) ?? false}
              onPress={() => {
                if (item.uid === user?.id) {
                  router.navigate('/(app)');
                  // PagerView.setPage() is unreliable while the tab screen isn't
                  // focused/visible yet — give the navigation a tick to land first.
                  setTimeout(() => goToTab(4), 50);
                } else router.push(`/(app)/user/${item.uid}` as any);
              }}
              onFollow={() => handleFollow(item)}
              followLabel={t.searchFollow}
              followingLabel={t.searchFollowing}
              userMetaLabel={t.searchUserMeta(item.followersCount, item.eventsCount)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, borderBottomWidth: 2, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 22, fontWeight: FontWeight.bold },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.full, borderWidth: 1.5, paddingHorizontal: Spacing.md, height: 42, gap: 8 },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: FontSize.sm },
  clearIcon: { fontSize: 14, paddingLeft: 4 },
  list: { padding: Spacing.lg, gap: Spacing.sm },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: Spacing.xl },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },
  // Card
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md, borderRadius: BorderRadius.xl, borderWidth: 2.5, ...Shadow.sm },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1, overflow: 'hidden' },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarInitials: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  cardInfo: { flex: 1 },
  cardName: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  cardUni: { fontSize: FontSize.xs },
  cardMeta: { fontSize: FontSize.xs, marginTop: 2 },
  followBtn: { paddingHorizontal: Spacing.md, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 2, flexShrink: 0 },
  followBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
});
