import React, { useEffect, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  ActivityIndicator, FlatList, Image, Keyboard,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { haptics } from '@/core/utils/haptics';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { queryUsersByNamePrefix } from '@/core/utils/userSearch';

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
  const docs = await queryUsersByNamePrefix(q, 30);
  return docs.map((d) => {
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

interface PeopleSearchViewProps {
  /** Called with the tapped result's uid — the caller decides where "view
   *  this person" navigates to, since that differs for "it's me" (jump to
   *  the profile tab) vs. everyone else (push their profile screen). */
  onPressUser: (uid: string) => void;
  autoFocus?: boolean;
}

// Shared guts of "search for a specific person" — used standalone by
// app/(app)/search.tsx and embedded as the "Άτομα" tab on the
// Communities screen (GroupsTab), so the two entry points never drift.
export function PeopleSearchView({ onPressUser, autoFocus = false }: PeopleSearchViewProps) {
  const { colors } = useTheme();
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
    <View style={styles.root}>
      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Icon name="search" size={16} color={colors.textHint} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder={t.searchPlaceholder}
          placeholderTextColor={colors.textHint}
          value={query_}
          onChangeText={setQuery_}
          autoFocus={autoFocus}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {query_.length > 0 && (
          <AnimatedPressable onPress={() => setQuery_('')} hitSlop={8}>
            <Icon name="x" size={14} color={colors.textHint} />
          </AnimatedPressable>
        )}
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
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <UserCard
              result={item}
              isMe={item.uid === user?.id}
              isFollowing={user?.following?.includes(item.uid) ?? false}
              onPress={() => onPressUser(item.uid)}
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
  searchBox: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: Spacing.gutter, marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, height: 42, gap: 8,
  },
  searchInput: { flex: 1, fontSize: FontSize.base, fontFamily: UIFontLight },
  list: { paddingHorizontal: Spacing.gutter, paddingBottom: 24, gap: Spacing.sm },
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
