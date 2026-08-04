import React, { useEffect, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  ActivityIndicator, FlatList, Image,
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
import { UIFont, UIFontLight, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { haptics } from '@/core/utils/haptics';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { SectionLabel } from '@/components/ui/SectionLabel';

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
  profileVisibility?: 'students' | 'connections';
  followers: string[];
  following: string[];
}

// "Ποιοι με βλέπουν" (Settings → who can see me): 'connections' restricts a
// profile to people it has a *mutual* follow with — one-way followers don't
// count, matching how Connections is defined on the profile screen.
function isVisibleTo(result: UserResult, viewerUid: string | undefined): boolean {
  if (!viewerUid || result.uid === viewerUid) return true;
  if (result.profileVisibility !== 'connections') return true;
  return result.followers.includes(viewerUid) && result.following.includes(viewerUid);
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
          avatarColor: data.avatarColor ?? '#B8482A',
          photoUri: data.photoUri,
          bio: data.bio,
          followersCount: (data.followers ?? []).length,
          eventsCount: (data.joinedEvents ?? []).length,
          profileVisibility: data.profileVisibility,
          followers: data.followers ?? [],
          following: data.following ?? [],
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
        avatarColor: data.avatarColor ?? '#B8482A',
        photoUri: data.photoUri,
        bio: data.bio,
        followersCount: (data.followers ?? []).length,
        eventsCount: (data.joinedEvents ?? []).length,
        profileVisibility: data.profileVisibility,
        followers: data.followers ?? [],
        following: data.following ?? [],
      };
    })
    .filter((u) =>
      u.name.toLowerCase().includes(lower) ||
      u.universityName.toLowerCase().includes(lower) ||
      u.department.toLowerCase().includes(lower),
    )
    .slice(0, 30);
}

function UserCard({ result, isMe, isFollowing, onPress, onFollow, followLabel, followingLabel }: {
  result: UserResult;
  isMe: boolean;
  isFollowing: boolean;
  onPress: () => void;
  onFollow: () => void;
  followLabel: string;
  followingLabel: string;
}) {
  const { colors } = useTheme();
  const { language } = useLanguageStore();
  const initials = result.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <AnimatedPressable onPress={onPress} style={styles.card}>
      <View style={styles.cardLeft}>
        {result.photoUri ? (
          <Image source={{ uri: result.photoUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: result.avatarColor }]}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>{result.name}</Text>
          <Text style={[styles.cardUni, { color: colors.textHint }]} numberOfLines={1}>
            {universityLabel(result.universityName, language)}
          </Text>
        </View>
      </View>
      {!isMe && (
        <Button
          label={isFollowing ? followingLabel : followLabel}
          variant={isFollowing ? 'outline' : 'primary'}
          size="sm"
          shape="pill"
          onPress={onFollow}
        />
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
      setResults(found.filter((r) => isVisibleTo(r, user?.id)));
      setIsSearching(false);
    }, 350);
  }, [query_, user?.id]);

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
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <AnimatedPressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="back" size={16} color={colors.textPrimary} />
        </AnimatedPressable>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          <Icon name="search" size={15} color={colors.textHint} />
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
            <AnimatedPressable onPress={() => setQuery_('')} hitSlop={8}>
              <Icon name="x" size={14} color={colors.textHint} />
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
              <Icon name="users" size={40} color={colors.textDecor} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.searchEmptyHint}</Text>
            </>
          ) : (
            <>
              <Icon name="search" size={40} color={colors.textDecor} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.searchNotFound(query_)}</Text>
            </>
          )}
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 48 }]}
          ListHeaderComponent={<SectionLabel label={t.searchPeopleLabel} style={styles.sectionLabel} />}
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
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  backBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, height: 42, gap: 8 },
  searchInput: { flex: 1, fontSize: FontSize.base, fontFamily: UIFontLight },
  list: { padding: Spacing.gutter, gap: Spacing.sm },
  sectionLabel: { marginBottom: Spacing.xs },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: Spacing.xl },
  emptyText: { fontSize: FontSize.base, fontFamily: UIFontLight, textAlign: 'center', lineHeight: 21 },
  // Card
  card: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1, overflow: 'hidden' },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarInitials: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  cardInfo: { flex: 1 },
  cardName: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  cardUni: { fontSize: FontSize.sm, fontFamily: UIFontLight, marginTop: 1 },
});
