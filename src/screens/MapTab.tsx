import React, { useEffect, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  PanResponder, Platform, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useTabNavigation } from '@/core/tabNavigation';
import {
  EventEntity, EventCategory, EVENT_CATEGORY_COLORS, isEventPast,
} from '@/features/events/domain/entities/event.entity';
import { useTranslation } from '@/core/i18n';
import { Icon, IconName } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { FilterSheet, FeedRadius, FeedWhen } from '@/components/ui/FilterSheet';
import { haversineKm, matchesWhenBucket } from '@/core/utils/geo';
import { haptics } from '@/core/utils/haptics';

// Athens city centre default
const ATHENS = { latitude: 37.9838, longitude: 23.7275, latitudeDelta: 0.06, longitudeDelta: 0.06 };

const CITY_REGIONS: Record<string, { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }> = {
  athens: { latitude: 37.9838, longitude: 23.7275, latitudeDelta: 0.06, longitudeDelta: 0.06 },
  thessaloniki: { latitude: 40.6355, longitude: 22.9375, latitudeDelta: 0.06, longitudeDelta: 0.06 },
  patras: { latitude: 38.2466, longitude: 21.7346, latitudeDelta: 0.06, longitudeDelta: 0.06 },
  larissa: { latitude: 39.6364, longitude: 22.4137, latitudeDelta: 0.06, longitudeDelta: 0.06 },
  volos: { latitude: 39.3671, longitude: 22.7458, latitudeDelta: 0.06, longitudeDelta: 0.06 },
};

const FILTER_DEFS: { key: string; value: EventCategory | null }[] = [
  { key: 'catAll',    value: null },
  { key: 'catParty',  value: EventCategory.Party },
  { key: 'catSports', value: EventCategory.Sports },
  { key: 'catStudy',  value: EventCategory.Study },
  { key: 'catChill',  value: EventCategory.Chill },
  { key: 'catCoffee', value: EventCategory.Coffee },
  { key: 'catOther',  value: EventCategory.Other },
];

const CATEGORY_PIN_ICON: Record<EventCategory, IconName> = {
  [EventCategory.Party]: 'star',
  [EventCategory.Sports]: 'zap',
  [EventCategory.Study]: 'edit',
  [EventCategory.Chill]: 'heart',
  [EventCategory.Coffee]: 'chat',
  [EventCategory.Other]: 'pin',
};

// Warm Paper map style (spec §4 "Map"): land #EFE9DF, roads white, parks
// #E2EADC, water #DCE6EC — decluttered (POI/transit labels hidden).
const LIGHT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#EFE9DF' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9A8E82' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FAF7F2' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E2EADC' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#F2EBE0' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#DCE6EC' }] },
];

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1E1813' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9D8F7E' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#17120E' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#22271F' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#241C16' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#332A20' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0E1A20' }] },
];

function getEventCity(lat: number, lng: number): string | null {
  const cities = Object.entries(CITY_REGIONS);
  const distances = cities.map(([city, region]) => {
    const dist = Math.sqrt((lat - region.latitude) ** 2 + (lng - region.longitude) ** 2);
    return { city, dist };
  });
  const closest = distances.sort((a, b) => a.dist - b.dist)[0];
  return closest.dist < 0.15 ? closest.city : null; // ~15km radius in lat/lng coords
}

function spreadCoincident(events: EventEntity[]): (EventEntity & { spreadLat: number; spreadLng: number })[] {
  const seen: Record<string, number> = {};
  return events.map((e) => {
    const key = `${e.latitude},${e.longitude}`;
    const count = seen[key] ?? 0;
    seen[key] = count + 1;
    const angle = (count * 137.5 * Math.PI) / 180;
    const radius = count === 0 ? 0 : 0.0004 * Math.ceil(count / 8);
    return {
      ...e,
      spreadLat: e.latitude! + Math.cos(angle) * radius,
      spreadLng: e.longitude! + Math.sin(angle) * radius,
    };
  });
}

export default function MapScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const events = useEventsStore((s) => s.events);
  const user = useAuthStore((s) => s.user);
  const t = useTranslation();
  const FILTERS = FILTER_DEFS.map((f) => ({ ...f, label: t[f.key as keyof typeof t] as string }));

  const mapRef = useRef<MapView>(null);
  const focusLocation = useTabNavigation((s) => s.focusLocation);
  const clearFocusLocation = useTabNavigation((s) => s.clearFocusLocation);
  const goToTab = useTabNavigation((s) => s.goToTab);

  // MapView's own native pan gesture claims horizontal drags anywhere over
  // it, so the tab pager's swipe-to-change-tab never gets a chance here —
  // the map just pans instead. Two narrow strips pinned to the screen edges
  // (clear of the filter chips up top and the locate/count buttons down
  // low) restore that swipe without touching normal map panning anywhere
  // else, same idea as an OS edge-swipe-to-go-back gesture.
  const SWIPE_THRESHOLD = 50;
  const leftEdgePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => { if (g.dx > SWIPE_THRESHOLD) goToTab(0); },
    }),
  ).current;
  const rightEdgePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => { if (g.dx < -SWIPE_THRESHOLD) goToTab(2); },
    }),
  ).current;

  const [selected, setSelected] = useState<EventCategory | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Filter bottom-sheet state (mockup 10 · design/screens.html "10 · Φίλτρα") —
  // same shared sheet FeedTab uses, filtering the already-loaded events client-side.
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [radiusKm, setRadiusKm] = useState<FeedRadius>(null);
  const [when, setWhen] = useState<FeedWhen>(null);
  const [uniOnly, setUniOnly] = useState(false);
  const [soloFriendly, setSoloFriendly] = useState(false);
  const hasActiveFilters = radiusKm != null || when != null || uniOnly || soloFriendly;
  const following = user?.following ?? [];

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      // Don't fight a pending "focus on this event" request from the event
      // detail screen — that takes priority over centering on the user.
      if (!useTabNavigation.getState().focusLocation) {
        mapRef.current?.animateToRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }, 800);
      }
    })();
  }, []);

  // Center on a specific event's location when navigated here from the
  // event detail screen (tapping the location row) — see tabNavigation.ts.
  useEffect(() => {
    if (!focusLocation) return;
    mapRef.current?.animateToRegion({
      latitude: focusLocation.latitude,
      longitude: focusLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 600);
    clearFocusLocation();
  }, [focusLocation, clearFocusLocation]);

  // A distance chip was picked in the filter sheet — request location (once)
  // if we didn't already get it from the on-mount request above.
  const handleRadiusChange = async (next: FeedRadius) => {
    if (next == null || userLocation) {
      setRadiusKm(next);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    setRadiusKm(next);
  };

  const clearFilterSheet = () => {
    setRadiusKm(null);
    setWhen(null);
    setUniOnly(false);
    setSoloFriendly(false);
  };

  const now = new Date();
  const eventsWithCoords = spreadCoincident(
    events.filter((e) => {
      if (isEventPast(e)) return false;
      if (selected && e.category !== selected) return false;
      if (e.latitude == null || e.longitude == null) return false;
      if (selectedCity) {
        const eventCity = getEventCity(e.latitude, e.longitude);
        if (eventCity !== selectedCity) return false;
      }
      // Filter sheet: ΑΠΟΣΤΑΣΗ
      if (radiusKm != null && userLocation) {
        const dist = haversineKm(userLocation.latitude, userLocation.longitude, e.latitude, e.longitude);
        if (dist > radiusKm) return false;
      }
      // Filter sheet: ΠΟΤΕ
      if (when && !matchesWhenBucket(e.dateTime, when, now)) return false;
      // Filter sheet: ΠΟΙΟΙ — "Από τη σχολή μου"
      if (uniOnly && user?.universityName) {
        const fromMyUni = e.creatorUniversity === user.universityName || (e.allowedUniversities ?? []).includes(user.universityName);
        if (!fromMyUni) return false;
      }
      // Filter sheet: ΠΟΙΟΙ — "Έρχονται μόνοι" (nobody you follow is going yet)
      if (soloFriendly && e.attendeeIds.some((uid) => following.includes(uid))) return false;
      return true;
    })
  );

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={ATHENS}
        showsUserLocation
        showsMyLocationButton={false}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        customMapStyle={isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
        // Handling taps here (matched by identifier) instead of on each
        // Marker's own onPress — react-native-maps' per-marker onPress is
        // known to be unreliable on iOS once the marker has custom child
        // content, which is exactly what these pins are. onMarkerPress on
        // the MapView itself goes through the native markerPress delegate
        // directly and doesn't have that problem.
        onMarkerPress={(e) => {
          const eventId = e.nativeEvent.id;
          if (!eventId) return;
          haptics.light();
          router.push(`/(app)/event/${eventId}`);
        }}
      >
        {eventsWithCoords.map((e) => {
          const catColor = EVENT_CATEGORY_COLORS[e.category];
          return (
            <Marker
              key={e.id}
              identifier={e.id}
              coordinate={{ latitude: e.spreadLat, longitude: e.spreadLng }}
              // Android snapshots custom marker views to bitmaps for
              // rendering; if tracksViewChanges is false from the first
              // frame, that snapshot is sometimes taken before the child
              // view has painted, leaving a permanently blank/invisible
              // marker. iOS renders custom marker views natively and
              // doesn't have this issue, so keep tracking off there for
              // perf.
              tracksViewChanges={Platform.OS === 'android'}
            >
              <View style={[styles.pin, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name={CATEGORY_PIN_ICON[e.category]} size={15} color={catColor} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Filter chips overlay */}
      <View style={[styles.filtersOverlay, { paddingTop: insets.top + 10 }]}>
        <View style={styles.filterRowWithBtn}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {FILTERS.map((f) => {
              const isActive = selected === f.value;
              return (
                <AnimatedPressable key={f.label} onPress={() => setSelected(f.value)}>
                  <View style={[
                    styles.chip,
                    { backgroundColor: isActive ? colors.accentSoft : colors.surface, borderColor: isActive ? colors.primary : colors.border },
                  ]}>
                    <Text style={[styles.chipText, { color: isActive ? colors.accentInk : colors.textSecondary, fontWeight: isActive ? FontWeight.semibold : FontWeight.medium }]}>{f.label}</Text>
                  </View>
                </AnimatedPressable>
              );
            })}
          </ScrollView>
          <AnimatedPressable onPress={() => { haptics.light(); setFilterSheetVisible(true); }} style={styles.mapFilterBtnWrap}>
            <View style={[styles.mapFilterBtn, { backgroundColor: hasActiveFilters ? colors.accentSoft : colors.surface, borderColor: hasActiveFilters ? colors.primary : colors.border }]}>
              <Icon name="filter" size={15} color={hasActiveFilters ? colors.accentInk : colors.textSecondary} />
            </View>
            {hasActiveFilters && <View style={[styles.mapFilterDot, { backgroundColor: colors.primary }]} />}
          </AnimatedPressable>
        </View>

        {/* City filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <AnimatedPressable
            onPress={() => { setSelectedCity(null); if (userLocation) mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600); }}
          >
            <View style={[styles.chip, { backgroundColor: !selectedCity ? colors.accentSoft : colors.surface, borderColor: !selectedCity ? colors.primary : colors.border }]}>
              <Text style={[styles.chipText, { color: !selectedCity ? colors.accentInk : colors.textSecondary, fontWeight: !selectedCity ? FontWeight.semibold : FontWeight.medium }]}>{t.mapAllCities}</Text>
            </View>
          </AnimatedPressable>
          {Object.keys(CITY_REGIONS).map((city) => {
            const isActive = selectedCity === city;
            return (
              <AnimatedPressable
                key={city}
                onPress={() => { setSelectedCity(city); mapRef.current?.animateToRegion(CITY_REGIONS[city], 600); }}
              >
                <View style={[styles.chip, { backgroundColor: isActive ? colors.accentSoft : colors.surface, borderColor: isActive ? colors.primary : colors.border }]}>
                  <Text style={[styles.chipText, { color: isActive ? colors.accentInk : colors.textSecondary, fontWeight: isActive ? FontWeight.semibold : FontWeight.medium }]}>
                    {city.charAt(0).toUpperCase() + city.slice(1)}
                  </Text>
                </View>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Empty state */}
      {eventsWithCoords.length === 0 && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Card padded style={styles.emptyCard}>
            <Icon name="map" size={34} color={colors.textDecor} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.mapEmptyTitle}</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{t.mapEmptyBody}</Text>
          </Card>
        </View>
      )}

      {/* Event count badge */}
      <View style={[styles.countBadge, { backgroundColor: colors.surface, borderColor: colors.border, bottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 16 }]}>
        <Text style={[styles.countText, { color: colors.textPrimary }]}>
          {t.mapEvents(eventsWithCoords.length)}
        </Text>
      </View>

      {/* My location button */}
      {userLocation && (
        <AnimatedPressable
          onPress={() => mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600)}
          style={[styles.locBtn, { backgroundColor: colors.surface, borderColor: colors.border, bottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 16 }]}
        >
          <Icon name="pin" size={19} color={colors.primary} />
        </AnimatedPressable>
      )}

      {/* Edge-swipe strips — restore swipe-to-change-tab without
          interfering with map panning or the filter/locate/count controls. */}
      <View
        pointerEvents="box-only"
        style={[styles.swipeEdge, { left: 0, top: insets.top + 100, bottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 70 }]}
        {...leftEdgePan.panHandlers}
      />
      <View
        pointerEvents="box-only"
        style={[styles.swipeEdge, { right: 0, top: insets.top + 100, bottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 70 }]}
        {...rightEdgePan.panHandlers}
      />

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
        resultCount={eventsWithCoords.length}
        onClear={clearFilterSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  // Pins (spec §4 "Map": 32px white circle, 1px border, category-colored icon)
  // No Shadow.sm here — its `elevation` (Android's shadow mechanism) breaks
  // react-native-maps' native bitmap snapshot for custom marker views on
  // Android, making pins render as fully invisible while the map tiles
  // underneath render fine. iOS shadow props don't have this problem since
  // iOS renders marker views natively instead of snapshotting them.
  pin: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    ...(Platform.OS === 'ios' ? Shadow.sm : null),
  },
  // Filters overlay
  filtersOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  filterRowWithBtn: { flexDirection: 'row', alignItems: 'center' },
  filterRow: { paddingLeft: Spacing.gutter, gap: 7, flexDirection: 'row', paddingBottom: 8, paddingRight: Spacing.md },
  mapFilterBtnWrap: { marginRight: Spacing.gutter, marginBottom: 8 },
  mapFilterBtn: {
    width: 34, height: 34, borderRadius: BorderRadius.full,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  mapFilterDot: { position: 'absolute', top: -1, right: -1, width: 8, height: 8, borderRadius: 4 },
  chip: { borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: Spacing.base, paddingVertical: 9, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontSize: FontSize.base, fontFamily: UIFont },
  // Count badge
  countBadge: {
    position: 'absolute', right: Spacing.gutter,
    borderWidth: 1, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.base, paddingVertical: 7,
  },
  countText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  swipeEdge: { position: 'absolute', width: 24 },
  // Location button
  locBtn: {
    position: 'absolute', left: Spacing.gutter,
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  // Empty state
  emptyOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl,
  },
  emptyCard: { alignItems: 'center', gap: 6, maxWidth: 280, ...Shadow.sheet },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont, textAlign: 'center' },
  emptyBody: { fontSize: FontSize.base, fontFamily: UIFontLight, textAlign: 'center', lineHeight: 19 },
});
