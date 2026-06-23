import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/core/theme';
import { FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { EventCategory, isAttending } from '@/features/events/domain/entities/event.entity';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { EventCard } from '@/components/ui/EventCard';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { isLeft } from '@/core/utils/either';

const ALL_CATEGORIES = Object.values(EventCategory);

const GREETINGS = ['Hey', 'Yo', 'Hi', 'What\'s up'];
const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

export default function FeedScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { events, isLoading, setEvents, setLoading, setError } = useEventsStore();
  const { user } = useAuthStore();
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | null>(null);

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    setLoading(true);
    const result = await eventsRepository.getFeedEvents();
    if (isLeft(result)) setError(result.left.message);
    else setEvents(result.right);
    setLoading(false);
  };

  const filtered = selectedCategory
    ? events.filter((e) => e.category === selectedCategory)
    : events;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textHint }]}>
            {greeting}, {user?.name.split(' ')[0]} 👋
          </Text>
          <Text style={[styles.headingTitle, { color: colors.textPrimary }]}>
            What's happening?
          </Text>
        </View>
        <View style={[styles.onlineDot, { backgroundColor: colors.success }]} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterRow}
      >
        <Pressable
          onPress={() => setSelectedCategory(null)}
          style={[
            styles.allChip,
            { backgroundColor: !selectedCategory ? colors.primary : colors.surfaceVariant, borderColor: !selectedCategory ? colors.primary : colors.border },
          ]}
        >
          <Text style={[styles.allChipLabel, { color: !selectedCategory ? '#fff' : colors.textSecondary }]}>
            All
          </Text>
        </Pressable>
        {ALL_CATEGORIES.map((cat) => (
          <CategoryChip
            key={cat}
            category={cat}
            selected={selectedCategory === cat}
            onPress={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
          />
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onRefresh={loadEvents}
        refreshing={isLoading}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nothing here yet</Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Be the first to post something for your campus!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <EventCard
            event={item}
            isJoined={user ? isAttending(item, user.id) : false}
            onPress={() => router.push(`/(app)/event/${item.id}`)}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  greeting: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, marginBottom: 2 },
  headingTitle: { fontSize: 26, fontWeight: FontWeight.extrabold, letterSpacing: -0.5 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  filterScroll: { flexGrow: 0 },
  filterRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  allChipLabel: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  empty: { alignItems: 'center', paddingTop: 64, gap: Spacing.sm },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  emptyBody: { fontSize: FontSize.md, textAlign: 'center', lineHeight: 22, paddingHorizontal: Spacing.xl },
});
