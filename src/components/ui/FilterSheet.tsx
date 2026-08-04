import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme';
import { UIFont, TitleFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { AnimatedPressable } from './AnimatedPressable';
import { SectionLabel } from './SectionLabel';
import { haptics } from '@/core/utils/haptics';

export type FeedRadius = 1 | 5 | 10 | null; // null = "Παντού" (everywhere)
export type FeedWhen = 'today' | 'tomorrow' | 'weekend' | null;

interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  radiusKm: FeedRadius;
  onRadiusChange: (r: FeedRadius) => void;
  when: FeedWhen;
  onWhenChange: (w: FeedWhen) => void;
  uniOnly: boolean;
  onUniOnlyChange: (v: boolean) => void;
  soloFriendly: boolean;
  onSoloFriendlyChange: (v: boolean) => void;
  /** Live count of events the current filter combination matches. */
  resultCount: number;
  onClear: () => void;
}

function SheetChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable onPress={onPress} scaleTo={0.96}>
      <View
        style={[
          styles.chip,
          { backgroundColor: active ? colors.accentSoft : colors.surface, borderColor: active ? colors.primary : colors.border },
        ]}
      >
        <Text style={[styles.chipText, { color: active ? colors.accentInk : colors.textSecondary, fontWeight: active ? FontWeight.semibold : FontWeight.medium }]}>
          {label}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

// Warm Paper filter bottom-sheet (mockup 10 · design/screens.html "10 · Φίλτρα"):
// grab handle, "Φίλτρα" + "Καθαρισμός", three chip-groups (ΑΠΟΣΤΑΣΗ / ΠΟΤΕ /
// ΠΟΙΟΙ, each single-select except ΠΟΙΟΙ which is independent toggles), and a
// full-width "Δείξε N events" button reflecting the live filtered count.
export function FilterSheet({
  visible, onClose,
  radiusKm, onRadiusChange,
  when, onWhenChange,
  uniOnly, onUniOnlyChange,
  soloFriendly, onSoloFriendlyChange,
  resultCount, onClear,
}: FilterSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();

  const RADII: { key: string; value: FeedRadius }[] = [
    { key: t.filterRadius1, value: 1 },
    { key: t.filterRadius5, value: 5 },
    { key: t.filterRadius10, value: 10 },
    { key: t.filterRadiusAll, value: null },
  ];
  const WHENS: { key: string; value: Exclude<FeedWhen, null> }[] = [
    { key: t.filterWhenToday, value: 'today' },
    { key: t.filterWhenTomorrow, value: 'tomorrow' },
    { key: t.filterWhenWeekend, value: 'weekend' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 20 }]}>
        <View style={[styles.grab, { backgroundColor: colors.border }]} />

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t.filterSheetTitle}</Text>
          <AnimatedPressable onPress={() => { haptics.light(); onClear(); }} hitSlop={8}>
            <Text style={[styles.clear, { color: colors.textHint }]}>{t.filterSheetClear}</Text>
          </AnimatedPressable>
        </View>

        <SectionLabel label={t.filterDistanceLabel} style={styles.label} />
        <View style={styles.row}>
          {RADII.map((r) => (
            <SheetChip
              key={r.key}
              label={r.key}
              active={radiusKm === r.value}
              onPress={() => { haptics.light(); onRadiusChange(radiusKm === r.value ? null : r.value); }}
            />
          ))}
        </View>

        <SectionLabel label={t.filterWhenLabel} style={styles.label} />
        <View style={styles.row}>
          {WHENS.map((w) => (
            <SheetChip
              key={w.value}
              label={w.key}
              active={when === w.value}
              onPress={() => { haptics.light(); onWhenChange(when === w.value ? null : w.value); }}
            />
          ))}
        </View>

        <SectionLabel label={t.filterWhoLabel} style={styles.label} />
        <View style={[styles.row, styles.lastRow]}>
          <SheetChip label={t.filterWhoUni} active={uniOnly} onPress={() => { haptics.light(); onUniOnlyChange(!uniOnly); }} />
          <SheetChip label={t.filterWhoSolo} active={soloFriendly} onPress={() => { haptics.light(); onSoloFriendlyChange(!soloFriendly); }} />
        </View>

        <AnimatedPressable onPress={() => { haptics.medium(); onClose(); }} style={[styles.showBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.showBtnText}>{t.filterShowEvents(resultCount)}</Text>
        </AnimatedPressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.gutter,
    paddingTop: 10,
  },
  grab: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.4 },
  clear: { fontSize: FontSize.base, fontFamily: UIFont, fontWeight: FontWeight.semibold },
  label: { marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  lastRow: { marginBottom: 22 },
  chip: {
    borderRadius: BorderRadius.full, borderWidth: 1,
    paddingHorizontal: Spacing.base, paddingVertical: 9,
  },
  chipText: { fontSize: FontSize.base, fontFamily: UIFont },
  showBtn: { borderRadius: BorderRadius.md, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  showBtnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
});
