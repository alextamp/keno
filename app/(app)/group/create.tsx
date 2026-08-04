import React, { useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { UIFont, TitleFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useGroupsStore } from '@/features/groups/presentation/store/groups.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { GROUP_COVER_COLORS, GROUP_EMOJI_OPTIONS } from '@/features/groups/domain/entities/group.entity';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { uploadGroupCoverPhoto } from '@/core/utils/uploadImage';
import { pickImage } from '@/core/utils/imagePicker';
import { useTranslation } from '@/core/i18n';

export default function CreateGroupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const createGroup = useGroupsStore((s) => s.createGroup);
  const isLoading = useGroupsStore((s) => s.isLoading);
  const error = useGroupsStore((s) => s.error);
  const t = useTranslation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('🎓');
  const [coverColor, setCoverColor] = useState(GROUP_COVER_COLORS[0]);
  const [coverPhoto, setCoverPhoto] = useState<string | undefined>(undefined);
  const [universityName, setUniversityName] = useState(user?.universityName ?? '');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const canSubmit = name.trim().length >= 3 && description.trim().length >= 10 && !isLoading;

  const pickPhoto = async () => {
    const uri = await pickImage({ aspect: [16, 9] });
    if (uri) setCoverPhoto(uri);
  };

  const handleCreate = async () => {
    if (!user || !canSubmit) return;
    if (containsBlockedContent(name) || containsBlockedContent(description)) {
      Alert.alert(t.groupLabelName, t.validContentBlocked);
      return;
    }
    let finalCoverPhoto = coverPhoto;
    if (coverPhoto && !coverPhoto.startsWith('http')) {
      setIsUploadingPhoto(true);
      try {
        finalCoverPhoto = await uploadGroupCoverPhoto(coverPhoto);
      } catch {
        Alert.alert(t.profileAlertPhotoTitle, t.profileAlertPhotoBody);
        finalCoverPhoto = undefined;
      }
      setIsUploadingPhoto(false);
    }
    const group = await createGroup({
      name: name.trim(),
      description: description.trim(),
      emoji,
      coverColor,
      coverPhotoUri: finalCoverPhoto,
      creatorId: user.id,
      universityName: universityName.trim() || undefined,
      isPrivate,
    });
    if (group) router.replace(`/(app)/group/${group.id}` as any);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <AnimatedPressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>{t.editEventBack}</Text>
        </AnimatedPressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t.groupNewTitle}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {/* Preview banner */}
        <View style={[styles.preview, { backgroundColor: coverColor, borderColor: colors.border }]}>
          {coverPhoto && <Image source={{ uri: coverPhoto }} style={styles.previewPhoto} />}
          {coverPhoto && <View style={styles.previewOverlay} />}
          {!coverPhoto && <Text style={styles.previewEmoji}>{emoji}</Text>}
          <Text style={styles.previewName}>{name || t.groupPreviewName}</Text>
        </View>

        {/* Cover photo picker */}
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t.groupLabelPhoto}</Text>
        <View style={styles.photoRow}>
          <AnimatedPressable
            onPress={pickPhoto}
            style={[styles.photoBtn, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
          >
            <Text style={[styles.photoBtnText, { color: colors.textPrimary }]}>{t.groupAddPhoto}</Text>
          </AnimatedPressable>
          {coverPhoto && (
            <AnimatedPressable onPress={() => setCoverPhoto(undefined)} style={styles.photoRemoveBtn}>
              <Text style={[styles.photoRemoveText, { color: colors.textHint }]}>{t.groupRemovePhoto}</Text>
            </AnimatedPressable>
          )}
        </View>

        {/* Emoji picker */}
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t.groupLabelIcon}</Text>
        <View style={styles.emojiRow}>
          {GROUP_EMOJI_OPTIONS.map((e) => (
            <AnimatedPressable
              key={e}
              onPress={() => setEmoji(e)}
              style={[styles.emojiBtn, emoji === e && { backgroundColor: colors.surfaceVariant, borderColor: colors.primary }]}
            >
              <Text style={styles.emojiOpt}>{e}</Text>
            </AnimatedPressable>
          ))}
        </View>

        {/* Color picker */}
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t.groupLabelColour}</Text>
        <View style={styles.colorRow}>
          {GROUP_COVER_COLORS.map((c) => (
            <AnimatedPressable
              key={c}
              onPress={() => setCoverColor(c)}
              style={[styles.colorDot, { backgroundColor: c, borderWidth: coverColor === c ? 3 : 0, borderColor: '#fff' }]}
            />
          ))}
        </View>

        {/* Name */}
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t.groupLabelName}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.textPrimary }]}
          placeholder={t.groupNamePlaceholder}
          placeholderTextColor={colors.textHint}
          value={name}
          onChangeText={setName}
          maxLength={60}
        />

        {/* Description */}
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t.groupLabelDescription}</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.textPrimary }]}
          placeholder={t.groupDescriptionPlaceholder}
          placeholderTextColor={colors.textHint}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
          maxLength={300}
        />

        {/* University (optional) */}
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t.groupLabelUniversity}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.textPrimary }]}
          placeholder={t.groupUniversityPlaceholder}
          placeholderTextColor={colors.textHint}
          value={universityName}
          onChangeText={setUniversityName}
          maxLength={80}
        />

        {/* Private toggle */}
        <View style={[styles.toggleRow, { borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>{t.groupPrivateLabel}</Text>
            <Text style={[styles.toggleSub, { color: colors.textSecondary }]}>{t.groupPrivateSub}</Text>
          </View>
          <Switch
            value={isPrivate}
            onValueChange={setIsPrivate}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        {error && (
          <Text style={[styles.error, { color: colors.error }]}>{error}</Text>
        )}

        <AnimatedPressable
          onPress={handleCreate}
          disabled={!canSubmit || isUploadingPhoto}
          style={[
            styles.submitBtn,
            { backgroundColor: canSubmit ? colors.primary : colors.border, borderColor: colors.border },
          ]}
        >
          {isLoading || isUploadingPhoto ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>{t.groupCreateBtn}</Text>
          )}
        </AnimatedPressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
    borderBottomWidth: 2,
  },
  backBtn: { width: 60 },
  backText: { fontSize: FontSize.sm, fontFamily: UIFont },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: TitleFont },
  form: { padding: Spacing.lg, gap: Spacing.md },
  preview: {
    height: 90, borderRadius: BorderRadius.xl, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4,
    overflow: 'hidden',
  },
  previewPhoto: { ...StyleSheet.absoluteFillObject },
  previewOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },
  previewEmoji: { fontSize: 32 },
  previewName: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont, marginBottom: -4 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photoBtn: {
    paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1,
  },
  photoBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  photoRemoveBtn: { paddingVertical: 10 },
  photoRemoveText: { fontSize: FontSize.sm, fontFamily: UIFont },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  emojiOpt: { fontSize: 22 },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  input: {
    height: 46, borderRadius: BorderRadius.lg, borderWidth: 1.5,
    paddingHorizontal: Spacing.md, fontSize: FontSize.sm, fontFamily: UIFont,
  },
  textArea: { height: 90, paddingTop: 12, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, borderBottomWidth: 1,
  },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  toggleSub: { fontSize: FontSize.xs },
  error: { fontSize: FontSize.sm, textAlign: 'center' },
  submitBtn: {
    height: 52, borderRadius: BorderRadius.full, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  submitText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
});
