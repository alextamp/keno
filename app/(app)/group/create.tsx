import React, { useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useGroupsStore } from '@/features/groups/presentation/store/groups.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { GROUP_COVER_COLORS } from '@/features/groups/domain/entities/group.entity';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { useTranslation } from '@/core/i18n';

const EMOJI_OPTIONS = ['🎓', '⚽', '☕', '🎨', '🎸', '📚', '🎮', '🏃', '🎭', '🌿', '🤝', '🧪'];

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
  const [universityName, setUniversityName] = useState(user?.universityName ?? '');
  const [isPrivate, setIsPrivate] = useState(false);

  const canSubmit = name.trim().length >= 3 && description.trim().length >= 10 && !isLoading;

  const handleCreate = async () => {
    if (!user || !canSubmit) return;
    if (containsBlockedContent(name) || containsBlockedContent(description)) {
      Alert.alert(t.groupLabelName, t.validContentBlocked);
      return;
    }
    const group = await createGroup({
      name: name.trim(),
      description: description.trim(),
      emoji,
      coverColor,
      creatorId: user.id,
      universityName: universityName.trim() || undefined,
      isPrivate,
    });
    if (group) router.replace(`/(app)/group/${group.id}` as any);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.borderStrong }]}>
        <AnimatedPressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>{t.editEventBack}</Text>
        </AnimatedPressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t.groupNewTitle}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        {/* Preview banner */}
        <View style={[styles.preview, { backgroundColor: coverColor, borderColor: colors.borderStrong }]}>
          <Text style={styles.previewEmoji}>{emoji}</Text>
          <Text style={styles.previewName}>{name || t.groupPreviewName}</Text>
        </View>

        {/* Emoji picker */}
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t.groupLabelIcon}</Text>
        <View style={styles.emojiRow}>
          {EMOJI_OPTIONS.map((e) => (
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
          disabled={!canSubmit}
          style={[
            styles.submitBtn,
            { backgroundColor: canSubmit ? colors.primary : colors.border, borderColor: colors.borderStrong },
          ]}
        >
          {isLoading ? (
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
  backText: { fontSize: FontSize.sm, fontFamily: DrawFont },
  headerTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  form: { padding: Spacing.lg, gap: Spacing.md },
  preview: {
    height: 90, borderRadius: BorderRadius.xl, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 4,
  },
  previewEmoji: { fontSize: 32 },
  previewName: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  label: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont, marginBottom: -4 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  emojiOpt: { fontSize: 22 },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  input: {
    height: 46, borderRadius: BorderRadius.lg, borderWidth: 1.5,
    paddingHorizontal: Spacing.md, fontSize: FontSize.sm, fontFamily: DrawFont,
  },
  textArea: { height: 90, paddingTop: 12, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.sm, borderBottomWidth: 1,
  },
  toggleLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  toggleSub: { fontSize: FontSize.xs },
  error: { fontSize: FontSize.sm, textAlign: 'center' },
  submitBtn: {
    height: 52, borderRadius: BorderRadius.full, borderWidth: 2.5,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  submitText: { color: '#fff', fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
});
