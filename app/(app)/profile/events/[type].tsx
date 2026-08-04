import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { EventCard } from '@/components/ui/EventCard';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useTheme } from '@/core/theme';
import { FontSize, Spacing } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { EventEntity, isAttending, isEventPast } from '@/features/events/domain/entities/event.entity';
import { isLeft } from '@/core/utils/either';

type EventsListType = 'upcoming' | 'past' | 'saved';

// Split out of ProfileTab's inline tabs (mockup section) into a dedicated
// page per list — the full lists were taking up a lot of vertical space on
// the profile itself, so the profile now just links out to these.
export default function ProfileEventsScreen() {
  const { type } = useLocalSearchParams<{ type: EventsListType }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);
  const unsaveEvent = useAuthStore((s) => s.unsaveEvent);
  const events = useEventsStore((s) => s.events);
  const setEvents = useEventsStore((s) => s.setEvents);
  const [myEvents, setMyEvents] = useState<EventEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (events.length === 0) {
      eventsRepository.getFeedEvents().then((result) => {
        if (!isLeft(result)) setEvents(result.right);
      });
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    eventsRepository.getEventsByAttendee(user.id).then((result) => {
      if (!isLeft(result)) setMyEvents(result.right);
      setLoading(false);
    });
  }, [user?.id]);

  if (!user) return null;

  const upcomingEvents = myEvents.filter((e) => !isEventPast(e));
  const pastEvents = myEvents.filter((e) => isEventPast(e)).sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());
  const savedEvents = events.filter((e) => user.savedEventIds?.includes(e.id));

  // Faded when the user joined but never actually checked in — a Ticket
  // (Tickets & Photos section) means "you were actually there," this list
  // is just event history.
  const checkedInPast = pastEvents.filter((e) => user.attendanceHistory?.[e.id]?.checkedIn);

  const title = type === 'upcoming' ? t.profileEventsUpcomingTitle
    : type === 'past' ? t.profileEventsPastTitle
    : t.profileEventsSavedTitle;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: Spacing.gutter, paddingTop: insets.top + 12 }}>
        <ScreenHeader title={title} />
      </View>

      {loading ? <LoadingScreen /> : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
        >
          {type === 'upcoming' && (
            upcomingEvents.length === 0
              ? <Text style={[styles.empty, { color: colors.textHint }]}>{t.profileEmptyUpcoming}</Text>
              : upcomingEvents.map((e) => (
                <EventCard key={e.id} event={e} isJoined={isAttending(e, user.id)} onPress={() => router.push(`/(app)/event/${e.id}`)} />
              ))
          )}
          {type === 'past' && (
            pastEvents.length === 0
              ? <Text style={[styles.empty, { color: colors.textHint }]}>{t.profileEmptyPast}</Text>
              : pastEvents.map((e) => (
                <EventCard key={e.id} event={e} isJoined={isAttending(e, user.id)} onPress={() => router.push(`/(app)/event/${e.id}`)} faded={!checkedInPast.includes(e)} />
              ))
          )}
          {type === 'saved' && (
            savedEvents.length === 0
              ? <Text style={[styles.empty, { color: colors.textHint }]}>{t.profileEmptySaved}</Text>
              : savedEvents.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  isSaved
                  onSave={() => unsaveEvent(e.id).catch(() => {})}
                  onPress={() => router.push(`/(app)/event/${e.id}`)}
                />
              ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.md, gap: 14 },
  empty: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.xl },
});
