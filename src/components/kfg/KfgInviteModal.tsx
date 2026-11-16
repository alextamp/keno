import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { haptics } from '@/core/utils/haptics';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { UserEntity } from '@/features/auth/domain/entities/user.entity';
import { notificationsRepository } from '@/features/notifications/notifications.repository';
import { KfgMission } from '@/features/kfg/domain/entities/kfg.entity';

/** "Invite friends" — the people you follow, one tap each sends a kfg_invite notification (like event invites). */
export function KfgInviteModal({ visible, onClose, mission, user }: {
  visible: boolean; onClose: () => void; mission: KfgMission; user: UserEntity;
}) {
  const { colors } = useTheme();
  const t = useTranslation();
  const [people, setPeople] = useState<UserProfile[]>([]);
  const [sent, setSent] = useState<string[]>([]);
  const following = (user.following ?? []).filter((uid) => !mission.participantIds.includes(uid) && uid !== mission.creatorId);
  const key = following.join(',');

  useEffect(() => {
    if (!visible || !key) return;
    fetchUserProfiles(key.split(',')).then((p) => setPeople(Object.values(p)));
  }, [visible, key]);

  const invite = async (p: UserProfile) => {
    haptics.light();
    setSent((s) => [...s, p.uid]);
    await notificationsRepository.create({
      toUid: p.uid, fromUid: user.id, fromName: user.name, fromAvatarColor: user.avatarColor, fromPhotoUri: user.photoUri,
      type: 'kfg_invite', eventId: mission.id, eventTitle: mission.title,
    }).catch(() => setSent((s) => s.filter((x) => x !== p.uid)));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t.kfgInviteBtn}</Text>
          <ScrollView style={styles.list} contentContainerStyle={{ gap: Spacing.sm }}>
            {people.map((p) => {
              const done = sent.includes(p.uid);
              return (
                <View key={p.uid} style={styles.row}>
                  {p.photoUri
                    ? <Image source={{ uri: p.photoUri }} style={styles.avatar} />
                    : (
                      <View style={[styles.avatar, { backgroundColor: p.avatarColor ?? colors.primary }]}>
                        <Text style={styles.initial}>{p.name.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                  <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{p.name}</Text>
                  <Button label={done ? t.kfgInvited : t.kfgInviteOne} size="sm" variant={done ? 'soft' : 'primary'} disabled={done} onPress={() => invite(p)} />
                </View>
              );
            })}
            {people.length === 0 && <Text style={[styles.empty, { color: colors.textHint }]}>{t.kfgInviteEmpty}</Text>}
          </ScrollView>
          <Button label={t.settingsBtnCancel} variant="ghost" onPress={onClose} fullWidth />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md, maxHeight: '75%' },
  title: { fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  list: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontFamily: UIFont, fontWeight: FontWeight.bold },
  name: { flex: 1, fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  empty: { fontFamily: UIFontLight, fontSize: FontSize.md, textAlign: 'center' },
});
