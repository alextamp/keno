import React, { useEffect } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useNotificationsStore } from '@/features/notifications/notifications.store';
import { NotificationEntity, NotifType } from '@/features/notifications/notification.entity';
import { formatMessageTime } from '@/core/utils/time';
import { useTranslation, useLanguageStore } from '@/core/i18n';

const NOTIF_EMOJIS: Record<NotifType, string> = {
  follow: '👤',
  event_join: '🎉',
  event_message: '💬',
  event_invite: '✉️',
  waitlist_promoted: '🎊',
  event_cancelled: '❌',
  event_reminder: '⏰',
  group_invite: '👥',
};

function NotifAvatar({ name, color }: { name: string; color?: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <View style={[styles.avatar, { backgroundColor: color ?? '#C94D0A' }]}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const notifications = useNotificationsStore((s) => s.notifications);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const t = useTranslation();
  const { language } = useLanguageStore();

  useEffect(() => {
    if (user) markAllRead(user.id);
  }, [user?.id]);

  const handleTap = (notif: NotificationEntity) => {
    if (notif.type === 'group_invite' && notif.eventId) {
      router.push(`/(app)/group/${notif.eventId}`);
    } else if (notif.eventId) {
      router.push(`/(app)/event/${notif.eventId}`);
    } else if (notif.type === 'follow') {
      router.push(`/(app)/user/${notif.fromUid}`);
    }
  };

  const bs = colors.borderStrong;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title={t.notifTitle} />

      {notifications.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: bs }]}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.notifEmptyTitle}</Text>
          <Text style={[styles.emptyBody, { color: colors.textHint }]}>{t.notifEmptyBody}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {notifications.map((notif) => {
            const emoji = NOTIF_EMOJIS[notif.type];
            const label = notif.type === 'follow'
              ? t.notifFollow(notif.fromName)
              : notif.type === 'event_join'
              ? t.notifEventJoin(notif.fromName, notif.eventTitle ?? '')
              : notif.type === 'event_message'
              ? t.notifEventMessage(notif.fromName, notif.eventTitle ?? '')
              : notif.type === 'event_invite'
              ? t.notifEventInvite(notif.fromName, notif.eventTitle ?? '')
              : notif.type === 'waitlist_promoted'
              ? t.notifWaitlistPromoted(notif.eventTitle ?? '')
              : notif.type === 'event_cancelled'
              ? t.notifEventCancelled(notif.eventTitle ?? '')
              : notif.type === 'event_reminder'
              ? t.notifEventReminder(notif.eventTitle ?? '')
              : t.notifGroupInvite(notif.fromName, notif.eventTitle ?? '');
            return (
              <AnimatedPressable
                key={notif.id}
                onPress={() => handleTap(notif)}
                style={[
                  styles.row,
                  {
                    backgroundColor: notif.read ? colors.surface : colors.surfaceVariant,
                    borderColor: bs,
                  },
                ]}
              >
                <View style={styles.rowLeft}>
                  <NotifAvatar name={notif.fromName} color={notif.fromAvatarColor} />
                  {!notif.read && (
                    <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                  )}
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowEmoji}>{emoji}</Text>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: colors.textPrimary }]} numberOfLines={2}>
                      {label}
                    </Text>
                    <Text style={[styles.rowTime, { color: colors.textHint }]}>
                      {formatMessageTime(notif.createdAt, language)}
                    </Text>
                  </View>
                </View>
              </AnimatedPressable>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  empty: {
    borderWidth: 2.5,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  emptyBody: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  list: { gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2.5,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.sm,
  },
  rowLeft: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: FontWeight.bold },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  rowEmoji: { fontSize: 20, marginTop: 2 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, lineHeight: 19 },
  rowTime: { fontSize: FontSize.xs },
});
