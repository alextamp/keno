import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import PagerView from 'react-native-pager-view';
import { useTheme } from '@/core/theme';
import { useNotificationsStore } from '@/features/notifications/notifications.store';
import { useTabNavigation } from '@/core/tabNavigation';
import { useCreateFlowStore } from '@/core/store/createFlow.store';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';
import { useTranslation } from '@/core/i18n';
import { Icon, IconName } from '@/components/ui/Icon';
import { TabBar, TabBarItem } from '@/components/ui/TabBar';
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

function FabItem({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(0.92);
  return (
    <AnimatedPressable
      onPress={() => { haptics.medium(); onPress(); }}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="button"
      accessibilityLabel={label}
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
          // bounces back, and only once there's actually a half-filled form
          // to lose (createFlowStep 2) — it read as a stray navigation bug
          // mid-form. Step 1 has nothing entered yet, so swiping away there
          // is safe and left working normally, same as swiping toward Map.
          if (activeIndexRef.current === FAB_INDEX && position === LEADERBOARD_INDEX && useCreateFlowStore.getState().step !== 1) {
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

      <TabBar>
        {TAB_ICONS.map((icon, i) =>
          i === FAB_INDEX ? (
            <View key="fab" style={styles.fabSlot}>
              <FabItem label={t.tabCreate} onPress={() => goTo(i)} />
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
      </TabBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1 },
  page: { flex: 1 },
  fabSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
});
