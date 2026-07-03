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
import { BorderRadius, DrawFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import {
  validateName,
  validatePassword,
  validateUniversityEmail,
} from '@/core/utils/validators';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { GREEK_UNIVERSITIES, universityLabel } from '@/core/constants/universities';

export default function SignUpScreen() {
  const router = useRouter();
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const deptRef = useRef<TextInput>(null);

  const validate = () => {
    const errors: Record<string, string> = {};
    const nameCheck = validateName(name);
    const emailCheck = validateUniversityEmail(email);
    const passCheck = validatePassword(password);

    if (!nameCheck.isValid) errors.name = nameCheck.errorMessage!;
    if (!emailCheck.isValid) errors.email = emailCheck.errorMessage!;
    if (!passCheck.isValid) errors.password = passCheck.errorMessage!;
    if (!universityName.trim()) errors.universityName = t.authUniRequired;
    if (!department.trim()) errors.department = t.authDeptRequired;

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
    });

    if (success) router.replace('/(auth)/verify-email');
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
        <View style={styles.header}>
          <Link href="/(auth)/sign-in" asChild>
            <AnimatedPressable style={[styles.backBtn, { borderColor: Colors.borderStrong }]}>
              <Text style={[styles.backText, { fontFamily: DrawFont }]}>{t.editEventBack}</Text>
            </AnimatedPressable>
          </Link>
          <Text style={styles.title}>{t.authSignUpTitle}</Text>
          <Text style={styles.subtitle}>{t.authSignUpSubtitle}</Text>
        </View>

        {error && (
          <View style={[styles.errorBanner, { borderColor: Colors.borderStrong }]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <Input
            label={t.authNameLabel}
            value={name}
            onChangeText={setName}
            placeholder="Alex Papadopoulos"
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
            placeholder="you@aueb.gr"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            error={fieldErrors.email}
            hint={t.authUniHint}
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
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
            <Text style={styles.pickerLabel}>{t.authUniLabel}</Text>
            {!!fieldErrors.universityName && (
              <Text style={styles.pickerError}>{fieldErrors.universityName}</Text>
            )}
            <View style={styles.uniGrid}>
              {GREEK_UNIVERSITIES.map((u) => {
                const selected = universityName === u;
                return (
                  <AnimatedPressable
                    key={u}
                    onPress={() => setUniversityName(u)}
                    style={[styles.uniChip, { borderColor: Colors.borderStrong, backgroundColor: selected ? Colors.primary : Colors.surface, marginRight: 8, marginBottom: 8 }]}
                  >
                    <Text style={[styles.uniChipText, { color: selected ? '#fff' : Colors.textSecondary }]}>{universityLabel(u, language)}</Text>
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
            returnKeyType="done"
            error={fieldErrors.department}
            onSubmitEditing={handleSignUp}
          />

          <Button
            label={t.authCreateBtn}
            onPress={handleSignUp}
            loading={isLoading}
            fullWidth
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t.authHaveAccount}</Text>
          <Link href="/(auth)/sign-in" asChild>
            <AnimatedPressable>
              <Text style={styles.footerLink}>{t.authSignInLink}</Text>
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
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  title: {
    fontSize: 28,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    fontFamily: DrawFont,
  },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary },
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
  pickerField: { gap: 8 },
  pickerLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, fontFamily: DrawFont, color: Colors.textPrimary },
  pickerError: { fontSize: FontSize.xs, color: Colors.error, fontWeight: FontWeight.medium },
  uniGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  uniChip: { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 2.5 },
  uniChipText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Spacing.lg,
  },
  footerText: { fontSize: FontSize.md, color: Colors.textSecondary },
  footerLink: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: FontWeight.bold,
    fontFamily: DrawFont,
  },
});
