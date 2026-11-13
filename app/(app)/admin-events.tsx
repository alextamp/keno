import React, { useEffect, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AccentScopeProvider, useTheme } from '@/core/theme';
import { UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { Icon } from '@/components/ui/Icon';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { logAdminAction } from '@/core/utils/adminAuditLog';
import { KENO_EVENTS_UID } from '@/core/constants/eventsAccount';
import { formatMessageTime } from '@/core/utils/time';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { FEATURES } from '@/core/constants/features';
import { isLeft } from '@/core/utils/either';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { KfgMission } from '@/features/kfg/domain/entities/kfg.entity';

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

      {FEATURES.kenoForGood && (
        <AccentScopeProvider value="kfg">
          <KfgPendingMissions />
        </AccentScopeProvider>
      )}
    </ScrollView>
  );
}

// Student-created Keno for Good missions waiting for approval. Approving goes
// through the kfgReviewMission callable, which re-checks admin rights server-side.
function KfgPendingMissions() {
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const adminUid = useAuthStore((s) => s.user?.id);
  const [missions, setMissions] = useState<KfgMission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Live, like the events list above — a mission submitted while this screen
  // is open shows up without leaving and coming back.
  useEffect(() => kfgRepository.subscribePendingMissions(
    (list) => { setError(null); setMissions(list); },
    (message) => { setError(message); setMissions([]); },
  ), []);

  const decide = async (m: KfgMission, approve: boolean) => {
    setBusyId(m.id);
    const r = await kfgRepository.reviewMission(m.id, approve);
    setBusyId(null);
    if (isLeft(r)) { Alert.alert(m.title, t.kfgError(r.left.message)); return; }
    if (adminUid) logAdminAction(adminUid, 'kfgMissionReview', { missionId: m.id, approve: String(approve) });
  };

  const bs = colors.border;
  return (
    <View style={styles.list}>
      <SectionLabel label={t.kfgAdminPendingMissions} />
      {missions === null ? (
        <ActivityIndicator color={colors.primary} />
      ) : error ? (
        <Text style={[styles.meta, { color: colors.error }]}>{error}</Text>
      ) : missions.length === 0 ? (
        <Text style={[styles.meta, { color: colors.textHint }]}>{t.kfgAdminEmpty}</Text>
      ) : missions.map((m) => {
        const isBusy = busyId === m.id;
        return (
          <View key={m.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: bs }]}>
            <View style={[styles.reviewTag, { backgroundColor: colors.accentSoft, borderColor: colors.primary, marginTop: 0 }]}>
              <Icon name="heart" size={13} color={colors.accentInk} />
              <Text style={[styles.reviewTagText, { color: colors.accentInk }]}>Keno for Good · {m.creatorName}</Text>
            </View>
            {!!m.imageUri && <Image source={{ uri: m.imageUri }} style={styles.cover} />}
            <Text style={[styles.name, { color: colors.textPrimary }]}>{m.title}</Text>
            <Text style={[styles.meta, { color: colors.textSecondary }]}>
              {formatMessageTime(m.startsAt, language)} · {m.areaLabel} · {m.capacity}
            </Text>
            {!!m.address && <Text style={[styles.meta, { color: colors.textHint }]}>{m.address}</Text>}
            <Text style={[styles.meta, { color: colors.textHint }]} numberOfLines={4}>{m.description}</Text>
            {!!m.infoText && <Text style={[styles.meta, { color: colors.textHint }]} numberOfLines={3}>{m.infoText}</Text>}
            <View style={styles.actions}>
              <AnimatedPressable
                onPress={() => decide(m, false)}
                disabled={isBusy}
                style={[styles.actionBtn, { borderColor: colors.border }]}
              >
                <Text style={[styles.actionText, { color: colors.textSecondary }]}>{t.adminEventsReject}</Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => decide(m, true)}
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
  cover: { width: '100%', height: 140, borderRadius: BorderRadius.md },
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
