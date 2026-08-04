import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Icon } from '@/components/ui/Icon';
import { Ticket } from '@/components/ui/Ticket';
import { SavePhotoModal } from '@/components/ui/SavePhotoModal';
import { FontSize, FontWeight, Spacing, TitleFont, UIFont, BorderRadius } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';
import { useTranslation, getDateLocale, useLanguageStore } from '@/core/i18n';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { EventCategory, EventEntity } from '@/features/events/domain/entities/event.entity';
import { isLeft } from '@/core/utils/either';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { db } from '@/lib/firebase';

interface MyPhoto { id: string; eventId: string; uri: string; createdAt: Date; }

const CATEGORY_KEYS: Record<EventCategory, string> = {
  [EventCategory.Party]: 'catParty',
  [EventCategory.Sports]: 'catSports',
  [EventCategory.Study]: 'catStudy',
  [EventCategory.Chill]: 'catChill',
  [EventCategory.Coffee]: 'catCoffee',
  [EventCategory.Other]: 'catOther',
};

// Full ticket collection (mockup 22) — Ticket consumer 2 (plan section B).
// Numbering: ticketNumber counts DOWN from the user's lifetime checkInCount
// as events get older, since that's the one field that isn't gated on an
// RSVP stake having existed (see events.repository.impl's checkInWithToken).
export default function TicketsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const dateLocale = getDateLocale(language);
  const user = useAuthStore((s) => s.user);
  const [events, setEvents] = useState<EventEntity[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<MyPhoto[]>([]);
  const [savePhotoUri, setSavePhotoUri] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    eventsRepository.getEventsByAttendee(user.id).then((result) => {
      if (!isLeft(result)) setEvents(result.right);
      setLoading(false);
    });
  }, [user?.id]);

  // Every photo this account uploaded to any event's photo wall — queried
  // per-event (no collection-group index exists for events/*/photos) across
  // the same attended-events list the tickets above already loaded.
  useEffect(() => {
    if (!user || events.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(events.map(async (e) => {
        const snap = await getDocs(query(collection(db, 'events', e.id, 'photos'), where('uploaderUid', '==', user.id)));
        return snap.docs.map((d) => ({
          id: d.id,
          eventId: e.id,
          uri: d.data().uri as string,
          createdAt: (d.data().createdAt as Timestamp)?.toDate() ?? new Date(),
        }));
      }));
      if (cancelled) return;
      setPhotos(results.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()));
    })();
    return () => { cancelled = true; };
  }, [user?.id, events.length]);

  const checkedIn = events
    .filter((e) => user?.attendanceHistory?.[e.id]?.checkedIn)
    .sort((a, b) => b.dateTime.getTime() - a.dateTime.getTime());

  useEffect(() => {
    const uids = Array.from(new Set(checkedIn.flatMap((e) => e.attendeeIds.slice(0, 2))));
    const missing = uids.filter((uid) => !profiles[uid]);
    if (missing.length === 0) return;
    fetchUserProfiles(missing).then((fetched) => setProfiles((prev) => ({ ...prev, ...fetched })));
  }, [checkedIn.length]);

  if (!user) return null;

  const total = user.checkInCount ?? checkedIn.length;

  return (
    <View style={[styles.root, { backgroundColor: colors.surfaceVariant }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, borderColor: colors.border }]}>
        <AnimatedPressable onPress={() => router.back()} style={styles.iconBtn}>
          <Icon name="back" size={18} color={colors.textPrimary} />
        </AnimatedPressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t.profileTicketsPageTitle}</Text>
        <Text style={[styles.headerCount, { color: colors.textHint }]}>{total}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.subtitle, { color: colors.textHint }]}>{t.profileTicketsPageSub}</Text>

        {!loading && checkedIn.length === 0 && (
          <Text style={[styles.empty, { color: colors.textHint }]}>{t.profileEmptyPast}</Text>
        )}

        {checkedIn.map((e, i) => {
          const topLabel = user.firstSoloAttendanceEventId === e.id
            ? t.ticketFirstSoloLabel
            : i === checkedIn.length - 1
              ? t.ticketWelcomeLabel
              : e.category === EventCategory.Other && e.customCategory?.trim()
                ? e.customCategory.trim().toUpperCase()
                : ((t as any)[CATEGORY_KEYS[e.category]] as string).toUpperCase();
          const attendees = e.attendeeIds.slice(0, 2).map((uid) => profiles[uid]).filter((p): p is UserProfile => !!p)
            .map((p) => ({ uid: p.uid, name: p.name, avatarColor: p.avatarColor, photoUri: p.photoUri }));
          return (
            <AnimatedPressable key={e.id} onPress={() => router.push(`/(app)/event/${e.id}`)}>
              <Ticket
                onSurface
                topLabel={topLabel}
                title={e.title}
                number={Math.max(1, total - i)}
                footerLeft={format(e.dateTime, 'EEE d MMM · HH:mm', { locale: dateLocale })}
                attendees={attendees}
                attendeesTotal={e.attendeeIds.length}
                style={styles.ticket}
              />
            </AnimatedPressable>
          );
        })}

        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.profilePhotosSection}</Text>
        {photos.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textHint }]}>{t.profilePhotosEmpty}</Text>
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((p) => (
              <AnimatedPressable key={p.id} onPress={() => setSavePhotoUri(p.uri)} style={styles.photoItem}>
                <Image source={{ uri: p.uri }} style={styles.photoImg} resizeMode="cover" />
              </AnimatedPressable>
            ))}
          </View>
        )}
      </ScrollView>

      <SavePhotoModal uri={savePhotoUri} onClose={() => setSavePhotoUri(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.md, borderBottomWidth: 1,
  },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.xl, fontFamily: TitleFont, fontWeight: FontWeight.semibold, flex: 1, textAlign: 'center' },
  headerCount: { fontSize: FontSize.sm, width: 34, textAlign: 'right' },
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.md, gap: Spacing.md },
  subtitle: { fontSize: FontSize.base, marginBottom: 4 },
  empty: { fontSize: FontSize.sm, textAlign: 'center', paddingVertical: Spacing.xl },
  ticket: {},
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold, fontFamily: UIFont, marginTop: Spacing.md },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoItem: { width: '31.5%', aspectRatio: 1, borderRadius: BorderRadius.md, overflow: 'hidden' },
  photoImg: { width: '100%', height: '100%' },
});
