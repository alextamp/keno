import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from './Button';
import { Icon } from './Icon';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';

interface Props {
  visible: boolean;
  /** 'levelUp' — shown right after creating the first-ever event, while
   *  still in "Νέος στην πόλη" mode. 'exitMode' — shown right after the
   *  first-ever real check-in, which is also when the mode ends. */
  variant: 'levelUp' | 'exitMode';
  xpAmount: number;
  fromLevelName?: string;
  toLevelName?: string;
  onContinue: () => void;
}

// Full-screen celebratory moment for the two "Νέος στην πόλη" (newcomer
// mode) milestones — mirrors the dedicated checkin success screen's halo
// treatment, but as a dismissible overlay since CreateTab has no success
// route of its own to redirect to.
export function NewcomerMilestoneModal({ visible, variant, xpAmount, fromLevelName, toLevelName, onContinue }: Props) {
  const { colors } = useTheme();
  const t = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onContinue}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}>
            <Icon name={variant === 'levelUp' ? 'zap' : 'check'} size={32} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {variant === 'levelUp' ? t.newcomerLevelUpTitle : t.newcomerExitTitle}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textHint }]}>
            {variant === 'levelUp' ? t.newcomerLevelUpBody : t.newcomerExitBody}
          </Text>

          <View style={[styles.xpCard, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.xpText, { color: colors.primary }]}>+{xpAmount} XP</Text>
            {variant === 'levelUp' && fromLevelName && toLevelName ? (
              <View style={styles.levelRow}>
                <Text style={[styles.levelTextFrom, { color: colors.textHint }]}>{fromLevelName}</Text>
                <Text style={[styles.levelArrow, { color: colors.primary }]}>→</Text>
                <Text style={[styles.levelTextTo, { color: colors.primary }]}>{toLevelName}</Text>
              </View>
            ) : (
              <Text style={[styles.exitNote, { color: colors.textHint }]}>{t.newcomerBadgeRemoved}</Text>
            )}
          </View>

          <Button label={t.newcomerContinueBtn} onPress={onContinue} fullWidth />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.gutter },
  card: { width: '100%', borderRadius: BorderRadius.xl, padding: Spacing.lg, alignItems: 'center', gap: Spacing.md },
  iconCircle: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont, textAlign: 'center', letterSpacing: -0.4 },
  subtitle: { fontSize: FontSize.base, fontFamily: UIFontLight, textAlign: 'center', lineHeight: 20 },
  xpCard: { width: '100%', borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: 8 },
  xpText: { fontSize: 30, fontWeight: FontWeight.bold, fontFamily: TitleFont },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelTextFrom: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  levelArrow: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  levelTextTo: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  exitNote: { fontSize: FontSize.sm, textAlign: 'center', fontFamily: UIFontLight, lineHeight: 18 },
});
