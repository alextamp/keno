import React, { useEffect, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { pickImage as pickPhoto } from '@/core/utils/imagePicker';
import { format } from 'date-fns';
import { useTheme } from '@/core/theme';
import { BorderRadius, UIFont, TitleFont, FontSize, FontWeight, Shadow, Spacing } from '@/core/constants/theme';
import { EventCategory, EventEntity, GenderFilter } from '@/features/events/domain/entities/event.entity';
import { UpdateEventParams } from '@/features/events/domain/repositories/events.repository';
import { seriesRepository } from '@/features/series/series.repository';
import { FEATURES } from '@/core/constants/features';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useIsAdmin } from '@/core/utils/adminRole';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { isLeft } from '@/core/utils/either';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { uploadEventImage } from '@/core/utils/uploadImage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { Icon } from '@/components/ui/Icon';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useTranslation, useLanguageStore, getDateLocale } from '@/core/i18n';
import { GREEK_UNIVERSITIES, universityLabel } from '@/core/constants/universities';

const UNIVERSITIES = ['Any', ...GREEK_UNIVERSITIES];
const AGE_OPTIONS = [18, 19, 20, 21, 22, 23, 24, 25, 26];

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const upsertEvent = useEventsStore((s) => s.upsertEvent);
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = useIsAdmin();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const GENDER_OPTIONS: { value: GenderFilter; label: string }[] = [
    { value: 'any', label: t.createGenderAny },
    { value: 'male', label: t.createGenderMale },
    { value: 'female', label: t.createGenderFemale },
  ];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>(EventCategory.Chill);
  const [customCategory, setCustomCategory] = useState('');
  const [dateTime, setDateTime] = useState(new Date());
  const [location, setLocation] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('10');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [minAge, setMinAge] = useState(18);
  const [maxAge, setMaxAge] = useState(26);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('any');
  const [selectedUniversities, setSelectedUniversities] = useState<string[]>(['Any']);
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [checkInInfoText, setCheckInInfoText] = useState('');
  const [checkInInfoPhotoUri, setCheckInInfoPhotoUri] = useState<string | null>(null);
  const [isFlagship, setIsFlagship] = useState(false);
  const [ridesEnabled, setRidesEnabled] = useState(false);
  const [original, setOriginal] = useState<EventEntity | null>(null);

  useEffect(() => {
    eventsRepository.getEvent(id).then((result) => {
      if (isLeft(result)) {
        Alert.alert(t.userInviteErrorTitle, result.left.message, [{ onPress: () => router.back() }]);
        return;
      }
      const e = result.right;
      setTitle(e.title);
      setDescription(e.description ?? '');
      setCategory(e.category);
      setCustomCategory(e.customCategory ?? '');
      setDateTime(e.dateTime);
      setLocation(e.location);
      setMaxAttendees(String(e.maxAttendees));
      setImageUri(e.imageUri ?? null);
      setMinAge(e.minAge ?? 18);
      setMaxAge(e.maxAge ?? 26);
      setGenderFilter(e.genderFilter ?? 'any');
      setSelectedUniversities(e.allowedUniversities?.length ? e.allowedUniversities : ['Any']);
      setCheckInInfoText(e.checkInInfo?.text ?? '');
      setCheckInInfoPhotoUri(e.checkInInfo?.photoUri ?? null);
      setIsFlagship(e.isFlagship ?? false);
      setRidesEnabled(e.ridesEnabled ?? false);
      setOriginal(e);
      setLoading(false);
    });
  }, [id]);

  const pickImage = async () => {
    const uri = await pickPhoto({ aspect: [16, 9] });
    if (uri) setImageUri(uri);
  };

  const pickCheckInPhoto = async () => {
    const uri = await pickPhoto({ aspect: [4, 3] });
    if (uri) setCheckInInfoPhotoUri(uri);
  };

  const toggleUniversity = (u: string) => {
    if (u === 'Any') { setSelectedUniversities(['Any']); return; }
    const without = selectedUniversities.filter((x) => x !== 'Any');
    setSelectedUniversities(
      without.includes(u)
        ? without.filter((x) => x !== u).length ? without.filter((x) => x !== u) : ['Any']
        : [...without, u],
    );
  };

  const handlePickerChange = (_: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setPickerMode(null);
    if (!selected) return;
    if (pickerMode === 'date') {
      const u = new Date(dateTime);
      u.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setDateTime(u);
    } else {
      const u = new Date(dateTime);
      u.setHours(selected.getHours(), selected.getMinutes());
      setDateTime(u);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !location.trim()) { Alert.alert(t.createAlertMissingTitle, t.createAlertMissingBody); return; }
    const max = parseInt(maxAttendees, 10);
    if (isNaN(max) || max < 2 || max > 100) { Alert.alert(t.createAlertBadMaxTitle, t.createAlertBadMaxBody); return; }
    if (containsBlockedContent(title) || containsBlockedContent(description) || containsBlockedContent(customCategory) || containsBlockedContent(checkInInfoText)) {
      Alert.alert(t.createAlertMissingTitle, t.validContentBlocked);
      return;
    }
    setSaving(true);
    let finalImageUri: string | undefined = imageUri ?? undefined;
    if (imageUri && !imageUri.startsWith('http')) {
      try {
        finalImageUri = await uploadEventImage(imageUri, (p) => setUploadProgress(p));
      } catch {
        Alert.alert(t.createAlertUploadTitle, t.createAlertUploadBody);
        finalImageUri = undefined;
      }
    }
    let finalCheckInPhoto: string | undefined = checkInInfoPhotoUri ?? undefined;
    if (checkInInfoPhotoUri && !checkInInfoPhotoUri.startsWith('http')) {
      try {
        finalCheckInPhoto = await uploadEventImage(checkInInfoPhotoUri);
      } catch {
        finalCheckInPhoto = undefined;
      }
    }

    const patch: UpdateEventParams = {
      title: title.trim(),
      description: description.trim(),
      category,
      customCategory: category === EventCategory.Other ? customCategory.trim() : undefined,
      dateTime,
      location: location.trim(),
      maxAttendees: max,
      imageUri: finalImageUri,
      minAge,
      maxAge,
      allowedUniversities: selectedUniversities.includes('Any') ? undefined : selectedUniversities,
      genderFilter,
      checkInInfo: (checkInInfoText.trim() || finalCheckInPhoto)
        ? { text: checkInInfoText.trim() || undefined, photoUri: finalCheckInPhoto }
        : undefined,
      ridesEnabled,
      ...(isAdmin ? { isFlagship } : {}),
    };

    // Part of a series → ask whether the edit is for this occurrence only.
    const scope: 'this' | 'following' | null = original?.seriesId
      ? await new Promise((resolve) => Alert.alert(t.seriesEditScopeTitle, undefined, [
          { text: t.seriesEditThisOnly, onPress: () => resolve('this') },
          { text: t.seriesEditFollowing, onPress: () => resolve('following') },
          { text: t.cancel, style: 'cancel', onPress: () => resolve(null) },
        ], { cancelable: true, onDismiss: () => resolve(null) }))
      : 'this';
    if (!scope) { setSaving(false); setUploadProgress(0); return; }

    const result = await eventsRepository.updateEvent(id, patch);
    if (isLeft(result)) Alert.alert(t.userInviteErrorTitle, result.left.message);
    else {
      if (scope === 'following' && original) {
        await seriesRepository.applyToFollowing(result.right, original, patch).catch(() => {
          Alert.alert(t.userInviteErrorTitle, t.seriesEditFollowingFailed);
        });
      }
      upsertEvent(result.right);
      router.back();
    }
    setSaving(false);
    setUploadProgress(0);
  };

  const handleStopSeries = () => {
    if (!original?.seriesId) return;
    Alert.alert(t.seriesStopTitle, t.seriesStopBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.seriesStopConfirm,
        style: 'destructive',
        onPress: () => {
          seriesRepository.stopSeries(original.seriesId!)
            .then(() => Alert.alert(t.seriesStoppedToast))
            .catch(() => Alert.alert(t.userInviteErrorTitle, t.authErrGeneric));
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <AnimatedPressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="back" size={14} color={colors.textSecondary} />
            <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>{t.editEventBack}</Text>
          </AnimatedPressable>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{t.editEventTitle}</Text>
        </View>

        <View style={styles.form}>
          {/* Photo */}
          <AnimatedPressable onPress={pickImage} style={[styles.photoBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderStyle: imageUri ? 'solid' : 'dashed' }]}>
            {imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                <AnimatedPressable onPress={() => setImageUri(null)} style={styles.photoRemove}>
                  <Icon name="x" size={12} color="#fff" />
                </AnimatedPressable>
              </>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Icon name="camera" size={26} color={colors.textDecor} />
                <Text style={[styles.photoLabel, { color: colors.textHint, fontFamily: UIFont }]}>{t.editEventCoverPhoto}</Text>
              </View>
            )}
          </AnimatedPressable>

          <Input label={t.createLabelTitle} value={title} onChangeText={setTitle} placeholder={t.createTitlePlaceholder} autoCapitalize="sentences" maxLength={80} />
          <Input label={t.createLabelDescription} value={description} onChangeText={setDescription} placeholder={t.createDescriptionPlaceholder} multiline numberOfLines={3} style={styles.textarea} textAlignVertical="top" maxLength={600} />

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.createLabelCategory}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {Object.values(EventCategory).map((cat, i, arr) => (
                <View key={cat} style={{ marginRight: i < arr.length - 1 ? 10 : 0 }}>
                  <CategoryChip category={cat} selected={category === cat} onPress={() => setCategory(cat)} />
                </View>
              ))}
            </ScrollView>
            {category === EventCategory.Other && (
              <Input label={t.editEventType} value={customCategory} onChangeText={setCustomCategory} placeholder={t.createCustomCategoryPlaceholder} autoCapitalize="words" maxLength={30} />
            )}
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.createLabelDateTime}</Text>
            <View style={styles.dateRow}>
              <AnimatedPressable style={[styles.dateBtn, { backgroundColor: colors.surface, borderColor: colors.primary }]} onPress={() => setPickerMode('date')}>
                <Icon name="cal" size={14} color={colors.textSecondary} />
                <Text style={[styles.dateBtnText, { color: colors.textPrimary }]}>{format(dateTime, 'EEE, d MMM yyyy', { locale: getDateLocale(language) })}</Text>
              </AnimatedPressable>
              <AnimatedPressable style={[styles.dateBtn, styles.timeBtnWidth, { backgroundColor: colors.surface, borderColor: colors.primary }]} onPress={() => setPickerMode('time')}>
                <Icon name="clock" size={14} color={colors.textSecondary} />
                <Text style={[styles.dateBtnText, { color: colors.textPrimary }]}>{format(dateTime, 'HH:mm')}</Text>
              </AnimatedPressable>
            </View>
          </View>

          {pickerMode !== null && (
            <DateTimePicker value={dateTime} mode={pickerMode} is24Hour minimumDate={pickerMode === 'date' ? new Date() : undefined} onChange={handlePickerChange} />
          )}

          <Input label={t.createLabelLocation} value={location} onChangeText={setLocation} placeholder={t.createLocationPlaceholder} autoCapitalize="words" maxLength={100} />
          <Input label={t.createLabelMaxAttendees} value={maxAttendees} onChangeText={(v) => setMaxAttendees(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" hint={t.createMaxAttendeesHint} />

          {/* Gender */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.createLabelGender}</Text>
            <View style={styles.optionRow}>
              {GENDER_OPTIONS.map((g) => (
                <AnimatedPressable key={g.value} onPress={() => setGenderFilter(g.value)}
                  style={[styles.optionChip, { borderColor: genderFilter === g.value ? colors.primary : colors.border, backgroundColor: genderFilter === g.value ? colors.accentSoft : colors.surface }]}>
                  <Text style={[styles.optionLabel, { color: genderFilter === g.value ? colors.accentInk : colors.textSecondary, fontFamily: UIFont }]}>{g.label}</Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>

          {/* Age */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.createLabelAgeRange}</Text>
            <View style={styles.ageRow}>
              {([t.createAgeFrom, t.createAgeTo]).map((label, idx) => {
                const val = idx === 0 ? minAge : maxAge;
                const opts = idx === 0 ? AGE_OPTIONS.filter((a) => a < maxAge) : AGE_OPTIONS.filter((a) => a > minAge);
                const setter = idx === 0 ? setMinAge : setMaxAge;
                return (
                  <View key={label} style={styles.ageGroup}>
                    <Text style={[styles.ageGroupLabel, { color: colors.textHint }]}>{label}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ageScroll}>
                      {opts.map((a, i, arr) => (
                        <AnimatedPressable key={a} onPress={() => setter(a)}
                          style={[styles.ageChip, { borderColor: val === a ? colors.primary : colors.border, backgroundColor: val === a ? colors.accentSoft : colors.surface, marginRight: i < arr.length - 1 ? 8 : 0 }]}>
                          <Text style={[styles.ageLabel, { color: val === a ? colors.accentInk : colors.textSecondary, fontFamily: UIFont }]}>{a}</Text>
                        </AnimatedPressable>
                      ))}
                    </ScrollView>
                  </View>
                );
              })}
            </View>
          </View>

          {/* University */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.createLabelUniversity}</Text>
            <View style={styles.uniGrid}>
              {UNIVERSITIES.map((u) => {
                const sel = selectedUniversities.includes(u);
                return (
                  <AnimatedPressable key={u} onPress={() => toggleUniversity(u)}
                    style={[styles.uniChip, { borderColor: sel ? colors.primary : colors.border, backgroundColor: sel ? colors.accentSoft : colors.surface, marginRight: 8, marginBottom: 8 }]}>
                    <Text style={[styles.uniLabel, { color: sel ? colors.accentInk : colors.textSecondary, fontFamily: UIFont }]}>{u === 'Any' ? t.createGenderAny : universityLabel(u, language)}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>

          {/* Find-your-group info (research doc #9) — same optional field as
              the create flow; leave blank and check-in is unaffected. */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.createCheckInInfoLabel}</Text>
            <Text style={[styles.checkInInfoHint, { color: colors.textHint }]}>{t.createCheckInInfoHint}</Text>
            <Input
              value={checkInInfoText}
              onChangeText={setCheckInInfoText}
              placeholder={t.createCheckInInfoPlaceholder}
              multiline
              numberOfLines={2}
              style={styles.textarea}
              textAlignVertical="top"
              maxLength={200}
            />
            {checkInInfoPhotoUri ? (
              <View style={[styles.checkInPhotoPreviewWrap, { borderColor: colors.border }]}>
                <Image source={{ uri: checkInInfoPhotoUri }} style={styles.checkInPhotoPreview} />
                <AnimatedPressable onPress={() => setCheckInInfoPhotoUri(null)} style={styles.photoRemove} hitSlop={8}>
                  <Icon name="x" size={12} color="#fff" />
                </AnimatedPressable>
              </View>
            ) : (
              <AnimatedPressable onPress={pickCheckInPhoto} style={[styles.checkInPhotoBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Icon name="camera" size={15} color={colors.textSecondary} />
                <Text style={[styles.checkInPhotoBtnText, { color: colors.textSecondary }]}>{t.createCheckInInfoPhotoBtn}</Text>
              </AnimatedPressable>
            )}
          </View>

          {/* Admin-only "Keno Wednesdays" flagship pin (research doc #28) —
              not a general creator feature, since letting anyone pin their
              own event above everyone else's would just be abuse. */}
          {isAdmin && (
            <AnimatedPressable
              onPress={() => setIsFlagship((v) => !v)}
              style={[
                styles.flagshipRow,
                { borderColor: isFlagship ? colors.primary : colors.border, backgroundColor: isFlagship ? colors.accentSoft : colors.surface },
              ]}
            >
              <Icon name="star" size={16} color={isFlagship ? colors.primary : colors.textSecondary} filled={isFlagship} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.flagshipLabel, { color: isFlagship ? colors.accentInk : colors.textPrimary }]}>{t.editEventFlagshipLabel}</Text>
                <Text style={[styles.flagshipHint, { color: isFlagship ? colors.accentInk : colors.textHint }]}>{t.editEventFlagshipHint}</Text>
              </View>
            </AnimatedPressable>
          )}

          {FEATURES.rides && (
            <AnimatedPressable
              onPress={() => setRidesEnabled((v) => !v)}
              style={[
                styles.flagshipRow,
                { borderColor: ridesEnabled ? colors.primary : colors.border, backgroundColor: ridesEnabled ? colors.accentSoft : colors.surface },
              ]}
            >
              <Icon name="users" size={16} color={ridesEnabled ? colors.primary : colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.flagshipLabel, { color: ridesEnabled ? colors.accentInk : colors.textPrimary }]}>{t.ridesToggleLabel}</Text>
                <Text style={[styles.flagshipHint, { color: ridesEnabled ? colors.accentInk : colors.textHint }]}>{t.ridesToggleHint}</Text>
              </View>
            </AnimatedPressable>
          )}

          <Button
            label={saving && uploadProgress > 0 && uploadProgress < 1
              ? t.editEventSaving(Math.round(uploadProgress * 100))
              : t.editEventSave}
            onPress={handleSave}
            loading={saving}
            fullWidth
          />

          {!!original?.seriesId && (
            <Button label={t.seriesStopConfirm} onPress={handleStopSeries} variant="ghost" fullWidth />
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: Spacing.gutter, gap: Spacing.lg },
  header: { gap: Spacing.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: BorderRadius.full, borderWidth: 1 },
  backBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  pageTitle: { fontSize: FontSize.display, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.5 },
  form: { gap: Spacing.md },
  photoBtn: { borderWidth: 1, borderRadius: BorderRadius.lg, overflow: 'hidden', height: 160 },
  photoPreview: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  textarea: { minHeight: 88, paddingTop: Spacing.sm },
  field: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.4 },
  chips: { flexDirection: 'row', paddingVertical: 4, alignItems: 'center' },
  dateRow: { flexDirection: 'row', gap: Spacing.sm },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 13, borderWidth: 1 },
  timeBtnWidth: { flex: 0, minWidth: 110 },
  dateBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  optionRow: { flexDirection: 'row', gap: Spacing.sm },
  optionChip: { flex: 1, paddingVertical: 11, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center' },
  optionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  ageRow: { gap: Spacing.sm },
  ageGroup: { gap: 6 },
  ageGroupLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  ageScroll: { flexDirection: 'row', alignItems: 'center' },
  ageChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1 },
  ageLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  uniGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  uniChip: { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1 },
  uniLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  checkInInfoHint: { fontSize: FontSize.xs, lineHeight: 16, marginTop: -4 },
  checkInPhotoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderStyle: 'dashed', borderRadius: BorderRadius.md, paddingVertical: 12 },
  checkInPhotoBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  checkInPhotoPreviewWrap: { borderWidth: 1, borderRadius: BorderRadius.md, overflow: 'hidden', height: 110, position: 'relative' },
  checkInPhotoPreview: { width: '100%', height: '100%' },
  flagshipRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md },
  flagshipLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  flagshipHint: { fontSize: 11, marginTop: 1 },
});
