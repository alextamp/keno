import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Icon } from '@/components/ui/Icon';
import { ProgressTrack } from '@/components/ui/ProgressTrack';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { KfgCharacter } from '@/components/kfg/KfgCharacter';
import { KfgHeader } from '@/components/kfg/KfgHeader';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { KFG_COSMETICS, KfgCosmetic } from '@/core/constants/kfg';
import { useLanguageStore, useTranslation } from '@/core/i18n';
import { isLeft } from '@/core/utils/either';
import { haptics } from '@/core/utils/haptics';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import { formatPoints, kfgLevelInfo } from '@/features/kfg/format';

const SLOT_ORDER = { head: 0, face: 1, neck: 2 } as const;
const ITEMS = [...KFG_COSMETICS].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);

export default function CharacterTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const { profile, ownedCosmetics } = useKfgStore();
  const [busyId, setBusyId] = useState<string | null>(null);

  const lifetime = profile?.lifetimePoints ?? 0;
  const balance = profile?.balance ?? 0;
  const level = kfgLevelInfo(lifetime, language);
  const equipped = profile?.equipped ?? { head: null, face: null, neck: null };

  const toggleWear = async (item: KfgCosmetic) => {
    if (!profile) return;
    const wearing = equipped[item.slot] === item.id;
    setBusyId(item.id);
    const r = await kfgRepository.equip(profile.uid, { ...equipped, [item.slot]: wearing ? null : item.id });
    setBusyId(null);
    if (isLeft(r)) Alert.alert(t.kfgWardrobe, t.kfgError(r.left.message));
    else haptics.light();
  };

  const buy = (item: KfgCosmetic, price: number) => {
    if (balance < price) { Alert.alert(t.kfgBuyTitle, t.kfgError('not-enough-points')); return; }
    Alert.alert(t.kfgBuyTitle, t.kfgBuyConfirm(item.name[language], formatPoints(price, language)), [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: t.kfgBuyBtn,
        onPress: async () => {
          setBusyId(item.id);
          const r = await kfgRepository.purchase(item.id);
          setBusyId(null);
          if (isLeft(r)) { Alert.alert(t.kfgBuyTitle, t.kfgError(r.left.message)); return; }
          haptics.success();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 6, paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 24 }]}
    >
      <KfgHeader balance={balance} />

      <View style={styles.hero}>
        <View style={[styles.stage, { backgroundColor: colors.accentSoft }]}>
          <KfgCharacter size={180} equipped={equipped} />
        </View>
        <Text style={[styles.levelName, { color: colors.textPrimary }]}>{level.label}</Text>
        <Text style={[styles.meta, { color: colors.textHint }]}>
          {t.kfgLevel(level.level)} · {t.kfgPoints(formatPoints(lifetime, language))}
        </Text>
        <ProgressTrack progress={level.progress} style={styles.track} />
        <Text style={[styles.meta, { color: colors.textHint }]}>
          {level.next ? t.kfgPointsToLevel(formatPoints(level.pointsToNext, language), level.next.level) : t.kfgMaxLevel}
        </Text>
      </View>

      <View style={styles.wardrobeHead}>
        <SectionLabel label={t.kfgWardrobe} />
        <Text style={[styles.meta, { color: colors.textHint }]}>{t.kfgBalanceLine(formatPoints(balance, language))}</Text>
      </View>

      <View style={styles.grid}>
        {ITEMS.map((item) => {
          const owned = ownedCosmetics.includes(item.id);
          const wearing = owned && equipped[item.slot] === item.id;
          const locked = !owned && item.unlock.type !== 'price';
          const price = item.unlock.type === 'price' ? item.unlock.points : null;
          const state = wearing ? t.kfgWearing
            : owned ? t.kfgOwned
              : item.unlock.type === 'level' ? t.kfgLockedLevel(item.unlock.level)
                : item.unlock.type === 'leaderboard' ? t.kfgLockedTop(item.unlock.top)
                  : t.kfgPointsShort(formatPoints(price ?? 0, language));
          return (
            <AnimatedPressable
              key={item.id}
              disabled={locked || busyId === item.id}
              onPress={() => (owned ? toggleWear(item) : price != null ? buy(item, price) : undefined)}
              accessibilityRole="button"
              accessibilityState={{ selected: wearing, disabled: locked }}
              accessibilityLabel={`${item.name[language]}, ${state}`}
              style={[
                styles.item,
                {
                  backgroundColor: wearing ? colors.accentSoft : colors.surface,
                  borderColor: wearing ? colors.primary : colors.border,
                  borderStyle: locked ? 'dashed' : 'solid',
                },
              ]}
            >
              <View style={styles.itemArt}>
                <KfgCharacter size={64} equipped={{ [item.slot]: item.id }} />
                {locked && (
                  <View style={[styles.lockBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Icon name="lock" size={11} color={colors.textHint} />
                  </View>
                )}
              </View>
              <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name[language]}</Text>
              <Text style={[styles.itemState, { color: wearing || owned ? colors.accentInk : colors.textHint }]} numberOfLines={1}>{state}</Text>
            </AnimatedPressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.md },
  hero: { alignItems: 'center', gap: 4, marginTop: Spacing.sm },
  stage: { width: 200, height: 200, borderRadius: 100, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', marginBottom: Spacing.sm },
  levelName: { fontFamily: TitleFont, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, letterSpacing: -0.4 },
  meta: { fontFamily: UIFontLight, fontSize: FontSize.md },
  track: { alignSelf: 'stretch', marginVertical: 6 },
  wardrobeHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  item: {
    width: '31.5%', borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.sm,
    alignItems: 'center', gap: 2, minHeight: 44,
  },
  itemArt: { width: 64, height: 64 },
  lockBadge: {
    position: 'absolute', right: -2, top: -2, width: 20, height: 20, borderRadius: 10, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  itemName: { fontFamily: UIFont, fontSize: FontSize.sm, fontWeight: FontWeight.bold, textAlign: 'center' },
  itemState: { fontFamily: UIFontLight, fontSize: FontSize.sm, textAlign: 'center' },
});
