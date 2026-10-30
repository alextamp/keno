import React, { useEffect, useState, useRef } from 'react';
import { useCreateFlowStore } from '@/core/store/createFlow.store';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  Alert, Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabNavigation } from '@/core/tabNavigation';
import DateTimePicker from '@react-native-community/datetimepicker';
import { pickImage as pickPhoto } from '@/core/utils/imagePicker';
import { format } from 'date-fns';
import { useTheme } from '@/core/theme';
import { BorderRadius, UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { EventCategory, GenderFilter } from '@/features/events/domain/entities/event.entity';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { CreateEventParams } from '@/features/events/domain/repositories/events.repository';
import { isLeft } from '@/core/utils/either';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { uploadEventImage } from '@/core/utils/uploadImage';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { Icon } from '@/components/ui/Icon';
import { Card } from '@/components/ui/Card';
import { DuotoneScene } from '@/components/ui/DuotoneScene';
import { NewcomerMilestoneModal } from '@/components/ui/NewcomerMilestoneModal';
import { FEATURES } from '@/core/constants/features';
import { RepeatFrequency, SERIES_DEFAULT_COUNT, SERIES_MAX_COUNT, seriesDates } from '@/features/series/series';
import { seriesRepository } from '@/features/series/series.repository';
import { XP_VALUES, getLevel, isNewcomerUser } from '@/core/constants/gamification';
import { ProgressTrack } from '@/components/ui/ProgressTrack';
import { useGroupsStore } from '@/features/groups/presentation/store/groups.store';
import { groupsRepository } from '@/features/groups/data/repositories/groups.repository.impl';
import { useTranslation, useLanguageStore, getDateLocale } from '@/core/i18n';
import { analytics } from '@/core/utils/analytics';
import { GREEK_UNIVERSITIES, universityLabel } from '@/core/constants/universities';

const UNIVERSITIES = ['Any', ...GREEK_UNIVERSITIES];
const AGE_OPTIONS = [18, 19, 20, 21, 22, 23, 24, 25, 26];

function nextHour(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

// `plain` drops the row's own border/background so it can sit as one of
// several dividered rows inside a parent Card (spec §6 "restriction rows in
// a bordered card", mockup 15's ΠΕΡΙΟΡΙΣΜΟΙ card).
function ToggleRow({
  icon, label, hint, on, onPress, plain = false,
}: { icon: 'lock' | 'zap' | 'users'; label: string; hint: string; on: boolean; onPress: () => void; plain?: boolean }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      style={[
        styles.toggleRow,
        plain
          ? styles.toggleRowPlain
          : { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, backgroundColor: on ? colors.accentSoft : colors.surface, borderColor: on ? colors.primary : colors.border },
      ]}
    >
      <Icon name={icon} size={17} color={on ? colors.primary : colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.toggleLabel, { color: on ? colors.accentInk : colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.toggleHint, { color: on ? colors.accentInk : colors.textHint }]}>{hint}</Text>
      </View>
      <View style={[styles.toggleSwitch, { backgroundColor: on ? colors.primary : colors.surfaceVariant }]}>
        <View style={[styles.toggleKnob, { alignSelf: on ? 'flex-end' : 'flex-start' }]} />
      </View>
    </AnimatedPressable>
  );
}

export default function CreateEventScreen() {
  const { goToTab } = useTabNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const awardXP = useAuthStore((s) => s.awardXP);
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
  const scrollViewRef = useRef<ScrollView>(null);
  const setCreateFlowStep = useCreateFlowStore((s) => s.setStep);
  useEffect(() => { setCreateFlowStep(step); }, [step]);

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
  const [noFilters, setNoFilters] = useState(false);
  const [minAge, setMinAge] = useState<number>(18);
  const [maxAge, setMaxAge] = useState<number>(26);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('any');
  const [selectedUniversities, setSelectedUniversities] = useState<string[]>(['Any']);
  const [soloFriendly, setSoloFriendly] = useState(false);
  const [checkInInfoText, setCheckInInfoText] = useState('');
  const [checkInInfoPhotoUri, setCheckInInfoPhotoUri] = useState<string | null>(null);

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [ridesEnabled, setRidesEnabled] = useState(false);
  const [repeat, setRepeat] = useState<RepeatFrequency>('once');
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [repeatCount, setRepeatCount] = useState(SERIES_DEFAULT_COUNT);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  // "Νέος στην πόλη" (newcomer mode) — creating your very first event while
  // still in the mode awards enough bonus XP to level up on the spot.
  // resetForm/goToTab are deferred to the modal's own continue button instead
  // of firing immediately, so the celebration isn't instantly wiped by the
  // tab switch.
  const [newcomerLevelUp, setNewcomerLevelUp] = useState<{ xp: number; from: string; to: string } | null>(null);

  const pickImage = async () => {
    const uri = await pickPhoto({ aspect: [16, 9] });
    if (uri) setImageUri(uri);
  };

  const pickCheckInPhoto = async () => {
    const uri = await pickPhoto({ aspect: [4, 3] });
    if (uri) setCheckInInfoPhotoUri(uri);
  };

  const capacity = Math.max(2, Math.min(100, parseInt(maxAttendees, 10) || 10));
  const adjustCapacity = (delta: number) => setMaxAttendees(String(Math.max(2, Math.min(100, capacity + delta))));

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
        // r.name often duplicates r.street verbatim when the pin isn't on a
        // named place (no POI at that spot) — naively taking the first two
        // of [name, street, district, city] then produced "Street N, Street"
        // instead of "Street N, District". Dedupe case-insensitively instead
        // of blindly slicing.
        const candidates = [r.name, r.street, r.district, r.city].filter((p): p is string => !!p);
        const parts: string[] = [];
        for (const c of candidates) {
          if (parts.length >= 2) break;
          if (!parts.some((p) => p.toLowerCase() === c.toLowerCase())) parts.push(c);
        }
        if (parts.length) setLocation(parts.join(', '));
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
      Alert.alert(t.createPinRequiredTitle, t.createPinRequiredBody);
      return;
    }
    if (dateTime <= new Date()) {
      Alert.alert(t.createAlertBadDateTitle, t.createAlertBadDateBody);
      return;
    }
    setStep(2);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  // This screen stays mounted the whole time it's in the tab pager (it's
  // only hidden, never unmounted, when you swipe away) — so without this,
  // every field from the event you just created would still be sitting
  // there filled in the next time you open Create.
  const seriesPreview = repeat === 'once' ? [] : seriesDates(dateTime, repeat, repeatDays, repeatCount);

  const resetForm = () => {
    setStep(1);
    setTitle('');
    setDescription('');
    setCategory(EventCategory.Chill);
    setCustomCategory('');
    setDateTime(nextHour());
    setLocation('');
    setLocationMode('text');
    setPinCoords(null);
    setMaxAttendees('10');
    setImageUri(null);
    setNoFilters(false);
    setMinAge(18);
    setMaxAge(26);
    setGenderFilter('any');
    setSelectedUniversities(['Any']);
    setSelectedGroupId(null);
    setIsPrivate(false);
    setRidesEnabled(false);
    setRepeat('once');
    setRepeatDays([]);
    setRepeatCount(SERIES_DEFAULT_COUNT);
    setSoloFriendly(false);
    setCheckInInfoText('');
    setCheckInInfoPhotoUri(null);
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  };

  const handleCreate = async () => {
    if (!user) return;
    const max = parseInt(maxAttendees, 10);
    if (isNaN(max) || max < 2 || max > 100) {
      Alert.alert(t.createAlertBadMaxTitle, t.createAlertBadMaxBody);
      return;
    }
    if (containsBlockedContent(title) || containsBlockedContent(description) || containsBlockedContent(customCategory) || containsBlockedContent(checkInInfoText)) {
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

    let checkInInfoPhoto: string | undefined;
    if (checkInInfoPhotoUri) {
      try {
        checkInInfoPhoto = await uploadEventImage(checkInInfoPhotoUri);
      } catch {
        // Non-fatal — the event still gets created without the optional
        // find-your-group photo; the text hint (if any) still goes through.
      }
    }

    // Geocode text location to coordinates if provided
    let finalLat: number | undefined;
    let finalLng: number | undefined;
    if (locationMode === 'map') {
      finalLat = pinCoords?.latitude;
      finalLng = pinCoords?.longitude;
    } else if (location.trim()) {
      try {
        const results = await Location.geocodeAsync(location.trim());
        if (results.length > 0) {
          finalLat = results[0].latitude;
          finalLng = results[0].longitude;
        }
      } catch {
        // Geocoding failed, event will still be created without coordinates
      }
    }

    const params: CreateEventParams = {
      title: title.trim(),
      description: description.trim(),
      category,
      customCategory: category === EventCategory.Other ? customCategory.trim() : undefined,
      dateTime,
      location: location.trim() || 'Pinned location',
      creatorId: user.id,
      latitude: finalLat,
      longitude: finalLng,
      maxAttendees: max,
      imageUri: finalImageUri,
      minAge: noFilters ? undefined : minAge,
      maxAge: noFilters ? undefined : maxAge,
      allowedUniversities: noFilters ? undefined : (selectedUniversities.includes('Any') ? undefined : selectedUniversities),
      genderFilter,
      isPrivate,
      creatorUniversity: user.universityName,
      soloFriendly,
      checkInInfo: (checkInInfoText.trim() || checkInInfoPhoto)
        ? { text: checkInInfoText.trim() || undefined, photoUri: checkInInfoPhoto }
        : undefined,
      ridesEnabled: FEATURES.rides && ridesEnabled,
    };
    const result = FEATURES.recurringEvents && repeat !== 'once'
      ? await seriesRepository.createSeries(params, { frequency: repeat, weekdays: repeatDays, count: repeatCount })
      : await eventsRepository.createEvent(params);
    if (isLeft(result)) Alert.alert(t.createAlertSaveError, result.left.message);
    else {
      upsertEvent(result.right);
      if (selectedGroupId) {
        groupsRepository.addEventToGroup(selectedGroupId, result.right.id).catch(() => {});
      }
      analytics.track('event_created', {
        eventId: result.right.id,
        category,
        isPrivate,
        hasImage: !!finalImageUri,
      });
      // createEvent() above already awarded XP_VALUES.createEvent — `user` is
      // a stale pre-render snapshot either way, so compute both before/after
      // level names from it directly rather than re-reading the store.
      const isFirstEventEver = (user.createdEvents?.length ?? 0) === 0 && isNewcomerUser(user.checkInCount);
      if (isFirstEventEver) {
        const preXp = user.xp ?? 0;
        await awardXP(XP_VALUES.newcomerFirstEventBonus);
        setNewcomerLevelUp({
          xp: XP_VALUES.createEvent + XP_VALUES.newcomerFirstEventBonus,
          from: getLevel(preXp, user.id).name,
          to: getLevel(preXp + XP_VALUES.createEvent + XP_VALUES.newcomerFirstEventBonus, user.id).name,
        });
      } else {
        resetForm();
        goToTab(0); // go back to Feed tab
      }
    }
    setLoading(false);
    setUploadProgress(0);
  };

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: TAB_BAR_BASE_HEIGHT + insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          {step === 2 && (
            <AnimatedPressable onPress={() => { setStep(1); scrollViewRef.current?.scrollTo({ y: 0, animated: true }); }} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon name="back" size={15} color={colors.textSecondary} />
            </AnimatedPressable>
          )}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {step === 1 ? t.createTitle : t.createWhoTitle}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textHint }]}>
            {step === 1 ? t.createStep1 : t.createStep2}
          </Text>
          <ProgressTrack progress={step === 1 ? 0.5 : 1} />
        </View>

        {step === 1 ? (
          <View style={styles.form}>
            {/* Photo */}
            {imageUri ? (
              <View style={[styles.photoBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Image source={{ uri: imageUri }} style={styles.photoPreview} />
                <AnimatedPressable onPress={() => setImageUri(null)} style={styles.photoRemove} hitSlop={8}>
                  <Icon name="x" size={13} color="#fff" />
                </AnimatedPressable>
                <AnimatedPressable onPress={pickImage} style={styles.photoChange}>
                  <Icon name="camera" size={13} color="#fff" />
                  <Text style={[styles.photoChangeText, { fontFamily: UIFont }]}>{t.editEventChangeCover}</Text>
                </AnimatedPressable>
              </View>
            ) : (
              <AnimatedPressable onPress={pickImage} style={[styles.photoBtn, { borderColor: colors.border }]}>
                {/* No cover yet — preview the category's duotone scene (addendum
                    §3) instead of a flat placeholder, so the creator sees what
                    their card will look like without a real photo. */}
                <DuotoneScene category={category} height={160} />
                <View style={styles.photoPlaceholder}>
                  <Icon name="camera" size={24} color="#fff" />
                  <Text style={[styles.photoLabel, { color: '#fff', fontFamily: UIFont }]}>{t.createPhotoBtnLabel}</Text>
                  <Text style={[styles.photoSub, { color: 'rgba(255,255,255,0.8)' }]}>{t.createPhotoOptional}</Text>
                </View>
              </AnimatedPressable>
            )}

            <Input label={t.createLabelTitle} value={title} onChangeText={setTitle} placeholder={t.createTitlePlaceholder} autoCapitalize="sentences" returnKeyType="next" maxLength={80} />
            <Input label={t.createLabelDescription} value={description} onChangeText={setDescription} placeholder={t.createDescriptionPlaceholder} multiline numberOfLines={3} style={styles.textarea} textAlignVertical="top" maxLength={600} />

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.createLabelCategory}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {Object.values(EventCategory).map((cat) => (
                  <CategoryChip key={cat} category={cat} selected={category === cat} onPress={() => setCategory(cat)} />
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

            {/* Location */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.createLabelLocation}</Text>
              <View style={styles.locationModeRow}>
                <AnimatedPressable
                  onPress={() => { setLocationMode('text'); setPinCoords(null); }}
                  style={[styles.locationModeBtn, { backgroundColor: locationMode === 'text' ? colors.accentSoft : colors.surface, borderColor: locationMode === 'text' ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.locationModeTxt, { color: locationMode === 'text' ? colors.accentInk : colors.textSecondary }]}>{t.createLocationGeneral ?? 'General'}</Text>
                </AnimatedPressable>
                <AnimatedPressable
                  onPress={() => setLocationMode('map')}
                  style={[styles.locationModeBtn, { backgroundColor: locationMode === 'map' ? colors.accentSoft : colors.surface, borderColor: locationMode === 'map' ? colors.primary : colors.border }]}
                >
                  <Text style={[styles.locationModeTxt, { color: locationMode === 'map' ? colors.accentInk : colors.textSecondary }]}>{t.createLocationExact ?? 'Exact spot'}</Text>
                </AnimatedPressable>
              </View>

              {locationMode === 'text' ? (
                <Input value={location} onChangeText={setLocation} placeholder={t.createLocationPlaceholder} autoCapitalize="words" returnKeyType="next" maxLength={100} />
              ) : (
                <>
                  <View style={[styles.mapWrap, { borderColor: colors.border }]}>
                    <MapView
                      style={StyleSheet.absoluteFill}
                      initialRegion={{ latitude: 37.98, longitude: 23.73, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
                      onPress={handleMapPress}
                    >
                      {pinCoords && <Marker coordinate={pinCoords} />}
                    </MapView>
                  </View>
                  <Text style={[styles.pinStatus, { color: pinCoords ? colors.primary : colors.textHint }]}>
                    {pinCoords ? (t.createPinPlaced ?? 'Pin placed — tap to move it') : (t.createPinTap ?? 'Tap the map to drop a pin')}
                  </Text>
                  <Input
                    label={t.createLocationNameLabel ?? 'Location name'}
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

            <Button
              label={t.createBtnNext}
              onPress={goToStep2}
              disabled={!title.trim() || (locationMode === 'text' ? !location.trim() : !pinCoords)}
              fullWidth
            />
          </View>
        ) : (
          <View style={styles.form}>
            {/* Capacity stepper (mockup 15 ΧΩΡΗΤΙΚΟΤΗΤΑ) */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.createLabelMaxAttendees}</Text>
              <Card padded style={styles.capacityCard}>
                <Text style={[styles.capacityValue, { color: colors.textPrimary }]}>{capacity}</Text>
                <View style={styles.capacityBtns}>
                  <Button label="−" variant="outline" shape="pill" size="sm" style={styles.stepperBtn} onPress={() => adjustCapacity(-1)} />
                  <Button label="+" variant="outline" shape="pill" size="sm" style={styles.stepperBtn} onPress={() => adjustCapacity(1)} />
                </View>
              </Card>
            </View>

            {/* Restriction toggles, grouped in one bordered card (mockup 15 ΠΕΡΙΟΡΙΣΜΟΙ) */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.createLabelEventOptions}</Text>
              <Card padded style={styles.restrictionsCard}>
                <ToggleRow
                  icon="lock"
                  label={t.createNoFiltersLabel ?? 'No Filters'}
                  hint={t.createNoFiltersHint ?? 'Anyone can join without providing age or university'}
                  on={noFilters}
                  onPress={() => setNoFilters((v) => !v)}
                  plain
                />
                <View style={[styles.rowDivider, { borderColor: colors.border }]} />
                <ToggleRow
                  icon="lock"
                  label={t.createPrivateLabel ?? 'Private Event'}
                  hint={isPrivate || !FEATURES.publicEventLinks ? t.createPrivateHint : t.createPublicHint}
                  on={isPrivate}
                  onPress={() => setIsPrivate((v) => !v)}
                  plain
                />
                <View style={[styles.rowDivider, { borderColor: colors.border }]} />
                <ToggleRow
                  icon="users"
                  label={t.createSoloFriendlyLabel}
                  hint={t.createSoloFriendlyHint}
                  on={soloFriendly}
                  onPress={() => setSoloFriendly((v) => !v)}
                  plain
                />
                {FEATURES.rides && (
                  <>
                    <View style={[styles.rowDivider, { borderColor: colors.border }]} />
                    <ToggleRow
                      icon="users"
                      label={t.ridesToggleLabel}
                      hint={t.ridesToggleHint}
                      on={ridesEnabled}
                      onPress={() => setRidesEnabled((v) => !v)}
                      plain
                    />
                  </>
                )}
              </Card>
            </View>

            {FEATURES.recurringEvents && (
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.seriesRepeatLabel}</Text>
                <View style={styles.optionRow}>
                  {(['once', 'weekly', 'biweekly'] as RepeatFrequency[]).map((f) => (
                    <AnimatedPressable key={f} onPress={() => setRepeat(f)}
                      style={[styles.optionChip, { borderColor: repeat === f ? colors.primary : colors.border, backgroundColor: repeat === f ? colors.accentSoft : colors.surface }]}>
                      <Text style={[styles.optionLabel, { color: repeat === f ? colors.accentInk : colors.textSecondary, fontFamily: UIFont }]}>{t.seriesFrequency(f)}</Text>
                    </AnimatedPressable>
                  ))}
                </View>
                {repeat !== 'once' && (
                  <Card padded style={styles.seriesCard}>
                    <View style={styles.weekdayRow}>
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                        const isStart = d === dateTime.getDay();
                        const on = isStart || repeatDays.includes(d);
                        return (
                          <AnimatedPressable
                            key={d}
                            disabled={isStart}
                            onPress={() => setRepeatDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d]))}
                            style={[styles.weekdayChip, { backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.border }]}
                          >
                            <Text style={[styles.weekdayText, { color: on ? '#FFFFFF' : colors.textSecondary }]}>{t.seriesWeekdaysShort[d]}</Text>
                          </AnimatedPressable>
                        );
                      })}
                    </View>
                    <View style={styles.seriesCountRow}>
                      <Text style={[styles.toggleLabel, { color: colors.textPrimary, flex: 1 }]}>{t.seriesEndsAfter(repeatCount)}</Text>
                      <View style={styles.capacityBtns}>
                        <Button label="−" variant="outline" shape="pill" size="sm" style={styles.stepperBtn} onPress={() => setRepeatCount((c) => Math.max(2, c - 1))} />
                        <Button label="+" variant="outline" shape="pill" size="sm" style={styles.stepperBtn} onPress={() => setRepeatCount((c) => Math.min(SERIES_MAX_COUNT, c + 1))} />
                      </View>
                    </View>
                    <Text style={[styles.toggleHint, { color: colors.textHint }]}>
                      {t.seriesUpcomingDates(
                        seriesPreview.slice(0, 4).map((d) => format(d, 'EEE d MMM', { locale: getDateLocale(language) })).join(' · '),
                        seriesPreview.length,
                      )}
                    </Text>
                  </Card>
                )}
              </View>
            )}

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

            {/* Age range */}
            {!noFilters && (<View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.createLabelAgeRange}</Text>
              <View style={styles.ageRow}>
                <View style={styles.ageGroup}>
                  <Text style={[styles.ageGroupLabel, { color: colors.textHint }]}>{t.createAgeFrom}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ageScroll}>
                    {AGE_OPTIONS.filter((a) => a < maxAge).map((a, i, arr) => (
                      <AnimatedPressable key={a} onPress={() => setMinAge(a)}
                        style={[styles.ageChip, { borderColor: minAge === a ? colors.primary : colors.border, backgroundColor: minAge === a ? colors.accentSoft : colors.surface, marginRight: i < arr.length - 1 ? 8 : 0 }]}>
                        <Text style={[styles.ageLabel, { color: minAge === a ? colors.accentInk : colors.textSecondary, fontFamily: UIFont }]}>{a}</Text>
                      </AnimatedPressable>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.ageGroup}>
                  <Text style={[styles.ageGroupLabel, { color: colors.textHint }]}>{t.createAgeTo}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ageScroll}>
                    {AGE_OPTIONS.filter((a) => a > minAge).map((a, i, arr) => (
                      <AnimatedPressable key={a} onPress={() => setMaxAge(a)}
                        style={[styles.ageChip, { borderColor: maxAge === a ? colors.primary : colors.border, backgroundColor: maxAge === a ? colors.accentSoft : colors.surface, marginRight: i < arr.length - 1 ? 8 : 0 }]}>
                        <Text style={[styles.ageLabel, { color: maxAge === a ? colors.accentInk : colors.textSecondary, fontFamily: UIFont }]}>{a}</Text>
                      </AnimatedPressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
            )}

            {/* University */}
            {!noFilters && (<View style={styles.field}>
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
            )}

            {/* Find-your-group info (research doc #9) — entirely optional;
                shown to attendees the moment they check in. Leave both
                blank and QR check-in behaves exactly as before. */}
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
                    <Icon name="x" size={13} color="#fff" />
                  </AnimatedPressable>
                </View>
              ) : (
                <AnimatedPressable onPress={pickCheckInPhoto} style={[styles.checkInPhotoBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Icon name="camera" size={15} color={colors.textSecondary} />
                  <Text style={[styles.checkInPhotoBtnText, { color: colors.textSecondary }]}>{t.createCheckInInfoPhotoBtn}</Text>
                </AnimatedPressable>
              )}
            </View>

            {/* Post to community (optional) */}
            {myGroups.length > 0 && (
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textDecor }]}>{t.createLabelCommunity}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <AnimatedPressable
                    onPress={() => setSelectedGroupId(null)}
                    style={[styles.uniChip, { borderColor: selectedGroupId === null ? colors.primary : colors.border, backgroundColor: selectedGroupId === null ? colors.accentSoft : colors.surface }]}
                  >
                    <Text style={[styles.uniLabel, { color: selectedGroupId === null ? colors.accentInk : colors.textSecondary, fontFamily: UIFont }]}>{t.createCommunityNone}</Text>
                  </AnimatedPressable>
                  {myGroups.map((g) => (
                    <AnimatedPressable
                      key={g.id}
                      onPress={() => setSelectedGroupId(g.id)}
                      style={[styles.uniChip, { borderColor: selectedGroupId === g.id ? colors.primary : colors.border, backgroundColor: selectedGroupId === g.id ? colors.accentSoft : colors.surface }]}
                    >
                      <Text style={[styles.uniLabel, { color: selectedGroupId === g.id ? colors.accentInk : colors.textSecondary, fontFamily: UIFont }]}>
                        {g.emoji} {g.name}
                      </Text>
                    </AnimatedPressable>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Safety note (spec §4 "note"; CLAUDE.md safety non-negotiable: report SLA <24h) */}
            <View style={[styles.noteBox, { backgroundColor: colors.accentSoft }]}>
              <Icon name="shield" size={15} color={colors.accentInk} />
              <Text style={[styles.noteText, { color: colors.accentInk }]}>{t.createSafetyNote}</Text>
            </View>

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

      <NewcomerMilestoneModal
        visible={!!newcomerLevelUp}
        variant="levelUp"
        xpAmount={newcomerLevelUp?.xp ?? 0}
        fromLevelName={newcomerLevelUp?.from}
        toLevelName={newcomerLevelUp?.to}
        onContinue={() => {
          setNewcomerLevelUp(null);
          resetForm();
          goToTab(0);
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: Spacing.gutter, gap: Spacing.lg },
  header: { gap: Spacing.sm },
  backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', borderWidth: 1 },
  title: { fontSize: FontSize.display, fontWeight: FontWeight.bold, fontFamily: TitleFont, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.base, fontFamily: UIFontLight },
  form: { gap: Spacing.md },
  photoBtn: { borderWidth: 1, borderRadius: BorderRadius.lg, overflow: 'hidden', height: 160, position: 'relative' },
  photoPreview: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  photoChange: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoChangeText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  photoPlaceholder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: 'rgba(20,14,10,0.34)',
  },
  photoLabel: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  photoSub: { fontSize: FontSize.xs },
  textarea: { minHeight: 88, paddingTop: Spacing.sm },
  field: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.4 },
  chips: { flexDirection: 'row', paddingVertical: 4, alignItems: 'center', gap: Spacing.sm },
  dateRow: { flexDirection: 'row', gap: Spacing.sm },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 13, borderWidth: 1 },
  timeBtnWidth: { flex: 0, minWidth: 110 },
  dateBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.medium },
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
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  toggleRowPlain: { paddingVertical: 9 },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  toggleHint: { fontSize: 11, marginTop: 1 },
  toggleSwitch: { width: 36, height: 20, borderRadius: 10, padding: 2, justifyContent: 'center' },
  toggleKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#fff' },
  restrictionsCard: { gap: 0 },
  seriesCard: { marginTop: Spacing.sm, gap: Spacing.md },
  weekdayRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  weekdayChip: { flex: 1, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  weekdayText: { fontSize: FontSize.xs, fontFamily: UIFont, fontWeight: FontWeight.bold },
  seriesCountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowDivider: { borderTopWidth: 1, marginVertical: 2 },
  capacityCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capacityValue: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  capacityBtns: { flexDirection: 'row', gap: Spacing.sm },
  stepperBtn: { paddingHorizontal: Spacing.md },
  locationModeRow: { flexDirection: 'row', gap: 10 },
  locationModeBtn: { flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center' },
  locationModeTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  mapWrap: { height: 220, borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  pinStatus: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textAlign: 'center' },
  // Warm Paper "note" box (spec §4): accent.soft bg, shield icon, accent.ink text.
  noteBox: { flexDirection: 'row', gap: 9, alignItems: 'flex-start', borderRadius: BorderRadius.md, padding: Spacing.md },
  noteText: { flex: 1, fontSize: FontSize.xs, lineHeight: 17 },
  checkInInfoHint: { fontSize: FontSize.xs, lineHeight: 16, marginTop: -4 },
  checkInPhotoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderStyle: 'dashed', borderRadius: BorderRadius.md, paddingVertical: 12 },
  checkInPhotoBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  checkInPhotoPreviewWrap: { borderWidth: 1, borderRadius: BorderRadius.md, overflow: 'hidden', height: 110, position: 'relative' },
  checkInPhotoPreview: { width: '100%', height: '100%' },
});
