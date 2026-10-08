import React, { useEffect, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { logAdminAction } from '@/core/utils/adminAuditLog';
import { KENO_EVENTS_UID } from '@/core/constants/eventsAccount';
import { formatMessageTime } from '@/core/utils/time';

interface PendingEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  customCategory?: string;
  dateTime: Date;
  location: string;
  latitude?: number;
  longitude?: number;
  maxAttendees: number;
  imageUri?: string;
  source: string;
  needsReview: string[];
}

// Mirrors events.repository.impl.ts's own generator — kept as a small local
// copy rather than exported from there, since that file is the client
// repository layer and this is a one-off admin tool (same precedent as
// admin-verifications.tsx talking to Firestore directly).
function generateCheckInSecret(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 20; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export default function AdminEventsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const adminUid = useAuthStore((s) => s.user?.id);

  const [pending, setPending] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'eventsPending'), (snap) => {
      const list: PendingEvent[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title as string,
          description: data.description as string,
          category: data.category as string,
          customCategory: data.customCategory as string | undefined,
          dateTime: (data.dateTime as Timestamp).toDate(),
          location: data.location as string,
          latitude: data.latitude as number | undefined,
          longitude: data.longitude as number | undefined,
          maxAttendees: (data.maxAttendees as number) ?? 20,
          imageUri: data.imageUri as string | undefined,
          source: data.source as string,
          needsReview: (data.needsReview as string[]) ?? [],
        };
      }).sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
      setPending(list);
      setLoading(false);
    }, (err) => {
      // A permission-denied listener error used to look identical to a
      // genuinely empty list (both just left `pending` as []) — surfacing
      // it explicitly so "rules not deployed yet" is obvious instead of
      // looking like "nothing pending".
      setLoadError(err.message ?? String(err));
      setLoading(false);
    });
    return unsub;
  }, []);

  const approve = async (ev: PendingEvent) => {
    setBusyId(ev.id);
    try {
      const eventRef = doc(collection(db, 'events'));
      await setDoc(eventRef, {
        title: ev.title,
        description: ev.description,
        category: ev.category,
        ...(ev.customCategory ? { customCategory: ev.customCategory } : {}),
        dateTime: Timestamp.fromDate(ev.dateTime),
        location: ev.location,
        ...(ev.latitude != null ? { latitude: ev.latitude } : {}),
        ...(ev.longitude != null ? { longitude: ev.longitude } : {}),
        creatorId: KENO_EVENTS_UID,
        maxAttendees: ev.maxAttendees,
        attendeeIds: [KENO_EVENTS_UID],
        ...(ev.imageUri ? { imageUri: ev.imageUri } : {}),
        reactions: { hype: [], funny: [], interested: [] },
        waitlistIds: [],
        messages: [],
        source: ev.source,
        sourceType: 'auto',
        addedBy: 'events-agent',
        verifiedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'events', eventRef.id, 'private', 'checkin'), {
        secret: generateCheckInSecret(),
        createdAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, 'eventsPending', ev.id));
      if (adminUid) logAdminAction(adminUid, 'eventApproved', { targetEventId: eventRef.id, source: ev.source });
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (ev: PendingEvent) => {
    setBusyId(ev.id);
    try {
      await deleteDoc(doc(db, 'eventsPending', ev.id));
      if (adminUid) logAdminAction(adminUid, 'eventRejected', { source: ev.source });
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    } finally {
      setBusyId(null);
    }
  };

  const bs = colors.border;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title={t.adminEventsTitle} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : loadError ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.error }]}>
          <Icon name="alert" size={38} color={colors.error} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.adminEventsLoadErrorTitle}</Text>
          <Text style={[styles.emptyBody, { color: colors.textHint }]}>{loadError}</Text>
        </View>
      ) : pending.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: bs }]}>
          <Icon name="cal" size={38} color={colors.textDecor} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.adminEventsEmpty}</Text>
          <Text style={[styles.emptyBody, { color: colors.textHint }]}>{t.adminEventsEmptyBody}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {pending.map((ev) => {
            const isBusy = busyId === ev.id;
            return (
              <View key={ev.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: bs }]}>
                <Text style={[styles.name, { color: colors.textPrimary }]}>{ev.title}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>
                  {formatMessageTime(ev.dateTime, language)} · {ev.location}
                </Text>
                <Text style={[styles.meta, { color: colors.textHint }]} numberOfLines={3}>{ev.description}</Text>
                <AnimatedPressable onPress={() => Linking.openURL(ev.source).catch(() => {})}>
                  <Text style={[styles.sourceLink, { color: colors.primary }]} numberOfLines={1}>
                    {t.adminEventsSource}: {ev.source}
                  </Text>
                </AnimatedPressable>
                {ev.needsReview.length > 0 && (
                  <View style={[styles.reviewTag, { backgroundColor: colors.accentSoft, borderColor: colors.primary }]}>
                    <Icon name="alert" size={13} color={colors.accentInk} />
                    <Text style={[styles.reviewTagText, { color: colors.accentInk }]}>
                      {t.adminEventsNeedsReview}: {ev.needsReview.join(', ')}
                    </Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <AnimatedPressable
                    onPress={() => reject(ev)}
                    disabled={isBusy}
                    style={[styles.actionBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>{t.adminEventsReject}</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    onPress={() => approve(ev)}
                    disabled={isBusy}
                    style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={[styles.actionText, { color: '#fff' }]}>{t.adminEventsApprove}</Text>
                  </AnimatedPressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  empty: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, fontFamily: TitleFont },
  emptyBody: { fontSize: FontSize.sm, fontFamily: UIFontLight, textAlign: 'center', lineHeight: 20 },
  list: { gap: Spacing.md },
  card: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  meta: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  sourceLink: { fontSize: FontSize.xs, fontFamily: UIFont, textDecorationLine: 'underline', marginTop: 2 },
  reviewTag: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: 8, paddingVertical: 6, marginTop: 4, alignSelf: 'flex-start' },
  reviewTagText: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, fontFamily: UIFont },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  actionBtn: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.md, paddingVertical: 10, alignItems: 'center' },
  actionText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
});
