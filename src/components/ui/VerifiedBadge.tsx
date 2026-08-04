import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/core/theme';
import { UIFont, BorderRadius, FontWeight } from '@/core/constants/theme';
import { Icon, IconName } from './Icon';
import { useTranslation } from '@/core/i18n';

// Shown once someone has checked in to VERIFIED_CHECKIN_THRESHOLD+ events
// (gamification.ts isVerifiedUser) — proof they actually show up, visible
// on both their own profile and their public profile page. Also reused for
// the "Regular" consistency badge (isRegularUser) with a different icon.
export function VerifiedBadge({ label, icon = 'shield' }: { label?: string; icon?: IconName } = {}) {
  const { colors } = useTheme();
  const t = useTranslation();
  return (
    <View style={[styles.badge, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}>
      <Icon name={icon} size={11} color={colors.primary} />
      <Text style={[styles.text, { color: colors.primary }]}>{label ?? t.verifiedBadgeLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: BorderRadius.full, borderWidth: 1,
    paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start',
  },
  text: { fontSize: 9.5, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 0.3 },
});
