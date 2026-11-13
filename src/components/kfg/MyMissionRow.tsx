import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { format } from 'date-fns';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Icon } from '@/components/ui/Icon';
import { Tag } from '@/components/ui/Tag';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { getDateLocale, useLanguageStore, useTranslation } from '@/core/i18n';
import { KfgMission } from '@/features/kfg/domain/entities/kfg.entity';
import { CAUSE_ICONS } from './KfgMissionRow';

/** A mission the user created, in "My missions": when, sign-ups and where it stands (pending/live/…). */
export function MyMissionRow({ mission, over, first, onPress }: {
  mission: KfgMission; over: boolean; first: boolean; onPress: () => void;
}) {
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const when = format(mission.startsAt, 'EEE d MMM HH:mm', { locale: getDateLocale(language) });
  const meta = `${when} · ${mission.participantCount}/${mission.capacity}`;
  const state = t.kfgMissionState(mission.status, over);
  const active = mission.status === 'pending' || (mission.status === 'published' && !over);

  return (
    <AnimatedPressable
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole="button"
      accessibilityLabel={`${mission.title}, ${meta}, ${state}`}
      style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: colors.border }]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.accentSoft }]}>
        <Icon name={CAUSE_ICONS[mission.cause]} size={20} color={colors.primary} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{mission.title}</Text>
        <Text style={[styles.meta, { color: colors.textHint }]} numberOfLines={1}>{meta}</Text>
      </View>
      <Tag label={state} variant={active ? 'accent' : 'neutral'} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, minHeight: 66 },
  thumb: { width: 42, height: 42, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 3 },
  title: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  meta: { fontFamily: UIFontLight, fontSize: FontSize.md },
});
