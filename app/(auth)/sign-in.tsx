import React, { useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/core/theme';
import { BorderRadius, UIFont, UIFontLight, LogoFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';

export default function SignInScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const signIn = useAuthStore((s) => s.signIn);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const user = useAuthStore((s) => s.user);
  // AuthGate (app/_layout.tsx) does redirect to /(auth)/pending-verification
  // once the post-sign-in profile load resolves, but that's a second or two
  // after the Connect button's own spinner already stops (signIn() only
  // awaits the Firebase Auth call, not the Firestore profile load that
  // follows it) — during that gap the screen looks like it did nothing.
  // Surfacing the status here immediately removes that dead-feeling pause,
  // on top of whatever screen the redirect lands on a moment later.
  const pendingIdVerification = user?.idVerificationStatus === 'pending';
  const rejectedIdVerification = user?.idVerificationStatus === 'rejected';
  const t = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);

  const handleSignIn = async () => {
    clearError();
    await signIn({ email: email.trim().toLowerCase(), password });
    // Correct credentials but an unverified account: onAuthStateChanged
    // deliberately keeps `user`/isEmailVerified false for these (see
    // auth.store), so nothing here otherwise tells the router to move —
    // without this the screen just sits there looking like nothing happened.
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      router.replace('/(auth)/verify-email');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.brand}>
          <View style={[styles.mk, { backgroundColor: colors.primary }]}>
            <Text style={styles.mkLetter}>k.</Text>
          </View>
          <Text style={[styles.wordmark, { color: colors.textPrimary }]}>
            keno<Text style={{ color: colors.primary }}>.</Text>
          </Text>
          <Text style={[styles.tagline, { color: colors.textHint }]}>{t.authTagline}</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={[styles.errorBanner, { borderColor: colors.error }]}>
              <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
            </View>
          )}

          {(pendingIdVerification || rejectedIdVerification) && (
            <View style={[styles.infoBanner, { borderColor: colors.primary, backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.infoTitle, { color: colors.accentInk }]}>
                {rejectedIdVerification ? t.pendingVerificationRejectedTitle : t.pendingVerificationTitle}
              </Text>
              <Text style={[styles.infoText, { color: colors.accentInk }]}>
                {rejectedIdVerification ? t.pendingVerificationRejectedBody : t.pendingVerificationBody}
              </Text>
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
            <Text style={[styles.forgotText, { color: colors.textSecondary }]}>{t.authForgotLink}</Text>
          </AnimatedPressable>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t.authNoAccount}</Text>
          <Link href="/(auth)/sign-up" asChild>
            <AnimatedPressable>
              <Text style={[styles.footerLink, { color: colors.primary }]}>{t.authSignUpLink}</Text>
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
  brand: { alignItems: 'center', gap: 4 },
  mk: { width: 64, height: 64, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  mkLetter: { fontFamily: LogoFont, fontWeight: FontWeight.bold, fontSize: 38, color: '#FBF3EA', lineHeight: 42 },
  wordmark: { fontFamily: LogoFont, fontWeight: FontWeight.bold, fontSize: 26, letterSpacing: -1 },
  tagline: {
    fontSize: FontSize.base,
    fontFamily: UIFontLight,
    textAlign: 'center',
    marginTop: 4,
  },
  form: { gap: Spacing.md },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  infoBanner: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    fontFamily: UIFont,
  },
  infoText: {
    fontSize: FontSize.sm,
    fontFamily: UIFontLight,
    lineHeight: 19,
  },
  forgotBtn: { alignItems: 'center', paddingVertical: 4 },
  forgotText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: { fontSize: FontSize.md },
  footerLink: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    fontFamily: UIFont,
  },
});
