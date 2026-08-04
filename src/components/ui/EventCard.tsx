import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { format } from 'date-fns';
import { UserProfile } from '@/core/utils/userProfiles';
import { UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';
import {
  EventEntity,
  isEventFull, spotsLeft,
} from '@/features/events/domain/entities/event.entity';
import { CategoryChip } from './CategoryChip';
import { Tag } from './Tag';
import { AvatarPile } from './AvatarPile';
import { DuotoneScene } from './DuotoneScene';
import { Icon } from './Icon';
import { useTranslation, useLanguageStore, getDateLocale } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { haptics } from '@/core/utils/haptics';
import { isLeft } from '@/core/utils/either';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';
import { Card } from './Card';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const { animatedStyle: cardAnimatedStyle, onPressIn: onCardPressIn, onPressOut: onCardPressOut } = usePressAnimation(0.98);
  const bookmarkAnim = usePressAnimation(0.85);
  const full = isEventFull(event);
  const spots = spotsLeft(event);

  const friendGoingUids = user
    ? event.attendeeIds.filter((uid) => uid !== user.id && (user.following ?? []).includes(uid))
    : [];
  const friendAvatars = friendGoingUids.slice(0, 3).map((uid) => friendProfiles[uid]).filter(Boolean);

  const dateLocale = getDateLocale(language);
  const metaLine = `${format(event.dateTime, 'EEE d MMM, HH:mm', { locale: dateLocale })} · ${event.location}`;

  const caption = friendAvatars.length > 0
    ? friendGoingUids.length === 1
      ? t.eventFriendGoing(1)
      : `${friendAvatars[0].name.split(' ')[0]} +${friendGoingUids.length - 1}`
    : event.attendeeIds.length > 0
      ? t.eventGoing(event.attendeeIds.length, event.maxAttendees)
      : undefined;

  const pileProfiles = friendAvatars.length > 0
    ? friendAvatars.map((p) => ({ uid: p.uid, name: p.name, avatarColor: p.avatarColor, photoUri: p.photoUri }))
    : event.attendeeIds.slice(0, 3).map((uid) => friendProfiles[uid]).filter(Boolean).map((p) => ({ uid: p.uid, name: p.name, avatarColor: p.avatarColor, photoUri: p.photoUri }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onCardPressIn}
      onPressOut={onCardPressOut}
      style={[cardAnimatedStyle, faded && styles.fadedCard]}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          {event.imageUri ? (
            <Image source={{ uri: event.imageUri }} style={styles.image} resizeMode="cover" />
          ) : (
            <DuotoneScene category={event.category} height={132} />
          )}
          {onSave && (
            <AnimatedPressable
              onPress={(e) => { e.stopPropagation?.(); haptics.light(); onSave(); }}
              onPressIn={bookmarkAnim.onPressIn}
              onPressOut={bookmarkAnim.onPressOut}
              style={[styles.bookmarkBtn, { backgroundColor: colors.surface, borderColor: colors.border }, bookmarkAnim.animatedStyle]}
              hitSlop={8}
            >
              <Icon name="bookmark" size={16} color={isSaved ? colors.primary : colors.textSecondary} filled={isSaved} />
            </AnimatedPressable>
          )}
          {isJoined && (
            <View style={[styles.joinedBadge, { backgroundColor: colors.primary }]}>
              <Icon name="check" size={11} color="#fff" />
              <Text style={styles.joinedText}>{t.eventJoined}</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.chipRow}>
            <CategoryChip category={event.category} customLabel={event.customCategory} variant="inline" />
            {event.soloFriendly && <Tag label={t.eventSoloFriendlyTag} />}
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
            {event.title}
          </Text>

          <Text style={[styles.meta, { color: colors.textHint }]} numberOfLines={1}>
            {metaLine}
          </Text>

          <View style={styles.footer}>
            <AvatarPile
              profiles={pileProfiles}
              totalCount={event.attendeeIds.length}
              caption={caption}
              style={styles.pile}
            />
            <View style={[styles.smallBtn, { backgroundColor: isJoined || full ? colors.surfaceVariant : colors.primary }]}>
              <Text style={[styles.smallBtnText, { color: isJoined ? colors.primary : full ? colors.textHint : '#fff' }]}>
                {isJoined ? t.eventJoined : full ? t.eventFull : t.eventBtnJoin}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {},
  fadedCard: { opacity: 0.55 },

  header: { height: 132, position: 'relative' },
  image: { width: '100%', height: '100%' },
  bookmarkBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 30, height: 30, borderRadius: 15, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  joinedBadge: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  joinedText: { fontSize: 10, color: '#fff', fontWeight: FontWeight.bold, fontFamily: UIFont },

  body: { padding: 13, gap: 5 },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.25, lineHeight: 22 },
  meta: { fontSize: FontSize.md, fontFamily: UIFontLight, lineHeight: 18 },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, gap: 10 },
  pile: { flex: 1 },
  smallBtn: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 9, flexShrink: 0 },
  smallBtnText: { fontSize: 12.5, fontWeight: FontWeight.bold, fontFamily: UIFont },
});
