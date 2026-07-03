import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { useFonts, Comfortaa_400Regular, Comfortaa_700Bold } from '@expo-google-fonts/comfortaa';
import { useTheme } from '@/core/theme';
import { useThemeStore } from '@/core/theme/theme.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useLanguageStore } from '@/core/i18n';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { syncEventReminders, requestNotificationPermissions } from '@/core/utils/eventReminders';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const isEmailVerified = useAuthStore((s) => s.isEmailVerified);

  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === '(auth)';
    const onOnboarding = (segments as string[]).includes('onboarding');

    if (!user && !isEmailVerified && !inAuth) {
      router.replace('/(auth)/sign-in');
    } else if (!user && !isEmailVerified && inAuth) {
      // already on auth screens — do nothing
    } else if (user && isEmailVerified && inAuth) {
      if (!user.onboardingDone) {
        router.replace('/(app)/onboarding' as any);
      } else {
        router.replace('/(app)');
      }
    } else if (user && isEmailVerified && !user.onboardingDone && !onOnboarding) {
      router.replace('/(app)/onboarding' as any);
    }
  }, [user, isLoading, isEmailVerified, segments[0]]);

  return null;
}

export default function RootLayout() {
  const { isDark } = useTheme();
  const [fontsLoaded] = useFonts({ Comfortaa_400Regular, Comfortaa_700Bold });
  const isLoading = useAuthStore((s) => s.isLoading);
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const user = useAuthStore((s) => s.user);
  const events = useEventsStore((s) => s.events);
  const { loadLanguage } = useLanguageStore();
  const { loadTheme } = useThemeStore();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = initializeAuth();
    loadLanguage();
    loadTheme();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || events.length === 0) return;
    requestNotificationPermissions();
    syncEventReminders(user.joinedEvents, events).catch(() => {});
  }, [user?.id, events.length]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;
      if (data.type === 'follow' && data.fromUid) {
        router.push(`/(app)/user/${data.fromUid}` as any);
      } else if (data.type === 'group_invite' && data.eventId) {
        router.push(`/(app)/group/${data.eventId}` as any);
      } else if (data.eventId) {
        router.push(`/(app)/event/${data.eventId}` as any);
      }
    });
    return () => sub.remove();
  }, []);

  if (isLoading || !fontsLoaded) return <LoadingScreen />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}
