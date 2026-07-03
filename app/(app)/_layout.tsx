import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useNotificationsStore } from '@/features/notifications/notifications.store';

export default function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const subscribe = useNotificationsStore((s) => s.subscribe);
  const clear = useNotificationsStore((s) => s.clear);

  useEffect(() => {
    if (!user) { clear(); return; }
    const unsub = subscribe(user.id);
    return unsub;
  }, [user?.id]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" options={{ animation: 'none' }} />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="search" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="event/[id]" />
      <Stack.Screen name="event/edit/[id]" />
      <Stack.Screen name="user/[uid]" />
      <Stack.Screen name="group/[id]" />
      <Stack.Screen name="group/create" />
      <Stack.Screen name="leaderboard" />
    </Stack>
  );
}
