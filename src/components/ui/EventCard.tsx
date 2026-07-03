import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { UserProfile } from '@/core/utils/userProfiles';
import { BorderRadius, DrawFont, FontSize, FontWeight, Shadow, Spacing } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';
import {
  EventCategory, EventEntity,
  isEventFull, spotsLeft,
} from '@/features/events/domain/entities/event.entity';
import { getCountdown } from '@/core/utils/time';
import { CategoryChip } from './CategoryChip';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { haptics } from '@/core/utils/haptics';
import { isLeft } from '@/core/utils/either';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CATEGORY_EMOJIS: Record<EventCategory, string> = {
  party: '🎈',
  sports: '⚽',
  study: '✏️',
  chill: '🎨',
  coffee: '☕',
  other: '🌈',
};

interface EventCardProps {
  event: EventEntity;
  onPress: () => void;
  isJoined?: boolean;
  isSaved?: boolean;
  onSave?: () => void;
  faded?: boolean;
  friendProfiles?: Record<string, UserProfile>;
}

export function EventCard({ event, onPress, isJoined = false, isSaved = false, onSave, faded = false, friendProfiles = {} }: EventCardProps) {
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const upsertEvent = useEventsStore((s) => s.upsertEvent);
  const { animatedStyle: cardAnimatedStyle, onPressIn: onCardPressIn, onPressOut: onCardPressOut } = usePressAnimation(0.97);
  const bookmarkAnim = usePressAnimation(0.85);
  const hypeAnim = usePressAnimation(0.9);
  const full = isEventFull(event);
  const spots = spotsLeft(event);
  const attendancePct = Math.min(event.attendeeIds.length / event.maxAttendees, 1);
  const countdown = getCountdown(event.dateTime, language);
  const msgCount = event.messages.length;
  const friendGoingUids = user
    ? event.attendeeIds.filter((uid) => uid !== user.id && (user.following ?? []).includes(uid))
    : [];
  const friendGoingCount = friendGoingUids.length;
  const friendAvatars = friendGoingUids.slice(0, 3).map((uid) => friendProfiles[uid]).filter(Boolean);

  const categoryColorMap: Record<EventCategory, string> = {
    party: colors.categoryParty,
    sports: colors.categorySports,
    study: colors.categoryStudy,
    chill: colors.categoryChill,
    coffee: colors.categoryCoffee,
    other: colors.categoryOther,
  };
  const catColor = categoryColorMap[event.category];
  const catEmoji = CATEGORY_EMOJIS[event.category];
  const bs = colors.borderStrong;

  const isHyped = user ? event.reactions.hype.includes(user.id) : false;
  const hypeCount = event.reactions.hype.length;

  const handleHype = (e: any) => {
    e.stopPropagation?.();
    if (!user) return;
    haptics.light();
    const previous = event;
    const newHype = isHyped
      ? event.reactions.hype.filter((id) => id !== user.id)
      : [...event.reactions.hype, user.id];
    upsertEvent({ ...event, reactions: { ...event.reactions, hype: newHype } });
    // reactToEvent resolves (never rejects) with an Either — roll back the
    // optimistic update if the write actually failed server-side.
    eventsRepository.reactToEvent(event.id, user.id, 'hype').then((result) => {
      if (isLeft(result)) upsertEvent(previous);
    });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onCardPressIn}
      onPressOut={onCardPressOut}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: bs },
        cardAnimatedStyle,
        faded && styles.fadedCard,
      ]}
    >
      {/* Header — image or colored block */}
      {event.imageUri ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri: event.imageUri }} style={styles.image} resizeMode="cover" />
          {/* Gradient scrim */}
          <View style={styles.imageScrim} />
          {/* Overlaid bottom row */}
          <View style={styles.imageOverlay}>
            <CategoryChip category={event.category} customLabel={event.customCategory} selected size="sm" />
            <View style={styles.overlayRight}>
              <View style={[styles.countdownBadge, {
                backgroundColor: countdown.urgent ? colors.primary : 'rgba(0,0,0,0.45)',
                borderColor: 'rgba(255,255,255,0.3)',
              }]}>
                <Text style={[styles.countdownText, { color: '#fff' }]}>⏰ {countdown.label}</Text>
              </View>
              {isJoined && (
                <View style={[styles.joinedBadge, { backgroundColor: colors.success, borderColor: 'rgba(255,255,255,0.3)' }]}>
                  <Text style={styles.joinedText}>{t.eventJoined}</Text>
                </View>
              )}
              {onSave && (
                <AnimatedPressable
                  onPress={(e) => { e.stopPropagation?.(); haptics.light(); onSave(); }}
                  onPressIn={bookmarkAnim.onPressIn}
                  onPressOut={bookmarkAnim.onPressOut}
                  style={bookmarkAnim.animatedStyle}
                  hitSlop={8}
                >
                  <Text style={styles.bookmarkIcon}>{isSaved ? '🔖' : '🏷️'}</Text>
                </AnimatedPressable>
              )}
            </View>
          </View>
        </View>
      ) : (
        <View style={[styles.colorHeader, { backgroundColor: catColor }]}>
          <Text style={styles.colorHeaderEmoji}>{catEmoji}</Text>
          <View style={styles.colorHeaderRight}>
            {onSave && (
              <AnimatedPressable
                  onPress={(e) => { e.stopPropagation?.(); haptics.light(); onSave(); }}
                  onPressIn={bookmarkAnim.onPressIn}
                  onPressOut={bookmarkAnim.onPressOut}
                  style={bookmarkAnim.animatedStyle}
                  hitSlop={8}
                >
                <Text style={styles.bookmarkIcon}>{isSaved ? '🔖' : '🏷️'}</Text>
              </AnimatedPressable>
            )}
          </View>
        </View>
      )}

      {/* Body */}
      <View style={styles.body}>
        {/* Top row for no-image cards */}
        {!event.imageUri && (
          <View style={styles.headerRow}>
            <CategoryChip category={event.category} customLabel={event.customCategory} selected size="sm" />
            <View style={styles.headerRight}>
              <View style={[styles.countdownBadge, {
                backgroundColor: countdown.urgent ? colors.primary : colors.surfaceVariant,
                borderColor: bs,
              }]}>
                <Text style={[styles.countdownText, { color: countdown.urgent ? '#fff' : colors.textSecondary }]}>
                  ⏰ {countdown.label}
                </Text>
              </View>
              {isJoined && (
                <View style={[styles.joinedBadge, { backgroundColor: colors.success, borderColor: bs }]}>
                  <Text style={styles.joinedText}>{t.eventJoined}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {event.title}
        </Text>

        {event.description ? (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}

        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          📌 {event.location}
        </Text>

        {/* Pills row */}
        {(msgCount > 0 || friendGoingCount > 0) && (
          <View style={styles.pillsRow}>
            {msgCount > 0 && (
              <View style={[styles.pill, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
                <Text style={styles.pillEmoji}>💬</Text>
                <Text style={[styles.pillText, { color: colors.textSecondary }]}>{msgCount}</Text>
              </View>
            )}
            {friendGoingCount > 0 && (
              <View style={[styles.friendRow, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
                <View style={styles.friendAvatars}>
                  {friendAvatars.map((p, i) => (
                    <View
                      key={p.uid}
                      style={[styles.friendAvatar, { backgroundColor: p.avatarColor, marginLeft: i === 0 ? 0 : -8, zIndex: 3 - i }]}
                    >
                      {p.photoUri
                        ? <Image source={{ uri: p.photoUri }} style={styles.friendAvatarImg} />
                        : <Text style={styles.friendAvatarInitial}>{p.name[0].toUpperCase()}</Text>
                      }
                    </View>
                  ))}
                </View>
                <Text style={[styles.pillText, { color: colors.textSecondary }]}>
                  {friendAvatars.length > 0
                    ? friendGoingCount === 1
                      ? `${friendAvatars[0].name.split(' ')[0]} is going`
                      : `${friendAvatars[0].name.split(' ')[0]} +${friendGoingCount - 1} going`
                    : t.eventFriendGoing(friendGoingCount)
                  }
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Progress bar + hype */}
        <View style={styles.footer}>
          <AnimatedPressable
            onPress={handleHype}
            onPressIn={hypeAnim.onPressIn}
            onPressOut={hypeAnim.onPressOut}
            style={[styles.hypeBtn, {
              backgroundColor: isHyped ? colors.primary : colors.surfaceVariant,
              borderColor: isHyped ? colors.primary : bs,
            }, hypeAnim.animatedStyle]}
          >
            <Text style={styles.hypeEmoji}>🔥</Text>
            {hypeCount > 0 && (
              <Text style={[styles.hypeCount, { color: isHyped ? '#fff' : colors.textSecondary }]}>{hypeCount}</Text>
            )}
          </AnimatedPressable>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
            <View style={[styles.progressFill, { backgroundColor: full ? colors.error : catColor, width: `${attendancePct * 100}%` as any }]} />
          </View>
          <Text style={[styles.spotsText, { color: full ? colors.error : colors.textHint }]}>
            {full ? t.eventFull : t.eventSpotsLeft(spots)}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 2.5,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  fadedCard: { opacity: 0.55 },

  // Image header
  imageWrap: { height: 200, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imageScrim: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  imageOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  overlayRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Colored header (no image)
  colorHeader: {
    height: 80,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorHeaderEmoji: { fontSize: 36 },
  colorHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Body
  body: { padding: Spacing.md, gap: Spacing.xs },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },

  countdownBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: BorderRadius.full, borderWidth: 1.5,
  },
  countdownText: { fontSize: 10, fontWeight: FontWeight.bold, includeFontPadding: false },
  joinedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  joinedText: { fontSize: FontSize.xs, color: '#fff', fontWeight: FontWeight.bold, fontFamily: DrawFont },
  bookmarkIcon: { fontSize: 16 },

  title: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, lineHeight: 23, fontFamily: DrawFont },
  description: { fontSize: FontSize.sm, lineHeight: 19 },
  meta: { fontSize: FontSize.sm, lineHeight: 18 },

  pillsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: BorderRadius.full, borderWidth: 1.5,
  },
  pillEmoji: { fontSize: 12 },
  pillText: { fontSize: 11, fontWeight: FontWeight.bold },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  friendAvatars: { flexDirection: 'row', alignItems: 'center' },
  friendAvatar: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff', overflow: 'hidden' },
  friendAvatarImg: { width: 20, height: 20, borderRadius: 10 },
  friendAvatarInitial: { fontSize: 9, fontWeight: FontWeight.bold, color: '#fff' },

  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  hypeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  hypeEmoji: { fontSize: 12 },
  hypeCount: { fontSize: 11, fontWeight: FontWeight.bold },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', borderWidth: 1.5 },
  progressFill: { height: 6, borderRadius: 3 },
  spotsText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, minWidth: 60, textAlign: 'right' },
});
