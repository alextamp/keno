import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { AccentScopeProvider, useTheme } from '@/core/theme';
import { useTranslation } from '@/core/i18n';
import { IconName } from '@/components/ui/Icon';
import { TabBar, TabBarItem } from '@/components/ui/TabBar';
import { haptics } from '@/core/utils/haptics';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import MissionsTab from '@/screens/kfg/MissionsTab';
import CharacterTab from '@/screens/kfg/CharacterTab';
import KfgLeaderboardTab from '@/screens/kfg/KfgLeaderboardTab';
import GroupsScreen from '@/screens/GroupsTab';

// Keno for Good: its own four-tab world inside the app, same structure as
// AppHub (PagerView + the shared TabBar), with the green accent scope.
const TAB_ICONS: IconName[] = ['heart', 'users', 'user', 'trophy'];

export default function KfgHub() {
  return (
    <AccentScopeProvider value="kfg">
      <KfgHubInner />
    </AccentScopeProvider>
  );
}

function KfgHubInner() {
  const { colors } = useTheme();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { start, stop } = useKfgStore();
  const labels = [t.kfgTabMissions, t.kfgTabCommunities, t.kfgTabCharacter, t.kfgTabLeaderboard];
  const pagerRef = useRef<PagerView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [visited, setVisited] = useState(() => new Set([0]));

  useEffect(() => {
    if (!user) return;
    start(user.id);
    return stop;
  }, [user?.id]);

  const select = (index: number) => {
    setActiveIndex(index);
    setVisited((prev) => (prev.has(index) ? prev : new Set(prev).add(index)));
  };

  const goTo = (index: number) => {
    if (index !== activeIndex) haptics.light();
    pagerRef.current?.setPage(index);
    select(index);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={(e) => select(e.nativeEvent.position)}
        overdrag={false}
      >
        <View key="missions" style={styles.page}>
          {visited.has(0) && <MissionsTab />}
        </View>
        <View key="communities" style={styles.page}>
          {visited.has(1) && <GroupsScreen scope="kfg" />}
        </View>
        <View key="character" style={styles.page}>
          {visited.has(2) && <CharacterTab />}
        </View>
        <View key="leaderboard" style={styles.page}>
          {visited.has(3) && <KfgLeaderboardTab />}
        </View>
      </PagerView>

      <TabBar>
        {TAB_ICONS.map((icon, i) => (
          <TabBarItem key={icon} icon={icon} label={labels[i]} focused={activeIndex === i} onPress={() => goTo(i)} />
        ))}
      </TabBar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1 },
  page: { flex: 1 },
});
