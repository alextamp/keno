import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Alert, FlatList, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { format } from 'date-fns';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, TitleFont, LogoFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { EventCategory, EventEntity, isAttending, isEventFull, isEventPast } from '@/features/events/domain/entities/event.entity';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useNotificationsStore } from '@/features/notifications/notifications.store';
import { useDmUnreadStore } from '@/core/store/dmUnread.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { isLeft } from '@/core/utils/either';
import { EventCard } from '@/components/ui/EventCard';
import { FadeInView } from '@/components/ui/FadeInView';
import { EventCardSkeleton } from '@/components/ui/Skeleton';
import { Icon, IconName } from '@/components/ui/Icon';
import { DuotoneScene } from '@/components/ui/DuotoneScene';
import { Tag } from '@/components/ui/Tag';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { FilterSheet, FeedRadius, FeedWhen } from '@/components/ui/FilterSheet';
import { haptics } from '@/core/utils/haptics';
import { sounds } from '@/core/utils/sounds';
import { useLanguageStore, getDateLocale, useTranslation } from '@/core/i18n';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { haversineKm, matchesWhenBucket } from '@/core/utils/geo';
import { usePreferencesStore } from '@/core/store/preferences.store';
import { INTEREST_MATCH_KEYWORDS } from '@/core/constants/interests';

const FILTER_DEFS: { value: EventCategory | null; key: string }[] = [
  { key: 'catAll',    value: null },
  { key: 'catParty',  value: EventCategory.Party },
  { key: 'catSports', value: EventCategory.Sports },
  { key: 'catStudy',  value: EventCategory.Study },
  { key: 'catChill',  value: EventCategory.Chill },
  { key: 'catCoffee', value: EventCategory.Coffee },
  { key: 'catOther',  value: EventCategory.Other },
];

// Only a few picked interests (Sports/Study/Coffee) share a name with an
// EventCategory — everything else (Gaming, Hiking, Chess, ...) has no
// category counterpart at all, so relying on category alone left most of
// the 16 signup interests never affecting sort order. Searching the event's
// own title/description against each interest's keyword stems
// (INTEREST_MATCH_KEYWORDS) gives every interest a real shot at matching.
function interestScore(event: EventEntity, interests: string[]): number {
  if (!interests.length) return 0;
  const haystack = [event.category as string, event.customCategory ?? '', event.title, event.description]
    .join(' ')
    .toLowerCase();
  return interests.filter((i) => {
    const keywords = INTEREST_MATCH_KEYWORDS[i] ?? [i.toLowerCase()];
    return keywords.some((kw) => haystack.includes(kw));
  }).length;
}

function FilterChip({ label, icon, active, onPress }: { label: string; icon?: IconName; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable onPress={onPress}>
      <View style={[
        styles.chip,
        { backgroundColor: active ? colors.accentSoft : colors.surface, borderColor: active ? colors.primary : colors.border },
      ]}>
        {icon && <Icon name={icon} size={13} color={active ? colors.accentInk : colors.textSecondary} />}
        <Text style={[styles.chipText, { color: active ? colors.accentInk : colors.textSecondary, fontWeight: active ? FontWeight.semibold : FontWeight.medium }]}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
}

// Warm Paper compact feed row (spec §6 "then compact rows"): 50px duotone
// thumb + Strong title + Meta line + trailing chevron/full-tag. Everything
// but the feed's first (hero) card renders this way.
function FeedRow({ event, isJoined, isFirstRow, onPress, onPressIn }: { event: EventEntity; isJoined: boolean; isFirstRow: boolean; onPress: () => void; onPressIn: () => void }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const dateLocale = getDateLocale(language);
  const full = isEventFull(event);
  const metaLine = `${format(event.dateTime, 'EEE d MMM, HH:mm', { locale: dateLocale })} · ${event.location}`;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      scaleTo={0.98}
      style={[styles.row, isFirstRow ? styles.rowFirst : { borderTopWidth: 1, borderTopColor: colors.border }]}
    >
      {event.imageUri ? (
        <Image source={{ uri: event.imageUri }} style={styles.rowThumb} resizeMode="cover" />
      ) : (
        <DuotoneScene category={event.category} height={50} style={styles.rowThumb} />
      )}
      <View style={styles.rowInfo}>
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>{event.title}</Text>
        <Text style={[styles.rowMeta, { color: colors.textHint }]} numberOfLines={1}>{metaLine}</Text>
      </View>
      {full && !isJoined ? (
        <Tag label={t.eventFull} variant="neutral" />
      ) : (
        <Icon name="fwd" size={15} color={colors.textDecor} />
      )}
    </AnimatedPressable>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const events = useEventsStore((s) => s.events);
  const isLoading = useEventsStore((s) => s.isLoading);
  const setEvents = useEventsStore((s) => s.setEvents);
  const setLoading = useEventsStore((s) => s.setLoading);
  const setError = useEventsStore((s) => s.setError);
  const user = useAuthStore((s) => s.user);
  const saveEvent = useAuthStore((s) => s.saveEvent);
  const unsaveEvent = useAuthStore((s) => s.unsaveEvent);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const dmUnreadCount = useDmUnreadStore((s) => s.unreadCount);
  const { language } = useLanguageStore();
  const t = useTranslation();
  const FILTERS = FILTER_DEFS.map((f) => ({ ...f, label: t[f.key as keyof typeof t] as string }));

  const [selected, setSelected] = useState<EventCategory | null>(null);
  const [otherSearch, setOtherSearch] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [forYouSort, setForYouSort] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, UserProfile>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Touch-driven hero card (replaces the old "index === 0 is always the
  // hero" rule): landing a finger on a compact row instantly promotes that
  // event to the hero (with a click sound), and whatever was previously the
  // hero drops back down to a compact row.
  const [heroId, setHeroId] = useState<string | null>(null);
  const dynamicHeroEnabled = usePreferencesStore((s) => s.dynamicHeroEnabled);
  const becomeHero = useCallback((id: string) => {
    // Setting-gated (Settings → Preferences → "Dynamic card expand"): when
    // off, the hero card stays put — the feed reads as a normal static
    // list — instead of promoting whatever row you touch.
    if (!dynamicHeroEnabled) return;
    setHeroId((prev) => {
      if (prev === id) return prev;
      sounds.play('click').catch(() => {});
      return id;
    });
  }, [dynamicHeroEnabled]);

  // Filter bottom-sheet state (mockup 10 · design/screens.html "10 · Φίλτρα").
  // These are refinement filters that combine with whatever category/search
  // view is active — they're independent of the segmented category tabs.
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [radiusKm, setRadiusKm] = useState<FeedRadius>(null);
  const [when, setWhen] = useState<FeedWhen>(null);
  const [uniOnly, setUniOnly] = useState(false);
  const [soloFriendly, setSoloFriendly] = useState(false);
  const hasActiveFilters = radiusKm != null || when != null || uniOnly || soloFriendly;

  useEffect(() => {
    if (!user?.following?.length) return;
    fetchUserProfiles(user.following).then(setFriendProfiles);
  }, [user?.following?.join(',')]);

  useEffect(() => {
    setLoading(true);
    const unsub = eventsRepository.subscribeToFeedEvents(
      (freshEvents) => { setEvents(freshEvents); setLoading(false); },
      () => { setError('Failed to load events.'); setLoading(false); },
    );
    return () => { unsub(); };
  }, []);

  // A distance chip was picked in the filter sheet — request location (once)
  // before applying the radius, same permission flow the old "Nearby" chip used.
  const handleRadiusChange = useCallback(async (next: FeedRadius) => {
    if (next == null || userLocation) {
      setRadiusKm(next);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Location Required',
        'Enable location access in Settings to find nearby events.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => Linking.openSettings() }],
      );
      return;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setUserLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude });
    setRadiusKm(next);
  }, [userLocation]);

  const clearFilterSheet = useCallback(() => {
    setRadiusKm(null);
    setWhen(null);
    setUniOnly(false);
    setSoloFriendly(false);
  }, []);

  const handleSelectFilter = (value: EventCategory | null) => {
    haptics.light();
    setSelected(value);
    setOtherSearch('');
    setFriendsOnly(false);
  };

  const closeSearch = () => { setSearchActive(false); setSearchQuery(''); };

  const handleRefresh = async () => {
    setRefreshing(true);
    eventsRepository.getFeedEvents().then((r) => {
      if (!isLeft(r)) setEvents(r.right);
      setRefreshing(false);
    });
  };

  const now = new Date();
  const following = user?.following ?? [];
  const userInterests: string[] = (user as any)?.interests ?? [];

  const filtered = useMemo(() => {
    let list = events.filter((e) => {
      if (isEventPast(e)) return false;
      if (friendsOnly && !following.includes(e.creatorId)) return false;
      // Filter sheet: ΑΠΟΣΤΑΣΗ
      if (radiusKm != null && userLocation) {
        if ((e as any).latitude == null || (e as any).longitude == null) return false;
        const dist = haversineKm(userLocation.lat, userLocation.lon, (e as any).latitude, (e as any).longitude);
        if (dist > radiusKm) return false;
      }
      // Filter sheet: ΠΟΤΕ
      if (when && !matchesWhenBucket(e.dateTime, when, now)) return false;
      // Filter sheet: ΠΟΙΟΙ — "Από τη σχολή μου"
      if (uniOnly && user?.universityName) {
        const fromMyUni = e.creatorUniversity === user.universityName || (e.allowedUniversities ?? []).includes(user.universityName);
        if (!fromMyUni) return false;
      }
      // Filter sheet: ΠΟΙΟΙ — "Έρχονται μόνοι" (nobody you follow is going yet — good for meeting new people)
      if (soloFriendly && e.attendeeIds.some((uid) => following.includes(uid))) return false;
      // Age/university restrictions the event creator set — hide events the
      // signed-in user isn't eligible for (creator always sees their own).
      if (user && e.creatorId !== user.id) {
        if (user.age && e.minAge != null && user.age < e.minAge) return false;
        if (user.age && e.maxAge != null && user.age > e.maxAge) return false;
        if (user.universityName && (e.allowedUniversities?.length ?? 0) > 0 && !e.allowedUniversities!.includes(user.universityName)) return false;
      }
      // Blocked users' events disappear from the feed instantly.
      if (user?.blockedUserIds?.includes(e.creatorId)) return false;
      if (selected && e.category !== selected) return false;
      if (selected === EventCategory.Other && otherSearch.trim()) {
        const q = otherSearch.trim().toLowerCase();
        if (!(e.customCategory ?? '').toLowerCase().includes(q)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!e.title.toLowerCase().includes(q) && !e.location.toLowerCase().includes(q) && !(e.customCategory ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });

    if (forYouSort && userInterests.length) {
      list = [...list].sort((a, b) => interestScore(b, userInterests) - interestScore(a, userInterests));
    }
    return list;
  }, [events, friendsOnly, radiusKm, when, uniOnly, soloFriendly, userLocation, selected, otherSearch, searchQuery, forYouSort, userInterests, user?.id, user?.age, user?.universityName, user?.blockedUserIds, following]);

  // Zero-state (mockup 05): a brand-new user — hasn't joined or created
  // anything yet — gets a curated "3 things happening near you" framing
  // instead of the standard tabs/filters feed. Reverts automatically once
  // they join their first event. Only takes over the default view (no
  // active search or explicit filtering).
  //
  // "Near you" has to be a real distance filter, not just "whatever 3
  // events happen to be first in the list" — otherwise the copy below
  // ("within 5 km") is a lie for anyone whose closest match is actually
  // across town. If we don't know the user's location, or nothing is
  // genuinely within range, this naturally comes out empty and the feed
  // below falls through to the regular, unrestricted experience instead of
  // stranding a first-time user on a page with nothing on it.
  const ZERO_STATE_RADIUS_KM = 5;
  const nearbyUpcoming = useMemo(() => {
    if (!userLocation) return [];
    return filtered.filter((e) => {
      if ((e as any).latitude == null || (e as any).longitude == null) return false;
      return haversineKm(userLocation.lat, userLocation.lon, (e as any).latitude, (e as any).longitude) <= ZERO_STATE_RADIUS_KM;
    });
  }, [filtered, userLocation]);
  const isNewUser = !!user && (user.joinedEvents?.length ?? 0) === 0 && (user.createdEvents?.length ?? 0) === 0;
  const showZeroState =
    isNewUser && !searchActive && !selected && !friendsOnly && !forYouSort && !hasActiveFilters && nearbyUpcoming.length > 0;
  const zeroStateItems = showZeroState ? nearbyUpcoming.slice(0, 3) : filtered;

  // Default the hero to the first item once data loads (or whenever the
  // active hero falls out of the current list, e.g. after a filter change)
  // — after that, scroll position alone drives it.
  useEffect(() => {
    if (!zeroStateItems.length) return;
    if (!heroId || !zeroStateItems.some((i) => i.id === heroId)) {
      setHeroId(zeroStateItems[0].id);
    }
  }, [zeroStateItems, heroId]);

  // Same touch-driven hero promotion as the main list, but for the
  // Opening Soon fallback rows — this was wired as a no-op there
  // (onPressIn={() => {}}), so "dynamic card expand" never did anything
  // for that section even though the setting/feature itself is identical.
  const [openingSoonHeroId, setOpeningSoonHeroId] = useState<string | null>(null);
  const becomeOpeningSoonHero = useCallback((id: string) => {
    if (!dynamicHeroEnabled) return;
    setOpeningSoonHeroId((prev) => {
      if (prev === id) return prev;
      sounds.play('click').catch(() => {});
      return id;
    });
  }, [dynamicHeroEnabled]);

  // "Keno Wednesdays" flagship pin (research doc #28) — admin-curated (see
  // edit/[id].tsx), shown above every filter/search state so it never
  // requires browsing. Store already drops anything more than 6h past its
  // start (subscribeToFeedEvents), so any flagship event still present here
  // is current by construction.
  const flagshipEvent = useMemo(() => events.find((e) => e.isFlagship) ?? null, [events]);

  const showOtherSearch = selected === EventCategory.Other;

  // Never show a dead empty screen (research doc #13) — but only ever with
  // *real* data: events genuinely opening in the next 48h, pulled straight
  // from the full unfiltered store, never a fabricated "X people nearby."
  // Only used for the generic "nothing matches your filters" case — the
  // friends-only and custom-search empty states already have their own
  // honest, specific copy and stay as-is.
  const OPENING_SOON_WINDOW_MS = 48 * 3600_000;
  const openingSoonFallback = useMemo(() => {
    const cutoff = new Date(now.getTime() + OPENING_SOON_WINDOW_MS);
    return events
      .filter((e) => e.dateTime >= now && e.dateTime <= cutoff && !user?.blockedUserIds?.includes(e.creatorId))
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime())
      .slice(0, 5);
  }, [events, user?.blockedUserIds]);
  const showOpeningSoonFallback =
    zeroStateItems.length === 0 && !friendsOnly && !(showOtherSearch && otherSearch) && openingSoonFallback.length > 0;

  useEffect(() => {
    if (!openingSoonFallback.length) return;
    if (!openingSoonHeroId || !openingSoonFallback.some((e) => e.id === openingSoonHeroId)) {
      setOpeningSoonHeroId(openingSoonFallback[0].id);
    }
  }, [openingSoonFallback, openingSoonHeroId]);

  const listHeader = (
    <>
      {/* Category text-tabs (spec §6: "text tabs (Όλα / Κοντά μου / Φίλοι / Αύριο)").
          Pinned to its natural height: SegmentedTabs' scrollable mode puts
          flexGrow:1 on its own contentContainerStyle (for centering short
          rows), which used to be harmless nested inside the FlatList header's
          plain content flow — now that this row is a flex sibling of the
          list itself (fixed category tags), that flexGrow reads as "fill the
          remaining column" instead, stretching the whole row into empty
          space. flexGrow/flexShrink: 0 here keeps it pinned regardless. */}
      <View style={{ flexGrow: 0, flexShrink: 0 }}>
        <SegmentedTabs
          tabs={FILTERS.map((f) => f.label)}
          activeIndex={FILTERS.findIndex((f) => !friendsOnly && selected === f.value)}
          onChange={(i) => handleSelectFilter(FILTERS[i].value)}
          scrollable
          style={styles.categoryTabs}
        />
      </View>

      {/* Secondary toggle chips (for-you/friends/filters) — one uniform row */}
      <View style={styles.filterRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <FilterChip label={t.feedForYou} icon="star" active={forYouSort} onPress={() => { haptics.light(); setForYouSort((v) => !v); }} />
          <FilterChip
            label={t.feedFriends} icon="users" active={friendsOnly}
            onPress={() => { haptics.light(); setFriendsOnly((v) => !v); setSelected(null); setOtherSearch(''); }}
          />
          <FilterChip
            label={t.feedFilters} icon="filter" active={hasActiveFilters}
            onPress={() => { haptics.light(); setFilterSheetVisible(true); }}
          />
        </ScrollView>
      </View>

      {/* For You no-interests hint */}
      {forYouSort && !userInterests.length && (
        <View style={[styles.forYouHint, { backgroundColor: colors.accentSoft }]}>
          <Icon name="star" size={13} color={colors.accentInk} />
          <Text style={[styles.forYouHintText, { color: colors.accentInk }]}>{t.feedForYouHint}</Text>
        </View>
      )}

      {/* Custom type search */}
      {showOtherSearch && (
        <View style={styles.otherSearchRow}>
          <View style={[styles.otherSearchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="search" size={15} color={colors.textHint} />
            <TextInput
              style={[styles.otherSearchInput, { color: colors.textPrimary }]}
              value={otherSearch}
              onChangeText={setOtherSearch}
              placeholder={t.feedSearchTypePlaceholder}
              placeholderTextColor={colors.textHint}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {otherSearch.length > 0 && (
              <AnimatedPressable onPress={() => setOtherSearch('')} hitSlop={8}>
                <Icon name="x" size={14} color={colors.textHint} />
              </AnimatedPressable>
            )}
          </View>
        </View>
      )}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 14 }]}>
        {searchActive ? (
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="search" size={16} color={colors.textHint} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t.feedSearchPlaceholder}
              placeholderTextColor={colors.textHint}
              autoFocus
              returnKeyType="search"
              autoCapitalize="none"
            />
            <AnimatedPressable onPress={closeSearch} hitSlop={8}>
              <Icon name="x" size={16} color={colors.textHint} />
            </AnimatedPressable>
          </View>
        ) : showZeroState ? (
          <View style={styles.headingBlock}>
            <Text style={[styles.headingTitle, { color: colors.textPrimary }]}>
              {t.feedZeroWelcome(user?.name?.split(' ')[0] ?? '')}
            </Text>
            <Text style={[styles.headingSubtitle, { color: colors.textHint }]}>
              {t.feedZeroSubtitle}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.headingBlock}>
              <Text style={[styles.wordmark, { color: colors.textPrimary }]} numberOfLines={1}>
                keno<Text style={{ color: colors.primary }}>.</Text>
              </Text>
            </View>
            <View style={styles.headerActions}>
              <AnimatedPressable onPress={() => router.push('/(app)/groups' as any)} style={styles.iconBtn}>
                <Icon name="users" size={19} color={colors.textPrimary} />
              </AnimatedPressable>
              <AnimatedPressable onPress={() => router.push('/(app)/notifications' as any)} style={styles.iconBtn}>
                <Icon name="bell" size={19} color={colors.textPrimary} />
                {unreadCount > 0 && (
                  <View style={[styles.topBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.topBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </AnimatedPressable>
              <AnimatedPressable onPress={() => router.push('/(app)/messages' as any)} style={styles.iconBtn}>
                <Icon name="chat" size={19} color={colors.textPrimary} />
                {dmUnreadCount > 0 && (
                  <View style={[styles.topBadge, { backgroundColor: colors.error }]}>
                    <Text style={styles.topBadgeText}>{dmUnreadCount > 9 ? '9+' : dmUnreadCount}</Text>
                  </View>
                )}
              </AnimatedPressable>
              <AnimatedPressable onPress={() => setSearchActive(true)} style={styles.iconBtn}>
                <Icon name="search" size={19} color={colors.textPrimary} />
              </AnimatedPressable>
            </View>
          </>
        )}
      </View>

      {flagshipEvent && !searchActive && (
        <AnimatedPressable
          onPress={() => router.push(`/(app)/event/${flagshipEvent.id}`)}
          style={[styles.flagshipBanner, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}
        >
          <Icon name="star" size={16} color={colors.primary} filled />
          <View style={{ flex: 1 }}>
            <Text style={[styles.flagshipBannerLabel, { color: colors.accentInk }]}>{t.feedFlagshipLabel}</Text>
            <Text style={[styles.flagshipBannerTitle, { color: colors.accentInk }]} numberOfLines={1}>{flagshipEvent.title}</Text>
          </View>
          <Icon name="fwd" size={15} color={colors.primary} />
        </AnimatedPressable>
      )}

      {/* Category tags + For You/Friends/Filters row — fixed above the list,
          not scrolled away with the events underneath it. */}
      {!showZeroState && listHeader}

      {isLoading ? (
        <FlatList
          key="feed-skeleton"
          style={{ flex: 1 }}
          data={[1, 2, 3]}
          keyExtractor={(item) => String(item)}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          renderItem={() => <EventCardSkeleton />}
        />
      ) : zeroStateItems.length === 0 ? (
        // FlatList's own ListEmptyComponent path doesn't reliably scroll once
        // its content (the opening-soon fallback cards) overflows the screen
        // — a known RN quirk where an empty `data` array leaves the list's
        // scroll metrics stuck near zero regardless of what actually renders.
        // Tapping a category tag with zero matching events hit exactly this,
        // so the empty state gets a plain ScrollView instead, which has no
        // such issue.
        <ScrollView
          key="feed-empty"
          style={{ flex: 1 }}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          <View style={styles.empty}>
            <Icon
              name={friendsOnly ? 'users' : showOtherSearch && otherSearch ? 'search' : 'star'}
              size={38}
              color={colors.textDecor}
            />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              {friendsOnly ? t.feedEmptyFriendsTitle : showOtherSearch && otherSearch ? `"${otherSearch}"` : t.feedEmptyTitle}
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              {friendsOnly ? t.feedEmptyFriendsBody : showOtherSearch && otherSearch ? t.feedEmptySearchBody : t.feedEmptyBody}
            </Text>
            {friendsOnly && (
              <AnimatedPressable onPress={() => router.push('/(app)/search' as any)} style={[styles.emptyBtn, { backgroundColor: colors.primary }]}>
                <Text style={styles.emptyBtnText}>{t.feedFindPeople}</Text>
              </AnimatedPressable>
            )}
            {showOpeningSoonFallback && (
              <View style={styles.openingSoonWrap}>
                <Text style={[styles.openingSoonLabel, { color: colors.textHint }]}>{t.feedOpeningSoonLabel}</Text>
                {openingSoonFallback.map((event, index) => {
                  const joined = user ? isAttending(event, user.id) : false;
                  const isHero = event.id === openingSoonHeroId;
                  const prevEvent = index > 0 ? openingSoonFallback[index - 1] : null;
                  const isFirstRow = !prevEvent || prevEvent.id === openingSoonHeroId;
                  return (
                    <FadeInView key={isHero ? `${event.id}-hero` : `${event.id}-row`}>
                      {isHero ? (
                        <EventCard
                          event={event}
                          isJoined={joined}
                          isSaved={user?.savedEventIds?.includes(event.id) ?? false}
                          onSave={user ? () => {
                            haptics.light();
                            const saved = user?.savedEventIds?.includes(event.id) ?? false;
                            (saved ? unsaveEvent(event.id) : saveEvent(event.id)).catch(() => {});
                          } : undefined}
                          onPress={() => router.push(`/(app)/event/${event.id}`)}
                          friendProfiles={friendProfiles}
                        />
                      ) : (
                        <FeedRow
                          event={event}
                          isJoined={joined}
                          isFirstRow={isFirstRow}
                          onPress={() => router.push(`/(app)/event/${event.id}`)}
                          onPressIn={() => becomeOpeningSoonHero(event.id)}
                        />
                      )}
                    </FadeInView>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          key="feed-content"
          style={{ flex: 1 }}
          data={zeroStateItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          renderItem={({ item, index }) => {
            const joined = user ? isAttending(item, user.id) : false;
            // Spec §6: one photo hero card, then compact rows — but which
            // item is the hero is now touch-driven (heroId): landing a
            // finger on a row promotes it, rather than it always being
            // index 0.
            const isHero = item.id === heroId;
            // The row directly under the hero (or the very first row, if
            // the hero isn't at the top of the list) skips its top border
            // and uses a marginTop instead — same treatment the old
            // index-1 row got.
            const prevItem = index > 0 ? zeroStateItems[index - 1] : null;
            const isFirstRow = !prevItem || prevItem.id === heroId;
            return (
              // `key` forces a fresh mount (and re-triggers the fade/pop-in)
              // whenever this item swaps between hero and compact row.
              <FadeInView key={isHero ? 'hero' : 'row'}>
                {isHero ? (
                  <EventCard
                    event={item}
                    isJoined={joined}
                    isSaved={user?.savedEventIds?.includes(item.id) ?? false}
                    onSave={user ? () => {
                      haptics.light();
                      const saved = user?.savedEventIds?.includes(item.id) ?? false;
                      (saved ? unsaveEvent(item.id) : saveEvent(item.id)).catch(() => {});
                    } : undefined}
                    onPress={() => router.push(`/(app)/event/${item.id}`)}
                    friendProfiles={friendProfiles}
                  />
                ) : (
                  <FeedRow
                    event={item}
                    isJoined={joined}
                    isFirstRow={isFirstRow}
                    onPress={() => router.push(`/(app)/event/${item.id}`)}
                    onPressIn={() => becomeHero(item.id)}
                  />
                )}
              </FadeInView>
            );
          }}
        />
      )}

      <FilterSheet
        visible={filterSheetVisible}
        onClose={() => setFilterSheetVisible(false)}
        radiusKm={radiusKm}
        onRadiusChange={handleRadiusChange}
        when={when}
        onWhenChange={setWhen}
        uniOnly={uniOnly}
        onUniOnlyChange={setUniOnly}
        soloFriendly={soloFriendly}
        onSoloFriendlyChange={setSoloFriendly}
        resultCount={filtered.length}
        onClear={clearFilterSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter,
    paddingBottom: Spacing.base,
  },
  headingBlock: { flex: 1, marginRight: 8 },
  headingTitle: { fontSize: FontSize.display, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.5, lineHeight: 30 },
  headingSubtitle: { fontSize: FontSize.md, fontFamily: UIFontLight, marginTop: 3 },
  wordmark: { fontSize: FontSize.display + 4, fontWeight: FontWeight.bold, fontFamily: LogoFont, letterSpacing: -0.8 },
  headerActions: { flexDirection: 'row', gap: 8, flexShrink: 0, marginTop: 2 },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  topBadge: { position: 'absolute', top: -4, right: -6, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  topBadgeText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 9, gap: 8,
  },
  searchInput: { flex: 1, fontSize: FontSize.base, fontFamily: UIFontLight },

  categoryTabs: { paddingHorizontal: Spacing.gutter, marginBottom: Spacing.md },
  filterRowWrap: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: 14,
    paddingLeft: Spacing.gutter,
  },
  filterRow: {
    paddingRight: Spacing.md,
    flexDirection: 'row', gap: 7, alignItems: 'center',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: BorderRadius.full, borderWidth: 1,
    paddingHorizontal: Spacing.base, paddingVertical: 9,
  },
  chipText: { fontSize: FontSize.base, fontFamily: UIFont },
  otherSearchRow: { paddingHorizontal: Spacing.gutter, paddingBottom: 12 },
  otherSearchBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.md, borderWidth: 1,
    paddingHorizontal: Spacing.md, paddingVertical: 9, gap: 8,
  },
  otherSearchInput: { flex: 1, fontSize: FontSize.base, fontFamily: UIFontLight },
  list: { paddingHorizontal: Spacing.gutter, paddingTop: 4 },
  empty: { alignItems: 'center', paddingTop: 64, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.4 },
  emptyBody: { fontSize: FontSize.base, fontFamily: UIFontLight, textAlign: 'center', lineHeight: 21, paddingHorizontal: Spacing.xl },
  emptyBtn: { marginTop: 8, paddingHorizontal: Spacing.xl, paddingVertical: 12, borderRadius: BorderRadius.md },
  emptyBtnText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  openingSoonWrap: { width: '100%', marginTop: Spacing.xl },
  openingSoonLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  flagshipBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.gutter, marginBottom: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md },
  flagshipBannerLabel: { fontSize: 10.5, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.2, textTransform: 'uppercase' },
  flagshipBannerTitle: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont, marginTop: 1 },
  forYouHint: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: Spacing.gutter, marginTop: -4, marginBottom: 10, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 9 },
  forYouHintText: { fontSize: FontSize.sm, fontFamily: UIFontLight, flex: 1 },

  // Compact feed row (spec §6)
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11 },
  rowFirst: { marginTop: 11 },
  rowThumb: { width: 50, height: 50, borderRadius: BorderRadius.xs },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  rowMeta: { fontSize: FontSize.md, fontFamily: UIFontLight, marginTop: 2 },
});
