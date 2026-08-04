import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { LogoFont, TitleFont, UIFontLight, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { Button } from '@/components/ui/Button';

// Mockup 01 (welcome/splash) — this screen didn't exist before; AuthGate in
// app/_layout.tsx used to send signed-out users straight to /(auth)/sign-in.
// It now lands here first (see the one-line redirect-target change there),
// keeping sign-in/sign-up completely untouched.
export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.center}>
        <View style={[styles.mark, { backgroundColor: colors.primary }]}>
          <Text style={styles.markLetter}>κ</Text>
        </View>

        <Text style={[styles.wordmark, { color: colors.textPrimary }]}>
          keno<Text style={{ color: colors.primary }}>.</Text>
        </Text>

        <Text style={[styles.tagline, { color: colors.textPrimary }]}>{t.welcomeTagline}</Text>
        <Text style={[styles.body, { color: colors.textHint }]}>{t.welcomeBody}</Text>
      </View>

      <View style={styles.footer}>
        <Button label={t.welcomeGetStarted} onPress={() => router.push('/(auth)/sign-up')} fullWidth />
        <Button label={t.welcomeHaveAccount} variant="outline" onPress={() => router.push('/(auth)/sign-in')} fullWidth />
        <Text style={[styles.termsNotice, { color: colors.textHint }]}>{t.welcomeTermsNotice}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Spacing.gutter, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 0 },
  mark: { width: 74, height: 74, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  markLetter: { fontFamily: LogoFont, fontWeight: FontWeight.bold, fontSize: 44, color: '#FBF3EA', lineHeight: 48 },
  wordmark: { fontFamily: LogoFont, fontWeight: FontWeight.bold, fontSize: 34, letterSpacing: -1.1, marginTop: 22 },
  tagline: {
    fontFamily: TitleFont, fontWeight: FontWeight.bold, fontSize: FontSize.xxl,
    letterSpacing: -0.4, textAlign: 'center', marginTop: 18, lineHeight: 26,
  },
  body: {
    fontFamily: UIFontLight, fontSize: FontSize.base, textAlign: 'center',
    lineHeight: 21, marginTop: 10, paddingHorizontal: 10,
  },
  footer: { gap: Spacing.sm },
  termsNotice: { fontSize: FontSize.xs, textAlign: 'center', marginTop: 16 },
});
