import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/core/theme';
import { FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';

export default function PendingVerificationScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const t = useTranslation();
  const rejected = user?.idVerificationStatus === 'rejected';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.surfaceVariant }]}>
        <Text style={styles.iconEmoji}>{rejected ? '❌' : '🪪'}</Text>
      </View>

      <View style={styles.textGroup}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {rejected ? t.pendingVerificationRejectedTitle : t.pendingVerificationTitle}
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {rejected ? t.pendingVerificationRejectedBody : t.pendingVerificationBody}
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          label={t.verifyBtnSignOut}
          onPress={signOut}
          variant="ghost"
          labelStyle={{ color: colors.textSecondary }}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 40 },
  textGroup: { gap: Spacing.sm, alignItems: 'center' },
  title: {
    fontSize: 28,
    fontWeight: FontWeight.extrabold,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  actions: { width: '100%', gap: Spacing.sm },
});
