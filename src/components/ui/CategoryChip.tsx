import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated from 'react-native-reanimated';
import { EventCategory } from '@/features/events/domain/entities/event.entity';
import { BorderRadius, DrawFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';
import { useTranslation } from '@/core/i18n';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CATEGORY_EMOJIS: Record<EventCategory, string> = {
  [EventCategory.Party]: '🎈',
  [EventCategory.Sports]: '⚽',
  [EventCategory.Study]: '✏️',
  [EventCategory.Chill]: '🎨',
  [EventCategory.Coffee]: '☕',
  [EventCategory.Other]: '🌈',
};

const CATEGORY_KEYS: Record<EventCategory, string> = {
  [EventCategory.Party]: 'catParty',
  [EventCategory.Sports]: 'catSports',
  [EventCategory.Study]: 'catStudy',
  [EventCategory.Chill]: 'catChill',
  [EventCategory.Coffee]: 'catCoffee',
  [EventCategory.Other]: 'catOther',
};

const CATEGORY_COLORS: Record<EventCategory, string> = {
  [EventCategory.Party]: '#8B3FCC',
  [EventCategory.Sports]: '#0A8A52',
  [EventCategory.Study]: '#2952CC',
  [EventCategory.Chill]: '#CC1F6E',
  [EventCategory.Coffee]: '#CC6B00',
  [EventCategory.Other]: '#504540',
};

interface CategoryChipProps {
  category: EventCategory;
  customLabel?: string;
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
}

export function CategoryChip({ category, customLabel, selected = false, onPress, size = 'md' }: CategoryChipProps) {
  const { colors } = useTheme();
  const t = useTranslation();
  const catColor = CATEGORY_COLORS[category];
  const label = customLabel?.trim() || t[CATEGORY_KEYS[category] as keyof typeof t] as string;
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(0.93);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        styles.chip,
        size === 'sm' && styles.chipSm,
        {
          backgroundColor: selected ? catColor : colors.surface,
          borderColor: colors.borderStrong,
        },
        animatedStyle,
      ]}
    >
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: selected ? '#FFFFFF' : colors.textSecondary }]}>
        {CATEGORY_EMOJIS[category]} {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 2.5,
    flexShrink: 0,
  },
  chipSm: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontFamily: DrawFont,
  },
  labelSm: {
    fontSize: FontSize.xs,
  },
});
