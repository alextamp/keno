import React, { useEffect, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { formatMessageTime } from '@/core/utils/time';
import { isLeft } from '@/core/utils/either';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';

interface ReportItem {
  id: string;
  reportedEventId?: string;
  reportedUid: string;
  reporterUid: string;
  reason: string;
  createdAt: Date;
  eventTitle?: string;
  eventGone?: boolean;
  reportedUserName?: string;
  reporterName?: string;
}

const REASON_KEYS: Record<string, 'eventReportSpam' | 'eventReportInappropriate' | 'eventReportMisinformation' | 'eventReportFake'> = {
  spam: 'eventReportSpam',
  inappropriate: 'eventReportInappropriate',
  misinformation: 'eventReportMisinformation',
  fake: 'eventReportFake',
};

async function fetchUserName(uid: string, cache: Map<string, string>): Promise<string> {
  if (cache.has(uid)) return cache.get(uid)!;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const name = snap.exists() ? (snap.data().name as string) ?? uid : uid;
    cache.set(uid, name);
    return name;
  } catch {
    return uid;
  }
}

export default function AdminReportsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const { language } = useLanguageStore();

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, async (snap) => {
      const nameCache = new Map<string, string>();
      const enriched = await Promise.all(
        snap.docs.map(async (d) => {
          const data = d.data() as any;
          const base: ReportItem = {
            id: d.id,
            reportedEventId: data.reportedEventId,
            reportedUid: data.reportedUid,
            reporterUid: data.reporterUid,
            reason: data.reason,
            createdAt: data.createdAt?.toDate?.() ?? new Date(),
          };
          const [reportedUserName, reporterName] = await Promise.all([
            fetchUserName(base.reportedUid, nameCache),
            fetchUserName(base.reporterUid, nameCache),
          ]);
          base.reportedUserName = reportedUserName;
          base.reporterName = reporterName;
          if (base.reportedEventId) {
            try {
              const eventSnap = await getDoc(doc(db, 'events', base.reportedEventId));
              if (eventSnap.exists()) {
                base.eventTitle = (eventSnap.data() as any).title;
              } else {
                base.eventGone = true;
              }
            } catch {
              base.eventGone = true;
            }
          }
          return base;
        }),
      );
      setReports(enriched);
      setLoading(false);
    });
    return unsub;
  }, []);

  const dismissReport = async (report: ReportItem) => {
    setBusyId(report.id);
    try {
      await deleteDoc(doc(db, 'reports', report.id));
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    } finally {
      setBusyId(null);
    }
  };

  const deleteReportedEvent = (report: ReportItem) => {
    if (!report.reportedEventId) return;
    Alert.alert(t.adminReportsConfirmDeleteTitle, t.adminReportsConfirmDeleteBody, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: t.adminReportsDeleteBtn,
        style: 'destructive',
        onPress: async () => {
          setBusyId(report.id);
          try {
            const result = await eventsRepository.deleteEvent(report.reportedEventId!, report.reportedUid);
            if (isLeft(result)) {
              Alert.alert(t.createAlertSaveError, result.left.message);
              return;
            }
            await deleteDoc(doc(db, 'reports', report.id));
          } catch {
            Alert.alert(t.createAlertSaveError, t.authErrGeneric);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const bs = colors.borderStrong;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title={t.adminReportsTitle} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : reports.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: bs }]}>
          <Text style={styles.emptyEmoji}>🛡️</Text>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.adminReportsEmpty}</Text>
          <Text style={[styles.emptyBody, { color: colors.textHint }]}>{t.adminReportsEmptyBody}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {reports.map((report) => {
            const reasonKey = REASON_KEYS[report.reason];
            const isBusy = busyId === report.id;
            return (
              <View key={report.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: bs }]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.reason, { color: colors.textPrimary }]}>
                    {reasonKey ? t[reasonKey] : report.reason}
                  </Text>
                  <Text style={[styles.time, { color: colors.textHint }]}>
                    {formatMessageTime(report.createdAt, language)}
                  </Text>
                </View>

                {report.reportedEventId && (
                  <AnimatedPressable
                    onPress={() => router.push(`/(app)/event/${report.reportedEventId}`)}
                    style={styles.metaRow}
                  >
                    <Text style={[styles.metaLabel, { color: colors.textHint }]}>{t.adminReportsEventLabel}</Text>
                    <Text style={[styles.metaValue, { color: colors.primary }]} numberOfLines={1}>
                      {report.eventGone ? t.adminReportsEventGone : report.eventTitle ?? report.reportedEventId}
                    </Text>
                  </AnimatedPressable>
                )}

                <AnimatedPressable
                  onPress={() => router.push(`/(app)/user/${report.reportedUid}`)}
                  style={styles.metaRow}
                >
                  <Text style={[styles.metaLabel, { color: colors.textHint }]}>{t.adminReportsUserLabel}</Text>
                  <Text style={[styles.metaValue, { color: colors.primary }]} numberOfLines={1}>
                    {report.reportedUserName}
                  </Text>
                </AnimatedPressable>

                <View style={styles.metaRow}>
                  <Text style={[styles.metaLabel, { color: colors.textHint }]}>{t.adminReportsReporterLabel}</Text>
                  <Text style={[styles.metaValue, { color: colors.textSecondary }]} numberOfLines={1}>
                    {report.reporterName}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <AnimatedPressable
                    onPress={() => dismissReport(report)}
                    disabled={isBusy}
                    style={[styles.actionBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>{t.adminReportsDismissBtn}</Text>
                  </AnimatedPressable>
                  {report.reportedEventId && !report.eventGone && (
                    <AnimatedPressable
                      onPress={() => deleteReportedEvent(report)}
                      disabled={isBusy}
                      style={[styles.actionBtn, { backgroundColor: '#EF4444', borderColor: '#EF4444' }]}
                    >
                      <Text style={[styles.actionText, { color: '#fff' }]}>{t.adminReportsDeleteBtn}</Text>
                    </AnimatedPressable>
                  )}
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
    borderWidth: 2.5,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadow.sm,
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  emptyBody: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  list: { gap: Spacing.md },
  card: { borderWidth: 2.5, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 8, ...Shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reason: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  time: { fontSize: FontSize.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium },
  metaValue: { fontSize: FontSize.sm, fontWeight: FontWeight.medium, flexShrink: 1 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  actionBtn: { flex: 1, borderWidth: 2, borderRadius: BorderRadius.full, paddingVertical: 10, alignItems: 'center' },
  actionText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
});
