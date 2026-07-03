import React, { useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTabNavigation } from '@/core/tabNavigation';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { useTheme } from '@/core/theme';
import { BorderRadius, DrawFont, FontSize, FontWeight, Shadow, Spacing } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { EventCategory, GenderFilter } from '@/features/events/domain/entities/event.entity';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { isLeft } from '@/core/utils/either';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { uploadEventImage } from '@/core/utils/uploadImage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { useGroupsStore } from '@/features/groups/presentation/store/groups.store';
import { groupsRepository } from '@/features/groups/data/repositories/groups.repository.impl';
import { useTranslation, useLanguageStore, getDateLocale } from '@/core/i18n';
import { GREEK_UNIVERSITIES, universityLabel } from '@/core/constants/universities';

const UNIVERSITIES = ['Any', ...GREEK_UNIVERSITIES];
const AGE_OPTIONS = [18, 19, 20, 21, 22, 23, 24, 25, 26];

function nextHour(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export default function CreateEventScreen() {
  const router = useRouter();
  const { goToTab } = useTabNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const upsertEvent = useEventsStore((s) => s.upsertEvent);
  const myGroups = useGroupsStore((s) => s.myGroups);
  const loadMyGroups = useGroupsStore((s) => s.loadMyGroups);
  const t = useTranslation();
  const { language } = useLanguageStore();
  const GENDER_OPTIONS: { value: GenderFilter; label: string }[] = [
    { value: 'any', label: t.createGenderAny },
    { value: 'male', label: t.createGenderMale },
    { value: 'female', label: t.createGenderFemale },
  ];

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>(EventCategory.Chill);
  const [customCategory, setCustomCategory] = useState('');
  const [dateTime, setDateTime] = useState<Date>(nextHour);
  const [location, setLocation] = useState('');
  const [locationMode, setLocationMode] = useState<'text' | 'map'>('text');
  const [pinCoords, setPinCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [maxAttendees, setMaxAttendees] = useState('10');
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);

  // Step 2 fields
  const [minAge, setMinAge] = useState<number>(18);
  const [maxAge, setMaxAge] = useState<number>(26);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('any');
  const [selectedUniversities, setSelectedUniversities] = useState<string[]>(['Any']);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t.profileAlertPermTitle, t.profileAlertPermBody);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const toggleUniversity = (u: string) => {
    if (u === 'Any') { setSelectedUniversities(['Any']); return; }
    const without = selectedUniversities.filter((x) => x !== 'Any');
    setSelectedUniversities(without.includes(u) ? without.filter((x) => x !== u).length ? without.filter((x) => x !== u) : ['Any'] : [...without, u]);
  };

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPinCoords({ latitude, longitude });
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.street, r.district, r.city].filter(Boolean);
        if (parts.length) setLocation(parts.slice(0, 2).join(', '));
      }
    } catch {}
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

  const goToStep2 = () => {
    if (user) loadMyGroups(user.id);
    if (!title.trim()) {
      Alert.alert(t.createAlertMissingTitle, t.createAlertMissingBody);
      return;
    }
    if (locationMode === 'text' && !location.trim()) {
      Alert.alert(t.createAlertMissingTitle, t.createAlertMissingBody);
      return;
    }
    if (locationMode === 'map' && !pinCoords) {
      Alert.alert('Pin required', 'Tap the map to drop a pin for the exact location.');
      return;
    }
    if (dateTime <= new Date()) {
      Alert.alert(t.createAlertBadDateTitle, t.createAlertBadDateBody);
      return;
    }
    setStep(2);
  };

  const handleCreate = async () => {
    if (!user) return;
    const max = parseInt(maxAttendees, 10);
    if (isNaN(max) || max < 2 || max > 100) {
      Alert.alert(t.createAlertBadMaxTitle, t.createAlertBadMaxBody);
      return;
    }
    if (containsBlockedContent(title) || containsBlockedContent(description) || containsBlockedContent(customCategory)) {
      Alert.alert(t.createAlertMissingTitle, t.validContentBlocked);
      return;
    }
    setLoading(true);
    let finalImageUri: string | undefined;
    if (imageUri) {
      try {
        finalImageUri = await uploadEventImage(imageUri, (p) => setUploadProgress(p));
      } catch {
        Alert.alert(t.createAlertUploadTitle, t.createAlertUploadBody);
        setLoading(false);
        return;
      }
    }
    const result = await eventsRepository.createEvent({
      title: title.trim(),
      description: description.trim(),
      category,
      customCategory: category === EventCategory.Other ? customCategory.trim() : undefined,
      dateTime,
      location: location.trim() || 'Pinned location',
      creatorId: user.id,
      latitude: locationMode === 'map' ? pinCoords?.latitude : undefined,
      longitude: locationMode === 'map' ? pinCoords?.longitude : undefined,
      maxAttendees: max,
      imageUri: finalImageUri,
      minAge,
      maxAge,
      allowedUniversities: selectedUniversities.includes('Any') ? undefined : selectedUniversities,
      genderFilter,
      isPrivate,
      creatorUniversity: user.universityName,
    });
    if (isLeft(result)) Alert.alert(t.createAlertSaveError, result.left.message);
    else {
      upsertEvent(result.right);
      if (selectedGroupId) {
        groupsRepository.addEventToGroup(selectedGroupId, result.right.id).catch(() => {});
      }
      goToTab(0); // go back to Feed tab
    }
    setLoading(false);
    setUploadProgress(0);
  };

  const bs = colors.borderStrong;

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          {step === 2 && (
            <AnimatedPressable onPress={() => setStep(1)} style={[styles.backBtn, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
              <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>{t.createBack}</Text>
            </AnimatedPressable>
          )}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {step === 1 ? t.createTitle : t.createWhoTitle}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {step === 1 ? t.createStep1 : t.createStep2}
          </Text>
          <View style={[styles.stepBar, { backgroundColor: colors.surfaceVariant, borderColor: bs }]}>
            <View style={[styles.stepFill, { backgroundColor: colors.primary, width: step === 1 ? '50%' : '100%' }]} />
          </View>
        </View>

        {step === 1 ? (
          <View style={styles.form}>
            {/* Photo */}
            {imageUri ? (
              <View style={[styles.photoBtn, { backgroundColor: colors.surface, borderColor: bs }]}>
                <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                <AnimatedPressable onPress={() => setImageUri(null)} style={styles.photoRemove} hitSlop={8}>
                  <Text style={styles.photoRemoveText}>✕</Text>
                </AnimatedPressable>
                <AnimatedPressable onPress={pickImage} style={styles.photoChange}>
                  <Text style={[styles.photoChangeText, { fontFamily: DrawFont }]}>📷 {t.editEventChangeCover}</Text>
                </AnimatedPressable>
              </View>
            ) : (
              <AnimatedPressable onPress={pickImage} style={[styles.photoBtn, { backgroundColor: colors.surface, borderColor: bs, borderStyle: 'dashed' }]}>
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoIcon}>📷</Text>
                  <Text style={[styles.photoLabel, { color: colors.textHint, fontFamily: DrawFont }]}>{t.createPhotoBtnLabel}</Text>
                  <Text style={[styles.photoSub, { color: colors.textHint }]}>{t.createPhotoOptional}</Text>
                </View>
              </AnimatedPressable>
            )}

            <Input label={t.createLabelTitle} value={title} onChangeText={setTitle} placeholder={t.createTitlePlaceholder} autoCapitalize="sentences" returnKeyType="next" maxLength={80} />
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
                <Input
                  label={t.createLabelCustomCategory}
                  value={customCategory}
                  onChangeText={setCustomCategory}
                  placeholder={t.createCustomCategoryPlaceholder}
                  autoCapitalize="words"
                  returnKeyType="next"
                  maxLength={30}
                />
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t.createLabelDateTime}</Text>
              <View style={styles.dateRow}>
                <AnimatedPressable style={[styles.dateBtn, { backgroundColor: colors.surface, borderColor: bs }]} onPress={() => setPickerMode('date')}>
                  <Text style={[styles.dateBtnText, { color: colors.textPrimary }]}>📅 {format(dateTime, 'EEE, d MMM yyyy', { locale: getDateLocale(language) })}</Text>
                </AnimatedPressable>
                <AnimatedPressable style={[styles.dateBtn, styles.timeBtnWidth, { backgroundColor: colors.surface, borderColor: bs }]} onPress={() => setPickerMode('time')}>
                  <Text style={[styles.dateBtnText, { color: colors.textPrimary }]}>🕐 {format(dateTime, 'HH:mm')}</Text>
                </AnimatedPressable>
              </View>
            </View>

            {pickerMode !== null && (
              <DateTimePicker value={dateTime} mode={pickerMode} is24Hour minimumDate={pickerMode === 'date' ? new Date() : undefined} onChange={handlePickerChange} />
            )}

            {/* Location */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t.createLabelLocation}</Text>
              <View style={styles.locationModeRow}>
                <AnimatedPressable
                  onPress={() => { setLocationMode('text'); setPinCoords(null); }}
                  style={[styles.locationModeBtn, { backgroundColor: locationMode === 'text' ? colors.primary : colors.surface, borderColor: bs }]}
                >
                  <Text style={[styles.locationModeTxt, { color: locationMode === 'text' ? '#fff' : colors.textSecondary }]}>📝 General</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => setLocationMode('map')}
                  style={[styles.locationModeBtn, { backgroundColor: locationMode === 'map' ? colors.primary : colors.surface, borderColor: bs }]}
                >
                  <Text style={[styles.locationModeTxt, { color: locationMode === 'map' ? '#fff' : colors.textSecondary }]}>📍 Exact spot</Text>
                </AnimatedPressable>
              </View>

              {locationMode === 'text' ? (
                <Input value={location} onChangeText={setLocation} placeholder={t.createLocationPlaceholder} autoCapitalize="words" returnKeyType="next" maxLength={100} />
              ) : (
                <>
                  <View style={[styles.mapWrap, { borderColor: bs }]}>
                    <MapView
                      style={StyleSheet.absoluteFillObject}
                      initialRegion={{ latitude: 37.98, longitude: 23.73, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
                      onPress={handleMapPress}
                    >
                      {pinCoords && <Marker coordinate={pinCoords} />}
                    </MapView>
                  </View>
                  <Text style={[styles.pinStatus, { color: pinCoords ? colors.primary : colors.textHint }]}>
                    {pinCoords ? '📍 Pin placed — tap to move it' : 'Tap the map to drop a pin'}
                  </Text>
                  <Input
                    label="Location name"
                    value={location}
                    onChangeText={setLocation}
                    placeholder="e.g. Campus square, AUEB"
                    autoCapitalize="words"
                    returnKeyType="next"
                    maxLength={100}
                  />
                </>
              )}
            </View>

            <Input label={t.createLabelMaxAttendees} value={maxAttendees} onChangeText={(v) => setMaxAttendees(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" returnKeyType="done" hint={t.createMaxAttendeesHint} />

            <Button
              label={t.createBtnNext}
              onPress={goToStep2}
              disabled={!title.trim() || (locationMode === 'text' ? !location.trim() : !pinCoords)}
              fullWidth
            />
          </View>
        ) : (
          <View style={styles.form}>
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

            {/* Age range */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t.createLabelAgeRange}</Text>
              <View style={styles.ageRow}>
                <View style={styles.ageGroup}>
                  <Text style={[styles.ageGroupLabel, { color: colors.textHint }]}>{t.createAgeFrom}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ageScroll}>
                    {AGE_OPTIONS.filter((a) => a < maxAge).map((a, i, arr) => (
                      <AnimatedPressable key={a} onPress={() => setMinAge(a)}
                        style={[styles.ageChip, { borderColor: bs, backgroundColor: minAge === a ? colors.primary : colors.surface, marginRight: i < arr.length - 1 ? 8 : 0 }]}>
                        <Text style={[styles.ageLabel, { color: minAge === a ? '#fff' : colors.textSecondary, fontFamily: DrawFont }]}>{a}</Text>
                      </AnimatedPressable>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.ageGroup}>
                  <Text style={[styles.ageGroupLabel, { color: colors.textHint }]}>{t.createAgeTo}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ageScroll}>
                    {AGE_OPTIONS.filter((a) => a > minAge).map((a, i, arr) => (
                      <AnimatedPressable key={a} onPress={() => setMaxAge(a)}
                        style={[styles.ageChip, { borderColor: bs, backgroundColor: maxAge === a ? colors.primary : colors.surface, marginRight: i < arr.length - 1 ? 8 : 0 }]}>
                        <Text style={[styles.ageLabel, { color: maxAge === a ? '#fff' : colors.textSecondary, fontFamily: DrawFont }]}>{a}</Text>
                      </AnimatedPressable>
                    ))}
                  </ScrollView>
                </View>
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

            {/* Private event toggle */}
            <AnimatedPressable
              onPress={() => setIsPrivate((v) => !v)}
              style={[styles.recurringRow, { backgroundColor: isPrivate ? '#1a1a2e' : colors.surface, borderColor: isPrivate ? '#6c63ff' : bs }]}
            >
              <Text style={styles.recurringIcon}>{isPrivate ? '🔒' : '🔓'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.recurringLabel, { color: isPrivate ? '#fff' : colors.textPrimary }]}>
                  {t.createPrivateLabel ?? 'Private Event'}
                </Text>
                <Text style={{ fontSize: 11, color: isPrivate ? 'rgba(255,255,255,0.6)' : colors.textHint }}>
                  {t.createPrivateHint ?? 'Only invited people can join'}
                </Text>
              </View>
              <View style={[styles.recurringToggle, { backgroundColor: isPrivate ? '#6c63ff' : colors.surfaceVariant, borderColor: bs }]}>
                <Text style={[styles.recurringToggleText, { color: '#fff' }]}>{isPrivate ? 'ON' : 'OFF'}</Text>
              </View>
            </AnimatedPressable>

            {/* Post to community (optional) */}
            {myGroups.length > 0 && (
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>{t.createLabelCommunity}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <AnimatedPressable
                    onPress={() => setSelectedGroupId(null)}
                    style={[styles.uniChip, { borderColor: bs, backgroundColor: selectedGroupId === null ? colors.primary : colors.surface }]}
                  >
                    <Text style={[styles.uniLabel, { color: selectedGroupId === null ? '#fff' : colors.textSecondary, fontFamily: DrawFont }]}>{t.createCommunityNone}</Text>
                  </AnimatedPressable>
                  {myGroups.map((g) => (
                    <AnimatedPressable
                      key={g.id}
                      onPress={() => setSelectedGroupId(g.id)}
                      style={[styles.uniChip, { borderColor: bs, backgroundColor: selectedGroupId === g.id ? colors.primary : colors.surface }]}
                    >
                      <Text style={[styles.uniLabel, { color: selectedGroupId === g.id ? '#fff' : colors.textSecondary, fontFamily: DrawFont }]}>
                        {g.emoji} {g.name}
                      </Text>
                    </AnimatedPressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <Button
              label={loading && uploadProgress > 0 && uploadProgress < 1
                ? t.createBtnUploading(Math.round(uploadProgress * 100))
                : t.createBtnCreate}
              onPress={handleCreate}
              loading={loading}
              fullWidth
            />
          </View>
        )}
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
  title: { fontSize: 28, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  subtitle: { fontSize: FontSize.sm },
  stepBar: { height: 8, borderRadius: 4, overflow: 'hidden', borderWidth: 2 },
  stepFill: { height: '100%', borderRadius: 4 },
  form: { gap: Spacing.md },
  photoBtn: { borderWidth: 2.5, borderRadius: 18, overflow: 'hidden', height: 160 },
  photoPreview: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  photoRemoveText: { color: '#fff', fontSize: 13, fontWeight: FontWeight.bold },
  photoChange: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 8, alignItems: 'center' },
  photoChangeText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoIcon: { fontSize: 32 },
  photoLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  photoSub: { fontSize: FontSize.xs },
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
  recurringRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 2.5, borderRadius: BorderRadius.lg, padding: Spacing.md },
  recurringIcon: { fontSize: 20 },
  recurringLabel: { flex: 1, fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  recurringToggle: { borderRadius: BorderRadius.full, borderWidth: 1.5, paddingHorizontal: 10, paddingVertical: 4 },
  recurringToggleText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  locationModeRow: { flexDirection: 'row', gap: 10 },
  locationModeBtn: { flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 2.5, alignItems: 'center' },
  locationModeTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  mapWrap: { height: 220, borderRadius: BorderRadius.lg, borderWidth: 2.5, overflow: 'hidden' },
  pinStatus: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textAlign: 'center' },
});
