import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight } from '@/core/constants/theme';
import { useNotificationsStore } from '@/features/notifications/notifications.store';
import { useTabNavigation } from '@/core/tabNavigation';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';
import { useTranslation } from '@/core/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

import FeedTab from '@/screens/FeedTab';
import CreateTab from '@/screens/CreateTab';
import MapTab from '@/screens/MapTab';
import GroupsTab from '@/screens/GroupsTab';
import ProfileTab from '@/screens/ProfileTab';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type TabDef = { label: string; icon: IoniconName; iconFocused: IoniconName };

const TAB_ICONS: { icon: IoniconName; iconFocused: IoniconName }[] = [
  { icon: 'home-outline',       iconFocused: 'home' },
  { icon: 'add-circle-outline', iconFocused: 'add-circle' },
  { icon: 'map-outline',        iconFocused: 'map' },
  { icon: 'people-outline',     iconFocused: 'people' },
  { icon: 'person-outline',     iconFocused: 'person' },
];

function TabBarItem({
  tab, focused, color, badge, onPress,
}: {
  tab: TabDef;
  focused: boolean;
  color: string;
  badge?: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(0.88);
  return (
    <AnimatedPressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[styles.tabItem, animatedStyle]}>
      <View style={[styles.tabIconWrap, focused && { backgroundColor: colors.primary + '22' }]}>
        <Ionicons name={focused ? tab.iconFocused : tab.icon} size={24} color={color} />
        {!!badge && badge > 0 && (
          <View style={[styles.notifBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.notifBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, { color, fontFamily: DrawFont }]}>{tab.label}</Text>
    </AnimatedPressable>
  );
}

export default function AppHub() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const TABS: TabDef[] = [
    { ...TAB_ICONS[0], label: t.tabFeed },
    { ...TAB_ICONS[1], label: t.tabCreate },
    { ...TAB_ICONS[2], label: t.tabMap },
    { ...TAB_ICONS[3], label: t.tabGroups },
    { ...TAB_ICONS[4], label: t.profileTitle },
  ];
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const pagerRef = useRef<PagerView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visited, setVisited] = useState(() => new Set([0]));
  const { pendingTab, clearPendingTab } = useTabNavigation();

  const goTo = (index: number) => {
    pagerRef.current?.setPage(index);
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
        <View key="create" style={styles.page}>
          {visited.has(1) && <CreateTab />}
        </View>
        <View key="map" style={styles.page}>
          {visited.has(2) && <MapTab />}
        </View>
        <View key="groups" style={styles.page}>
          {visited.has(3) && <GroupsTab />}
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
          borderTopColor: colors.borderStrong,
        },
      ]}>
        {TABS.map((tab, i) => (
          <TabBarItem
            key={tab.label}
            tab={tab}
            focused={activeIndex === i}
            color={activeIndex === i ? colors.primary : colors.textHint}
            badge={i === 0 ? unreadCount : undefined}
            onPress={() => goTo(i)}
          />
        ))}
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
    borderTopWidth: 2.5,
    paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  tabIconWrap: { position: 'relative', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4 },
  tabLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  notifBadge: {
    position: 'absolute', top: -4, right: -8,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.extrabold },
});
