import React, { useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Image, Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont } from '@/core/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useSignupDraftStore } from '@/features/auth/presentation/store/signupDraft.store';
import { SignupStepShell } from '@/features/auth/presentation/components/SignupStepShell';
import { pickImage } from '@/core/utils/imagePicker';
import { UNIVERSITY_DOMAINS } from '@/core/constants/universities';
import {
  validateGenericEmail, validatePassword, validateUniversityEmail,
} from '@/core/utils/validators';
import { analytics } from '@/core/utils/analytics';

const PRIVACY_POLICY_URL = 'https://alextamp.github.io/keno/docs/privacy/';
const TERMS_URL = 'https://alextamp.github.io/keno/docs/terms/';

function emailMatchesDomain(email: string, domain: string): boolean {
  const emailDomain = email.trim().toLowerCase().split('@')[1] ?? '';
  return emailDomain === domain || emailDomain.endsWith(`.${domain}`);
}

export default function AccountStep() {
  const router = useRouter();
  const { colors } = useTheme();
  const t = useTranslation();
  const signUp = useAuthStore((s) => s.signUp);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const draft = useSignupDraftStore((s) => s.draft);
  const resetDraft = useSignupDraftStore((s) => s.reset);

  const expectedDomain = UNIVERSITY_DOMAINS[draft.universityName];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [idPhoto, setIdPhoto] = useState<string | undefined>();
  // Picking "Other" on the university step (or, defensively, any university
  // we don't have a domain mapping for) already told the person they'll
  // need their own email + a photo — start them in that mode instead of
  // making them discover it again by tapping the link a second time.
  const [noUniEmail, setNoUniEmail] = useState(!expectedDomain);
  const [emailDeclined, setEmailDeclined] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uniMismatch, setUniMismatch] = useState(false);

  const passwordRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const pickIdPhoto = async () => {
    const uri = await pickImage();
    if (uri) setIdPhoto(uri);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    const emailCheck = noUniEmail ? validateGenericEmail(email) : validateUniversityEmail(email);
    const passCheck = validatePassword(password);
    let mismatch = false;

    if (!emailCheck.isValid) {
      errors.email = emailCheck.errorMessage!;
    } else if (!noUniEmail && expectedDomain && !emailMatchesDomain(email, expectedDomain)) {
      errors.email = t.startUniMismatchError(expectedDomain);
      mismatch = true;
    }
    if (!passCheck.isValid) errors.password = passCheck.errorMessage!;
    if (noUniEmail && !idPhoto) errors.idPhoto = t.authIdPhotoRequired;
    if (!agreedToTerms) errors.terms = t.authTermsRequired;

    setFieldErrors(errors);
    setUniMismatch(mismatch);
    return Object.keys(errors).length === 0;
  };

  // Mirrors sign-up.tsx: an unrecognized/non-.gr address auto-switches to
  // the ID-photo fallback instead of dead-ending on a red error.
  const handleCreateAccount = async () => {
    clearError();

    if (!noUniEmail && email.trim() && !validateUniversityEmail(email).isValid) {
      setNoUniEmail(true);
      setEmailDeclined(true);
      setFieldErrors((prev) => {
        const { email: _omit, ...rest } = prev;
        return rest;
      });
      // The declined-email banner and ID-photo fields render further up the
      // form than the footer button someone just tapped — without this,
      // scrolled-down taps look like they did nothing.
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }

    if (!validate()) return;

    const success = await signUp({
      name: draft.name,
      email: email.trim().toLowerCase(),
      password,
      universityName: draft.universityName || undefined,
      department: draft.department || undefined,
      age: draft.age.trim() ? Number(draft.age.trim()) : undefined,
      idPhotoUri: noUniEmail ? idPhoto : undefined,
      interests: draft.interests,
      bio: draft.bio,
      avatarColor: draft.avatarColor,
      photoUri: draft.photoUri,
    });

    if (success) {
      analytics.track('onboarding_step_completed', { step: 'account' });
      resetDraft();
      router.replace('/(auth)/verify-email');
    }
  };

  return (
    <SignupStepShell
      ref={scrollRef}
      title={t.startAccountTitle}
      subtitle={t.startAccountSubtitle}
      ctaLabel={t.authCreateBtn}
      onCta={handleCreateAccount}
      ctaLoading={isLoading}
    >
      {error && (
        <View style={[styles.errorBanner, { borderColor: colors.error }]}>
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </View>
      )}

      <Input
        label={noUniEmail ? t.genericEmailLabel : t.authEmailLabel}
        value={email}
        onChangeText={(v) => { setEmail(v); setUniMismatch(false); }}
        placeholder={noUniEmail ? 'you@example.com' : `you@${expectedDomain ?? 'aueb.gr'}`}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="next"
        error={fieldErrors.email}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      {uniMismatch && (
        <AnimatedPressable onPress={() => router.push('/(auth)/start/university' as any)} style={styles.toggleLink}>
          <Text style={[styles.toggleLinkText, { color: colors.primary }]}>{t.startUniMismatchChangeLink}</Text>
        </AnimatedPressable>
      )}
      {emailDeclined && (
        <Text style={[styles.declinedText, { color: colors.error }]}>{t.startAccountEmailDeclinedNote}</Text>
      )}

      <AnimatedPressable
        onPress={() => { setNoUniEmail((v) => !v); setEmailDeclined(false); }}
        style={styles.toggleLink}
      >
        <Text style={[styles.toggleLinkText, { color: colors.primary }]}>
          {noUniEmail ? t.authUseUniEmailLink : t.startNoAcademicEmailLink}
        </Text>
      </AnimatedPressable>

      <Input
        ref={passwordRef}
        label={t.authPasswordLabel}
        value={password}
        onChangeText={setPassword}
        placeholder={t.authPasswordMin}
        secureTextEntry
        autoComplete="new-password"
        returnKeyType="done"
        error={fieldErrors.password}
        onSubmitEditing={handleCreateAccount}
      />

      {noUniEmail && (
        <View style={styles.pickerField}>
          <Text style={[styles.pickerLabel, { color: colors.textDecor }]}>{t.authIdPhotoLabel.toUpperCase()}</Text>
          <Text style={[styles.idPhotoHint, { color: colors.textSecondary }]}>{t.startAccountIdPhotoNote}</Text>
          {!!fieldErrors.idPhoto && (
            <Text style={[styles.pickerError, { color: colors.error }]}>{fieldErrors.idPhoto}</Text>
          )}
          {idPhoto && <Image source={{ uri: idPhoto }} style={styles.idPhotoPreview} />}
          <AnimatedPressable
            onPress={pickIdPhoto}
            style={[styles.idPhotoBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.idPhotoBtnText, { color: colors.primary }]}>
              {idPhoto ? t.authIdPhotoBtnChange : t.authIdPhotoBtnAdd}
            </Text>
          </AnimatedPressable>
        </View>
      )}

      <View style={styles.termsRow}>
        <AnimatedPressable
          onPress={() => setAgreedToTerms((v) => !v)}
          style={[
            styles.checkbox,
            { borderColor: agreedToTerms ? colors.primary : colors.border, backgroundColor: agreedToTerms ? colors.primary : 'transparent' },
          ]}
        >
          {agreedToTerms && <Icon name="check" size={13} color="#fff" />}
        </AnimatedPressable>
        <Text style={[styles.termsText, { color: colors.textSecondary }]}>
          {t.authTermsPrefix}{' '}
          <Text style={[styles.termsLink, { color: colors.primary }]} onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}>
            {t.termsOfService}
          </Text>
          {' '}{t.authTermsAnd}{' '}
          <Text style={[styles.termsLink, { color: colors.primary }]} onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}>
            {t.privacyPolicy}
          </Text>
        </Text>
      </View>
      {!!fieldErrors.terms && (
        <Text style={[styles.pickerError, { color: colors.error }]}>{fieldErrors.terms}</Text>
      )}
    </SignupStepShell>
  );
}

const styles = StyleSheet.create({
  errorBanner: { backgroundColor: '#FEF2F2', borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1 },
  errorText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  toggleLink: { alignSelf: 'flex-start', paddingVertical: 2 },
  toggleLinkText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  declinedText: { fontSize: FontSize.xs, marginTop: -4 },
  pickerField: { gap: 8 },
  pickerLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.4 },
  pickerError: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  idPhotoHint: { fontSize: FontSize.xs, lineHeight: 16 },
  idPhotoPreview: { width: '100%', height: 160, borderRadius: BorderRadius.md },
  idPhotoBtn: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  idPhotoBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  termsText: { flex: 1, fontSize: FontSize.md, lineHeight: 19 },
  termsLink: { fontWeight: FontWeight.bold },
});
