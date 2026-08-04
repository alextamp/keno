import React, { useState } from 'react';
import { Alert, Image, Modal, StyleSheet, View } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import { File, Paths } from 'expo-file-system';
import { AnimatedPressable } from './AnimatedPressable';
import { Button } from './Button';
import { useTheme } from '@/core/theme';
import { BorderRadius, Spacing } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { haptics } from '@/core/utils/haptics';

interface SavePhotoModalProps {
  /** The remote (Firebase Storage) photo URL to preview/save, or null to hide the modal. */
  uri: string | null;
  onClose: () => void;
}

// Tap-to-save popup for a remote photo — shared by the event photo wall and
// the profile's "My photos" grid so both save the same way. Downloads the
// image locally first since saveToLibraryAsync can't take a remote URL.
export function SavePhotoModal({ uri, onClose }: SavePhotoModalProps) {
  const { colors } = useTheme();
  const t = useTranslation();
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!uri) return;
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(true);
      if (status !== 'granted') {
        Alert.alert(t.createAlertSaveError, t.eventPhotoSavePermissionDenied);
        return;
      }
      const file = await File.downloadFileAsync(uri, Paths.cache);
      await MediaLibrary.saveToLibraryAsync(file.uri);
      haptics.success();
      onClose();
    } catch {
      Alert.alert(t.createAlertSaveError, t.eventPhotoSaveError);
    }
    setSaving(false);
  };

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <AnimatedPressable style={styles.backdrop} onPress={onClose}>
        <AnimatedPressable
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => {}}
        >
          {!!uri && <Image source={{ uri }} style={styles.preview} resizeMode="cover" />}
          <View style={styles.actions}>
            <Button label={t.settingsBtnCancel} onPress={onClose} disabled={saving} variant="outline" style={{ flex: 1 }} />
            <Button label={t.eventPhotoSaveBtn} onPress={handleSave} loading={saving} disabled={saving} variant="primary" style={{ flex: 1 }} />
          </View>
        </AnimatedPressable>
      </AnimatedPressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  card: { width: '100%', maxWidth: 380, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: 10 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: BorderRadius.md },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
});
