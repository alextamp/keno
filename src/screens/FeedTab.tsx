import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Alert, FlatList, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { EventCategory, EventEntity, isAttending } from '@/features/events/domain/entities/event.entity';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useNotificationsStore } from '@/features/notifications/notifications.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { isLeft } from '@/core/utils/either';
import { EventCard } from '@/components/ui/EventCard';
import { EventCardSkeleton } from '@/components/ui/Skeleton';
import { haptics } from '@/core/utils/haptics';
import { useLanguageStore, getGreeting, useTranslation } from '@/core/i18n';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';

const FILTER_DEFS: { value: EventCategory | null; color: string; emoji: string; key: string }[] = [
  { key: 'catAll',    value: null,                  color: '#C94D0A', emoji: '🌟' },
  { key: 'catParty',  value: EventCategory.Party,   color: '#8B3FCC', emoji: '🎈' },
  { key: 'catSports', value: EventCategory.Sports,  color: '#0A8A52', emoji: '⚽' },
  { key: 'catStudy',  value: EventCategory.Study,   color: '#2952CC', emoji: '✏️' },
  { key: 'catChill',  value: EventCategory.Chill,   color: '#CC1F6E', emoji: '🎨' },
  { key: 'catCoffee', value: EventCategory.Coffee,  color: '#CC6B00', emoji: '☕' },
  { key: 'catOther',  value: EventCategory.Other,   color: '#504540', emoji: '🌈' },
];

const EARTH_KM = 6371;
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NEARBY_KM = 5;

function interestScore(event: EventEntity, interests: string[]): number {
  if (!interests.length) return 0;
  const tags = [event.category as string, ...(event.customCategory ? [event.customCategory.toLowerCase()] : [])];
  return interests.filter((i) => tags.includes(i.toLowerCase())).length;
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
  const { language } = useLanguageStore();
  const t = useTranslation();
  const greeting = getGreeting(language, user?.name?.split(' ')[0] ?? '');
  const FILTERS = FILTER_DEFS.map((f) => ({ ...f, label: t[f.key as keyof typeof t] as string }));

  const [selected, setSelected] = useState<EventCategory | null>(null);
  const [otherSearch, setOtherSearch] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [soonOnly, setSoonOnly] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [forYouSort, setForYouSort] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [friendProfiles, setFriendProfiles] = useState<Record<string, UserProfile>>({});
  const [refreshing, setRefreshing] = useState(false);

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

  const handleNearbyToggle = useCallback(async () => {
    haptics.light();
    if (nearbyOnly) {
      setNearbyOnly(false);
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
    setNearbyOnly(true);
    setFriendsOnly(false);
    setSoonOnly(false);
    setSelected(null);
    setOtherSearch('');
  }, [nearbyOnly]);

  const handleSelectFilter = (value: EventCategory | null) => {
    haptics.light();
    setSelected(value);
    setOtherSearch('');
    setFriendsOnly(false);
    setSoonOnly(false);
    setNearbyOnly(false);
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
  const soonCutoff = new Date(now.getTime() + 3 * 3600_000);
  const following = user?.following ?? [];
  const userInterests: string[] = (user as any)?.interests ?? [];

  const filtered = useMemo(() => {
    let list = events.filter((e) => {
      if (e.dateTime < now) return false;
      if (soonOnly && e.dateTime > soonCutoff) return false;
      if (friendsOnly && !following.includes(e.creatorId)) return false;
      if (nearbyOnly && userLocation) {
        if ((e as any).latitude == null || (e as any).longitude == null) return false;
        const dist = haversineKm(userLocation.lat, userLocation.lon, (e as any).latitude, (e as any).longitude);
        if (dist > NEARBY_KM) return false;
      }
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
  }, [events, soonOnly, friendsOnly, nearbyOnly, userLocation, selected, otherSearch, searchQuery, forYouSort, userInterests]);

  const showOtherSearch = selected === EventCategory.Other;

  const INACTIVE_PILL = '#4A4440';

  const listHeader = (
    <>
      {/* Filter row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {/* For You */}
        <AnimatedPressable onPress={() => { haptics.light(); setForYouSort((v) => !v); }} >
          <View style={[styles.pillOuter, { backgroundColor: '#1A1208' }]}>
            <View style={[styles.pillInner, { backgroundColor: forYouSort ? '#CC1F6E' : INACTIVE_PILL }]}>
              <Text style={styles.pillText}>{t.feedForYou}</Text>
            </View>
          </View>
        </AnimatedPressable>

        {/* Soon */}
        <AnimatedPressable onPress={() => { haptics.light(); setSoonOnly((v) => !v); setFriendsOnly(false); setNearbyOnly(false); setSelected(null); setOtherSearch(''); }} >
          <View style={[styles.pillOuter, { backgroundColor: '#1A1208' }]}>
            <View style={[styles.pillInner, { backgroundColor: soonOnly ? '#C94D0A' : INACTIVE_PILL }]}>
              <Text style={styles.pillText}>⚡ {t.feedFilterSoon}</Text>
            </View>
          </View>
        </AnimatedPressable>

        {/* Nearby */}
        <AnimatedPressable onPress={handleNearbyToggle} >
          <View style={[styles.pillOuter, { backgroundColor: '#1A1208' }]}>
            <View style={[styles.pillInner, { backgroundColor: nearbyOnly ? '#0A8A52' : INACTIVE_PILL }]}>
              <Text style={styles.pillText}>📍 {t.feedFilterNearby}</Text>
            </View>
          </View>
        </AnimatedPressable>

        {/* Friends */}
        <AnimatedPressable onPress={() => { haptics.light(); setFriendsOnly((v) => !v); setSoonOnly(false); setNearbyOnly(false); setSelected(null); setOtherSearch(''); }} >
          <View style={[styles.pillOuter, { backgroundColor: '#1A1208' }]}>
            <View style={[styles.pillInner, { backgroundColor: friendsOnly ? '#2952CC' : INACTIVE_PILL }]}>
              <Text style={styles.pillText}>👥 {t.feedFriends}</Text>
            </View>
          </View>
        </AnimatedPressable>

        {/* Category pills */}
        {FILTERS.map((f) => {
          const isActive = !friendsOnly && !nearbyOnly && selected === f.value;
          return (
            <AnimatedPressable key={f.label} onPress={() => handleSelectFilter(f.value)} >
              <View style={[styles.pillOuter, { backgroundColor: '#1A1208' }]}>
                <View style={[styles.pillInner, { backgroundColor: isActive ? f.color : INACTIVE_PILL }]}>
                  <Text style={styles.pillText}>{f.emoji} {f.label}</Text>
                </View>
              </View>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      {/* For You no-interests hint */}
      {forYouSort && !userInterests.length && (
        <View style={[styles.forYouHint, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
          <Text style={[styles.forYouHintText, { color: colors.textSecondary }]}>
            💡 Add interests in your profile to get personalized events
          </Text>
        </View>
      )}

      {/* Custom type search */}
      {showOtherSearch && (
        <View style={[styles.otherSearchRow, { borderBottomColor: colors.borderStrong }]}>
          <View style={[styles.otherSearchBox, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
            <Text style={styles.otherSearchIcon}>🔍</Text>
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
              <AnimatedPressable onPress={() => setOtherSearch('')}>
                <Text style={[styles.otherSearchClear, { color: colors.textHint }]}>✕</Text>
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
      <View style={[styles.header, { borderBottomColor: colors.borderStrong, paddingTop: insets.top + 12 }]}>
        {searchActive ? (
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
            <Text style={styles.searchIcon}>🔍</Text>
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
            <AnimatedPressable onPress={closeSearch}>
              <Text style={[styles.searchClose, { color: colors.textHint }]}>✕</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <>
            <View style={styles.headingBlock}>
              <Text style={[styles.headingTitle, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
                {greeting.line1}
              </Text>
              <Text style={[styles.headingSubtitle, { color: colors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit>
                {greeting.line2}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <AnimatedPressable onPress={() => router.push('/(app)/notifications' as any)} style={[styles.iconBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.borderStrong }]}>
                <Text style={styles.iconBtnText}>🔔</Text>
                {unreadCount > 0 && (
                  <View style={[styles.topBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.topBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </AnimatedPressable>
              <AnimatedPressable onPress={() => router.push('/(app)/messages' as any)} style={[styles.iconBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.borderStrong }]}>
                <Text style={styles.iconBtnText}>💬</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => router.push('/(app)/leaderboard' as any)} style={[styles.iconBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.borderStrong }]}>
                <Text style={styles.iconBtnText}>🏆</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => setSearchActive(true)} style={[styles.iconBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.borderStrong }]}>
                <Text style={styles.iconBtnText}>🔍</Text>
              </AnimatedPressable>
            </View>
          </>
        )}
      </View>

      {isLoading ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(item) => String(item)}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          renderItem={() => <EventCardSkeleton />}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={listHeader}
          ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>
                {friendsOnly ? '👥' : nearbyOnly ? '📍' : showOtherSearch && otherSearch ? '🔍' : '🌟'}
              </Text>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontFamily: DrawFont }]}>
                {friendsOnly ? t.feedEmptyFriendsTitle : showOtherSearch && otherSearch ? `"${otherSearch}"` : t.feedEmptyTitle}
              </Text>
              <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
                {friendsOnly ? t.feedEmptyFriendsBody : showOtherSearch && otherSearch ? t.feedEmptySearchBody : t.feedEmptyBody}
              </Text>
              {friendsOnly && (
                <AnimatedPressable onPress={() => router.push('/(app)/search' as any)} style={[styles.emptyBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.emptyBtnText}>Find people →</Text>
                </AnimatedPressable>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const saved = user?.savedEventIds?.includes(item.id) ?? false;
            return (
              <EventCard
                event={item}
                isJoined={user ? isAttending(item, user.id) : false}
                isSaved={saved}
                onSave={user ? () => { haptics.light(); (saved ? unsaveEvent(item.id) : saveEvent(item.id)).catch(() => {}); } : undefined}
                onPress={() => router.push(`/(app)/event/${item.id}`)}
                friendProfiles={friendProfiles}
              />
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 2.5,
  },
  headingBlock: { flex: 1, marginRight: 8 },
  headingTitle: { fontSize: 20, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, lineHeight: 26 },
  headingSubtitle: { fontSize: 16, fontWeight: FontWeight.bold, fontFamily: DrawFont, lineHeight: 22 },
  headerActions: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  iconBtnText: { fontSize: 18 },
  topBadge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  topBadgeText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.extrabold },
  badge: {
    position: 'absolute', top: -4, right: -4,
    minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: FontWeight.extrabold },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderRadius: 999, borderWidth: 2.5,
    paddingHorizontal: Spacing.md, paddingVertical: 8, gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: FontSize.md, fontFamily: DrawFont },
  searchClose: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, paddingHorizontal: 4 },

  filterRow: {
    paddingHorizontal: Spacing.lg, paddingTop: 12, paddingBottom: 14,
    flexDirection: 'row', gap: 10, alignItems: 'center',
  },
  pillOuter: { borderRadius: 999, padding: 3 },
  pillInner: { borderRadius: 999, height: 32, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', includeFontPadding: false, lineHeight: 16, fontFamily: DrawFont },
  otherSearchRow: { paddingHorizontal: Spacing.lg, paddingBottom: 12, borderBottomWidth: 2.5 },
  otherSearchBox: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 999, borderWidth: 2.5,
    paddingHorizontal: Spacing.md, paddingVertical: 8, gap: 8,
  },
  otherSearchIcon: { fontSize: 14 },
  otherSearchInput: { flex: 1, fontSize: FontSize.sm, fontFamily: DrawFont },
  otherSearchClear: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, paddingHorizontal: 4 },
  list: { paddingHorizontal: Spacing.lg, paddingTop: 14 },
  empty: { alignItems: 'center', paddingTop: 64, gap: Spacing.sm },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  emptyBody: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.xl },
  emptyBtn: { marginTop: 8, paddingHorizontal: Spacing.xl, paddingVertical: 12, borderRadius: BorderRadius.full },
  emptyBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  forYouHint: { marginHorizontal: Spacing.lg, marginTop: -4, marginBottom: 10, borderWidth: 1.5, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  forYouHintText: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, textAlign: 'center' },
});
