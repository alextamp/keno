import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';
import {
  EventCategory,
  EventEntity,
  isEventFull,
  spotsLeft,
} from '@/features/events/domain/entities/event.entity';
import { CategoryChip } from './CategoryChip';

interface EventCardProps {
  event: EventEntity;
  onPress: () => void;
  isJoined?: boolean;
}

export function EventCard({ event, onPress, isJoined = false }: EventCardProps) {
  const { colors } = useTheme();
  const full = isEventFull(event);
  const spots = spotsLeft(event);
  const attendancePct = Math.min(event.attendeeIds.length / event.maxAttendees, 1);

  const categoryColorMap: Record<EventCategory, string> = {
    party: colors.categoryParty,
    sports: colors.categorySports,
    study: colors.categoryStudy,
    chill: colors.categoryChill,
    coffee: colors.categoryCoffee,
    other: colors.categoryOther,
  };
  const catColor = categoryColorMap[event.category];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: colors.black,
        },
        pressed && styles.pressed,
      ]}
    >
      {event.imageUri ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri: event.imageUri }} style={styles.image} resizeMode="cover" />
        </View>
      ) : (
        <View style={[styles.topBar, { backgroundColor: catColor }]} />
      )}
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <CategoryChip category={event.category} selected size="sm" />
          {isJoined && (
            <View style={[styles.joinedBadge, { backgroundColor: colors.success }]}>
              <Text style={styles.joinedText}>✓ Joined</Text>
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {event.title}
        </Text>

        {event.description ? (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
            🕐 {format(event.dateTime, 'EEE d MMM · HH:mm')}
          </Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
            📍 {event.location}
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: full ? colors.error : catColor, width: `${attendancePct * 100}%` as any },
              ]}
            />
          </View>
          <Text style={[styles.spotsText, { color: full ? colors.error : colors.textHint }]}>
            {full ? 'Full' : `${spots} spot${spots === 1 ? '' : 's'} left`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  topBar: { height: 4 },
  imageWrap: { height: 120, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  body: { padding: Spacing.md, gap: Spacing.sm },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  joinedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  joinedText: {
    fontSize: FontSize.xs,
    color: '#FFFFFF',
    fontWeight: FontWeight.bold,
  },
  title: {
    fontSize: FontSize.base,
    fontWeight: FontWeight.bold,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
  metaRow: { gap: 4 },
  meta: { fontSize: FontSize.sm, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 2,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  spotsText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    minWidth: 60,
    textAlign: 'right',
  },
});
