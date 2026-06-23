import React, { useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { format } from 'date-fns';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { EventCategory, GenderFilter } from '@/features/events/domain/entities/event.entity';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { isLeft } from '@/core/utils/either';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CategoryChip } from '@/components/ui/CategoryChip';

const UNIVERSITIES = ['AUEB', 'NTUA', 'UOA', 'AUTH', 'UNIPI', 'Panteion', 'Any'];
const GENDER_OPTIONS: { value: GenderFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];
const AGE_OPTIONS = [18, 19, 20, 21, 22, 23, 24, 25, 26];

function nextHour(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

export default function CreateEventScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { upsertEvent } = useEventsStore();

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventCategory>(EventCategory.Chill);
  const [dateTime, setDateTime] = useState<Date>(nextHour);
  const [location, setLocation] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('10');
  const [pickerMode, setPickerMode] = useState<'date' | 'time' | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);

  // Step 2 fields
  const [minAge, setMinAge] = useState<number>(18);
  const [maxAge, setMaxAge] = useState<number>(26);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('any');
  const [selectedUniversities, setSelectedUniversities] = useState<string[]>(['Any']);

  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
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
    if (!title.trim() || !location.trim()) {
      Alert.alert('Missing info', 'Title and location are required.');
      return;
    }
    if (dateTime <= new Date()) {
      Alert.alert('Invalid date', 'Event must be in the future.');
      return;
    }
    setStep(2);
  };

  const handleCreate = async () => {
    if (!user) return;
    const max = parseInt(maxAttendees, 10);
    if (isNaN(max) || max < 2 || max > 100) {
      Alert.alert('Invalid', 'Max attendees must be between 2 and 100.');
      return;
    }
    setLoading(true);
    const result = await eventsRepository.createEvent({
      title: title.trim(),
      description: description.trim(),
      category,
      dateTime,
      location: location.trim(),
      creatorId: user.id,
      maxAttendees: max,
      imageUri: imageUri ?? undefined,
      minAge,
      maxAge,
      allowedUniversities: selectedUniversities.includes('Any') ? undefined : selectedUniversities,
      genderFilter,
    });
    if (isLeft(result)) Alert.alert('Error', result.left.message);
    else { upsertEvent(result.right); router.replace('/(app)'); }
    setLoading(false);
  };

  const bg = colors.background;
  const surf = colors.surface;
  const bord = colors.border;

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          {step === 2 && (
            <Pressable onPress={() => setStep(1)} style={[styles.backBtn, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>← Back</Text>
            </Pressable>
          )}
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {step === 1 ? 'New event' : 'Who can join?'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {step === 1 ? 'Step 1 of 2 — The basics' : 'Step 2 of 2 — Set your filters'}
          </Text>
          <View style={[styles.stepBar, { backgroundColor: colors.surfaceVariant }]}>
            <View style={[styles.stepFill, { backgroundColor: colors.primary, width: step === 1 ? '50%' : '100%' }]} />
          </View>
        </View>

        {step === 1 ? (
          <View style={styles.form}>
            {/* Photo */}
            <Pressable onPress={pickImage} style={[styles.photoBtn, { backgroundColor: surf, borderColor: bord, borderStyle: imageUri ? 'solid' : 'dashed' }]}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoIcon}>📷</Text>
                  <Text style={[styles.photoLabel, { color: colors.textHint }]}>Add a cover photo</Text>
                  <Text style={[styles.photoSub, { color: colors.textHint }]}>optional</Text>
                </View>
              )}
            </Pressable>

            <Input label="Title" value={title} onChangeText={setTitle} placeholder="5x5 football, study session, coffee..." autoCapitalize="sentences" returnKeyType="next" />
            <Input label="Description (optional)" value={description} onChangeText={setDescription} placeholder="Details, what to bring, dress code..." multiline numberOfLines={3} style={styles.textarea} textAlignVertical="top" />

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {Object.values(EventCategory).map((cat, i, arr) => (
                  <View key={cat} style={{ marginRight: i < arr.length - 1 ? 8 : 0 }}>
                    <CategoryChip category={cat} selected={category === cat} onPress={() => setCategory(cat)} />
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Date & Time</Text>
              <View style={styles.dateRow}>
                <Pressable style={[styles.dateBtn, { backgroundColor: colors.surfaceVariant }]} onPress={() => setPickerMode('date')}>
                  <Text style={[styles.dateBtnText, { color: colors.textPrimary }]}>📅 {format(dateTime, 'EEE, d MMM yyyy')}</Text>
                </Pressable>
                <Pressable style={[styles.dateBtn, styles.timeBtnWidth, { backgroundColor: colors.surfaceVariant }]} onPress={() => setPickerMode('time')}>
                  <Text style={[styles.dateBtnText, { color: colors.textPrimary }]}>🕐 {format(dateTime, 'HH:mm')}</Text>
                </Pressable>
              </View>
            </View>

            {pickerMode !== null && (
              <DateTimePicker value={dateTime} mode={pickerMode} is24Hour minimumDate={pickerMode === 'date' ? new Date() : undefined} onChange={handlePickerChange} />
            )}

            <Input label="Location" value={location} onChangeText={setLocation} placeholder="AUEB library, Exarcheia square..." autoCapitalize="words" returnKeyType="next" />
            <Input label="Max attendees" value={maxAttendees} onChangeText={(v) => setMaxAttendees(v.replace(/[^0-9]/g, ''))} keyboardType="number-pad" returnKeyType="done" hint="Between 2 and 100" />

            <Button label="Next →" onPress={goToStep2} disabled={!title.trim() || !location.trim()} fullWidth />
          </View>
        ) : (
          <View style={styles.form}>
            {/* Gender */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Gender</Text>
              <View style={styles.optionRow}>
                {GENDER_OPTIONS.map((g) => (
                  <Pressable key={g.value} onPress={() => setGenderFilter(g.value)}
                    style={[styles.optionChip, { borderColor: genderFilter === g.value ? colors.primary : bord, backgroundColor: genderFilter === g.value ? colors.primary : surf }]}>
                    <Text style={[styles.optionLabel, { color: genderFilter === g.value ? '#fff' : colors.textSecondary }]}>{g.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Age range */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Age range</Text>
              <View style={styles.ageRow}>
                <View style={styles.ageGroup}>
                  <Text style={[styles.ageGroupLabel, { color: colors.textHint }]}>From</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ageScroll}>
                    {AGE_OPTIONS.filter((a) => a < maxAge).map((a, i, arr) => (
                      <Pressable key={a} onPress={() => setMinAge(a)}
                        style={[styles.ageChip, { borderColor: minAge === a ? colors.primary : bord, backgroundColor: minAge === a ? colors.primary : surf, marginRight: i < arr.length - 1 ? 8 : 0 }]}>
                        <Text style={[styles.ageLabel, { color: minAge === a ? '#fff' : colors.textSecondary }]}>{a}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.ageGroup}>
                  <Text style={[styles.ageGroupLabel, { color: colors.textHint }]}>To</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ageScroll}>
                    {AGE_OPTIONS.filter((a) => a > minAge).map((a, i, arr) => (
                      <Pressable key={a} onPress={() => setMaxAge(a)}
                        style={[styles.ageChip, { borderColor: maxAge === a ? colors.primary : bord, backgroundColor: maxAge === a ? colors.primary : surf, marginRight: i < arr.length - 1 ? 8 : 0 }]}>
                        <Text style={[styles.ageLabel, { color: maxAge === a ? '#fff' : colors.textSecondary }]}>{a}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>

            {/* University */}
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>University</Text>
              <View style={styles.uniGrid}>
                {UNIVERSITIES.map((u) => {
                  const sel = selectedUniversities.includes(u);
                  return (
                    <Pressable key={u} onPress={() => toggleUniversity(u)}
                      style={[styles.uniChip, { borderColor: sel ? colors.primary : bord, backgroundColor: sel ? colors.primary : surf, marginRight: 8, marginBottom: 8 }]}>
                      <Text style={[styles.uniLabel, { color: sel ? '#fff' : colors.textSecondary }]}>{u}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Button label="Create event" onPress={handleCreate} loading={loading} fullWidth />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: 40, gap: Spacing.lg },
  header: { gap: Spacing.sm },
  backBtn: { alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.full },
  backBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  title: { fontSize: 26, fontWeight: FontWeight.extrabold, letterSpacing: -0.5 },
  subtitle: { fontSize: FontSize.sm },
  stepBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  stepFill: { height: 4, borderRadius: 2 },
  form: { gap: Spacing.md },
  photoBtn: { borderWidth: 1.5, borderRadius: 16, overflow: 'hidden', height: 160 },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoIcon: { fontSize: 32 },
  photoLabel: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  photoSub: { fontSize: FontSize.xs },
  textarea: { minHeight: 88, paddingTop: Spacing.sm },
  field: { gap: Spacing.sm },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  chips: { flexDirection: 'row', paddingVertical: 4, alignItems: 'center' },
  dateRow: { flexDirection: 'row', gap: Spacing.sm },
  dateBtn: { flex: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 14, justifyContent: 'center' },
  timeBtnWidth: { flex: 0, minWidth: 110 },
  dateBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  optionRow: { flexDirection: 'row', gap: Spacing.sm },
  optionChip: { flex: 1, paddingVertical: 12, borderRadius: BorderRadius.md, borderWidth: 1.5, alignItems: 'center' },
  optionLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  ageRow: { gap: Spacing.sm },
  ageGroup: { gap: 6 },
  ageGroupLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  ageScroll: { flexDirection: 'row', alignItems: 'center' },
  ageChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  ageLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  uniGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  uniChip: { paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1.5 },
  uniLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
