import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Colors } from '@/core/constants/colors';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';

export default function VerifyEmailScreen() {
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
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconEmoji}>✉️</Text>
      </View>

      <View style={styles.textGroup}>
        <Text style={styles.title}>{t.verifyTitle}</Text>
        <Text style={styles.body}>{t.verifyBody}</Text>
      </View>

      {resent && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{t.verifyResent}</Text>
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
          variant="outline"
          loading={resending}
          disabled={resent}
          fullWidth
        />
        <Button
          label={t.verifyBtnSignOut}
          onPress={signOut}
          variant="ghost"
          labelStyle={{ color: Colors.textSecondary }}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: { fontSize: 40 },
  textGroup: { gap: Spacing.sm, alignItems: 'center' },
  title: {
    fontSize: 28,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  successBanner: {
    backgroundColor: '#F0FDF4',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
    width: '100%',
  },
  successText: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: FontWeight.medium,
  },
  actions: { width: '100%', gap: Spacing.sm },
});
