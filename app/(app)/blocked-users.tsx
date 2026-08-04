import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Icon } from '@/components/ui/Icon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useTranslation } from '@/core/i18n';

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);
  const unblockUser = useAuthStore((s) => s.unblockUser);

  const blockedIds = user?.blockedUserIds ?? [];
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const loaded = await fetchUserProfiles(blockedIds);
      if (!cancelled) {
        setProfiles(blockedIds.map((id) => loaded[id]).filter(Boolean));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [blockedIds.join(',')]);

  const handleUnblock = async (uid: string) => {
    setUnblockingId(uid);
    try {
      await unblockUser(uid);
      setProfiles((prev) => prev.filter((p) => p.uid !== uid));
    } finally {
      setUnblockingId(null);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title={t.blockedUsersTitle} />

      {profiles.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="lock" size={38} color={colors.textDecor} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.blockedUsersEmpty}</Text>
          <Text style={[styles.emptyText, { color: colors.textHint }]}>{t.blockedUsersEmptyBody}</Text>
        </View>
      ) : (
        <View>
          {profiles.map((profile, i) => (
            <View
              key={profile.uid}
              style={[styles.row, { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : 1 }]}
            >
              <AnimatedPressable
                onPress={() => router.push(`/(app)/user/${profile.uid}`)}
                style={styles.rowLeft}
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
              <Button
                label={t.userUnblockBtn}
                onPress={() => handleUnblock(profile.uid)}
                loading={unblockingId === profile.uid}
                variant="outline"
                shape="pill"
                size="sm"
              />
            </View>
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
  emptyTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: TitleFont },
  emptyText: { fontSize: FontSize.sm, fontFamily: UIFontLight, textAlign: 'center', lineHeight: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md,
    paddingVertical: 12,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 42, height: 42, borderRadius: 21 },
  avatarText: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont },
  rowBody: { flex: 1, gap: 2 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  uni: { fontSize: FontSize.xs, fontFamily: UIFontLight },
});
