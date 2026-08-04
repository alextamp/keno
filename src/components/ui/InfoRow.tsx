import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { UIFont, UIFontLight, FontSize, FontWeight } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';
import { Icon, IconName } from './Icon';

// Warm Paper info row (spec §4): 18px line icon in ink.dim + two-line text
// block (15/700 over 13 faint). No boxes, no dividers; 13px vertical rhythm.
export function InfoRow({
  icon,
  title,
  subtitle,
  style,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={18} color={colors.textSecondary} />
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textHint }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 9 },
  iconWrap: { marginTop: 1 },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  subtitle: { fontSize: FontSize.md, fontFamily: UIFontLight, marginTop: 2, lineHeight: 18 },
});
