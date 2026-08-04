import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useTranslation } from '@/core/i18n';

export default function ConnectionsScreen() {
  const { uid, type } = useLocalSearchParams<{ uid: string; type: 'followers' | 'following' | 'connections' }>();
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
      const data = snap.exists() ? snap.data() : {};
      // "Connections" (mockup profile stat) means a *mutual* follow — someone
      // this account follows who also follows back — not a plain
      // followers/following list.
      const ids: string[] = type === 'connections'
        ? (data.following ?? []).filter((id: string) => (data.followers ?? []).includes(id))
        : (data[type] ?? []);
      const loaded = await fetchUserProfiles(ids);
      if (!cancelled) {
        setProfiles(ids.map((id) => loaded[id]).filter(Boolean));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, type]);

  const title = type === 'followers' ? t.userFollowersTitle : type === 'following' ? t.userFollowingTitle : t.userConnectionsTitle;

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title={title} />

      {profiles.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="users" size={38} color={colors.textDecor} />
          <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.userConnectionsEmpty}</Text>
        </View>
      ) : (
        <View>
          {profiles.map((profile, i) => (
            <AnimatedPressable
              key={profile.uid}
              onPress={() => router.push(`/(app)/user/${profile.uid}`)}
              style={[styles.row, { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : 1 }]}
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
  content: { paddingHorizontal: Spacing.gutter },
  empty: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center', gap: Spacing.sm,
  },
  emptyText: { fontSize: FontSize.sm, fontFamily: UIFontLight, textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: 12,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 42, height: 42, borderRadius: 21 },
  avatarText: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  rowBody: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  uni: { fontSize: FontSize.xs, fontFamily: UIFontLight },
});
