import React, { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { haptics } from '@/core/utils/haptics';
import { useTabNavigation } from '@/core/tabNavigation';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { UserEntity } from '@/features/auth/domain/entities/user.entity';
import { useReviewsStore } from '@/features/reviews/presentation/store/reviews.store';
import { KfgMission } from '@/features/kfg/domain/entities/kfg.entity';

/**
 * "Who's coming" for a mission — the event page's attendee grid: mutual
 * connections, a ✓ for who was actually there (presentIds), Kudos between
 * people who were there (kfgMissions/{id}/kudos/{uid}), and a one-tap
 * "recommend" once it's over.
 */
export function KfgParticipants({ mission, user, over, onLongPress }: {
  mission: KfgMission; user: UserEntity; over: boolean;
  /** Creator only: long-press toggles co-host (like the event page). */
  onLongPress?: (uid: string, name: string) => void;
}) {
  const { colors } = useTheme();
  const t = useTranslation();
  const router = useRouter();
  const { goToTab } = useTabNavigation();
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [kudos, setKudos] = useState<Record<string, string[]>>({});
  const [recommended, setRecommended] = useState<string[]>([]);

  const ids = mission.participantIds.join(',');
  useEffect(() => {
    if (!ids) return;
    fetchUserProfiles(ids.split(',')).then(setProfiles);
  }, [ids]);

  useEffect(() => onSnapshot(collection(db, 'kfgMissions', mission.id, 'kudos'), (snap) => {
    setKudos(Object.fromEntries(snap.docs.map((d) => [d.id, (d.data().kudos as string[] | undefined) ?? []])));
  }, () => {}), [mission.id]);

  const shown = mission.participantIds.filter((uid) => !user.blockedUserIds?.includes(uid));
  if (shown.length === 0) return null;
  const iWasThere = mission.presentIds.includes(user.id);

  const toggleKudos = async (uid: string) => {
    const given = (kudos[uid] ?? []).includes(user.id);
    haptics.light();
    try {
      await setDoc(doc(db, 'kfgMissions', mission.id, 'kudos', uid), {
        kudos: given ? arrayRemove(user.id) : arrayUnion(user.id),
      }, { merge: true });
    } catch {}
  };

  const recommend = async (uid: string) => {
    if (recommended.includes(uid)) return;
    haptics.medium();
    setRecommended((r) => [...r, uid]);
    const ok = await useReviewsStore.getState().submitReview(user.id, uid, mission.id, 'recommend');
    if (ok) {
      haptics.success();
      Alert.alert(t.eventRecommendedAlertTitle, t.eventRecommendedAlertBody);
    } else {
      setRecommended((r) => r.filter((x) => x !== uid));
      Alert.alert(t.createAlertSaveError, t.eventReviewSubmitError);
    }
  };

  const open = (uid: string) => {
    if (uid === user.id) {
      router.navigate('/(app)' as any);
      setTimeout(() => goToTab(4), 50);
    } else router.push(`/(app)/user/${uid}` as any);
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t.eventWhosGoing}</Text>
      <View style={styles.grid}>
        {shown.map((uid) => {
          const p = profiles[uid];
          const isMe = uid === user.id;
          const wasThere = mission.presentIds.includes(uid);
          const mutual = !isMe && p?.following ? p.following.filter((f) => (user.following ?? []).includes(f)).length : 0;
          const given = (kudos[uid] ?? []).includes(user.id);
          return (
            <AnimatedPressable
              key={uid}
              onPress={() => open(uid)}
              onLongPress={onLongPress && !isMe ? () => onLongPress(uid, p?.name ?? '') : undefined}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View>
                {p?.photoUri
                  ? <Image source={{ uri: p.photoUri }} style={styles.avatar} />
                  : (
                    <View style={[styles.avatar, { backgroundColor: p?.avatarColor ?? colors.primary }]}>
                      <Text style={styles.initial}>{(p?.name ?? '?').charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                {wasThere && (
                  <View style={[styles.badge, { backgroundColor: colors.success, borderColor: colors.surface }]}>
                    <Icon name="check" size={9} color="#fff" />
                  </View>
                )}
              </View>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {isMe ? t.eventYou : p?.name ?? '…'}
              </Text>
              {mission.coHostIds.includes(uid) && (
                <Text style={[styles.mutual, { color: colors.accentInk }]} numberOfLines={1}>{t.kfgCoHost}</Text>
              )}
              {mutual > 0 && (
                <Text style={[styles.mutual, { color: colors.primary }]} numberOfLines={1}>{t.eventMutualConnections(mutual)}</Text>
              )}
              {!isMe && wasThere && iWasThere && (
                <Pressable onPress={() => toggleKudos(uid)} hitSlop={6} style={styles.kudos}>
                  <Icon name="heart" size={12} filled={given} color={given ? colors.primary : colors.textHint} />
                  {(kudos[uid] ?? []).length > 0 && (
                    <Text style={[styles.kudosCount, { color: colors.textHint }]}>{(kudos[uid] ?? []).length}</Text>
                  )}
                </Pressable>
              )}
              {over && !isMe && wasThere && iWasThere && !recommended.includes(uid) && (
                <Pressable onPress={() => recommend(uid)} style={[styles.recommend, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.recommendText, { color: colors.accentInk }]}>{t.eventRecommendBtn}</Text>
                </Pressable>
              )}
            </AnimatedPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  title: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { width: '31.5%', borderWidth: 1, borderRadius: BorderRadius.md, padding: 8, alignItems: 'center', gap: 3 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontFamily: UIFont, fontWeight: FontWeight.bold },
  badge: {
    position: 'absolute', right: -2, bottom: -2, width: 16, height: 16, borderRadius: 8, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontFamily: UIFont, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  mutual: { fontFamily: UIFontLight, fontSize: 11 },
  kudos: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  kudosCount: { fontSize: 11, fontFamily: UIFont },
  recommend: { marginTop: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  recommendText: { fontSize: 11, fontWeight: FontWeight.bold, fontFamily: UIFont },
});
