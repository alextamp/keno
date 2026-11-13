import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { ProgressTrack } from '@/components/ui/ProgressTrack';
import { useTheme } from '@/core/theme';
import { FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { useLanguageStore, useTranslation } from '@/core/i18n';
import { KfgProfile } from '@/features/kfg/domain/entities/kfg.entity';
import { formatPoints, kfgLevelInfo } from '@/features/kfg/format';
import { KfgCharacter } from './KfgCharacter';

/** Character + level name, 4px progress to the next level, weekly streak. */
export function KfgLevelCard({ profile }: { profile: KfgProfile | null }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const level = kfgLevelInfo(profile?.lifetimePoints ?? 0, language);
  const streak = profile?.streakWeeks ?? 0;

  return (
    <Card padded style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
        <KfgCharacter size={60} equipped={profile?.equipped} character={profile?.character} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.level, { color: colors.textPrimary }]}>{level.label}</Text>
        <Text style={[styles.sub, { color: colors.textHint }]}>{t.kfgLevel(level.level)}</Text>
        <ProgressTrack progress={level.progress} style={styles.track} />
        <Text style={[styles.sub, { color: colors.textHint }]}>
          {level.next ? t.kfgPointsToLevel(formatPoints(level.pointsToNext, language), level.next.level) : t.kfgMaxLevel}
        </Text>
        {streak > 0 && (
          <View style={styles.streak}>
            <Icon name="flame" size={13} color={colors.accentInk} />
            <Text style={[styles.streakText, { color: colors.accentInk }]}>{t.kfgStreakWeeks(streak)}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.base },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  body: { flex: 1, gap: 3 },
  level: { fontFamily: TitleFont, fontSize: FontSize.xl, fontWeight: FontWeight.bold, letterSpacing: -0.25 },
  sub: { fontFamily: UIFontLight, fontSize: FontSize.md },
  track: { marginVertical: 6 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  streakText: { fontFamily: UIFont, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
