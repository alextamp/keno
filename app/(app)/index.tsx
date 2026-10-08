import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withSequence, interpolate, Extrapolation,
} from 'react-native-reanimated';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme';
import { UIFont, FontSize, FontWeight } from '@/core/constants/theme';
import { useNotificationsStore } from '@/features/notifications/notifications.store';
import { useTabNavigation } from '@/core/tabNavigation';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';
import { useTranslation } from '@/core/i18n';
import { Icon, IconName } from '@/components/ui/Icon';
import { haptics } from '@/core/utils/haptics';

import FeedTab from '@/screens/FeedTab';
import MapTab from '@/screens/MapTab';
import CreateTab from '@/screens/CreateTab';
import LeaderboardTab from '@/screens/LeaderboardTab';
import ProfileTab from '@/screens/ProfileTab';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Mockup tab bar order: Home / Map / [Create FAB] / Leaderboard / Profile.
const TAB_ICONS: IconName[] = ['home', 'map', 'plus', 'trophy', 'user'];
const FAB_INDEX = 2;
const LEADERBOARD_INDEX = 3;

function TabBarItem({
  icon, label, focused, badge, onPress,
}: {
  icon: IconName;
  label: string;
  focused: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressAnimation(0.88);
  const focusAnim = useSharedValue(focused ? 1 : 0);
  // Separate from focusAnim on purpose: this always settles back to exactly 1,
  // so the active tab's icon never sits at a fractional scale (that soft/blurry
  // look) — it only pulses at the instant of switching, then snaps crisp.
  const pulse = useSharedValue(1);

  useEffect(() => {
    focusAnim.value = withSpring(focused ? 1 : 0, { damping: 18, stiffness: 240 });
    if (focused) {
      pulse.value = withSequence(
        withSpring(1.22, { damping: 10, stiffness: 350 }),
        withSpring(1, { damping: 12, stiffness: 280 }),
      );
    }
  }, [focused]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: focusAnim.value,
    transform: [{ scale: interpolate(focusAnim.value, [0, 1], [0.5, 1], Extrapolation.CLAMP) }],
  }));

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const color = focused ? colors.primary : colors.textDecor;

  return (
    <AnimatedPressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[styles.tabItem, pressStyle]}>
      <Animated.View style={[styles.iconWrap, iconWrapStyle]}>
        <Animated.View style={[styles.activePill, { backgroundColor: colors.accentSoft }, pillStyle]} />
        <Icon name={icon} size={23} color={color} strokeWidth={1.8} />
        {!!badge && badge > 0 && (
          <View style={[styles.notifBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
            <Text style={styles.notifBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </Animated.View>
      <Text style={[styles.tabLabel, { color, fontFamily: UIFont, opacity: focused ? 1 : 0.8 }]}>{label}</Text>
    </AnimatedPressable>
  );
}

function FabItem({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(0.92);
  return (
    <AnimatedPressable
      onPress={() => { haptics.medium(); onPress(); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.fabWrap, animatedStyle]}
    >
      <View style={[styles.fabRing, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
          <Icon name="plus" size={25} color="#fff" strokeWidth={2} />
        </View>
      </View>
    </AnimatedPressable>
  );
}

export default function AppHub() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const LABELS = [t.tabFeed, t.tabMap, '', t.leaderboardTitle, t.profileTitle];
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const pagerRef = useRef<PagerView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visited, setVisited] = useState(() => new Set([0]));
  const { pendingTab, clearPendingTab } = useTabNavigation();
  // Mirrors activeIndex synchronously (state updates are async/batched, and
  // onPageSelected needs the true "index before this transition" the
  // instant it fires) — used below to tell a deliberate tab-bar tap apart
  // from an organic swipe, and to detect the one swipe direction Create
  // blocks.
  const activeIndexRef = useRef(0);
  const programmaticRef = useRef(false);

  const goTo = (index: number) => {
    if (index !== activeIndex) haptics.light();
    programmaticRef.current = true;
    pagerRef.current?.setPage(index);
    activeIndexRef.current = index;
    setActiveIndex(index);
    setVisited((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
  };

  useEffect(() => {
    if (pendingTab !== null) {
      goTo(pendingTab);
      clearPendingTab();
    }
  }, [pendingTab]);

  const tabBarHeight = 58 + insets.bottom;

  return (
    <View style={styles.root}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => {
          const position = e.nativeEvent.position;
          if (programmaticRef.current) {
            // A tab-bar tap (goTo), or our own corrective bounce-back below
            // landing — always honor either.
            programmaticRef.current = false;
            activeIndexRef.current = position;
            setActiveIndex(position);
            setVisited((prev) => (prev.has(position) ? prev : new Set(prev).add(position)));
            return;
          }
          // Organic swipe. Only the swipe from Create toward Leaderboard
          // bounces back — it read as a stray navigation bug mid-form.
          // Swiping the other way (toward Map) still works normally.
          if (activeIndexRef.current === FAB_INDEX && position === LEADERBOARD_INDEX) {
            programmaticRef.current = true;
            pagerRef.current?.setPage(FAB_INDEX);
            return;
          }
          activeIndexRef.current = position;
          setActiveIndex(position);
          setVisited((prev) => (prev.has(position) ? prev : new Set(prev).add(position)));
        }}
        scrollEnabled
        overdrag={false}
      >
        {/* Each child must be a plain View — PagerView requirement.
            Heavy tab content (esp. MapTab's native MapView) only mounts once
            visited, so it doesn't run in the background on every other tab. */}
        <View key="feed" style={styles.page}>
          {visited.has(0) && <FeedTab />}
        </View>
        <View key="map" style={styles.page}>
          {visited.has(1) && <MapTab />}
        </View>
        <View key="create" style={styles.page}>
          {visited.has(2) && <CreateTab />}
        </View>
        <View key="leaderboard" style={styles.page}>
          {visited.has(3) && <LeaderboardTab />}
        </View>
        <View key="profile" style={styles.page}>
          {visited.has(4) && <ProfileTab />}
        </View>
      </PagerView>

      {/* Tab bar */}
      <View style={[
        styles.tabBar,
        {
          height: tabBarHeight,
          paddingBottom: insets.bottom + 4,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}>
        {TAB_ICONS.map((icon, i) =>
          i === FAB_INDEX ? (
            <View key="fab" style={styles.tabItem}>
              <FabItem onPress={() => goTo(i)} />
            </View>
          ) : (
            <TabBarItem
              key={icon}
              icon={icon}
              label={LABELS[i]}
              focused={activeIndex === i}
              badge={i === 0 ? unreadCount : undefined}
              onPress={() => goTo(i)}
            />
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1 },
  page: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#241F19',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  tabLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.15,
    includeFontPadding: false, textAlignVertical: 'center',
  },
  iconWrap: { width: 46, height: 32, alignItems: 'center', justifyContent: 'center' },
  activePill: {
    position: 'absolute',
    width: 40, height: 32, borderRadius: 13,
  },
  fabWrap: { alignItems: 'center', justifyContent: 'center' },
  fabRing: {
    width: 66, height: 66, borderRadius: 33, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginTop: -24,
  },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 10,
  },
  notifBadge: {
    position: 'absolute', top: -2, right: 2,
    minWidth: 15, height: 15, borderRadius: 8, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold },
});
