import React, { useEffect, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  ActivityIndicator, Alert, AppState, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet,
  Switch, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { addDoc, collection, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { useThemeStore, ThemeMode } from '@/core/theme/theme.store';
import { usePreferencesStore } from '@/core/store/preferences.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useLanguageStore, LANGUAGE_LABELS, AppLanguage, useTranslation } from '@/core/i18n';
import { UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { INTERESTS } from '@/core/constants/interests';
import { useIsAdmin } from '@/core/utils/adminRole';
import { KENO_EVENTS_UID } from '@/core/constants/eventsAccount';
import { Icon, IconName } from '@/components/ui/Icon';
import * as Notifications from 'expo-notifications';
import {
  REMINDER_LEAD_OPTIONS, getExpoPushToken, isNotificationPermissionGranted, requestNotificationPermissions,
} from '@/core/utils/eventReminders';
import { FEATURES } from '@/core/constants/features';
import { universityLabel } from '@/core/constants/universities';
import { uploadIssueScreenshot } from '@/core/utils/uploadImage';
import { pickImage } from '@/core/utils/imagePicker';

const PRIVACY_POLICY_URL = 'https://alextamp.github.io/keno/docs/privacy/';
const TERMS_URL = 'https://alextamp.github.io/keno/docs/terms/';
const FEEDBACK_URL = 'https://alextamp.github.io/keno/feedback.html';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textDecor }]}>{title.toUpperCase()}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

function SettingRow({ icon, iconEmoji, label, children, onPress, danger, accent }: {
  icon?: IconName;
  iconEmoji?: string;
  label: string;
  children?: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  /** Terracotta-tinted icon + label — used for the "report an issue" row per
   *  the mockup (accent-colored, distinct from the destructive `danger` red). */
  accent?: boolean;
}) {
  const { colors } = useTheme();
  const tint = danger ? '#EF4444' : accent ? colors.primary : colors.textSecondary;
  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, { borderBottomColor: colors.border }]}
    >
      <View style={styles.rowLeft}>
        <View style={styles.rowIconWrap}>
          {icon ? <Icon name={icon} size={17} color={tint} /> : <Text style={styles.rowIconEmoji}>{iconEmoji}</Text>}
        </View>
        <Text style={[styles.rowLabel, { color: danger ? '#EF4444' : accent ? colors.primary : colors.textPrimary }]}>{label}</Text>
      </View>
      {children ?? (onPress && <Icon name="fwd" size={15} color={colors.textHint} />)}
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
  const { mode, setMode } = useThemeStore();
  const soundEffectsEnabled = usePreferencesStore((s) => s.soundEffectsEnabled);
  const setSoundEffectsEnabled = usePreferencesStore((s) => s.setSoundEffectsEnabled);
  const dynamicHeroEnabled = usePreferencesStore((s) => s.dynamicHeroEnabled);
  const setDynamicHeroEnabled = usePreferencesStore((s) => s.setDynamicHeroEnabled);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isAdmin = useIsAdmin();
  const isEventsManager = useAuthStore((s) => s.user?.id === KENO_EVENTS_UID);
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

  // Emergency contact for Live Mode's "🆘" safety button (research doc #11)
  // — entirely optional, never required to use the app.
  const [editingEmergency, setEditingEmergency] = useState(false);
  const [draftEmergencyName, setDraftEmergencyName] = useState(user?.emergencyContactName ?? '');
  const [draftEmergencyPhone, setDraftEmergencyPhone] = useState(user?.emergencyContactPhone ?? '');
  const [isSavingEmergency, setIsSavingEmergency] = useState(false);

  const saveEmergencyContact = async () => {
    if (!user) return;
    setIsSavingEmergency(true);
    const name = draftEmergencyName.trim();
    const phone = draftEmergencyPhone.trim();
    await updateDoc(doc(db, 'users', user.id), { emergencyContactName: name, emergencyContactPhone: phone });
    useAuthStore.setState((s) => (s.user ? { user: { ...s.user, emergencyContactName: name, emergencyContactPhone: phone } } : {}));
    setIsSavingEmergency(false);
    setEditingEmergency(false);
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

  // Per-category notification toggles (opt-out model — a missing key means "on").
  const [editingNotifs, setEditingNotifs] = useState(false);
  // OS-level permission. The only in-app ask is the one-time screen after the
  // first join, so anyone who skipped it (or installed a new build since)
  // had no way back in — and without permission no push token is saved, so
  // pushes kept going to whatever device/app last registered one.
  const [osNotifsOn, setOsNotifsOn] = useState<boolean | null>(null);
  const savePushToken = () => {
    if (!user) return;
    getExpoPushToken().then((token) => {
      if (token) updateDoc(doc(db, 'users', user.id), { pushToken: token }).catch(() => {});
    }).catch(() => {});
  };
  useEffect(() => {
    const check = () => isNotificationPermissionGranted().then((granted) => {
      setOsNotifsOn(granted);
      if (granted) savePushToken();
    });
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  const handleEnableOsNotifs = async () => {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined' || canAskAgain) {
      const granted = await requestNotificationPermissions();
      setOsNotifsOn(granted);
      if (granted) { savePushToken(); return; }
    }
    Linking.openSettings().catch(() => {});
  };

  const setNotifPref = (key: 'eventReminders' | 'groupMessages' | 'suggestions' | 'rides', value: boolean) => {
    if (!user) return;
    updateProfile({ notificationPrefs: { ...(user.notificationPrefs ?? {}), [key]: value } });
  };

  // "Ποιοι με βλέπουν" — who can see this profile in search/discovery.
  const handleVisibilityPress = () => {
    Alert.alert(t.settingsWhoSeesMe, undefined, [
      { text: t.settingsVisibilityStudents, onPress: () => updateProfile({ profileVisibility: 'students' }) },
      { text: t.settingsVisibilityConnections, onPress: () => updateProfile({ profileVisibility: 'connections' }) },
      { text: t.settingsBtnCancel, style: 'cancel' },
    ]);
  };

  // User-facing "report an issue" ticket — writes to the same `reports`
  // collection the admin viewer (admin-reports.tsx) already reads from, just
  // without a reportedUid/reportedEventId (it's not about a specific user).
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportText, setReportText] = useState('');
  const [reportScreenshotUri, setReportScreenshotUri] = useState<string | null>(null);
  const [reportError, setReportError] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  const pickReportScreenshot = async () => {
    const uri = await pickImage({ allowsEditing: false, quality: 0.7 });
    if (uri) setReportScreenshotUri(uri);
  };

  const submitIssueReport = async () => {
    if (!user) return;
    const description = reportText.trim();
    if (!description) { setReportError(t.settingsReportIssueEmptyError); return; }
    setIsSubmittingReport(true);
    setReportError('');
    try {
      let screenshotUrl: string | undefined;
      if (reportScreenshotUri) {
        screenshotUrl = await uploadIssueScreenshot(user.id, reportScreenshotUri);
      }
      await addDoc(collection(db, 'reports'), {
        reason: 'app_issue',
        reporterUid: user.id,
        description,
        ...(screenshotUrl ? { screenshotUrl } : {}),
        createdAt: new Date(),
      });
      setReportModalVisible(false);
      setReportText('');
      setReportScreenshotUri(null);
      Alert.alert(t.settingsReportIssueSuccessTitle, t.settingsReportIssueSuccessBody);
    } catch {
      setReportError(t.authErrGeneric);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(t.settingsAlertDeleteTitle, t.settingsAlertDeleteBody, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: t.settingsAlertDeleteBtn,
        style: 'destructive',
        onPress: () => {
          setDeletePassword('');
          setDeleteError('');
          setDeleteModalVisible(true);
        },
      },
    ]);
  };

  const confirmDeleteWithPassword = async () => {
    const fbUser = auth.currentUser;
    if (!fbUser || !user || !fbUser.email) return;
    if (!deletePassword) {
      setDeleteError(t.settingsDeletePasswordRequired);
      return;
    }
    setIsDeleting(true);
    setDeleteError('');
    try {
      // Deleting the Auth account requires a *recent* sign-in — reauthenticate
      // first so we never end up in the old broken state where the Firestore
      // profile was deleted but the Auth account survived (or vice versa).
      const credential = EmailAuthProvider.credential(fbUser.email, deletePassword);
      await reauthenticateWithCredential(fbUser, credential);
      await deleteDoc(doc(db, 'users', user.id));
      await deleteUser(fbUser);
      setDeleteModalVisible(false);
      await signOut();
    } catch (e: any) {
      if (e?.code === 'auth/wrong-password' || e?.code === 'auth/invalid-credential') {
        setDeleteError(t.authErrWrongCredentials);
      } else {
        setDeleteError(t.authErrGeneric);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(t.settingsAlertSignOutTitle, t.settingsAlertSignOutBody, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      { text: t.settingsAlertSignOutBtn, style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <ScreenHeader title={t.settingsTitle} />

      {/* Appearance */}
      <Section title={t.settingsSectionAppearance}>
        <View style={styles.pillRow}>
          {(['auto', 'light', 'dark'] as ThemeMode[]).map((m) => {
            const active = mode === m;
            const label = m === 'auto' ? t.settingsThemeAuto : m === 'light' ? t.settingsThemeLight : t.settingsThemeDark;
            return (
              <AnimatedPressable
                key={m}
                onPress={() => setMode(m)}
                style={[
                  styles.pill,
                  { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.accentSoft : 'transparent' },
                ]}
              >
                <Text style={[styles.pillText, { color: active ? colors.accentInk : colors.textSecondary }]}>{label}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </Section>

      {/* Preferences */}
      <Section title={t.settingsSectionPreferences}>
        <View style={styles.notifBlock}>
          <View style={styles.notifRow}>
            <Text style={[styles.notifLabel, { color: colors.textPrimary }]}>{t.settingsSoundEffects}</Text>
            <Switch
              value={soundEffectsEnabled}
              onValueChange={setSoundEffectsEnabled}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        <Divider />
        <View style={styles.notifBlock}>
          <View style={styles.notifRow}>
            <Text style={[styles.notifLabel, { color: colors.textPrimary }]}>{t.settingsDynamicHero}</Text>
            <Switch
              value={dynamicHeroEnabled}
              onValueChange={setDynamicHeroEnabled}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
          <Text style={[styles.prefHint, { color: colors.textHint }]}>{t.settingsDynamicHeroHint}</Text>
        </View>
      </Section>

      {/* Language */}
      <Section title={t.settingsSectionLanguage}>
        {(['en', 'el'] as AppLanguage[]).map((lang, i, arr) => {
          const { flag, label } = LANGUAGE_LABELS[lang];
          const isActive = language === lang;
          return (
            <React.Fragment key={lang}>
              <SettingRow
                iconEmoji={flag}
                label={label}
                onPress={() => setLanguage(lang)}
              >
                <View style={[styles.langCheck, { borderColor: isActive ? colors.primary : colors.border, backgroundColor: isActive ? colors.primary : 'transparent' }]}>
                  {isActive && <Icon name="check" size={12} color="#fff" />}
                </View>
              </SettingRow>
              {i < arr.length - 1 && <Divider />}
            </React.Fragment>
          );
        })}
      </Section>

      {/* Account */}
      <Section title={t.settingsSectionAccount}>
        <SettingRow icon="shield" label={t.settingsVerification}>
          <View style={[styles.tag, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}>
            <Text style={[styles.tagText, { color: colors.accentInk }]}>
              {user?.universityName ? t.settingsVerifiedWith(universityLabel(user.universityName, language)) : t.settingsVerifiedGeneric}
            </Text>
          </View>
        </SettingRow>
        <Divider />
        {editingUni ? (
          <View style={styles.editBlock}>
            <Text style={[styles.editLabel, { color: colors.textDecor }]}>{t.profileLabelUniversity}</Text>
            <TextInput
              style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={draftUni}
              onChangeText={setDraftUni}
              placeholder={t.settingsUniPlaceholder}
              placeholderTextColor={colors.textHint}
            />
            <Text style={[styles.editLabel, { color: colors.textDecor }]}>{t.profileLabelDepartment}</Text>
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
            <SettingRow icon="globe" label={t.settingsUniDept} onPress={() => setEditingUni(true)} />
            <Divider />
          </>
        )}
        <SettingRow icon="mail" label={user?.universityEmail ?? ''} />
        <Divider />
        <SettingRow icon="bell" label={t.settingsSectionNotifications} onPress={() => setEditingNotifs((v) => !v)}>
          <Icon name={editingNotifs ? 'x' : 'fwd'} size={15} color={colors.textHint} />
        </SettingRow>
        {osNotifsOn === false && (
          <AnimatedPressable
            onPress={handleEnableOsNotifs}
            style={[styles.osNotifBanner, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}
          >
            <Text style={[styles.osNotifText, { color: colors.textPrimary }]}>{t.settingsOsNotifsOff}</Text>
            <Text style={[styles.osNotifCta, { color: colors.primary }]}>{t.settingsOsNotifsEnable}</Text>
          </AnimatedPressable>
        )}
        {editingNotifs && (
          <View style={styles.notifBlock}>
            <View style={styles.notifRow}>
              <Text style={[styles.notifLabel, { color: colors.textPrimary }]}>{t.settingsNotifEventReminders}</Text>
              <Switch
                value={user?.notificationPrefs?.eventReminders !== false}
                onValueChange={(v) => setNotifPref('eventReminders', v)}
                trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            {user?.notificationPrefs?.eventReminders !== false && (
              <View style={styles.leadRow}>
                <Text style={[styles.leadLabel, { color: colors.textHint }]}>{t.settingsReminderLead}</Text>
                <View style={styles.leadChips}>
                  {REMINDER_LEAD_OPTIONS.map((m) => {
                    const active = (user?.notificationPrefs?.reminderLeadMinutes ?? 60) === m;
                    return (
                      <AnimatedPressable
                        key={m}
                        onPress={() => user && updateProfile({ notificationPrefs: { ...(user.notificationPrefs ?? {}), reminderLeadMinutes: m } })}
                        style={[styles.leadChip, {
                          backgroundColor: active ? colors.primary : colors.surface,
                          borderColor: active ? colors.primary : colors.border,
                        }]}
                      >
                        <Text style={[styles.leadChipText, { color: active ? '#FFFFFF' : colors.textPrimary }]}>{t.reminderLeadLabel(m)}</Text>
                      </AnimatedPressable>
                    );
                  })}
                </View>
              </View>
            )}
            <Divider />
            <View style={styles.notifRow}>
              <Text style={[styles.notifLabel, { color: colors.textPrimary }]}>{t.settingsNotifGroupMessages}</Text>
              <Switch
                value={user?.notificationPrefs?.groupMessages !== false}
                onValueChange={(v) => setNotifPref('groupMessages', v)}
                trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            <Divider />
            <View style={styles.notifRow}>
              <Text style={[styles.notifLabel, { color: colors.textPrimary }]}>{t.settingsNotifSuggestions}</Text>
              <Switch
                value={user?.notificationPrefs?.suggestions !== false}
                onValueChange={(v) => setNotifPref('suggestions', v)}
                trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
            {FEATURES.rides && (
              <>
                <Divider />
                <View style={styles.notifRow}>
                  <Text style={[styles.notifLabel, { color: colors.textPrimary }]}>{t.settingsNotifRides}</Text>
                  <Switch
                    value={user?.notificationPrefs?.rides !== false}
                    onValueChange={(v) => setNotifPref('rides', v)}
                    trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>
              </>
            )}
          </View>
        )}
      </Section>

      {/* Interests */}
      <Section title={t.settingsSectionInterests}>
        {editingInterests ? (
          <View style={styles.editBlock}>
            <View style={styles.interestGrid}>
              {INTERESTS.map(({ key, tKey }) => {
                const selected = draftInterests.includes(key);
                return (
                  <AnimatedPressable
                    key={key}
                    onPress={() => toggleDraftInterest(key)}
                    style={[
                      styles.interestChip,
                      { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.primary : colors.border },
                    ]}
                  >
                    <Text style={[styles.interestLabel, { color: selected ? colors.accentInk : colors.textPrimary }]}>
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
          <SettingRow icon="star" label={t.settingsInterestsEdit} onPress={() => { setDraftInterests(user?.interests ?? []); setEditingInterests(true); }} />
        )}
      </Section>

      {/* Safety & Privacy */}
      <Section title={t.settingsSectionSafety}>
        <SettingRow icon="eye" label={t.settingsWhoSeesMe} onPress={handleVisibilityPress}>
          <Text style={[styles.metaText, { color: colors.textHint }]}>
            {user?.profileVisibility === 'connections' ? t.settingsVisibilityConnections : t.settingsVisibilityStudents}
          </Text>
        </SettingRow>
        <Divider />
        <SettingRow icon="lock" label={t.settingsBlockedUsers} onPress={() => router.push('/(app)/blocked-users' as any)}>
          <View style={styles.metaChevron}>
            <Text style={[styles.metaText, { color: colors.textHint }]}>{user?.blockedUserIds?.length ?? 0}</Text>
            <Icon name="fwd" size={15} color={colors.textHint} />
          </View>
        </SettingRow>
        <Divider />
        {editingEmergency ? (
          <View style={styles.editBlock}>
            <Text style={[styles.editLabel, { color: colors.textDecor }]}>{t.settingsEmergencyNameLabel}</Text>
            <TextInput
              style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={draftEmergencyName}
              onChangeText={setDraftEmergencyName}
              placeholder={t.settingsEmergencyNamePlaceholder}
              placeholderTextColor={colors.textHint}
            />
            <Text style={[styles.editLabel, { color: colors.textDecor }]}>{t.settingsEmergencyPhoneLabel}</Text>
            <TextInput
              style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={draftEmergencyPhone}
              onChangeText={setDraftEmergencyPhone}
              placeholder={t.settingsEmergencyPhonePlaceholder}
              placeholderTextColor={colors.textHint}
              keyboardType="phone-pad"
            />
            <View style={styles.editActions}>
              <AnimatedPressable onPress={() => setEditingEmergency(false)} style={[styles.editActionBtn, { borderColor: colors.border }]}>
                <Text style={[styles.editActionText, { color: colors.textSecondary }]}>{t.settingsBtnCancel}</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={saveEmergencyContact} disabled={isSavingEmergency} style={[styles.editActionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[styles.editActionText, { color: '#fff' }]}>{isSavingEmergency ? t.settingsBtnSaving : t.settingsBtnSave}</Text>
              </AnimatedPressable>
            </View>
          </View>
        ) : (
          <SettingRow icon="alert" label={t.settingsEmergencyContact} onPress={() => setEditingEmergency(true)}>
            <Text style={[styles.metaText, { color: colors.textHint }]} numberOfLines={1}>
              {user?.emergencyContactPhone ? user.emergencyContactName || user.emergencyContactPhone : t.settingsEmergencyNotSet}
            </Text>
          </SettingRow>
        )}
        <Divider />
        <SettingRow icon="flag" label={t.settingsReportIssue} onPress={() => setReportModalVisible(true)} accent />
      </Section>
      <View style={[styles.noteBox, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
        <Icon name="shield" size={16} color={colors.textSecondary} />
        <Text style={[styles.noteText, { color: colors.textSecondary }]}>{t.settingsSafetyNote}</Text>
      </View>

      {/* Legal */}
      <Section title={t.settingsPrivacy}>
        <SettingRow icon="chat" label={t.settingsFeedback} onPress={() => Linking.openURL(FEEDBACK_URL).catch(() => {})} />
        <Divider />
        <SettingRow icon="shield" label={t.privacyPolicy} onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})} />
        <Divider />
        <SettingRow icon="doc" label={t.termsOfService} onPress={() => Linking.openURL(TERMS_URL).catch(() => {})} />
      </Section>

      {/* Admin */}
      {isAdmin && (
        <Section title={t.settingsSectionAdmin}>
          <SettingRow icon="flag" label={t.settingsAdminReports} onPress={() => router.push('/(app)/admin-reports')} />
          <Divider />
          <SettingRow icon="shield" label={t.settingsAdminVerifications} onPress={() => router.push('/(app)/admin-verifications' as any)} />
        </Section>
      )}

      {/* Events review — lives on the "keno" account's own Settings, not the
          admin account's, since that's the account auto-imported events are
          attributed to (KENO_EVENTS_UID). Deliberately separate from isAdmin
          above — this account doesn't get report/verification access. */}
      {isEventsManager && (
        <Section title={t.settingsSectionEvents}>
          <SettingRow icon="cal" label={t.settingsAdminEvents} onPress={() => router.push('/(app)/admin-events' as any)} />
        </Section>
      )}

      {/* Danger zone */}
      <Section title={t.settingsSectionDanger}>
        <SettingRow icon="logout" label={t.settingsSignOut} onPress={handleSignOut} />
        <Divider />
        <SettingRow icon="trash" label={t.settingsDeleteAccount} onPress={handleDeleteAccount} danger />
      </Section>

      <Text style={[styles.version, { color: colors.textHint }]}>{t.settingsTagline}</Text>

      <Modal visible={deleteModalVisible} transparent animationType="fade" onRequestClose={() => setDeleteModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t.settingsDeletePasswordTitle}</Text>
            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>{t.settingsDeletePasswordBody}</Text>
            <TextInput
              style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={deletePassword}
              onChangeText={(v) => { setDeletePassword(v); setDeleteError(''); }}
              placeholder={t.authPasswordLabel}
              placeholderTextColor={colors.textHint}
              secureTextEntry
              autoFocus
              editable={!isDeleting}
            />
            {!!deleteError && <Text style={styles.modalError}>{deleteError}</Text>}
            <View style={styles.editActions}>
              <AnimatedPressable
                onPress={() => setDeleteModalVisible(false)}
                disabled={isDeleting}
                style={[styles.editActionBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.editActionText, { color: colors.textSecondary }]}>{t.settingsBtnCancel}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={confirmDeleteWithPassword}
                disabled={isDeleting}
                style={[styles.editActionBtn, { backgroundColor: '#EF4444', borderColor: '#EF4444' }]}
              >
                {isDeleting ? <ActivityIndicator color="#fff" /> : (
                  <Text style={[styles.editActionText, { color: '#fff' }]}>{t.settingsAlertDeleteBtn}</Text>
                )}
              </AnimatedPressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={reportModalVisible} transparent animationType="fade" onRequestClose={() => setReportModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{t.settingsReportIssueTitle}</Text>
            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>{t.settingsReportIssueBody}</Text>
            <TextInput
              style={[styles.reportInput, { color: colors.textPrimary, borderColor: colors.border }]}
              value={reportText}
              onChangeText={(v) => { setReportText(v); setReportError(''); }}
              placeholder={t.settingsReportIssuePlaceholder}
              placeholderTextColor={colors.textHint}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!isSubmittingReport}
            />
            {reportScreenshotUri ? (
              <View style={styles.screenshotPreviewRow}>
                <Image source={{ uri: reportScreenshotUri }} style={styles.screenshotThumb} />
                <AnimatedPressable onPress={() => setReportScreenshotUri(null)} disabled={isSubmittingReport}>
                  <Text style={[styles.editActionText, { color: colors.primary }]}>{t.settingsReportIssueRemoveScreenshot}</Text>
                </AnimatedPressable>
              </View>
            ) : (
              <AnimatedPressable
                onPress={pickReportScreenshot}
                disabled={isSubmittingReport}
                style={[styles.editActionBtn, styles.screenshotBtn, { borderColor: colors.border }]}
              >
                <Icon name="image" size={15} color={colors.textSecondary} />
                <Text style={[styles.editActionText, { color: colors.textSecondary }]}>{t.settingsReportIssueAddScreenshot}</Text>
              </AnimatedPressable>
            )}
            {!!reportError && <Text style={styles.modalError}>{reportError}</Text>}
            <View style={styles.editActions}>
              <AnimatedPressable
                onPress={() => setReportModalVisible(false)}
                disabled={isSubmittingReport}
                style={[styles.editActionBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.editActionText, { color: colors.textSecondary }]}>{t.settingsBtnCancel}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={submitIssueReport}
                disabled={isSubmittingReport}
                style={[styles.editActionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                {isSubmittingReport ? <ActivityIndicator color="#fff" /> : (
                  <Text style={[styles.editActionText, { color: '#fff' }]}>{t.settingsReportIssueSubmit}</Text>
                )}
              </AnimatedPressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(20,14,10,0.4)', alignItems: 'center', justifyContent: 'center', padding: Spacing.gutter },
  modalCard: { width: '100%', maxWidth: 380, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: 10 },
  modalTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: TitleFont },
  modalBody: { fontSize: FontSize.sm, fontFamily: UIFontLight, lineHeight: 20 },
  modalError: { fontSize: FontSize.xs, color: '#EF4444', fontWeight: FontWeight.medium },
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.lg },
  section: { gap: 6 },
  sectionTitle: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.4, paddingLeft: 4 },
  sectionCard: { borderWidth: 1, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: 13 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
  rowIconWrap: { width: 24, alignItems: 'center' },
  rowIconEmoji: { fontSize: 17 },
  rowLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium, fontFamily: UIFont, flex: 1 },
  divider: { height: 1, marginHorizontal: Spacing.md },
  editBlock: { padding: Spacing.md, gap: 8 },
  editLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.4 },
  editInput: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: FontSize.sm },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  editActionBtn: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.md, paddingVertical: 10, alignItems: 'center' },
  editActionText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  interestChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1 },
  interestLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },
  version: { textAlign: 'center', fontSize: FontSize.xs, paddingTop: Spacing.sm },
  langCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

  // Verification tag (Account section)
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full, borderWidth: 1 },
  tagText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },

  // Trailing meta text/chevron on rows (visibility selector, blocked-users count)
  metaText: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  metaChevron: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  // Appearance pill row (Αυτόματο / Ημέρα / Νύχτα)
  pillRow: { flexDirection: 'row', gap: 8, padding: Spacing.md },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: BorderRadius.full, borderWidth: 1 },
  pillText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont },

  // Inline notification-preferences toggle list
  notifBlock: { paddingHorizontal: Spacing.md },
  notifRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  osNotifBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1,
    borderRadius: BorderRadius.md, padding: Spacing.md, marginVertical: Spacing.sm,
  },
  osNotifText: { flex: 1, fontSize: FontSize.sm, fontFamily: UIFont },
  osNotifCta: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  notifLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, fontFamily: UIFont },
  leadRow: { paddingBottom: Spacing.sm, gap: 8 },
  leadLabel: { fontSize: FontSize.xs, fontFamily: UIFont },
  leadChips: { flexDirection: 'row', gap: 8 },
  leadChip: { flex: 1, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, alignItems: 'center' },
  leadChipText: { fontSize: FontSize.sm, fontFamily: UIFont },
  prefHint: { fontSize: FontSize.xs, fontFamily: UIFontLight, lineHeight: 16, paddingBottom: 12 },

  // Safety note box (24h SLA / second-strike copy)
  noteBox: { flexDirection: 'row', gap: 8, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: FontSize.xs, fontFamily: UIFontLight, lineHeight: 18 },

  // Report-an-issue modal
  reportInput: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: FontSize.sm, minHeight: 90 },
  screenshotBtn: { flexDirection: 'row', gap: 6, justifyContent: 'center' },
  screenshotPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  screenshotThumb: { width: 48, height: 48, borderRadius: BorderRadius.sm },
});
