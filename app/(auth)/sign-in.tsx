import React, { useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Colors } from '@/core/constants/colors';
import { BorderRadius, DrawFont, FontSize, FontWeight, LogoFont, Spacing } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';

export default function SignInScreen() {
  const router = useRouter();
  const signIn = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const t = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);

  const handleSignIn = async () => {
    clearError();
    await signIn({ email: email.trim().toLowerCase(), password });
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
        <View style={styles.brand}>
          <Text style={styles.logo}>KeNo.</Text>
          <Text style={styles.tagline}>{t.authTagline}</Text>
        </View>

        <View style={styles.form}>
          {error && (
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
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Input
            ref={passwordRef}
            label={t.authPasswordLabel}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="current-password"
            returnKeyType="done"
            onSubmitEditing={handleSignIn}
          />

          <Button
            label={t.authSignInBtn}
            onPress={handleSignIn}
            loading={isLoading}
            disabled={!email || !password}
            fullWidth
          />
          <AnimatedPressable onPress={() => router.push('/(auth)/forgot-password' as any)} style={styles.forgotBtn}>
            <Text style={styles.forgotText}>{t.authForgotLink}</Text>
          </AnimatedPressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t.authNoAccount}</Text>
          <Link href="/(auth)/sign-up" asChild>
            <AnimatedPressable>
              <Text style={styles.footerLink}>{t.authSignUpLink}</Text>
            </AnimatedPressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
    gap: Spacing.xl,
  },
  brand: { alignItems: 'center', gap: Spacing.sm },
  logo: {
    fontSize: 64,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    fontFamily: LogoFont,
  },
  tagline: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  form: { gap: Spacing.md },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 2.5,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: FontWeight.medium,
  },
  forgotBtn: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { fontSize: FontSize.sm, color: Colors.textSecondary, fontWeight: FontWeight.medium },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: { fontSize: FontSize.md, color: Colors.textSecondary },
  footerLink: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    fontFamily: DrawFont,
  },
});
