import React, { useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { pickImage } from '@/core/utils/imagePicker';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/core/theme';
import { BorderRadius, UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import {
  validateAge,
  validateGenericEmail,
  validateName,
  validatePassword,
  validateUniversityEmail,
} from '@/core/utils/validators';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { GREEK_UNIVERSITIES, universityLabel } from '@/core/constants/universities';

const PRIVACY_POLICY_URL = 'https://alextamp.github.io/keno/docs/privacy/';
const TERMS_URL = 'https://alextamp.github.io/keno/docs/terms/';

export default function SignUpScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const signUp = useAuthStore((s) => s.signUp);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const t = useTranslation();
  const { language } = useLanguageStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [department, setDepartment] = useState('');
  const [age, setAge] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [noUniEmail, setNoUniEmail] = useState(false);
  // True only when we auto-switched them here because their university
  // email got declined (as opposed to them manually choosing "I don't have
  // one") — drives which banner copy shows and whether a "try again" link
  // to go back is offered.
  const [emailDeclined, setEmailDeclined] = useState(false);
  const [idPhoto, setIdPhoto] = useState<string | undefined>();
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const deptRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);

  const pickIdPhoto = async () => {
    const uri = await pickImage();
    if (uri) setIdPhoto(uri);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    const nameCheck = validateName(name);
    const emailCheck = noUniEmail ? validateGenericEmail(email) : validateUniversityEmail(email);
    const passCheck = validatePassword(password);
    const ageCheck = age.trim() ? validateAge(age) : { isValid: true };

    if (!nameCheck.isValid) errors.name = nameCheck.errorMessage!;
    if (!emailCheck.isValid) errors.email = emailCheck.errorMessage!;
    if (!passCheck.isValid) errors.password = passCheck.errorMessage!;
    if (age.trim() && !ageCheck.isValid) errors.age = ageCheck.errorMessage!;
    if (noUniEmail && !idPhoto) errors.idPhoto = t.authIdPhotoRequired;
    if (!agreedToTerms) errors.terms = t.authTermsRequired;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // If they're still on the university-email path and it just failed
  // (unrecognized domain, or not a .gr address at all), don't dead-end them
  // on a red error — switch them to the ID-photo fallback automatically so
  // "declined" always has a next step. An empty field isn't a decline,
  // it's just an incomplete form, so that still falls through to validate()
  // and shows the normal "required" error instead.
  const handleSignUp = async () => {
    clearError();

    if (!noUniEmail && email.trim() && !validateUniversityEmail(email).isValid) {
      setNoUniEmail(true);
      setEmailDeclined(true);
      setFieldErrors((prev) => {
        const { email: _omit, ...rest } = prev;
        return rest;
      });
      return;
    }

    if (!validate()) return;

    const success = await signUp({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      universityName: universityName.trim() || undefined,
      department: department.trim() || undefined,
      age: age.trim() ? Number(age.trim()) : undefined,
      idPhotoUri: noUniEmail ? idPhoto : undefined,
    });

    if (success) router.replace('/(auth)/verify-email');
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
        <View style={styles.header}>
          <Link href="/(auth)/sign-in" asChild>
            <AnimatedPressable style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name="back" size={16} color={colors.textPrimary} />
            </AnimatedPressable>
          </Link>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t.authSignUpTitle}</Text>
          <Text style={[styles.subtitle, { color: colors.textHint }]}>{t.authSignUpSubtitle}</Text>
        </View>

        {error && (
          <View style={[styles.errorBanner, { borderColor: colors.error }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <Input
            label={t.authNameLabel}
            value={name}
            onChangeText={setName}
            placeholder="Alexandros Tampakis"
            autoCapitalize="words"
            autoComplete="name"
            returnKeyType="next"
            error={fieldErrors.name}
            onSubmitEditing={() => emailRef.current?.focus()}
          />
          <Input
            ref={emailRef}
            label={t.authEmailLabel}
            value={email}
            onChangeText={setEmail}
            placeholder={noUniEmail ? 'you@example.com' : 'you@aueb.gr'}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            error={fieldErrors.email}
            hint={noUniEmail ? t.authGenericEmailHint : t.authUniHint}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <AnimatedPressable
            onPress={() => { setNoUniEmail((v) => !v); setEmailDeclined(false); }}
            style={styles.toggleLink}
          >
            <Text style={[styles.toggleLinkText, { color: colors.primary }]}>
              {noUniEmail ? t.authUseUniEmailLink : t.authNoUniEmailLink}
            </Text>
          </AnimatedPressable>
          {noUniEmail && (
            <View style={[styles.noUniBanner, { backgroundColor: emailDeclined ? colors.error + '15' : colors.accentSoft }]}>
              <Icon name={emailDeclined ? 'alert' : 'shield'} size={15} color={emailDeclined ? colors.error : colors.accentInk} />
              <Text style={[styles.noUniBannerText, { color: emailDeclined ? colors.error : colors.accentInk }]}>
                {emailDeclined ? t.authEmailDeclinedBanner : t.authNoUniEmailBanner}
              </Text>
            </View>
          )}
          {emailDeclined && (
            <AnimatedPressable
              onPress={() => { setNoUniEmail(false); setEmailDeclined(false); }}
              style={styles.toggleLink}
            >
              <Text style={[styles.toggleLinkText, { color: colors.primary }]}>{t.authEmailDeclinedTryAgain}</Text>
            </AnimatedPressable>
          )}
          <Input
            ref={passwordRef}
            label={t.authPasswordLabel}
            value={password}
            onChangeText={setPassword}
            placeholder={t.authPasswordMin}
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="next"
            error={fieldErrors.password}
            onSubmitEditing={() => deptRef.current?.focus()}
          />
          {/* University chips — a small fixed list of Greek universities reads
              better as tappable chips than mockup 02's free-text search
              field; keeping that, just fixing the label to the spec's
              uppercase "ΠΑΝΕΠΙΣΤΗΜΙΟ" micro-label treatment. */}
          <View style={styles.pickerField}>
            <Text style={[styles.pickerLabel, { color: colors.textDecor }]}>
              {t.authUniLabel.toUpperCase()} <Text style={{ color: colors.textHint, textTransform: 'none' }}>(optional)</Text>
            </Text>
            {!!fieldErrors.universityName && (
              <Text style={[styles.pickerError, { color: colors.error }]}>{fieldErrors.universityName}</Text>
            )}
            <View style={styles.uniGrid}>
              {GREEK_UNIVERSITIES.map((u) => {
                const selected = universityName === u;
                return (
                  <AnimatedPressable
                    key={u}
                    onPress={() => setUniversityName(u)}
                    style={[styles.uniChip, {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                      marginRight: 8, marginBottom: 8,
                    }]}
                  >
                    <Text style={[styles.uniChipText, { color: selected ? colors.accentInk : colors.textSecondary }]}>{universityLabel(u, language)}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
          <Input
            ref={deptRef}
            label={`${t.authDeptLabel} (optional)`}
            value={department}
            onChangeText={setDepartment}
            placeholder="Computer Science"
            autoCapitalize="words"
            returnKeyType="next"
            error={fieldErrors.department}
            onSubmitEditing={() => ageRef.current?.focus()}
          />
          <Input
            ref={ageRef}
            label={`${t.authAgeLabel} (optional)`}
            value={age}
            onChangeText={(v) => setAge(v.replace(/[^0-9]/g, ''))}
            placeholder="20"
            keyboardType="number-pad"
            returnKeyType="done"
            error={fieldErrors.age}
            onSubmitEditing={noUniEmail ? undefined : handleSignUp}
          />

          {noUniEmail && (
            <View style={styles.pickerField}>
              <Text style={[styles.pickerLabel, { color: colors.textDecor }]}>{t.authIdPhotoLabel.toUpperCase()}</Text>
              <Text style={[styles.idPhotoHint, { color: colors.textSecondary }]}>{t.authIdPhotoHint}</Text>
              {!!fieldErrors.idPhoto && (
                <Text style={[styles.pickerError, { color: colors.error }]}>{fieldErrors.idPhoto}</Text>
              )}
              {idPhoto && (
                <Image source={{ uri: idPhoto }} style={styles.idPhotoPreview} />
              )}
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
              <Text style={[styles.termsLink, { color: colors.primary }]} onPress={() => Linking.openURL(TERMS_URL)}>
                {t.termsOfService}
              </Text>
              {' '}{t.authTermsAnd}{' '}
              <Text style={[styles.termsLink, { color: colors.primary }]} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}>
                {t.privacyPolicy}
              </Text>
            </Text>
          </View>
          {!!fieldErrors.terms && (
            <Text style={[styles.pickerError, { color: colors.error }]}>{fieldErrors.terms}</Text>
          )}

          <Button
            label={t.authCreateBtn}
            onPress={handleSignUp}
            loading={isLoading}
            fullWidth
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>{t.authHaveAccount}</Text>
          <Link href="/(auth)/sign-in" asChild>
            <AnimatedPressable>
              <Text style={[styles.footerLink, { color: colors.primary }]}>{t.authSignInLink}</Text>
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  header: { gap: Spacing.xs },
  backBtn: { alignSelf: 'flex-start', marginBottom: Spacing.sm, width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    fontFamily: TitleFont,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: FontSize.base, fontFamily: UIFontLight },
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
  pickerField: { gap: 8 },
  pickerLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.4 },
  pickerError: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  toggleLink: { alignSelf: 'flex-start', paddingVertical: 2 },
  toggleLinkText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  // Warm Paper "note" box (spec §4 / mockup 02's ID-verification-fallback
  // note): accent.soft bg, shield icon, accent.ink text — no border.
  noUniBanner: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: 4 },
  noUniBannerText: { flex: 1, fontSize: FontSize.xs, lineHeight: 17 },
  idPhotoHint: { fontSize: FontSize.xs, lineHeight: 16 },
  idPhotoPreview: { width: '100%', height: 160, borderRadius: BorderRadius.md },
  idPhotoBtn: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  idPhotoBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  uniGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: 4 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  termsText: { flex: 1, fontSize: FontSize.sm, fontFamily: UIFontLight, lineHeight: 19 },
  termsLink: { fontWeight: FontWeight.bold },
  uniChip: { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1 },
  uniChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, fontFamily: UIFont },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Spacing.lg,
  },
  footerText: { fontSize: FontSize.md },
  footerLink: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    fontFamily: UIFont,
  },
});
