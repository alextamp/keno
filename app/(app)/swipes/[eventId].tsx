import React, { useEffect, useMemo, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import {
  Alert, Image, ScrollView, StyleSheet, Text, View, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme';
import { BorderRadius, TitleFont, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { EventCard } from '@/components/ui/EventCard';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { swipesRepository } from '@/features/swipes/data/repositories/swipes.repository.impl';
import { UserProfile, fetchUserProfiles } from '@/core/utils/userProfiles';
import { isRight } from '@/core/utils/either';
import { haptics } from '@/core/utils/haptics';
import { useTranslation } from '@/core/i18n';
import { useEventsStore } from '@/features/events/presentation/store/events.store';

export default function SwipesScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const t = useTranslation();
  const allEvents = useEventsStore((s) => s.events);

  const [event, setEvent] = useState<any>(null);
  const [attendees, setAttendees] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [alreadySwiped, setAlreadySwiped] = useState<Set<string>>(new Set());

  const bs = colors.border;

  useEffect(() => {
    if (!eventId) return;
    loadEvent();
  }, [eventId]);

  const loadEvent = async () => {
    if (!eventId || !user) return;
    setLoading(true);
    try {
      const eventSnap = await getDoc(doc(db, 'events', eventId));
      if (!eventSnap.exists()) {
        Alert.alert(t.createAlertSaveError, t.swipesEventNotFound);
        router.back();
        return;
      }

      const ev = eventSnap.data();
      setEvent(ev);

      const result = await swipesRepository.getSwipesForEvent(eventId, user.id);
      const alreadySwipedSet: Set<string> = isRight(result) ? new Set(result.right.map((s) => s.toUid)) : new Set();
      setAlreadySwiped(alreadySwipedSet);

      const others = (ev.attendeeIds ?? []).filter((uid: string) => uid !== user.id);
      setAttendees(others);
      const loaded = await fetchUserProfiles(others);
      setProfiles(loaded);
    } catch (e) {
      Alert.alert(t.createAlertSaveError, t.swipesLoadError);
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (uid: string) => {
    if (!eventId || !user || alreadySwiped.has(uid) || pendingUid) return;
    setPendingUid(uid);
    haptics.light();

    try {
      const result = await swipesRepository.recordSwipe(eventId, user.id, uid, 'interested');
      if (isRight(result)) {
        setAlreadySwiped((prev) => new Set([...prev, uid]));
      } else {
        Alert.alert(t.createAlertSaveError, t.reconnectError);
      }
    } catch (e) {
      Alert.alert(t.createAlertSaveError, t.reconnectError);
    } finally {
      setPendingUid(null);
    }
  };

  const suggestedEvent = useMemo(() => {
    if (!event) return null;
    const now = new Date();
    return allEvents.find((e) =>
      e.id !== eventId
      && e.category === event.category
      && new Date(e.dateTime) > now,
    ) ?? null;
  }, [allEvents, event, eventId]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + Spacing.md }]}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md }}>
        <AnimatedPressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: bs }]}>
          <Icon name="x" size={16} color={colors.textPrimary} />
        </AnimatedPressable>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t.reconnectTitle}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t.reconnectSubtitle}</Text>

        {attendees.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{t.reconnectEmpty}</Text>
        ) : (
          <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
            {attendees.map((uid) => {
              const profile = profiles[uid];
              const isChecked = alreadySwiped.has(uid);
              const isPending = pendingUid === uid;
              return (
                <AnimatedPressable
                  key={uid}
                  onPress={() => handleToggle(uid)}
                  disabled={isChecked || !!pendingUid}
                  style={[
                    styles.row,
                    isChecked
                      ? { borderColor: colors.primary, backgroundColor: colors.accentSoft }
                      : { borderColor: colors.border, backgroundColor: colors.surfaceVariant },
                  ]}
                >
                  {isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : isChecked ? (
                    <Icon name="check" size={18} color={colors.primary} />
                  ) : (
                    <View style={[styles.checkCircle, { borderColor: colors.textDecor }]} />
                  )}
                  {profile?.photoUri ? (
                    <Image source={{ uri: profile.photoUri }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: profile?.avatarColor ?? '#999' }]}>
                      <Text style={styles.avatarLetter}>{profile?.name?.charAt(0).toUpperCase() ?? '?'}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.textPrimary }]}>{profile?.name ?? 'User'}</Text>
                    {!!profile?.university && (
                      <Text style={[styles.uni, { color: colors.textHint }]}>{profile.university}</Text>
                    )}
                  </View>
                </AnimatedPressable>
              );
            })}
          </View>
        )}

        {suggestedEvent && (
          <View style={{ marginTop: Spacing.md }}>
            <Text style={[styles.suggestedLabel, { color: colors.textHint }]}>{t.reconnectSuggestedLabel}</Text>
            <EventCard
              event={suggestedEvent}
              onPress={() => router.push(`/event/${suggestedEvent.id}` as any)}
            />
          </View>
        )}
      </ScrollView>

      {/* Sticky actions */}
      <View style={{ paddingHorizontal: Spacing.lg, paddingBottom: insets.bottom + Spacing.lg, gap: Spacing.sm }}>
        <Button
          label={t.reconnectSendBtn}
          onPress={() => {
            haptics.light();
            Alert.alert('', t.reconnectAllDone);
            router.back();
          }}
          variant="primary"
          fullWidth
        />
        <Button
          label={t.reconnectSkipBtn}
          onPress={() => router.back()}
          variant="outline"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, fontFamily: TitleFont },
  subtitle: { fontSize: FontSize.sm, marginTop: 2, lineHeight: 20 },
  emptyText: { fontSize: FontSize.base, marginTop: Spacing.lg, textAlign: 'center' },
  row: {
    padding: 12, borderRadius: BorderRadius.md, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  checkCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#fff' },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  uni: { fontSize: FontSize.xs, marginTop: 2 },
  suggestedLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5, marginBottom: Spacing.xs },
});
