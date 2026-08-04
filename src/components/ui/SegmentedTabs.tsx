import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { UIFont, FontSize, FontWeight } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';
import { haptics } from '@/core/utils/haptics';

// Warm Paper segmented text tabs (spec §4): row with 1px bottom border;
// active item = accent + 700 + 2px accent underline. Used on feed,
// leaderboard, messages, groups, profile sub-tabs.
export function SegmentedTabs({
  tabs,
  activeIndex,
  onChange,
  scrollable = false,
  style,
}: {
  tabs: string[];
  activeIndex: number;
  onChange: (index: number) => void;
  scrollable?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();

  const items = tabs.map((label, i) => {
    const on = i === activeIndex;
    return (
      <Pressable
        key={label}
        onPress={() => { haptics.light(); onChange(i); }}
        style={[styles.tab, on && { borderBottomColor: colors.primary }]}
        hitSlop={{ top: 8, bottom: 8 }}
      >
        <Text style={[styles.label, { color: on ? colors.primary : colors.textHint }]}>{label}</Text>
      </Pressable>
    );
  });

  const row = <View style={[styles.row, { borderBottomColor: colors.border }, !scrollable && style]}>{items}</View>;

  if (!scrollable) return row;
  // In scrollable mode `style` carries the caller's content padding (e.g. the
  // screen gutter) — it belongs on contentContainerStyle, not the viewport.
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, style]}>
      {row}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 18,
    borderBottomWidth: 1,
  },
  scrollContent: { flexGrow: 1 },
  tab: {
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  label: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    fontFamily: UIFont,
  },
});
