import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KfgHeader } from '@/components/kfg/KfgHeader';
import { useTheme } from '@/core/theme';
import { Spacing } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';

// Step 11 fills this in (people / schools / friends, your row, top-100 progress).
export default function KfgLeaderboardTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useKfgStore((s) => s.profile);
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 24 }]}
    >
      <KfgHeader balance={profile?.balance ?? 0} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { paddingHorizontal: Spacing.gutter, gap: Spacing.md } });
