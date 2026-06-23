import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import {
  EventCategory,
  EVENT_CATEGORY_LABELS,
} from '@/features/events/domain/entities/event.entity';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';

const CATEGORY_EMOJIS: Record<EventCategory, string> = {
  [EventCategory.Party]: '🎉',
  [EventCategory.Sports]: '⚡',
  [EventCategory.Study]: '📚',
  [EventCategory.Chill]: '🎮',
  [EventCategory.Coffee]: '☕',
  [EventCategory.Other]: '✨',
};

interface CategoryChipProps {
  category: EventCategory;
  selected?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
}

export function CategoryChip({ category, selected = false, onPress, size = 'md' }: CategoryChipProps) {
  const { colors, isDark } = useTheme();

  const categoryColorMap: Record<EventCategory, string> = {
    [EventCategory.Party]: colors.categoryParty,
    [EventCategory.Sports]: colors.categorySports,
    [EventCategory.Study]: colors.categoryStudy,
    [EventCategory.Chill]: colors.categoryChill,
    [EventCategory.Coffee]: colors.categoryCoffee,
    [EventCategory.Other]: colors.categoryOther,
  };

  const color = categoryColorMap[category];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        size === 'sm' && styles.chipSm,
        {
          backgroundColor: selected ? color : isDark ? `${color}28` : `${color}18`,
          borderColor: selected ? color : `${color}66`,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, size === 'sm' && styles.labelSm, { color: selected ? '#FFFFFF' : color }]}>
        {size !== 'sm' ? `${CATEGORY_EMOJIS[category]} ${EVENT_CATEGORY_LABELS[category]}` : EVENT_CATEGORY_LABELS[category]}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  chipSm: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pressed: { opacity: 0.75 },
  label: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  labelSm: { fontSize: FontSize.xs },
});
