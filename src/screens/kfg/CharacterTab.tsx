import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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
import { KFG_CHARACTERS, KFG_COSMETICS, KfgCosmetic } from '@/core/constants/kfg';
import { useLanguageStore, useTranslation } from '@/core/i18n';
import { isLeft } from '@/core/utils/either';
import { haptics } from '@/core/utils/haptics';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import { formatPoints, kfgLevelInfo } from '@/features/kfg/format';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useTabNavigation } from '@/core/tabNavigation';
import { universityLabel } from '@/core/constants/universities';
import { Card } from '@/components/ui/Card';
import { semesterLabel } from '@/components/wrapped/WrappedSlides';
import { getSemesterBounds, getSemesterId } from '@/core/utils/weekId';
import { KFG_WRAPPED_MIN } from '@/features/kfg/wrapped';

const SLOT_ORDER = { head: 0, face: 1, neck: 2 } as const;
const ITEMS = [...KFG_COSMETICS].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);

export default function CharacterTab() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const { profile, ownedCosmetics, participations } = useKfgStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const { goToTab } = useTabNavigation();

  // Wrapped lock state: completed missions this semester (the Wrapped screen
  // recomputes exactly from the missions themselves).
  const [now] = useState(() => new Date());
  const { start: semStart, end: semEnd } = getSemesterBounds(now);
  const doneThisSemester = participations.filter((p) => {
    if (p.status !== 'completed') return false;
    const at = p.checkOutAt ?? p.joinedAt;
    return !!at && at >= semStart && at <= semEnd;
  }).length;
  const wrappedOpen = doneThisSemester >= KFG_WRAPPED_MIN;

  // Same account as the rest of Keno — this row opens your regular profile.
  const openProfile = () => {
    router.navigate('/(app)' as any);
    setTimeout(() => goToTab(4), 50);
  };

  const lifetime = profile?.lifetimePoints ?? 0;
  const balance = profile?.balance ?? 0;
  const level = kfgLevelInfo(lifetime, language);
  const equipped = profile?.equipped ?? { head: null, face: null, neck: null };
  const character = profile?.character ?? 'classic';
  const { uid } = useKfgStore();

  const pickCharacter = async (id: string) => {
    if (!uid || id === character) return;
    setBusyId(id);
    const r = await kfgRepository.setCharacter(uid, id);
    setBusyId(null);
    if (isLeft(r)) Alert.alert(t.kfgCharacters, t.kfgError(r.left.message));
    else haptics.light();
  };

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

      {user && (
        <AnimatedPressable
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel={t.kfgOpenProfileA11y}
          style={[styles.me, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {user.photoUri ? (
            <Image source={{ uri: user.photoUri }} style={styles.meAvatar} />
          ) : (
            <View style={[styles.meAvatar, { backgroundColor: user.avatarColor ?? colors.primary }]}>
              <Text style={styles.meInitial}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.meText}>
            <Text style={[styles.meName, { color: colors.textPrimary }]} numberOfLines={1}>{user.name}</Text>
            {!!user.universityName && (
              <Text style={[styles.meta, { color: colors.textHint }]} numberOfLines={1}>{universityLabel(user.universityName, language)}</Text>
            )}
          </View>
          <Text style={[styles.meLink, { color: colors.accentInk }]}>{t.kfgMyProfile}</Text>
          <Icon name="fwd" size={14} color={colors.accentInk} />
        </AnimatedPressable>
      )}

      <View style={styles.hero}>
        <View style={[styles.stage, { backgroundColor: colors.accentSoft }]}>
          <KfgCharacter size={180} equipped={equipped} character={character} />
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

      <AnimatedPressable onPress={() => router.push('/(app)/kfg/wrapped' as any)} accessibilityRole="button">
        <View style={[styles.wrappedCard, { backgroundColor: colors.primary }]}>
          <View style={styles.wrappedText}>
            <Text style={styles.wrappedKicker}>{t.kfgWrappedCardLabel}</Text>
            <Text style={styles.wrappedTitle}>{semesterLabel(getSemesterId(now), t)}</Text>
            <Text style={styles.wrappedCaption}>
              {wrappedOpen ? t.kfgWrappedCardOpen : t.kfgWrappedCardLocked(KFG_WRAPPED_MIN - doneThisSemester)}
            </Text>
          </View>
          <View style={styles.wrappedIcon}>
            <Icon name={wrappedOpen ? 'fwd' : 'lock'} size={18} color="#FAF7F2" />
          </View>
        </View>
      </AnimatedPressable>

      <AnimatedPressable onPress={() => router.push('/(app)/profile/tickets' as any)} accessibilityRole="button">
        <Card padded style={styles.ticketsRow}>
          <Icon name="ticket" size={18} color={colors.primary} />
          <Text style={[styles.meName, styles.meText, { color: colors.textPrimary }]}>{t.kfgTicketsLink}</Text>
          <Icon name="fwd" size={15} color={colors.textDecor} />
        </Card>
      </AnimatedPressable>

      <SectionLabel label={t.kfgCharacters} style={styles.section} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.characters}>
        {KFG_CHARACTERS.map((c) => {
          const on = c.id === character;
          return (
            <AnimatedPressable
              key={c.id}
              onPress={() => pickCharacter(c.id)}
              disabled={busyId === c.id}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={c.name[language]}
              style={[styles.charItem, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface }]}
            >
              <KfgCharacter size={56} character={c.id} equipped={equipped} />
              <Text style={[styles.charName, { color: on ? colors.accentInk : colors.textHint }]} numberOfLines={1}>{c.name[language]}</Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>

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
                <KfgCharacter size={64} equipped={{ [item.slot]: item.id }} character={character} />
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
  wrappedCard: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.lg, padding: Spacing.base, gap: Spacing.md },
  wrappedText: { flex: 1, gap: 2 },
  wrappedKicker: { fontSize: 10.5, letterSpacing: 2, fontFamily: UIFont, fontWeight: FontWeight.bold, color: 'rgba(250,247,242,0.75)' },
  wrappedTitle: { fontSize: FontSize.xl, fontFamily: TitleFont, fontWeight: FontWeight.bold, color: '#FAF7F2' },
  wrappedCaption: { fontSize: FontSize.sm, color: 'rgba(250,247,242,0.85)' },
  wrappedIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(250,247,242,0.18)' },
  ticketsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  me: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md },
  meAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  meInitial: { color: '#fff', fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  meText: { flex: 1, gap: 2 },
  meName: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  meLink: { fontFamily: UIFont, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  stage: { width: 200, height: 200, borderRadius: 100, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', marginBottom: Spacing.sm },
  levelName: { fontFamily: TitleFont, fontSize: FontSize.xxl, fontWeight: FontWeight.bold, letterSpacing: -0.4 },
  meta: { fontFamily: UIFontLight, fontSize: FontSize.md },
  track: { alignSelf: 'stretch', marginVertical: 6 },
  section: { marginTop: Spacing.sm },
  characters: { gap: Spacing.sm, paddingRight: Spacing.gutter },
  charItem: { width: 84, alignItems: 'center', gap: 2, borderWidth: 1, borderRadius: BorderRadius.lg, paddingVertical: Spacing.sm },
  charName: { fontFamily: UIFont, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
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
