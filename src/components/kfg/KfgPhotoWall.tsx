import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { addDoc, collection, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Icon } from '@/components/ui/Icon';
import { SavePhotoModal } from '@/components/ui/SavePhotoModal';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { pickImage } from '@/core/utils/imagePicker';
import { uploadEventImage } from '@/core/utils/uploadImage';
import { haptics } from '@/core/utils/haptics';
import { UserEntity } from '@/features/auth/domain/entities/user.entity';
import { KfgParticipationStatus } from '@/features/kfg/domain/entities/kfg.entity';

interface WallPhoto { id: string; uri: string; uploaderUid: string; uploaderName: string; uploaderAvatarColor: string }

/** Statuses that mean "was actually there" — mirrors the firestore.rules create check. */
const WAS_THERE: KfgParticipationStatus[] = ['checkedIn', 'verified', 'inReview', 'completed'];

/** Pick + upload one photo to a mission's wall (also used by Live Mode's shortcut). Returns false if nothing was posted. */
export async function addMissionPhoto(missionId: string, user: UserEntity): Promise<boolean> {
  const localUri = await pickImage({ aspect: [4, 3] });
  if (!localUri) return false;
  const uri = await uploadEventImage(localUri);
  await addDoc(collection(db, 'kfgMissions', missionId, 'photos'), {
    uri,
    uploaderUid: user.id,
    uploaderName: user.name,
    uploaderAvatarColor: user.avatarColor ?? '#999',
    createdAt: Timestamp.now(),
  });
  return true;
}

/**
 * The event photo wall, for a mission: kfgMissions/{id}/photos, posting only
 * for people who were actually there, 30-day retention (functions
 * sweepOldPhotos covers every `photos` subcollection), tap to save.
 */
export function KfgPhotoWall({ missionId, user, status }: {
  missionId: string; user: UserEntity; status?: KfgParticipationStatus;
}) {
  const { colors } = useTheme();
  const t = useTranslation();
  const router = useRouter();
  const [photos, setPhotos] = useState<WallPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saveUri, setSaveUri] = useState<string | null>(null);
  const canPost = !!status && WAS_THERE.includes(status);

  useEffect(() => {
    const q = query(collection(db, 'kfgMissions', missionId, 'photos'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => setPhotos(snap.docs.map((d) => ({
      id: d.id,
      uri: d.data().uri as string,
      uploaderUid: d.data().uploaderUid as string,
      uploaderName: d.data().uploaderName as string,
      uploaderAvatarColor: d.data().uploaderAvatarColor as string,
    }))), () => {});
  }, [missionId]);

  const add = async () => {
    if (!canPost || uploading) return;
    setUploading(true);
    try {
      if (await addMissionPhoto(missionId, user)) haptics.success();
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
    setUploading(false);
  };

  // People you've blocked don't show up on the wall (same as their chat messages).
  const shown = photos.filter((p) => !user.blockedUserIds?.includes(p.uploaderUid));
  if (shown.length === 0 && !canPost) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headRow}>
        <View style={styles.titleRow}>
          <Icon name="camera" size={16} color={colors.textSecondary} />
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t.eventPhotoWall}{shown.length > 0 ? ` (${shown.length})` : ''}
          </Text>
        </View>
        {canPost && (
          <AnimatedPressable
            onPress={add}
            disabled={uploading}
            accessibilityRole="button"
            style={[styles.addBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
          >
            <Text style={styles.addText}>{uploading ? '...' : t.kfgPhotoWallAdd}</Text>
          </AnimatedPressable>
        )}
      </View>

      {shown.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="image" size={26} color={colors.textDecor} />
          <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.eventPhotoWallEmpty}</Text>
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            {shown.map((p) => (
              <View key={p.id} style={[styles.item, { borderColor: colors.border }]}>
                <Pressable onPress={() => setSaveUri(p.uri)}>
                  <Image source={{ uri: p.uri }} style={styles.img} resizeMode="cover" />
                </Pressable>
                <Pressable
                  onPress={() => p.uploaderUid && router.push(`/(app)/user/${p.uploaderUid}` as any)}
                  style={[styles.footer, { backgroundColor: p.uploaderAvatarColor }]}
                >
                  <Text style={styles.name} numberOfLines={1}>{p.uploaderName.split(' ')[0]}</Text>
                </Pressable>
              </View>
            ))}
          </View>
          <Text style={[styles.retention, { color: colors.textHint }]}>{t.eventPhotoWallRetentionHint}</Text>
        </>
      )}

      <SavePhotoModal uri={saveUri} onClose={() => setSaveUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  addBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: BorderRadius.full, borderWidth: 1 },
  addText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, fontFamily: UIFont },
  empty: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', gap: 6 },
  emptyText: { fontFamily: UIFontLight, fontSize: FontSize.sm, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: { width: '31.5%', borderRadius: BorderRadius.md, overflow: 'hidden', borderWidth: 1 },
  img: { width: '100%', aspectRatio: 1 },
  footer: { paddingHorizontal: 6, paddingVertical: 3 },
  name: { color: '#fff', fontFamily: UIFont, fontSize: 11, fontWeight: FontWeight.bold },
  retention: { fontSize: 11, fontFamily: UIFontLight, textAlign: 'center', marginTop: 4 },
});
