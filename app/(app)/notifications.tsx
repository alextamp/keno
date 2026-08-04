import React, { useEffect, useMemo } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { isToday, isYesterday } from 'date-fns';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useNotificationsStore } from '@/features/notifications/notifications.store';
import { NotificationEntity, NotifType } from '@/features/notifications/notification.entity';
import { formatMessageTime } from '@/core/utils/time';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { Icon, IconName } from '@/components/ui/Icon';

const NOTIF_ICONS: Record<NotifType, IconName> = {
  follow: 'user',
  event_join: 'users',
  event_message: 'chat',
  event_invite: 'mail',
  waitlist_promoted: 'zap',
  event_cancelled: 'x',
  event_reminder: 'clock',
  group_invite: 'users',
  event_join_request: 'lock',
  event_join_accepted: 'check',
  group_join_request: 'lock',
  group_join_accepted: 'check',
  group_message: 'chat',
  dm_message: 'chat',
  buddy_match: 'users',
  mutual_match: 'heart',
  level_up: 'trophy',
  friend_going: 'users',
  referral_reward: 'gift',
};

// Screen 26: notifications grouped into ΣΗΜΕΡΑ / ΧΘΕΣ / ΠΑΛΙΟΤΕΡΑ sections.
function groupByDay(notifications: NotificationEntity[]): { label: string; items: NotificationEntity[] }[] {
  const today: NotificationEntity[] = [];
  const yesterday: NotificationEntity[] = [];
  const earlier: NotificationEntity[] = [];
  for (const n of notifications) {
    if (isToday(n.createdAt)) today.push(n);
    else if (isYesterday(n.createdAt)) yesterday.push(n);
    else earlier.push(n);
  }
  return [
    { label: 'today', items: today },
    { label: 'yesterday', items: yesterday },
    { label: 'earlier', items: earlier },
  ].filter((s) => s.items.length > 0);
}

function NotifAvatar({ name, color, photoUri }: { name: string; color?: string; photoUri?: string }) {
  const initial = name.charAt(0).toUpperCase();
  if (photoUri) {
    return <Image source={{ uri: photoUri }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, { backgroundColor: color ?? '#B8482A' }]}>
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
    if ((notif.type === 'group_invite' || notif.type === 'group_join_request' || notif.type === 'group_join_accepted' || notif.type === 'group_message') && notif.eventId) {
      router.push(`/(app)/group/${notif.eventId}`);
    } else if (notif.type === 'event_message' && notif.eventId) {
      router.push(`/(app)/event-chat/${notif.eventId}` as any);
    } else if (notif.eventId) {
      router.push(`/(app)/event/${notif.eventId}`);
    } else if (notif.type === 'follow') {
      router.push(`/(app)/user/${notif.fromUid}`);
    }
  };

  const getLabel = (notif: NotificationEntity): string => {
    switch (notif.type) {
      case 'follow': return t.notifFollow(notif.fromName);
      case 'event_join': return t.notifEventJoin(notif.fromName, notif.eventTitle ?? '');
      case 'event_message': return t.notifEventMessage(notif.fromName, notif.eventTitle ?? '');
      case 'event_invite': return t.notifEventInvite(notif.fromName, notif.eventTitle ?? '');
      case 'waitlist_promoted': return t.notifWaitlistPromoted(notif.eventTitle ?? '');
      case 'event_cancelled': return t.notifEventCancelled(notif.eventTitle ?? '');
      case 'event_reminder': return t.notifEventReminder(notif.eventTitle ?? '');
      case 'event_join_request': return t.notifEventJoinRequest(notif.fromName, notif.eventTitle ?? '');
      case 'event_join_accepted': return t.notifEventJoinAccepted(notif.eventTitle ?? '');
      case 'group_join_request': return t.notifGroupJoinRequest(notif.fromName, notif.eventTitle ?? '');
      case 'group_join_accepted': return t.notifGroupJoinAccepted(notif.eventTitle ?? '');
      case 'group_message': return t.notifGroupMessage(notif.fromName, notif.eventTitle ?? '');
      case 'level_up': return t.notifLevelUp(notif.eventTitle ?? '');
      case 'friend_going': return t.notifFriendGoing(notif.fromName, notif.eventTitle ?? '');
      case 'referral_reward': return t.notifReferralReward(notif.fromName, notif.eventTitle ?? '');
      default: return t.notifGroupInvite(notif.fromName, notif.eventTitle ?? '');
    }
  };

  const sections = useMemo(() => groupByDay(notifications), [notifications]);
  const sectionLabels: Record<string, string> = {
    today: t.notifSectionToday,
    yesterday: t.notifSectionYesterday,
    earlier: t.notifSectionEarlier,
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title={t.notifTitle} />

      {notifications.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="bell" size={40} color={colors.textDecor} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.notifEmptyTitle}</Text>
          <Text style={[styles.emptyBody, { color: colors.textHint }]}>{t.notifEmptyBody}</Text>
        </View>
      ) : (
        <View>
          {sections.map((section) => (
            <View key={section.label}>
              <SectionLabel label={sectionLabels[section.label]} style={styles.sectionLabel} />
              {section.items.map((notif, i) => {
                const icon = NOTIF_ICONS[notif.type];
                const label = getLabel(notif);
                return (
                  <AnimatedPressable
                    key={notif.id}
                    onPress={() => handleTap(notif)}
                    style={[
                      styles.row,
                      { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : 1 },
                    ]}
                  >
                    <NotifAvatar name={notif.fromName} color={notif.fromAvatarColor} photoUri={notif.fromPhotoUri} />
                    <View style={styles.rowBody}>
                      <View style={styles.rowLabelRow}>
                        <Icon name={icon} size={13} color={colors.textSecondary} />
                        <Text style={[styles.rowLabel, { color: colors.textPrimary }]} numberOfLines={2}>
                          {label}
                        </Text>
                      </View>
                      <Text style={[styles.rowTime, { color: colors.textHint }]}>
                        {formatMessageTime(notif.createdAt, language)}
                      </Text>
                    </View>
                    {!notif.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                  </AnimatedPressable>
                );
              })}
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
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, fontFamily: TitleFont },
  emptyBody: { fontSize: FontSize.base, fontFamily: UIFontLight, textAlign: 'center', lineHeight: 20 },
  sectionLabel: { marginTop: Spacing.md, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: Spacing.md,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  unreadDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  rowBody: { flex: 1, gap: 3 },
  rowLabelRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  rowLabel: { flex: 1, fontSize: FontSize.sm, fontFamily: UIFontLight, lineHeight: 19 },
  rowTime: { fontSize: FontSize.xs, marginLeft: 20 },
});
