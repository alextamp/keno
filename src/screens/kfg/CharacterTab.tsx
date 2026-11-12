import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KfgHeader } from '@/components/kfg/KfgHeader';
import { KfgLevelCard } from '@/components/kfg/KfgLevelCard';
import { useTheme } from '@/core/theme';
import { Spacing } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';

// Step 10 replaces the body with the large character and the wardrobe.
export default function CharacterTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const profile = useKfgStore((s) => s.profile);
  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 24 }]}
    >
      <KfgHeader balance={profile?.balance ?? 0} />
      <KfgLevelCard profile={profile} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { paddingHorizontal: Spacing.gutter, gap: Spacing.md } });
