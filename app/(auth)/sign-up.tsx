import React, { useRef, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTheme } from '@/core/theme';
import { BorderRadius, DrawFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import {
  validateAge,
  validateGenericEmail,
  validateName,
  validatePassword,
  validateUniversityEmail,
} from '@/core/utils/validators';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { GREEK_UNIVERSITIES, universityLabel } from '@/core/constants/universities';

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
  const [idPhoto, setIdPhoto] = useState<string | undefined>();

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const deptRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);

  const pickIdPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t.profileAlertPermTitle, t.profileAlertPermBody); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setIdPhoto(result.assets[0].uri);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    const nameCheck = validateName(name);
    const emailCheck = noUniEmail ? validateGenericEmail(email) : validateUniversityEmail(email);
    const passCheck = validatePassword(password);
    const ageCheck = validateAge(age);

    if (!nameCheck.isValid) errors.name = nameCheck.errorMessage!;
    if (!emailCheck.isValid) errors.email = emailCheck.errorMessage!;
    if (!passCheck.isValid) errors.password = passCheck.errorMessage!;
    if (!universityName.trim()) errors.universityName = t.authUniRequired;
    if (!department.trim()) errors.department = t.authDeptRequired;
    if (!ageCheck.isValid) errors.age = ageCheck.errorMessage!;
    if (noUniEmail && !idPhoto) errors.idPhoto = t.authIdPhotoRequired;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSignUp = async () => {
    clearError();
    if (!validate()) return;

    const success = await signUp({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      universityName: universityName.trim(),
      department: department.trim(),
      age: Number(age.trim()),
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
            <AnimatedPressable style={[styles.backBtn, { borderColor: colors.borderStrong }]}>
              <Text style={[styles.backText, { fontFamily: DrawFont, color: colors.primary }]}>{t.editEventBack}</Text>
            </AnimatedPressable>
          </Link>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t.authSignUpTitle}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t.authSignUpSubtitle}</Text>
        </View>

        {error && (
          <View style={[styles.errorBanner, { borderColor: colors.borderStrong }]}>
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
          <AnimatedPressable onPress={() => setNoUniEmail((v) => !v)} style={styles.toggleLink}>
            <Text style={[styles.toggleLinkText, { color: colors.primary }]}>
              {noUniEmail ? t.authUseUniEmailLink : t.authNoUniEmailLink}
            </Text>
          </AnimatedPressable>
          {noUniEmail && (
            <View style={[styles.noUniBanner, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
              <Text style={[styles.noUniBannerText, { color: colors.textSecondary }]}>{t.authNoUniEmailBanner}</Text>
            </View>
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
          {/* University chips */}
          <View style={styles.pickerField}>
            <Text style={[styles.pickerLabel, { color: colors.textPrimary }]}>{t.authUniLabel}</Text>
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
                    style={[styles.uniChip, { borderColor: colors.borderStrong, backgroundColor: selected ? colors.primary : colors.surface, marginRight: 8, marginBottom: 8 }]}
                  >
                    <Text style={[styles.uniChipText, { color: selected ? '#fff' : colors.textSecondary }]}>{universityLabel(u, language)}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>
          <Input
            ref={deptRef}
            label={t.authDeptLabel}
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
            label={t.authAgeLabel}
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
              <Text style={[styles.pickerLabel, { color: colors.textPrimary }]}>{t.authIdPhotoLabel}</Text>
              <Text style={[styles.idPhotoHint, { color: colors.textSecondary }]}>{t.authIdPhotoHint}</Text>
              {!!fieldErrors.idPhoto && (
                <Text style={[styles.pickerError, { color: colors.error }]}>{fieldErrors.idPhoto}</Text>
              )}
              {idPhoto && (
                <Image source={{ uri: idPhoto }} style={styles.idPhotoPreview} />
              )}
              <AnimatedPressable
                onPress={pickIdPhoto}
                style={[styles.idPhotoBtn, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}
              >
                <Text style={[styles.idPhotoBtnText, { color: colors.primary }]}>
                  {idPhoto ? t.authIdPhotoBtnChange : t.authIdPhotoBtnAdd}
                </Text>
              </AnimatedPressable>
            </View>
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
  backBtn: { alignSelf: 'flex-start', marginBottom: Spacing.sm, borderWidth: 2, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  backText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  title: {
    fontSize: 28,
    fontWeight: FontWeight.extrabold,
    fontFamily: DrawFont,
  },
  subtitle: { fontSize: FontSize.md },
  form: { gap: Spacing.md },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 2.5,
  },
  errorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  pickerField: { gap: 8 },
  pickerLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  pickerError: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  toggleLink: { alignSelf: 'flex-start', paddingVertical: 2 },
  toggleLinkText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  noUniBanner: { borderRadius: BorderRadius.md, borderWidth: 1.5, padding: Spacing.sm, marginTop: 4 },
  noUniBannerText: { fontSize: FontSize.xs, lineHeight: 17 },
  idPhotoHint: { fontSize: FontSize.xs, lineHeight: 16 },
  idPhotoPreview: { width: '100%', height: 160, borderRadius: BorderRadius.md },
  idPhotoBtn: { alignSelf: 'flex-start', borderWidth: 2, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  idPhotoBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  uniGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  uniChip: { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 2.5 },
  uniChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
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
    fontFamily: DrawFont,
  },
});
