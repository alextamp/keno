import React, { useEffect, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  ActivityIndicator, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { useGroupsStore } from '@/features/groups/presentation/store/groups.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { GroupEntity } from '@/features/groups/domain/entities/group.entity';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { universityLabel } from '@/core/constants/universities';

function GroupCard({ group, isMember, onPress }: { group: GroupEntity; isMember: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  return (
    <AnimatedPressable onPress={onPress}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
        {/* Colored top bar */}
        <View style={[styles.cardBanner, { backgroundColor: group.coverColor }]}>
          <Text style={styles.cardEmoji}>{group.emoji}</Text>
          {isMember && (
            <View style={[styles.memberBadge, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Text style={styles.memberBadgeText}>{t.groupsMemberBadge}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={[styles.cardName, { color: colors.textPrimary }]} numberOfLines={1}>
            {group.name}
          </Text>
          {group.universityName && (
            <Text style={[styles.cardUni, { color: colors.textSecondary }]} numberOfLines={1}>
              🎓 {universityLabel(group.universityName, language)}
            </Text>
          )}
          <Text style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={2}>
            {group.description}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={[styles.cardMeta, { color: colors.textHint }]}>
              👥 {t.groupsMembers(group.memberIds.length)}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.textHint }]}>
              📅 {t.groupsEvents(group.eventIds.length)}
            </Text>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

export default function GroupsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const publicGroups = useGroupsStore((s) => s.publicGroups);
  const myGroups = useGroupsStore((s) => s.myGroups);
  const isLoading = useGroupsStore((s) => s.isLoading);
  const loadPublicGroups = useGroupsStore((s) => s.loadPublicGroups);
  const loadMyGroups = useGroupsStore((s) => s.loadMyGroups);
  const t = useTranslation();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'discover' | 'mine'>('discover');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPublicGroups();
    if (user) loadMyGroups(user.id);
  }, [user?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPublicGroups();
    if (user) await loadMyGroups(user.id);
    setRefreshing(false);
  };

  const query = search.trim().toLowerCase();
  const sourceGroups = tab === 'mine' ? myGroups : publicGroups;
  const filtered = query
    ? sourceGroups.filter((g) =>
        g.name.toLowerCase().includes(query) ||
        g.description.toLowerCase().includes(query) ||
        (g.universityName ?? '').toLowerCase().includes(query),
      )
    : sourceGroups;

  const myGroupIds = new Set(myGroups.map((g) => g.id));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.borderStrong }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t.groupsTitle}</Text>
          {user && (
            <AnimatedPressable
              onPress={() => router.push('/(app)/group/create' as any)}
              style={[styles.createBtn, { backgroundColor: colors.primary, borderColor: colors.borderStrong }]}
            >
              <Text style={styles.createBtnText}>{t.groupsNewBtn}</Text>
            </AnimatedPressable>
          )}
        </View>
        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
          {(['discover', 'mine'] as const).map((tabKey) => (
            <AnimatedPressable
              key={tabKey}
              onPress={() => setTab(tabKey)}
              style={[styles.tabBtn, tab === tabKey && { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
            >
              <Text style={[styles.tabText, { color: tab === tabKey ? colors.primary : colors.textSecondary }]}>
                {tabKey === 'discover' ? t.groupsTabDiscover : t.groupsTabMine(myGroups.length)}
              </Text>
            </AnimatedPressable>
          ))}
        </View>
        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder={t.groupsSearchPlaceholder}
            placeholderTextColor={colors.textHint}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <AnimatedPressable onPress={() => setSearch('')}>
              <Text style={[styles.searchClear, { color: colors.textHint }]}>✕</Text>
            </AnimatedPressable>
          )}
        </View>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{tab === 'mine' ? '👥' : '🌐'}</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {tab === 'mine'
                  ? t.groupsEmptyMine
                  : search ? t.groupsEmptySearch : t.groupsEmptyDiscover}
              </Text>
            </View>
          ) : (
            filtered.map((g) => (
              <GroupCard
                key={g.id}
                group={g}
                isMember={myGroupIds.has(g.id)}
                onPress={() => router.push(`/(app)/group/${g.id}` as any)}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, borderBottomWidth: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  createBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 8,
    borderRadius: BorderRadius.full, borderWidth: 2.5,
  },
  createBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  tabs: { flexDirection: 'row', borderRadius: BorderRadius.lg, borderWidth: 1.5, overflow: 'hidden', marginBottom: 10 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: BorderRadius.lg, borderWidth: 0 },
  tabText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.full, borderWidth: 1.5,
    paddingHorizontal: Spacing.md, height: 40, gap: 8,
    marginBottom: 4,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, fontSize: FontSize.sm },
  searchClear: { fontSize: 14, paddingLeft: 4 },
  list: { padding: Spacing.lg, gap: Spacing.md },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: FontSize.md, textAlign: 'center' },
  // Card
  card: { borderRadius: BorderRadius.xl, borderWidth: 2.5, overflow: 'hidden', ...Shadow.sm },
  cardBanner: { height: 70, alignItems: 'flex-start', justifyContent: 'space-between', flexDirection: 'row', padding: Spacing.md },
  cardEmoji: { fontSize: 32 },
  memberBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full, justifyContent: 'center' },
  memberBadgeText: { color: '#fff', fontSize: 11, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  cardBody: { padding: Spacing.md, gap: 4 },
  cardName: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  cardUni: { fontSize: FontSize.xs },
  cardDesc: { fontSize: FontSize.sm, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
  cardMeta: { fontSize: FontSize.xs },
});
