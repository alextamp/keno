import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { EventCategory } from '@/features/events/domain/entities/event.entity';
import { BorderRadius, UIFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';
import { useTranslation } from '@/core/i18n';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CATEGORY_KEYS: Record<EventCategory, string> = {
  [EventCategory.Party]: 'catParty',
  [EventCategory.Sports]: 'catSports',
  [EventCategory.Study]: 'catStudy',
  [EventCategory.Chill]: 'catChill',
  [EventCategory.Coffee]: 'catCoffee',
  [EventCategory.Other]: 'catOther',
};

const CATEGORY_COLORS: Record<EventCategory, string> = {
  [EventCategory.Party]: '#7E52A8',
  [EventCategory.Sports]: '#3F7A55',
  [EventCategory.Study]: '#3A6494',
  [EventCategory.Chill]: '#B2537A',
  [EventCategory.Coffee]: '#A0702C',
  [EventCategory.Other]: '#7A6E62',
};

interface CategoryChipProps {
  category: EventCategory;
  customLabel?: string;
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
  /** 'chip' (default) = filter/interest pill; 'inline' = the bare dot+LABEL
   *  used above an event card title (spec §4 "category dot + LABEL"). */
  variant?: 'chip' | 'inline';
}

export function CategoryChip({
  category, customLabel, selected = false, onPress, size = 'md', variant = 'chip',
}: CategoryChipProps) {
  const { colors } = useTheme();
  const t = useTranslation();
  const catColor = CATEGORY_COLORS[category];
  const label = customLabel?.trim() || (t[CATEGORY_KEYS[category] as keyof typeof t] as string);
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(0.94);

  if (variant === 'inline') {
    return (
      <View style={styles.inlineRow}>
        <View style={[styles.dot, { backgroundColor: catColor }]} />
        <Text style={[styles.inlineLabel, { color: colors.textDecor }]}>{label.toUpperCase()}</Text>
      </View>
    );
  }

  const chipStyle = [
    styles.chip,
    size === 'sm' && styles.chipSm,
    {
      backgroundColor: selected ? colors.accentSoft : colors.surface,
      borderColor: selected ? colors.primary : colors.border,
    },
  ];

  const labelNode = (
    <>
      <View style={[styles.dot, { backgroundColor: catColor }]} />
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: selected ? colors.accentInk : colors.textSecondary }]}>
        {label}
      </Text>
    </>
  );

  // Display-only usage (e.g. the tag shown on an event card) — no onPress
  // means this isn't a real button, so it must not carry press-scale/haptic
  // affordances that make it look tappable when it does nothing.
  if (!onPress) {
    return <View style={chipStyle}>{labelNode}</View>;
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[chipStyle, animatedStyle]}
    >
      {labelNode}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.base,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    flexShrink: 0,
  },
  chipSm: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  label: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.medium,
    fontFamily: UIFont,
  },
  labelSm: {
    fontSize: FontSize.md,
  },
  dot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  inlineLabel: {
    fontSize: FontSize.xs - 1.5,
    fontWeight: FontWeight.bold,
    fontFamily: UIFont,
    letterSpacing: 1.4,
  },
});
