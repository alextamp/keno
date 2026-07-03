import React, { useEffect, useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import {
  EventEntity, EventCategory, EVENT_CATEGORY_COLORS,
} from '@/features/events/domain/entities/event.entity';
import { useTranslation } from '@/core/i18n';

// Athens city centre default
const ATHENS = { latitude: 37.9838, longitude: 23.7275, latitudeDelta: 0.06, longitudeDelta: 0.06 };

const FILTER_DEFS: { key: string; value: EventCategory | null; emoji: string; color: string }[] = [
  { key: 'catAll',    value: null,                  emoji: '🌟', color: '#C94D0A' },
  { key: 'catParty',  value: EventCategory.Party,   emoji: '🎈', color: '#8B3FCC' },
  { key: 'catSports', value: EventCategory.Sports,  emoji: '⚽', color: '#0A8A52' },
  { key: 'catStudy',  value: EventCategory.Study,   emoji: '✏️', color: '#2952CC' },
  { key: 'catChill',  value: EventCategory.Chill,   emoji: '🎨', color: '#CC1F6E' },
  { key: 'catCoffee', value: EventCategory.Coffee,  emoji: '☕', color: '#CC6B00' },
  { key: 'catOther',  value: EventCategory.Other,   emoji: '🌈', color: '#504540' },
];

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

  const [selected, setSelected] = useState<EventCategory | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }, 800);
    })();
  }, []);

  const now = new Date();
  const eventsWithCoords = spreadCoincident(
    events.filter((e) => {
      if (e.dateTime < now) return false;
      if (selected && e.category !== selected) return false;
      return e.latitude != null && e.longitude != null;
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
      >
        {eventsWithCoords.map((e) => {
          const catColor = EVENT_CATEGORY_COLORS[e.category];
          return (
            <Marker
              key={e.id}
              coordinate={{ latitude: e.spreadLat, longitude: e.spreadLng }}
              onPress={() => router.push(`/(app)/event/${e.id}`)}
              tracksViewChanges={false}
            >
              <View style={[styles.pin, { backgroundColor: catColor, borderColor: catColor }]}>
                <Text style={styles.pinEmoji}>
                  {FILTERS.find((f) => f.value === e.category)?.emoji ?? '📍'}
                </Text>
              </View>
              <View style={[styles.pinTail, { borderTopColor: catColor }]} />
            </Marker>
          );
        })}
      </MapView>

      {/* Filter pills overlay */}
      <View style={[styles.filtersOverlay, { paddingTop: insets.top + 10 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => {
            const isActive = selected === f.value;
            return (
              <AnimatedPressable
                key={f.label}
                onPress={() => setSelected(f.value)}
              >
                <View style={[styles.pillOuter, { backgroundColor: 'rgba(0,0,0,0.75)' }]}>
                  <View style={[styles.pillInner, { backgroundColor: isActive ? f.color : 'rgba(255,255,255,0.15)' }]}>
                    <Text style={styles.pillText}>{f.emoji} {f.label}{isActive ? ' ★' : ''}</Text>
                  </View>
                </View>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Empty state */}
      {eventsWithCoords.length === 0 && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
            <Text style={styles.emptyEmoji}>🗺️</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary, fontFamily: DrawFont }]}>{t.mapEmptyTitle}</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>{t.mapEmptyBody}</Text>
          </View>
        </View>
      )}

      {/* Event count badge */}
      <View style={[styles.countBadge, { backgroundColor: colors.surface, borderColor: colors.borderStrong, bottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 16 }]}>
        <Text style={[styles.countText, { color: colors.textPrimary }]}>
          {t.mapEvents(eventsWithCoords.length)}
        </Text>
      </View>

      {/* My location button */}
      {userLocation && (
        <AnimatedPressable
          onPress={() => mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600)}
          style={[styles.locBtn, { backgroundColor: colors.surface, borderColor: colors.borderStrong, bottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 16 }]}
        >
          <Text style={styles.locBtnIcon}>📍</Text>
        </AnimatedPressable>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { flex: 1 },
  // Pins
  pin: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,
    elevation: 4,
  },
  pinEmoji: { fontSize: 18 },
  pinTail: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    alignSelf: 'center', marginTop: -1,
  },
  // Filters overlay
  filtersOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  filterRow: { paddingHorizontal: Spacing.lg, gap: 8, flexDirection: 'row', paddingBottom: 8 },
  pillOuter: { borderRadius: 999, padding: 2.5 },
  pillInner: { borderRadius: 999, height: 30, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', fontFamily: DrawFont },
  // Count badge
  countBadge: {
    position: 'absolute', right: Spacing.lg,
    borderWidth: 2.5, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    ...Shadow.sm,
  },
  countText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  // Location button
  locBtn: {
    position: 'absolute', left: Spacing.lg,
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 2.5, alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  locBtnIcon: { fontSize: 20 },
  // Empty state
  emptyOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl,
  },
  emptyCard: {
    borderWidth: 2.5, borderRadius: BorderRadius.xl,
    padding: Spacing.lg, alignItems: 'center', gap: 6,
    maxWidth: 280, ...Shadow.sm,
  },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, textAlign: 'center' },
  emptyBody: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 19 },
});
