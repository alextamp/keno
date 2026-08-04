import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora';
import { Inter_400Regular, Inter_700Bold } from '@expo-google-fonts/inter';
import { useTheme } from '@/core/theme';
import { useThemeStore } from '@/core/theme/theme.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useLanguageStore } from '@/core/i18n';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { syncEventReminders, ensureAndroidNotificationChannel } from '@/core/utils/eventReminders';
import { usePreferencesStore } from '@/core/store/preferences.store';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    // Full traces during early testing; worth dialing down once real
    // traffic arrives so it doesn't burn through the free-tier quota.
    tracesSampleRate: 1.0,
    environment: __DEV__ ? 'development' : 'production',
  });
}

function AuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const user = useAuthStore((s) => s.user);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const isEmailVerified = useAuthStore((s) => s.isEmailVerified);

  useEffect(() => {
    if (isInitializing) return;

    const inAuth = segments[0] === '(auth)';
    const onOnboarding = (segments as string[]).includes('onboarding');
    const onPendingVerification = (segments as string[]).includes('pending-verification');
    // These two screens require an active (if not yet verified) session —
    // if the user signs out from one of them, treating "inAuth" as reason
    // enough to do nothing leaves them stranded staring at the same screen,
    // since nothing else tells the router to move to sign-in.
    const onScreenRequiringSession = onPendingVerification || (segments as string[]).includes('verify-email');
    const pendingIdVerification = user?.idVerificationStatus === 'pending' || user?.idVerificationStatus === 'rejected';

    if (!user && !isEmailVerified && !inAuth) {
      router.replace('/(auth)/welcome' as any);
    } else if (!user && !isEmailVerified && inAuth) {
      if (onScreenRequiringSession) router.replace('/(auth)/sign-in');
      // else already on sign-in/sign-up/forgot-password — do nothing
    } else if (user && isEmailVerified && pendingIdVerification && !onPendingVerification) {
      router.replace('/(auth)/pending-verification' as any);
    } else if (user && isEmailVerified && !pendingIdVerification && inAuth) {
      if (!user.onboardingDone) {
        router.replace('/(app)/onboarding' as any);
      } else {
        router.replace('/(app)');
      }
    } else if (user && isEmailVerified && !pendingIdVerification && !user.onboardingDone && !onOnboarding) {
      router.replace('/(app)/onboarding' as any);
    }
  }, [user, isInitializing, isEmailVerified, segments[0]]);

  return null;
}

function RootLayout() {
  const { isDark } = useTheme();
  const [fontsLoaded] = useFonts({ Lora_600SemiBold, Lora_700Bold, Inter_400Regular, Inter_700Bold });
  const isInitializing = useAuthStore((s) => s.isInitializing);
  const initializeAuth = useAuthStore((s) => s.initializeAuth);
  const user = useAuthStore((s) => s.user);
  const events = useEventsStore((s) => s.events);
  const { loadLanguage } = useLanguageStore();
  const { loadTheme } = useThemeStore();
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = initializeAuth();
    loadLanguage();
    loadTheme();
    loadPreferences();
    ensureAndroidNotificationChannel().catch(() => {});
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || events.length === 0) return;
    // Note: this no longer prompts for OS notification permission — that ask
    // is reserved for the notification-permission screen (shown once, after
    // the user's first event join). syncEventReminders/scheduleEventReminder
    // silently no-op for users who haven't granted permission yet.
    syncEventReminders(user.joinedEvents, events).catch(() => {});
  }, [user?.id, events.length]);

  // Android's hardware back button falls through to exiting the app when
  // nothing intercepts it. This should only happen at the true root of the
  // stack (the tab bar) — everywhere else it should pop one screen, same as
  // the in-app back arrow. Registered last so it always runs after any open
  // <Modal>'s own Android back handling (RN's Modal wires that up
  // internally and, being mounted later, takes priority in the listener
  // chain — this only fires when nothing else already handled the press).
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;
      if (data.type === 'follow' && data.fromUid) {
        router.push(`/(app)/user/${data.fromUid}` as any);
      } else if (data.type === 'group_invite' && data.eventId) {
        router.push(`/(app)/group/${data.eventId}` as any);
      } else if (data.type === 'event_message' && data.eventId) {
        router.push(`/(app)/event-chat/${data.eventId}` as any);
      } else if (data.eventId) {
        router.push(`/(app)/event/${data.eventId}` as any);
      }
    });
    return () => sub.remove();
  }, []);

  if (isInitializing || !fontsLoaded) return <LoadingScreen />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthGate />
      <Stack screenOptions={{ headerShown: false }} />
    </GestureHandlerRootView>
  );
}

export default sentryDsn ? Sentry.wrap(RootLayout) : RootLayout;
