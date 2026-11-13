import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Icon, IconName } from '@/components/ui/Icon';
import { Tag } from '@/components/ui/Tag';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { getDateLocale, useLanguageStore, useTranslation } from '@/core/i18n';
import { KfgCause, KfgMission } from '@/features/kfg/domain/entities/kfg.entity';
import { formatPoints } from '@/features/kfg/format';

export const CAUSE_ICONS: Record<KfgCause, IconName> = {
  food: 'gift', animals: 'heart', environment: 'globe', recycling: 'trash', people: 'users', other: 'star',
};

/** One mission in the "this week" list: tinted cause icon, title, meta, points + how it's verified. */
export function KfgMissionRow({ mission, joined, first, onPress }: {
  mission: KfgMission; joined: boolean; first: boolean; onPress: () => void;
}) {
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const when = format(mission.startsAt, 'EEEE HH:mm', { locale: getDateLocale(language) });
  const meta = [when, mission.areaLabel, joined ? null : t.kfgSpotsLeft(mission.capacity - mission.participantCount)]
    .filter(Boolean).join(' · ');

  return (
    <AnimatedPressable
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${mission.title}, ${meta}, +${mission.points}`}
      style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.accentSoft }]}>
        {mission.imageUri
          ? <Image source={{ uri: mission.imageUri }} style={StyleSheet.absoluteFill} />
          : <Icon name={CAUSE_ICONS[mission.cause]} size={22} color={colors.primary} />}
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{mission.title}</Text>
        <Text style={[styles.meta, { color: colors.textHint }]} numberOfLines={1}>{meta}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.points, { color: colors.accentInk }]}>+{formatPoints(mission.points, language)}</Text>
        <Tag
          label={joined ? t.kfgJoinedTag : t.kfgVerifyLabel(mission.kind, mission.creatorType === 'student')}
          variant={joined ? 'accent' : 'neutral'}
        />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, minHeight: 74 },
  thumb: { width: 50, height: 50, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  info: { flex: 1, gap: 3 },
  title: { fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  meta: { fontFamily: UIFontLight, fontSize: FontSize.md },
  right: { alignItems: 'flex-end', gap: 5 },
  points: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
});
