import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useNotificationsStore } from '@/features/notifications/notifications.store';
import { useDmUnreadStore } from '@/core/store/dmUnread.store';

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const subscribe = useNotificationsStore((s) => s.subscribe);
  const clear = useNotificationsStore((s) => s.clear);
  const subscribeDmUnread = useDmUnreadStore((s) => s.subscribe);
  const clearDmUnread = useDmUnreadStore((s) => s.clear);

  useEffect(() => {
    if (!user) { clear(); return; }
    const unsub = subscribe(user.id);
    return unsub;
  }, [user?.id]);

  useEffect(() => {
    if (!user) { clearDmUnread(); return; }
    const unsub = subscribeDmUnread(user.id);
    return unsub;
  }, [user?.id]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="notification-permission" options={{ presentation: 'modal' }} />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="search" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="blocked-users" />
      <Stack.Screen name="admin-reports" />
      <Stack.Screen name="admin-verifications" />
      <Stack.Screen name="admin-events" />
      <Stack.Screen name="event/[id]" />
      <Stack.Screen name="event/edit/[id]" />
      <Stack.Screen name="user/[uid]" />
      <Stack.Screen name="user/connections/[uid]" />
      <Stack.Screen name="groups" />
      <Stack.Screen name="group/[id]" />
      <Stack.Screen name="group/create" />
      <Stack.Screen name="group/edit/[id]" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="challenges" />
      <Stack.Screen name="wrapped" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="organiser-stats" />
      <Stack.Screen name="event/rides/[id]" />
      <Stack.Screen name="dm/[uid]" />
      <Stack.Screen name="event-chat/[id]" />
      <Stack.Screen name="swipes/[eventId]" />
      <Stack.Screen name="checkin/[eventId]" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="checkin/success/[eventId]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="profile/tickets" />
      <Stack.Screen name="profile/events/[type]" />
    </Stack>
  );
}
