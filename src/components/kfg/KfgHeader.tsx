import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Icon } from '@/components/ui/Icon';
import { DarkColors, LightColors, useTheme } from '@/core/theme';
import { FontSize, FontWeight, LogoFont, UIFont } from '@/core/constants/theme';
import { useLanguageStore, useTranslation } from '@/core/i18n';
import { formatPoints } from '@/features/kfg/format';

// Top row of every Keno for Good tab: "‹ keno." back to the main app on the
// left, the spendable points balance on the right. The wordmark keeps Keno's
// own terracotta period — it's the way out of the green section.
export function KfgHeader({ balance }: { balance: number }) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const kenoAccent = (isDark ? DarkColors : LightColors).primary;

  return (
    <View style={styles.row}>
      <AnimatedPressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel={t.kfgBackA11y}
        hitSlop={8}
        style={styles.back}
      >
        <Icon name="back" size={17} color={colors.textPrimary} />
        <Text style={[styles.wordmark, { color: colors.textPrimary }]}>
          keno<Text style={{ color: kenoAccent }}>.</Text>
        </Text>
      </AnimatedPressable>
      <View style={[styles.pill, { backgroundColor: colors.accentSoft }]} accessibilityLabel={t.kfgPoints(formatPoints(balance, language))}>
        <Icon name="star" size={13} color={colors.accentInk} />
        <Text style={[styles.pillText, { color: colors.accentInk }]}>{formatPoints(balance, language)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingRight: 8 },
  wordmark: { fontFamily: LogoFont, fontSize: 21, fontWeight: FontWeight.bold, letterSpacing: -1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  pillText: { fontFamily: UIFont, fontSize: FontSize.md, fontWeight: FontWeight.bold },
});
