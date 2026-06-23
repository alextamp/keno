import React, { useRef, useState } from 'react';
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
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import {
  validateName,
  validatePassword,
  validateUniversityEmail,
} from '@/core/utils/validators';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [universityName, setUniversityName] = useState('');
  const [department, setDepartment] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const uniRef = useRef<TextInput>(null);
  const deptRef = useRef<TextInput>(null);

  const validate = () => {
    const errors: Record<string, string> = {};
    const nameCheck = validateName(name);
    const emailCheck = validateUniversityEmail(email);
    const passCheck = validatePassword(password);

    if (!nameCheck.isValid) errors.name = nameCheck.errorMessage!;
    if (!emailCheck.isValid) errors.email = emailCheck.errorMessage!;
    if (!passCheck.isValid) errors.password = passCheck.errorMessage!;
    if (!universityName.trim()) errors.universityName = 'University name is required.';
    if (!department.trim()) errors.department = 'Department is required.';

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
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable style={styles.backBtn}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          </Link>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Only verified university students can join</Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <Input
            label="Full Name"
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
            label="University Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@aueb.gr"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            error={fieldErrors.email}
            hint="Must be a recognised Greek university email (.gr)"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <Input
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Min. 8 characters"
            secureTextEntry
            autoComplete="new-password"
            returnKeyType="next"
            error={fieldErrors.password}
            onSubmitEditing={() => uniRef.current?.focus()}
          />
          <Input
            ref={uniRef}
            label="University"
            value={universityName}
            onChangeText={setUniversityName}
            placeholder="Athens University of Economics"
            autoCapitalize="words"
            returnKeyType="next"
            error={fieldErrors.universityName}
            onSubmitEditing={() => deptRef.current?.focus()}
          />
          <Input
            ref={deptRef}
            label="Department"
            value={department}
            onChangeText={setDepartment}
            placeholder="Computer Science"
            autoCapitalize="words"
            returnKeyType="done"
            error={fieldErrors.department}
            onSubmitEditing={handleSignUp}
          />

          <Button
            label="Create account"
            onPress={handleSignUp}
            loading={isLoading}
            fullWidth
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)/sign-in" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  header: { gap: Spacing.xs },
  backBtn: { alignSelf: 'flex-start', marginBottom: Spacing.sm },
  backText: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontWeight: FontWeight.semibold,
  },
  title: {
    fontSize: 28,
    fontWeight: FontWeight.extrabold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary },
  form: { gap: Spacing.md },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: FontWeight.medium,
  },
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
    fontWeight: FontWeight.semibold,
  },
});
