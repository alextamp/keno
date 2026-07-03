import React, { useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  Alert, Linking, Pressable, ScrollView, StyleSheet,
  Switch, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { deleteUser } from 'firebase/auth';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

const PRIVACY_POLICY_URL = 'https://keno.app/privacy';
const TERMS_URL = 'https://keno.app/terms';
import { useTheme } from '@/core/theme';
import { useThemeStore } from '@/core/theme/theme.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useLanguageStore, LANGUAGE_LABELS, AppLanguage, useTranslation } from '@/core/i18n';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { INTERESTS } from '@/core/constants/interests';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textHint }]}>{title.toUpperCase()}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
        {children}
      </View>
    </View>
  );
}

function SettingRow({ icon, label, children, onPress, danger }: {
  icon: string;
  label: string;
  children?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View style={styles.rowLeft}>
        <Text style={styles.rowIcon}>{icon}</Text>
        <Text style={[styles.rowLabel, { color: danger ? '#EF4444' : colors.textPrimary }]}>{label}</Text>
      </View>
      {children ?? (onPress && <Text style={[styles.chevron, { color: colors.textHint }]}>›</Text>)}
    </AnimatedPressable>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const { language, setLanguage } = useLanguageStore();
  const t = useTranslation();

  const [editingUni, setEditingUni] = useState(false);
  const [draftUni, setDraftUni] = useState(user?.universityName ?? '');
  const [draftDept, setDraftDept] = useState(user?.department ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const [editingInterests, setEditingInterests] = useState(false);
  const [draftInterests, setDraftInterests] = useState<string[]>(user?.interests ?? []);
  const [isSavingInterests, setIsSavingInterests] = useState(false);

  const saveUniversity = async () => {
    if (!user) return;
    setIsSaving(true);
    await updateDoc(doc(db, 'users', user.id), { universityName: draftUni.trim(), department: draftDept.trim() });
    setIsSaving(false);
    setEditingUni(false);
  };

  const toggleDraftInterest = (key: string) => {
    setDraftInterests((prev) => (prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]));
  };

  const saveInterests = async () => {
    if (!user) return;
    setIsSavingInterests(true);
    await updateProfile({ interests: draftInterests });
    setIsSavingInterests(false);
    setEditingInterests(false);
  };

  const cancelInterests = () => {
    setDraftInterests(user?.interests ?? []);
    setEditingInterests(false);
  };

  const handleDeleteAccount = () => {
    Alert.alert(t.settingsAlertDeleteTitle, t.settingsAlertDeleteBody, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: t.settingsAlertDeleteBtn,
        style: 'destructive',
        onPress: async () => {
          const fbUser = auth.currentUser;
          if (!fbUser || !user) return;
          try {
            await deleteDoc(doc(db, 'users', user.id));
            await deleteUser(fbUser);
            // signOut clears local auth state after the Firebase user is deleted
            await signOut();
          } catch {
            Alert.alert(t.settingsAlertReauthTitle, t.settingsAlertReauthBody);
          }
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert(t.settingsAlertSignOutTitle, t.settingsAlertSignOutBody, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      { text: t.settingsAlertSignOutBtn, style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <ScreenHeader title={t.settingsTitle} />

      {/* Appearance */}
      <Section title={t.settingsSectionAppearance}>
        <SettingRow icon={isDark ? '🌙' : '☀️'} label={t.settingsDarkMode}>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#E5E5EA', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </SettingRow>
      </Section>

      {/* Language */}
      <Section title={t.settingsSectionLanguage}>
        {(['en', 'el'] as AppLanguage[]).map((lang, i, arr) => {
          const { flag, label } = LANGUAGE_LABELS[lang];
          const isActive = language === lang;
          return (
            <React.Fragment key={lang}>
              <SettingRow
                icon={flag}
                label={label}
                onPress={() => setLanguage(lang)}
              >
                <View style={[styles.langCheck, { borderColor: colors.borderStrong, backgroundColor: isActive ? colors.primary : 'transparent' }]}>
                  {isActive && <Text style={styles.langCheckMark}>✓</Text>}
                </View>
              </SettingRow>
              {i < arr.length - 1 && <Divider />}
            </React.Fragment>
          );
        })}
      </Section>

      {/* Account */}
      <Section title={t.settingsSectionAccount}>
        {editingUni ? (
          <View style={styles.editBlock}>
            <Text style={[styles.editLabel, { color: colors.textHint }]}>{t.profileLabelUniversity}</Text>
            <TextInput
              style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={draftUni}
              onChangeText={setDraftUni}
              placeholder={t.settingsUniPlaceholder}
              placeholderTextColor={colors.textHint}
            />
            <Text style={[styles.editLabel, { color: colors.textHint }]}>{t.profileLabelDepartment}</Text>
            <TextInput
              style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={draftDept}
              onChangeText={setDraftDept}
              placeholder={t.settingsDeptPlaceholder}
              placeholderTextColor={colors.textHint}
            />
            <View style={styles.editActions}>
              <AnimatedPressable onPress={() => setEditingUni(false)} style={[styles.editActionBtn, { borderColor: colors.border }]}>
                <Text style={[styles.editActionText, { color: colors.textSecondary }]}>{t.settingsBtnCancel}</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={saveUniversity} disabled={isSaving} style={[styles.editActionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[styles.editActionText, { color: '#fff' }]}>{isSaving ? t.settingsBtnSaving : t.settingsBtnSave}</Text>
              </AnimatedPressable>
            </View>
          </View>
        ) : (
          <>
            <SettingRow icon="🎓" label={t.settingsUniDept} onPress={() => setEditingUni(true)} />
            <Divider />
          </>
        )}
        <SettingRow icon="📧" label={user?.universityEmail ?? ''} />
      </Section>

      {/* Interests */}
      <Section title={t.settingsSectionInterests}>
        {editingInterests ? (
          <View style={styles.editBlock}>
            <View style={styles.interestGrid}>
              {INTERESTS.map(({ key, tKey, emoji }) => {
                const selected = draftInterests.includes(key);
                return (
                  <AnimatedPressable
                    key={key}
                    onPress={() => toggleDraftInterest(key)}
                    style={[
                      styles.interestChip,
                      { backgroundColor: selected ? colors.primary : colors.surfaceVariant, borderColor: selected ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={styles.interestEmoji}>{emoji}</Text>
                    <Text style={[styles.interestLabel, { color: selected ? '#fff' : colors.textPrimary }]}>
                      {t[tKey as keyof typeof t] as string}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
            <View style={styles.editActions}>
              <AnimatedPressable onPress={cancelInterests} style={[styles.editActionBtn, { borderColor: colors.border }]}>
                <Text style={[styles.editActionText, { color: colors.textSecondary }]}>{t.settingsBtnCancel}</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={saveInterests} disabled={isSavingInterests} style={[styles.editActionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[styles.editActionText, { color: '#fff' }]}>{isSavingInterests ? t.settingsBtnSaving : t.settingsBtnSave}</Text>
              </AnimatedPressable>
            </View>
          </View>
        ) : (
          <SettingRow icon="🎯" label={t.settingsInterestsEdit} onPress={() => { setDraftInterests(user?.interests ?? []); setEditingInterests(true); }} />
        )}
      </Section>

      {/* Legal */}
      <Section title={t.settingsPrivacy}>
        <SettingRow icon="🔒" label={t.privacyPolicy} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} />
        <Divider />
        <SettingRow icon="📄" label={t.termsOfService} onPress={() => Linking.openURL(TERMS_URL)} />
      </Section>

      {/* Danger zone */}
      <Section title={t.settingsSectionDanger}>
        <SettingRow icon="🚪" label={t.settingsSignOut} onPress={handleSignOut} />
        <Divider />
        <SettingRow icon="🗑️" label={t.settingsDeleteAccount} onPress={handleDeleteAccount} danger />
      </Section>

      <Text style={[styles.version, { color: colors.textHint }]}>{t.settingsTagline}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  section: { gap: 6 },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: DrawFont, paddingLeft: 4 },
  sectionCard: { borderWidth: 2.5, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadow.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 14 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  rowIcon: { fontSize: 20, width: 28 },
  rowLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium, fontFamily: DrawFont, flex: 1 },
  chevron: { fontSize: 20, fontWeight: FontWeight.bold },
  divider: { height: 1, marginHorizontal: Spacing.md },
  editBlock: { padding: Spacing.md, gap: 8 },
  editLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  editInput: { borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: FontSize.sm },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  editActionBtn: { flex: 1, borderWidth: 2, borderRadius: BorderRadius.full, paddingVertical: 10, alignItems: 'center' },
  editActionText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 2 },
  interestEmoji: { fontSize: 14 },
  interestLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  version: { textAlign: 'center', fontSize: FontSize.xs, paddingTop: Spacing.sm },
  langCheck: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  langCheckMark: { fontSize: 13, fontWeight: FontWeight.extrabold, color: '#fff' },
});
