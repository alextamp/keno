import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  ActivityIndicator, Image, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { UIFontLight, TitleFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useGroupsStore } from '@/features/groups/presentation/store/groups.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { GroupEntity } from '@/features/groups/domain/entities/group.entity';
import { useTranslation } from '@/core/i18n';
import { sounds } from '@/core/utils/sounds';
import { usePreferencesStore } from '@/core/store/preferences.store';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { FadeInView } from '@/components/ui/FadeInView';
import { Tag } from '@/components/ui/Tag';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

// Groups keep their own user-chosen emoji + coverColor as the cover visual
// (not a DuotoneScene illustration) — that's user-generated content per
// spec rule 2, and it's the one visual identity a group's creator picks for
// it. GroupThumb/GroupHeroCard below reuse that identity at the mock's two
// anatomy sizes (full hero banner vs. compact row thumb). A creator-uploaded
// coverPhotoUri takes over the whole background when set; the emoji still
// shows as a small badge so the group keeps a recognizable icon either way.
function GroupThumb({ group, size = 50 }: { group: GroupEntity; size?: number }) {
  return (
    <View style={[styles.thumb, { width: size, height: size, backgroundColor: group.coverColor, overflow: 'hidden' }]}>
      {group.coverPhotoUri && <Image source={{ uri: group.coverPhotoUri }} style={StyleSheet.absoluteFillObject} />}
      {!group.coverPhotoUri && <Text style={{ fontSize: size * 0.44 }}>{group.emoji}</Text>}
    </View>
  );
}

function GroupHeroCard({ group, onPress }: { group: GroupEntity; onPress: () => void }) {
  const { colors } = useTheme();
  const t = useTranslation();
  return (
    <AnimatedPressable onPress={onPress}>
      <Card style={styles.heroCard}>
        <View style={[styles.heroBanner, { backgroundColor: group.coverColor }]}>
          {group.coverPhotoUri ? (
            <Image source={{ uri: group.coverPhotoUri }} style={StyleSheet.absoluteFillObject} />
          ) : (
            <Text style={styles.heroEmoji}>{group.emoji}</Text>
          )}
        </View>
        <View style={styles.heroBody}>
          <Text style={[styles.heroName, { color: colors.textPrimary }]} numberOfLines={1}>{group.name}</Text>
          <View style={styles.heroFooter}>
            <View style={styles.metaItem}>
              <Icon name="users" size={13} color={colors.textHint} />
              <Text style={[styles.metaText, { color: colors.textHint }]}>{t.groupsMembers(group.memberIds.length)}</Text>
            </View>
            <Tag label={t.groupsEvents(group.eventIds.length)} variant="neutral" />
          </View>
        </View>
      </Card>
    </AnimatedPressable>
  );
}

function GroupRow({
  group, onPress, onPressIn, action, isFirst,
}: { group: GroupEntity; onPress: () => void; onPressIn?: () => void; action?: React.ReactNode; isFirst?: boolean }) {
  const { colors } = useTheme();
  const t = useTranslation();
  return (
    <AnimatedPressable onPress={onPress} onPressIn={onPressIn} style={[styles.row, !isFirst && { borderTopWidth: 1, borderTopColor: colors.border }]}>
      <GroupThumb group={group} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowName, { color: colors.textPrimary }]} numberOfLines={1}>{group.name}</Text>
        <Text style={[styles.rowMeta, { color: colors.textHint }]} numberOfLines={1}>
          {t.groupsMembers(group.memberIds.length)} · {t.groupsEvents(group.eventIds.length)}
        </Text>
      </View>
      {action ?? <Icon name="fwd" size={16} color={colors.textDecor} />}
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
  const joinGroup = useGroupsStore((s) => s.joinGroup);
  const t = useTranslation();

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Touch-driven hero card for "ΟΙ ΟΜΑΔΕΣ ΜΟΥ": landing a finger on a
  // compact row instantly promotes it to the hero (with a click sound),
  // mirroring the same interaction as the Feed screen.
  const [heroId, setHeroId] = useState<string | null>(null);
  const dynamicHeroEnabled = usePreferencesStore((s) => s.dynamicHeroEnabled);
  const becomeHero = useCallback((id: string) => {
    if (!dynamicHeroEnabled) return;
    setHeroId((prev) => {
      if (prev === id) return prev;
      sounds.play('click').catch(() => {});
      return id;
    });
  }, [dynamicHeroEnabled]);

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

  const handleJoin = async (groupId: string) => {
    if (!user) return;
    setJoiningId(groupId);
    await joinGroup(groupId, user.id);
    setJoiningId(null);
  };

  const query = search.trim().toLowerCase();
  const matches = (g: GroupEntity) =>
    !query ||
    g.name.toLowerCase().includes(query) ||
    g.description.toLowerCase().includes(query) ||
    (g.universityName ?? '').toLowerCase().includes(query);

  const myGroupIds = new Set(myGroups.map((g) => g.id));
  const filteredMine = myGroups.filter(matches);
  const suggested = publicGroups.filter((g) => !myGroupIds.has(g.id) && matches(g));
  const nothingAtAll = myGroups.length === 0 && publicGroups.length === 0;

  // Default the hero to the first "my group" once loaded, or whenever the
  // active hero falls out of the (filtered) list — after that it's purely
  // scroll-driven.
  useEffect(() => {
    if (!filteredMine.length) { setHeroId(null); return; }
    if (!heroId || !filteredMine.some((g) => g.id === heroId)) {
      setHeroId(filteredMine[0].id);
    }
  }, [filteredMine, heroId]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.head, { paddingTop: insets.top + 14 }]}>
        <ScreenHeader
          title={t.groupsTitle}
          right={user ? (
            <AnimatedPressable
              onPress={() => router.push('/(app)/group/create' as any)}
              style={[styles.createBtn, { backgroundColor: colors.primary }]}
            >
              <Icon name="plus" size={18} color="#fff" />
            </AnimatedPressable>
          ) : undefined}
        />
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="search" size={16} color={colors.textHint} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder={t.groupsSearchPlaceholder}
            placeholderTextColor={colors.textHint}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <AnimatedPressable onPress={() => setSearch('')} hitSlop={8}>
              <Icon name="x" size={15} color={colors.textHint} />
            </AnimatedPressable>
          )}
        </View>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : nothingAtAll ? (
        <View style={styles.empty}>
          <Icon name="globe" size={40} color={colors.textDecor} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.groupsEmptyDiscover}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          {/* ── ΟΙ ΟΜΑΔΕΣ ΜΟΥ (mockup 29): one full hero card, then compact
              rows — which group is the hero is now touch-driven (heroId):
              landing a finger on a row promotes it, instead of it always
              being filteredMine[0]. ── */}
          {filteredMine.length > 0 && (() => {
            const heroIndex = filteredMine.findIndex((g) => g.id === heroId);
            const heroGroup = heroIndex === -1 ? filteredMine[0] : filteredMine[heroIndex];
            // Rows keep their original position relative to the hero (same
            // as the Feed screen): whichever group becomes the hero swaps in
            // place instead of jumping to the top of the section.
            const before = filteredMine.slice(0, heroIndex === -1 ? 0 : heroIndex);
            const after = filteredMine.slice(heroIndex === -1 ? 1 : heroIndex + 1);
            return (
              <View style={styles.section}>
                <SectionLabel label={t.groupsMySection} style={styles.sectionLabel} />
                {before.length > 0 && (
                  <Card style={styles.rowsCard}>
                    {before.map((g, i) => (
                      <FadeInView key={g.id}>
                        <GroupRow
                          group={g}
                          isFirst={i === 0}
                          onPress={() => router.push(`/(app)/group/${g.id}` as any)}
                          onPressIn={() => becomeHero(g.id)}
                        />
                      </FadeInView>
                    ))}
                  </Card>
                )}
                {/* `key` forces a fresh mount (and re-triggers the fade/pop-in)
                    whenever a different group becomes the hero. */}
                <FadeInView key={heroGroup.id}>
                  <GroupHeroCard group={heroGroup} onPress={() => router.push(`/(app)/group/${heroGroup.id}` as any)} />
                </FadeInView>
                {after.length > 0 && (
                  <Card style={styles.rowsCard}>
                    {after.map((g, i) => (
                      <FadeInView key={g.id}>
                        <GroupRow
                          group={g}
                          isFirst={i === 0}
                          onPress={() => router.push(`/(app)/group/${g.id}` as any)}
                          onPressIn={() => becomeHero(g.id)}
                        />
                      </FadeInView>
                    ))}
                  </Card>
                )}
              </View>
            );
          })()}

          {/* ── ΠΡΟΤΕΙΝΟΜΕΝΕΣ: compact rows with a small Join button ── */}
          <View style={styles.section}>
            <SectionLabel label={t.groupsSuggestedSection} style={styles.sectionLabel} />
            {suggested.length === 0 ? (
              <Text style={[styles.emptyInline, { color: colors.textHint }]}>
                {search ? t.groupsEmptySearch : t.groupsEmptyMine}
              </Text>
            ) : (
              <Card style={styles.rowsCard}>
                {suggested.map((g, i) => (
                  <GroupRow
                    key={g.id}
                    group={g}
                    isFirst={i === 0}
                    onPress={() => router.push(`/(app)/group/${g.id}` as any)}
                    action={user ? (
                      <Button
                        label={t.groupsJoinBtn}
                        variant="outline"
                        size="sm"
                        loading={joiningId === g.id}
                        onPress={() => handleJoin(g.id)}
                      />
                    ) : undefined}
                  />
                ))}
              </Card>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.sm, gap: Spacing.base },
  createBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, height: 42, gap: 8,
  },
  searchInput: { flex: 1, fontSize: FontSize.base, fontFamily: UIFontLight },
  list: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.base, gap: Spacing.lg },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: 12 },
  emptyText: { fontSize: FontSize.base, textAlign: 'center', fontFamily: UIFontLight },
  emptyInline: { fontSize: FontSize.base, fontFamily: UIFontLight, paddingVertical: Spacing.base },
  // Section
  section: { gap: Spacing.sm },
  sectionLabel: { marginBottom: 2 },
  // Hero card (first "my group")
  heroCard: {},
  heroBanner: { height: 90, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  heroEmoji: { fontSize: 40 },
  heroBody: { padding: Spacing.md, gap: 7 },
  heroName: { fontSize: FontSize.lg, fontWeight: FontWeight.semibold, fontFamily: TitleFont },
  heroFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  // Compact rows
  rowsCard: { paddingHorizontal: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  thumb: { borderRadius: BorderRadius.xs, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { fontSize: FontSize.base, fontWeight: FontWeight.semibold, fontFamily: TitleFont },
  rowMeta: { fontSize: FontSize.sm, fontFamily: UIFontLight },
});
