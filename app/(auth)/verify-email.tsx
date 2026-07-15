import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const sendEmailVerification = useAuthStore((s) => s.sendEmailVerification);
  const reloadAndCheckVerification = useAuthStore((s) => s.reloadAndCheckVerification);
  const signOut = useAuthStore((s) => s.signOut);
  const t = useTranslation();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = async () => {
    setResending(true);
    const ok = await sendEmailVerification();
    setResending(false);
    if (!ok) { Alert.alert(t.verifyTitle, t.verifyResendError); return; }
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  };

  const handleCheck = async () => {
    setChecking(true);
    await reloadAndCheckVerification();
    setChecking(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.surfaceVariant }]}>
        <Text style={styles.iconEmoji}>✉️</Text>
      </View>

      <View style={styles.textGroup}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t.verifyTitle}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{t.verifyBody}</Text>
        <Text style={[styles.hint, { color: colors.textHint }]}>{t.verifySpamHint}</Text>
      </View>

      {resent && (
        <View style={[styles.successBanner, { borderLeftColor: colors.success }]}>
          <Text style={[styles.successText, { color: colors.success }]}>{t.verifyResent}</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Button
          label={t.verifyBtnCheck}
          onPress={handleCheck}
          loading={checking}
          fullWidth
        />
        <Button
          label={t.verifyBtnResend}
          onPress={handleResend}
          loading={resending}
          disabled={resent}
          fullWidth
        />
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
  hint: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  successBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    width: '100%',
  },
  successText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  actions: { width: '100%', gap: Spacing.sm },
});
