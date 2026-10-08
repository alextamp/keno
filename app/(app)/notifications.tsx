import React, { useEffect, useMemo, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Alert, Image, SectionList, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
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
function groupByDay(notifications: NotificationEntity[]): { label: string; data: NotificationEntity[] }[] {
  const today: NotificationEntity[] = [];
  const yesterday: NotificationEntity[] = [];
  const earlier: NotificationEntity[] = [];
  for (const n of notifications) {
    if (isToday(n.createdAt)) today.push(n);
    else if (isYesterday(n.createdAt)) yesterday.push(n);
    else earlier.push(n);
  }
  return [
    { label: 'today', data: today },
    { label: 'yesterday', data: yesterday },
    { label: 'earlier', data: earlier },
  ].filter((s) => s.data.length > 0);
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

// Instagram-style swipe: dragging the row left reveals a trash button
// underneath instead of deleting immediately on the swipe itself — tapping
// that button is the actual delete action.
function DeleteAction({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable onPress={onPress} style={[styles.deleteAction, { backgroundColor: colors.error }]}>
      <Icon name="trash" size={19} color="#fff" />
    </AnimatedPressable>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const notifications = useNotificationsStore((s) => s.notifications);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const deleteNotification = useNotificationsStore((s) => s.deleteNotification);
  const deleteNotifications = useNotificationsStore((s) => s.deleteNotifications);
  const t = useTranslation();
  const { language } = useLanguageStore();

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) markAllRead(user.id);
  }, [user?.id]);

  // Leaving the screen with an active selection shouldn't leave it armed
  // for next time.
  useEffect(() => () => { setSelectionMode(false); setSelectedIds(new Set()); }, []);

  const handleTap = (notif: NotificationEntity) => {
    if (selectionMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(notif.id)) next.delete(notif.id); else next.add(notif.id);
        return next;
      });
      return;
    }
    if ((notif.type === 'group_invite' || notif.type === 'group_join_request' || notif.type === 'group_join_accepted' || notif.type === 'group_message') && notif.eventId) {
      router.push(`/(app)/group/${notif.eventId}`);
    } else if (notif.type === 'event_message' && notif.eventId) {
      router.push(`/(app)/event-chat/${notif.eventId}` as any);
    } else if (notif.eventId) {
      router.push(`/(app)/event/${notif.eventId}`);
    } else if (notif.type === 'follow') {
      router.push(`/(app)/user/${notif.fromUid}`);
    }
    // dm_message is deliberately unreachable here — the store filters it
    // out of this list entirely (see notifications.store.ts).
  };

  const handleSwipeDelete = (id: string) => {
    if (!user) return;
    deleteNotification(user.id, id);
  };

  const handleLongPressDelete = (notif: NotificationEntity) => {
    if (!user || selectionMode) return;
    Alert.alert(t.notifDeleteConfirmTitle, t.notifDeleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      { text: t.notifDeleteBtn, style: 'destructive', onPress: () => deleteNotification(user.id, notif.id) },
    ]);
  };

  const allIds = useMemo(() => notifications.map((n) => n.id), [notifications]);
  const allSelected = selectedIds.size > 0 && selectedIds.size === allIds.length;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  };

  const handleDeleteSelected = () => {
    if (!user || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    Alert.alert(t.notifDeleteSelectedConfirmTitle(ids.length), t.notifDeleteConfirmBody, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.notifDeleteBtn,
        style: 'destructive',
        onPress: () => {
          deleteNotifications(user.id, ids);
          setSelectionMode(false);
          setSelectedIds(new Set());
        },
      },
    ]);
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

  const headerRight = notifications.length > 0 ? (
    <AnimatedPressable
      onPress={() => {
        setSelectionMode((v) => !v);
        setSelectedIds(new Set());
      }}
      hitSlop={10}
      style={styles.headerActionBtn}
    >
      <Text style={[styles.headerActionText, { color: colors.primary }]}>
        {selectionMode ? t.cancel : t.notifSelectBtn}
      </Text>
    </AnimatedPressable>
  ) : undefined;

  return (
    <SectionList
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      sections={sections}
      keyExtractor={(notif) => notif.id}
      ListHeaderComponent={
        <>
          <ScreenHeader title={t.notifTitle} right={headerRight} />
          {selectionMode && (
            <View style={styles.selectionBar}>
              <AnimatedPressable onPress={toggleSelectAll} style={styles.toggleLink}>
                <Text style={[styles.toggleLinkText, { color: colors.primary }]}>
                  {allSelected ? t.notifDeselectAllBtn : t.notifSelectAllBtn}
                </Text>
              </AnimatedPressable>
              <Text style={[styles.selectionCount, { color: colors.textHint }]}>{t.notifSelectedCount(selectedIds.size)}</Text>
              <AnimatedPressable
                onPress={handleDeleteSelected}
                disabled={selectedIds.size === 0}
                hitSlop={10}
                style={[styles.deleteSelectedBtn, { opacity: selectedIds.size === 0 ? 0.4 : 1 }]}
              >
                <Icon name="trash" size={22} color={colors.error} />
              </AnimatedPressable>
            </View>
          )}
        </>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Icon name="bell" size={40} color={colors.textDecor} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.notifEmptyTitle}</Text>
          <Text style={[styles.emptyBody, { color: colors.textHint }]}>{t.notifEmptyBody}</Text>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <SectionLabel label={sectionLabels[section.label]} style={styles.sectionLabel} />
      )}
      renderItem={({ item: notif, index: i }) => {
        const icon = NOTIF_ICONS[notif.type];
        const label = getLabel(notif);
        const selected = selectedIds.has(notif.id);
        const row = (
          <AnimatedPressable
            onPress={() => handleTap(notif)}
            onLongPress={() => handleLongPressDelete(notif)}
            style={[
              styles.row,
              { borderTopColor: colors.border, borderTopWidth: i === 0 ? 0 : 1 },
            ]}
          >
            {selectionMode && (
              <View style={[
                styles.checkCircle,
                { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' },
              ]}>
                {selected && <Icon name="check" size={12} color="#fff" />}
              </View>
            )}
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
        if (selectionMode) return row;
        return (
          <Swipeable
            renderRightActions={() => <DeleteAction onPress={() => handleSwipeDelete(notif.id)} />}
            overshootRight={false}
          >
            {row}
          </Swipeable>
        );
      }}
    />
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
  headerActionBtn: { minWidth: 32, minHeight: 32, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: 4 },
  headerActionText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  selectionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.sm, marginTop: Spacing.sm,
  },
  toggleLink: { paddingVertical: 4 },
  toggleLinkText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  selectionCount: { fontSize: FontSize.xs },
  deleteSelectedBtn: { padding: 6 },
  checkCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  deleteAction: {
    width: 64, alignItems: 'center', justifyContent: 'center',
  },
});
