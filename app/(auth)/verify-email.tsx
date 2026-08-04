import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { pickImage } from '@/core/utils/imagePicker';
import { useRouter } from 'expo-router';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/core/theme';
import { BorderRadius, UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { validateGenericEmail } from '@/core/utils/validators';

export default function VerifyEmailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const sendEmailVerification = useAuthStore((s) => s.sendEmailVerification);
  const reloadAndCheckVerification = useAuthStore((s) => s.reloadAndCheckVerification);
  const switchToFallbackVerification = useAuthStore((s) => s.switchToFallbackVerification);
  const signOut = useAuthStore((s) => s.signOut);
  const t = useTranslation();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resent, setResent] = useState(false);

  // Escape hatch for university mail servers that never deliver the
  // verification email at all — switches the same (already signed-up,
  // just unverified) account onto the same personal-email + admin-reviewed
  // photo path signup already offers, instead of leaving the person stuck
  // forever with an unusable account tied to an email they can't confirm.
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackEmail, setFallbackEmail] = useState('');
  const [fallbackEmailError, setFallbackEmailError] = useState('');
  const [fallbackIdPhoto, setFallbackIdPhoto] = useState<string | undefined>();
  const [fallbackIdPhotoError, setFallbackIdPhotoError] = useState('');
  const [submittingFallback, setSubmittingFallback] = useState(false);
  const [fallbackSentTo, setFallbackSentTo] = useState<string | null>(null);

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

  const handleSignOut = async () => {
    await signOut();
    // `user`/`isEmailVerified` are already null/false while sitting here
    // unverified, so signing out doesn't change those store values — no
    // re-render fires, and AuthGate's router effect never re-triggers.
    // Navigate explicitly instead of relying on it.
    router.replace('/(auth)/welcome' as any);
  };

  const pickFallbackIdPhoto = async () => {
    const uri = await pickImage();
    if (uri) setFallbackIdPhoto(uri);
  };

  const handleSubmitFallback = async () => {
    const emailCheck = validateGenericEmail(fallbackEmail);
    setFallbackEmailError(emailCheck.isValid ? '' : emailCheck.errorMessage!);
    setFallbackIdPhotoError(fallbackIdPhoto ? '' : t.authIdPhotoRequired);
    if (!emailCheck.isValid || !fallbackIdPhoto) return;

    setSubmittingFallback(true);
    const email = fallbackEmail.trim().toLowerCase();
    const ok = await switchToFallbackVerification(email, fallbackIdPhoto);
    setSubmittingFallback(false);
    if (!ok) { Alert.alert(t.verifyTitle, t.verifyFallbackError); return; }
    setFallbackSentTo(email);
    setShowFallback(false);
  };

  if (showFallback) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
          <Icon name="camera" size={34} color={colors.primary} />
        </View>

        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t.verifyFallbackTitle}</Text>
          <Text style={[styles.body, { color: colors.textHint }]}>{t.verifyFallbackBody}</Text>
        </View>

        <View style={styles.fallbackForm}>
          <Input
            label={t.verifyFallbackEmailLabel}
            value={fallbackEmail}
            onChangeText={setFallbackEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={fallbackEmailError}
          />
          <View style={styles.pickerField}>
            <Text style={[styles.pickerLabel, { color: colors.textDecor }]}>{t.authIdPhotoLabel.toUpperCase()}</Text>
            <Text style={[styles.idPhotoHint, { color: colors.textSecondary }]}>{t.authIdPhotoHint}</Text>
            {!!fallbackIdPhotoError && (
              <Text style={[styles.pickerError, { color: colors.error }]}>{fallbackIdPhotoError}</Text>
            )}
            {fallbackIdPhoto && (
              <Image source={{ uri: fallbackIdPhoto }} style={styles.idPhotoPreview} />
            )}
            <AnimatedPressable
              onPress={pickFallbackIdPhoto}
              style={[styles.idPhotoBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            >
              <Text style={[styles.idPhotoBtnText, { color: colors.primary }]}>
                {fallbackIdPhoto ? t.authIdPhotoBtnChange : t.authIdPhotoBtnAdd}
              </Text>
            </AnimatedPressable>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label={t.verifyFallbackBtnSubmit}
            onPress={handleSubmitFallback}
            loading={submittingFallback}
            fullWidth
          />
          <Button
            label={t.verifyFallbackBtnCancel}
            onPress={() => setShowFallback(false)}
            variant="ghost"
            labelStyle={{ color: colors.textSecondary }}
            fullWidth
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
        <Icon name="mail" size={34} color={colors.primary} />
      </View>

      <View style={styles.textGroup}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {fallbackSentTo ? t.verifyFallbackSentTitle : t.verifyTitle}
        </Text>
        <Text style={[styles.body, { color: colors.textHint }]}>
          {fallbackSentTo ? t.verifyFallbackSentBody(fallbackSentTo) : t.verifyBody}
        </Text>
        {!fallbackSentTo && (
          <Text style={[styles.hint, { color: colors.textHint }]}>{t.verifySpamHint}</Text>
        )}
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
        {!fallbackSentTo && (
          <Button
            label={t.verifyBtnResend}
            onPress={handleResend}
            loading={resending}
            disabled={resent}
            fullWidth
          />
        )}
        {!fallbackSentTo && (
          <AnimatedPressable onPress={() => setShowFallback(true)} style={styles.troubleLink}>
            <Text style={[styles.troubleLinkText, { color: colors.primary }]}>{t.verifyTroubleLink}</Text>
          </AnimatedPressable>
        )}
        <Button
          label={t.verifyBtnSignOut}
          onPress={handleSignOut}
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
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: { gap: Spacing.sm, alignItems: 'center' },
  title: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    fontFamily: TitleFont,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.base,
    fontFamily: UIFontLight,
    textAlign: 'center',
    lineHeight: 21,
  },
  hint: {
    fontSize: FontSize.sm,
    fontFamily: UIFontLight,
    textAlign: 'center',
    lineHeight: 19,
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
  troubleLink: { alignSelf: 'center', paddingVertical: 4 },
  troubleLinkText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  fallbackForm: { width: '100%', gap: Spacing.md },
  pickerField: { gap: 8, width: '100%' },
  pickerLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.4 },
  pickerError: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  idPhotoHint: { fontSize: FontSize.xs, lineHeight: 16 },
  idPhotoPreview: { width: '100%', height: 160, borderRadius: BorderRadius.md },
  idPhotoBtn: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  idPhotoBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
});
