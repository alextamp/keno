import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Icon } from '@/components/ui/Icon';
import { AccentScopeProvider, useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { useLanguageStore, useTranslation } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import { formatPoints, kfgLevelInfo } from '@/features/kfg/format';
import { openMissionsFor } from '@/features/kfg/missions';
import { KfgCharacter } from './KfgCharacter';

/** The quiet Feed card that leads into Keno for Good. `flush` drops its own
 *  side/bottom margins, for screens whose content is already padded (Profile). */
export function KfgEntryCard({ flush = false }: { flush?: boolean }) {
  return (
    <AccentScopeProvider value="kfg">
      <EntryCardInner flush={flush} />
    </AccentScopeProvider>
  );
}

function EntryCardInner({ flush }: { flush: boolean }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const router = useRouter();
  const { language } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const { profile, missions, participations, start, stop } = useKfgStore();

  useEffect(() => {
    if (!user) return;
    start(user.id);
    return stop;
  }, [user?.id]);

  const waiting = useMemo(
    () => (user ? openMissionsFor(missions, participations, user.id).length : 0),
    [missions, participations, user?.id],
  );
  if (!user) return null;

  const lifetime = profile?.lifetimePoints ?? 0;
  const level = kfgLevelInfo(lifetime, language);

  return (
    <AnimatedPressable
      onPress={() => router.push('/(app)/kfg' as any)}
      accessibilityRole="button"
      accessibilityLabel={t.kfgOpenA11y}
      style={[styles.card, flush && styles.flush, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.accentSoft }]}>
        <KfgCharacter size={50} equipped={profile?.equipped} character={profile?.character} />
      </View>
      <View style={styles.text}>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.label, { color: colors.textHint }]}>KENO FOR GOOD</Text>
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{t.kfgFeedTitle(waiting)}</Text>
        <Text style={[styles.meta, { color: colors.textHint }]} numberOfLines={1}>
          {t.kfgFeedMeta(level.level, formatPoints(lifetime, language))}
        </Text>
      </View>
      <Icon name="fwd" size={15} color={colors.textDecor} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md,
    marginHorizontal: Spacing.gutter, marginBottom: Spacing.md,
  },
  flush: { marginHorizontal: 0, marginBottom: 0 },
  thumb: { width: 56, height: 56, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  text: { flex: 1, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: { fontFamily: UIFont, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1.2 },
  title: { fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  meta: { fontFamily: UIFontLight, fontSize: FontSize.md },
});
