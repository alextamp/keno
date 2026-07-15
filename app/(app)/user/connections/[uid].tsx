import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useTranslation } from '@/core/i18n';

export default function ConnectionsScreen() {
  const { uid, type } = useLocalSearchParams<{ uid: string; type: 'followers' | 'following' }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const snap = await getDoc(doc(db, 'users', uid));
      const ids: string[] = snap.exists() ? (snap.data()[type] ?? []) : [];
      const loaded = await fetchUserProfiles(ids);
      if (!cancelled) {
        setProfiles(ids.map((id) => loaded[id]).filter(Boolean));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, type]);

  const title = type === 'followers' ? t.userFollowersTitle : t.userFollowingTitle;

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title={title} />

      {profiles.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.userConnectionsEmpty}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {profiles.map((profile) => (
            <AnimatedPressable
              key={profile.uid}
              onPress={() => router.push(`/(app)/user/${profile.uid}`)}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}
            >
              {profile.photoUri ? (
                <Image source={{ uri: profile.photoUri }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: profile.avatarColor }]}>
                  <Text style={styles.avatarText}>{profile.name.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.rowBody}>
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{profile.name}</Text>
                {!!profile.university && (
                  <Text style={[styles.uni, { color: colors.textHint }]} numberOfLines={1}>{profile.university}</Text>
                )}
              </View>
            </AnimatedPressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  empty: {
    borderWidth: 2.5, borderRadius: BorderRadius.lg, padding: Spacing.xl,
    alignItems: 'center', gap: Spacing.sm, ...Shadow.sm,
  },
  emptyEmoji: { fontSize: 44 },
  emptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  list: { gap: Spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderWidth: 2.5, borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadow.sm,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: FontWeight.bold },
  rowBody: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.md, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  uni: { fontSize: FontSize.xs },
});
