import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { requestNotificationPermissions, getExpoPushToken } from '@/core/utils/eventReminders';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Mockup A4 "Θα σου θυμίζουμε;" — shown once, the first time a user's joined
// event count goes from 0 to 1 (see app/(app)/event/[id].tsx). Not part of
// onboarding: the mockup caption is explicit that this is asked only after
// the first join, so the actual permission prompt fires from the user's
// real intent to attend something, not on first login.
export default function NotificationPermissionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);

  const dismiss = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)');
  };

  const handleEnable = async () => {
    const granted = await requestNotificationPermissions();
    if (granted && user) {
      // Register the push token right away instead of waiting for the next
      // app start — initializeAuth's push-token registration ran before the
      // user had granted permission, so it would have silently skipped it.
      getExpoPushToken().then((token) => {
        if (token) updateDoc(doc(db, 'users', user.id), { pushToken: token }).catch(() => {});
      }).catch(() => {});
    }
    dismiss();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 40, paddingBottom: insets.bottom + Spacing.gutter }]}>
      <View style={[styles.halo, { backgroundColor: colors.accentSoft }]}>
        <Icon name="bell" size={36} color={colors.primary} strokeWidth={2.2} />
      </View>

      <View style={styles.cen}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t.notifPermTitle}</Text>
        <Text style={[styles.body, { color: colors.textHint }]}>{t.notifPermBody}</Text>
      </View>

      <Card padded style={styles.card}>
        <View style={styles.item}>
          <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>{t.notifPermItemReminder}</Text>
          <Icon name="check" size={16} color={colors.primary} strokeWidth={2.4} />
        </View>
        <View style={[styles.hr, { backgroundColor: colors.border }]} />
        <View style={styles.item}>
          <Text style={[styles.itemLabel, { color: colors.textPrimary }]}>{t.notifPermItemGroupMsg}</Text>
          <Icon name="check" size={16} color={colors.primary} strokeWidth={2.4} />
        </View>
        <View style={[styles.hr, { backgroundColor: colors.border }]} />
        <View style={styles.item}>
          <Text style={[styles.itemLabel, { color: colors.textDecor }]}>{t.notifPermItemSuggestions}</Text>
          <Text style={[styles.itemInactive, { color: colors.textHint }]}>{t.notifPermItemInactive}</Text>
        </View>
      </Card>

      <View style={styles.footer}>
        <Button label={t.notifPermEnableBtn} onPress={handleEnable} fullWidth />
        <Button label={t.notifPermSkipBtn} variant="ghost" onPress={dismiss} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.gutter, justifyContent: 'center' },
  halo: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  cen: { alignItems: 'center', marginTop: 22 },
  title: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, fontFamily: TitleFont, textAlign: 'center', letterSpacing: -0.4 },
  body: { fontSize: FontSize.base, fontFamily: UIFontLight, textAlign: 'center', lineHeight: 21, marginTop: 10, paddingHorizontal: 6 },
  card: { alignSelf: 'stretch', marginTop: 20, gap: 10 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  itemLabel: { fontSize: FontSize.base, fontWeight: FontWeight.medium, fontFamily: UIFont },
  itemInactive: { fontSize: FontSize.xs, fontFamily: UIFontLight },
  hr: { height: 1 },
  footer: { alignSelf: 'stretch', marginTop: 20, gap: 8 },
});
