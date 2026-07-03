import React, { useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/core/constants/colors';
import { BorderRadius, DrawFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset);
  const t = useTranslation();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e: any) {
      // Firebase returns auth/user-not-found for unknown emails.
      // We show a generic success message anyway to prevent email enumeration.
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: Colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        <AnimatedPressable onPress={() => router.back()} style={[styles.backBtn, { borderColor: Colors.borderStrong }]}>
          <Text style={[styles.backText, { fontFamily: DrawFont }]}>←</Text>
        </AnimatedPressable>

        {sent ? (
          <View style={styles.sentContainer}>
            <Text style={styles.sentEmoji}>📬</Text>
            <Text style={[styles.title, { color: Colors.textPrimary }]}>{t.authForgotSent}</Text>
            <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>{t.authForgotSentBody}</Text>
            <Button
              label={t.authSignInBtn}
              onPress={() => router.replace('/(auth)/sign-in')}
              fullWidth
            />
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: Colors.textPrimary }]}>{t.authForgotTitle}</Text>
              <Text style={[styles.subtitle, { color: Colors.textSecondary }]}>{t.authForgotSubtitle}</Text>
            </View>

            <View style={styles.form}>
              {!!error && (
                <View style={[styles.errorBanner, { borderColor: Colors.borderStrong }]}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <Input
                label={t.authEmailLabel}
                value={email}
                onChangeText={setEmail}
                placeholder="you@aueb.gr"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
              <Button
                label={t.authForgotBtn}
                onPress={handleSend}
                loading={loading}
                disabled={!email.trim()}
                fullWidth
              />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  backBtn: {
    alignSelf: 'flex-start',
    borderWidth: 2,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  backText: { fontSize: FontSize.md, color: Colors.primary, fontWeight: FontWeight.bold },
  header: { gap: Spacing.sm },
  title: { fontSize: 28, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  subtitle: { fontSize: FontSize.md, lineHeight: 22 },
  form: { gap: Spacing.md },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 2.5,
  },
  errorText: { fontSize: FontSize.sm, color: Colors.error, fontWeight: FontWeight.medium },
  sentContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingVertical: Spacing.xxl },
  sentEmoji: { fontSize: 64 },
});
