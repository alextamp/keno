import React, { useState } from 'react';
import { Alert, Image, Linking, Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { haptics } from '@/core/utils/haptics';
import { analytics } from '@/core/utils/analytics';
import { isLeft } from '@/core/utils/either';
import { UserEntity } from '@/features/auth/domain/entities/user.entity';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { KfgMission } from '@/features/kfg/domain/entities/kfg.entity';
import { addMissionPhoto } from './KfgPhotoWall';

/**
 * The event page's Live Mode, for a mission that's running: the creator's
 * "where to find us" note, tell-a-friend, a photo-wall shortcut, the
 * discreet 🆘 (emergency contact SMS / 112) and, for the creator, end now.
 */
export function KfgLiveMode({ mission, user, isCreator }: { mission: KfgMission; user: UserEntity; isCreator: boolean }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const place = [mission.address, mission.areaLabel].filter(Boolean).join(', ');

  const tellFriend = async () => {
    haptics.light();
    try {
      const result = await Share.share({
        message: `📍 ${t.eventLiveTellFriendMessage(mission.title, place, format(new Date(), 'HH:mm'))}\nkeno://kfg/mission/${mission.id}`,
      });
      if (result.action !== 'dismissedAction') analytics.track('kfg_mission_shared', { missionId: mission.id, method: 'live_tell_friend' });
    } catch {}
  };

  const photo = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      if (await addMissionPhoto(mission.id, user)) haptics.success();
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
    setUploading(false);
  };

  // Same deliberately low-key safety alert as events: a message to the
  // emergency contact (pre-filled, one tap to send) or a 112 call.
  const safety = () => {
    haptics.light();
    const phone = user.emergencyContactPhone;
    if (!phone) {
      Alert.alert(t.eventLiveSafetyNoContactTitle, t.eventLiveSafetyNoContactBody, [
        { text: t.eventLiveSafetySetupBtn, onPress: () => router.push('/(app)/settings') },
        { text: t.settingsBtnCancel, style: 'cancel' },
      ]);
      return;
    }
    Alert.alert(t.eventLiveSafetyTitle, undefined, [
      {
        text: t.eventLiveSafetyMessageBtn(user.emergencyContactName || phone),
        onPress: () => {
          const message = t.eventLiveTellFriendMessage(mission.title, place, format(new Date(), 'HH:mm'));
          Linking.openURL(`sms:${phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(message)}`).catch(() => {});
        },
      },
      { text: t.eventLiveSafetyCall112, onPress: () => { Linking.openURL('tel:112').catch(() => {}); } },
      { text: t.settingsBtnCancel, style: 'cancel' },
    ]);
  };

  const endNow = () => {
    Alert.alert(t.kfgEndNowConfirmTitle, t.kfgEndNowConfirmBody, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: t.kfgEndNowBtn,
        style: 'destructive',
        onPress: async () => {
          haptics.medium();
          const r = await kfgRepository.endMission(mission.id);
          if (isLeft(r)) Alert.alert(mission.title, t.kfgError(r.left.message));
          else haptics.success();
        },
      },
    ]);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        <Text style={[styles.title, { color: colors.accentInk }]}>{t.eventLiveModeTitle}</Text>
      </View>

      {!!mission.infoText && <Text style={[styles.info, { color: colors.accentInk }]}>{mission.infoText}</Text>}
      {!!mission.infoPhotoUri && <Image source={{ uri: mission.infoPhotoUri }} style={styles.infoPhoto} resizeMode="cover" />}

      <View style={styles.row}>
        <AnimatedPressable onPress={tellFriend} style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="share" size={15} color={colors.textPrimary} />
          <Text style={[styles.btnText, { color: colors.textPrimary }]}>{t.eventLiveTellFriendBtn}</Text>
        </AnimatedPressable>
        {mission.photoWall && (
          <AnimatedPressable onPress={photo} disabled={uploading} style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="camera" size={15} color={colors.textPrimary} />
            <Text style={[styles.btnText, { color: colors.textPrimary }]}>{uploading ? '…' : t.eventLiveAddPhotoBtn}</Text>
          </AnimatedPressable>
        )}
      </View>

      {isCreator && (
        <AnimatedPressable onPress={endNow} style={[styles.end, { borderColor: colors.primary }]}>
          <Text style={[styles.endText, { color: colors.primary }]}>{t.kfgEndNowBtn}</Text>
        </AnimatedPressable>
      )}

      <AnimatedPressable onPress={safety} style={styles.safety} hitSlop={6}>
        <Icon name="shield" size={11} color={colors.textHint} />
        <Text style={[styles.safetyText, { color: colors.textHint }]}>{t.eventLiveSafetyBtn}</Text>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  info: { fontFamily: UIFontLight, fontSize: FontSize.md, lineHeight: 19 },
  row: { flexDirection: 'row', gap: Spacing.sm },
  infoPhoto: { width: '100%', height: 150, borderRadius: BorderRadius.md },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: BorderRadius.md, paddingVertical: 10 },
  btnText: { fontFamily: UIFont, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  end: { borderWidth: 1, borderRadius: BorderRadius.md, paddingVertical: 10, alignItems: 'center' },
  endText: { fontFamily: UIFont, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  safety: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center' },
  safetyText: { fontFamily: UIFontLight, fontSize: 11 },
});
