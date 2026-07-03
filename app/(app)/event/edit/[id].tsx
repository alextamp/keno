import React, { useEffect, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { useTheme } from '@/core/theme';
import { BorderRadius, DrawFont, FontSize, FontWeight, Shadow, Spacing } from '@/core/constants/theme';
import { EventCategory, GenderFilter } from '@/features/events/domain/entities/event.entity';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { isLeft } from '@/core/utils/either';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { uploadEventImage } from '@/core/utils/uploadImage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { GREEK_UNIVERSITIES, universityLabel } from '@/core/constants/universities';

const UNIVERSITIES = ['Any', ...GREEK_UNIVERSITIES];
const AGE_OPTIONS = [18, 19, 20, 21, 22, 23, 24, 25, 26];

export default function EditEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const upsertEvent = useEventsStore((s) => s.upsertEvent);
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
      setLoading(false);
    });
  }, [id]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert(t.profileAlertPermTitle, t.profileAlertPermBody); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
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
    if (containsBlockedContent(title) || containsBlockedContent(description) || containsBlockedContent(customCategory)) {
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
    const result = await eventsRepository.updateEvent(id, {
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
    });
    if (isLeft(result)) Alert.alert(t.userInviteErrorTitle, result.left.message);
    else { upsertEvent(result.right); router.back(); }
    setSaving(false);
    setUploadProgress(0);
  };

  if (loading) return <LoadingScreen />;

  const bs = colors.borderStrong;

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <AnimatedPressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
            <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>{t.editEventBack}</Text>
          </AnimatedPressable>
          <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>{t.editEventTitle}</Text>
        </View>

        <View style={styles.form}>
          {/* Photo */}
          <AnimatedPressable onPress={pickImage} style={[styles.photoBtn, { backgroundColor: colors.surface, borderColor: bs, borderStyle: imageUri ? 'solid' : 'dashed' }]}>
            {imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                <AnimatedPressable onPress={() => setImageUri(null)} style={styles.photoRemove}>
                  <Text style={styles.photoRemoveText}>✕</Text>
                </AnimatedPressable>
              </>
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoIcon}>📷</Text>
                <Text style={[styles.photoLabel, { color: colors.textHint, fontFamily: DrawFont }]}>{t.editEventCoverPhoto}</Text>
              </View>
            )}
          </AnimatedPressable>

          <Input label={t.createLabelTitle} value={title} onChangeText={setTitle} placeholder={t.createTitlePlaceholder} autoCapitalize="sentences" maxLength={80} />
          <Input label={t.createLabelDescription} value={description} onChangeText={setDescription} placeholder={t.createDescriptionPlaceholder} multiline numberOfLines={3} style={styles.textarea} textAlignVertical="top" maxLength={600} />

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t.createLabelCategory}</Text>
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
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t.createLabelDateTime}</Text>
            <View style={styles.dateRow}>
              <AnimatedPressable style={[styles.dateBtn, { backgroundColor: colors.surface, borderColor: bs }]} onPress={() => setPickerMode('date')}>
                <Text style={[styles.dateBtnText, { color: colors.textPrimary }]}>📅 {format(dateTime, 'EEE, d MMM yyyy')}</Text>
              </AnimatedPressable>
              <AnimatedPressable style={[styles.dateBtn, styles.timeBtnWidth, { backgroundColor: colors.surface, borderColor: bs }]} onPress={() => setPickerMode('time')}>
                <Text style={[styles.dateBtnText, { color: colors.textPrimary }]}>🕐 {format(dateTime, 'HH:mm')}</Text>
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
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t.createLabelGender}</Text>
            <View style={styles.optionRow}>
              {GENDER_OPTIONS.map((g) => (
                <AnimatedPressable key={g.value} onPress={() => setGenderFilter(g.value)}
                  style={[styles.optionChip, { borderColor: bs, backgroundColor: genderFilter === g.value ? colors.primary : colors.surface }]}>
                  <Text style={[styles.optionLabel, { color: genderFilter === g.value ? '#fff' : colors.textSecondary, fontFamily: DrawFont }]}>{g.label}</Text>
                </AnimatedPressable>
              ))}
            </View>
          </View>

          {/* Age */}
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t.createLabelAgeRange}</Text>
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
                          style={[styles.ageChip, { borderColor: bs, backgroundColor: val === a ? colors.primary : colors.surface, marginRight: i < arr.length - 1 ? 8 : 0 }]}>
                          <Text style={[styles.ageLabel, { color: val === a ? '#fff' : colors.textSecondary, fontFamily: DrawFont }]}>{a}</Text>
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
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t.createLabelUniversity}</Text>
            <View style={styles.uniGrid}>
              {UNIVERSITIES.map((u) => {
                const sel = selectedUniversities.includes(u);
                return (
                  <AnimatedPressable key={u} onPress={() => toggleUniversity(u)}
                    style={[styles.uniChip, { borderColor: bs, backgroundColor: sel ? colors.primary : colors.surface, marginRight: 8, marginBottom: 8 }, sel && (Shadow.sm as any)]}>
                    <Text style={[styles.uniLabel, { color: sel ? '#fff' : colors.textSecondary, fontFamily: DrawFont }]}>{u === 'Any' ? t.createGenderAny : universityLabel(u, language)}</Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </View>

          <Button
            label={saving && uploadProgress > 0 && uploadProgress < 1
              ? t.editEventSaving(Math.round(uploadProgress * 100))
              : t.editEventSave}
            onPress={handleSave}
            loading={saving}
            fullWidth
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  header: { gap: Spacing.sm },
  backBtn: { alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 2 },
  backBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  pageTitle: { fontSize: 28, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  form: { gap: Spacing.md },
  photoBtn: { borderWidth: 2.5, borderRadius: 18, overflow: 'hidden', height: 160 },
  photoPreview: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  photoRemoveText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoIcon: { fontSize: 32 },
  photoLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  textarea: { minHeight: 88, paddingTop: Spacing.sm },
  field: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  chips: { flexDirection: 'row', paddingVertical: 4, alignItems: 'center' },
  dateRow: { flexDirection: 'row', gap: Spacing.sm },
  dateBtn: { flex: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 14, justifyContent: 'center', borderWidth: 2.5 },
  timeBtnWidth: { flex: 0, minWidth: 110 },
  dateBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  optionRow: { flexDirection: 'row', gap: Spacing.sm },
  optionChip: { flex: 1, paddingVertical: 12, borderRadius: BorderRadius.md, borderWidth: 2.5, alignItems: 'center' },
  optionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  ageRow: { gap: Spacing.sm },
  ageGroup: { gap: 6 },
  ageGroupLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  ageScroll: { flexDirection: 'row', alignItems: 'center' },
  ageChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 2.5 },
  ageLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  uniGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  uniChip: { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 2.5 },
  uniLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
