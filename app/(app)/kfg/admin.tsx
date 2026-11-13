import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Skeleton } from '@/components/ui/Skeleton';
import { AccentScopeProvider, useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { isLeft } from '@/core/utils/either';
import { logAdminAction } from '@/core/utils/adminAuditLog';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { KfgParticipation } from '@/features/kfg/domain/entities/kfg.entity';

// Admin-only: decide queued photo pairs. Student missions are approved in
// admin-events.tsx, next to the regular pending events.
// The callables re-check admin rights server-side; this screen is only
// reachable from the admin section of Settings.

type QueueItem = { participation: KfgParticipation; before?: string; after?: string };

export default function KfgAdminScreen() {
  return (
    <AccentScopeProvider value="kfg">
      <AdminInner />
    </AccentScopeProvider>
  );
}

function AdminInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();
  const adminUid = useAuthStore((s) => s.user?.id);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    kfgRepository.getPhotoReviewQueue().then((q) => setQueue(isLeft(q) ? [] : q.right));
  }, []);

  const decidePhoto = async (item: QueueItem, approve: boolean) => {
    const id = item.participation.id;
    setBusy(id);
    const r = await kfgRepository.reviewPhoto(id, approve);
    setBusy(null);
    if (isLeft(r)) { Alert.alert(t.kfgAdminPhotoQueue, t.kfgError(r.left.message)); return; }
    if (adminUid) logAdminAction(adminUid, 'kfgPhotoReview', { participationId: id, approve: String(approve) });
    setQueue((list) => list?.filter((x) => x.participation.id !== id) ?? null);
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
    >
      <ScreenHeader title={t.settingsAdminKfg} />

      <SectionLabel label={t.kfgAdminPhotoQueue} />
      {queue === null ? <Skeleton height={160} /> : queue.length === 0 ? (
        <Text style={[styles.meta, { color: colors.textHint }]}>{t.kfgAdminEmpty}</Text>
      ) : queue.map((item) => (
        <Card key={item.participation.id} padded style={styles.card}>
          <View style={styles.photos}>
            {[item.before, item.after].map((uri, i) => (
              uri
                ? <Image key={i} source={{ uri }} style={[styles.photo, { backgroundColor: colors.surfaceVariant }]} />
                : <View key={i} style={[styles.photo, { backgroundColor: colors.surfaceVariant }]} />
            ))}
          </View>
          <Text style={[styles.meta, { color: colors.textPrimary }]}>{t.kfgAdminProblems(item.participation.reviewProblems ?? [])}</Text>
          <View style={styles.actions}>
            <Button label={t.kfgAdminReject} variant="outline" size="sm" onPress={() => decidePhoto(item, false)} disabled={busy === item.participation.id} style={styles.flex} />
            <Button label={t.kfgAdminApprove} size="sm" onPress={() => decidePhoto(item, true)} disabled={busy === item.participation.id} style={styles.flex} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.md },
  flex: { flex: 1 },
  section: { marginTop: Spacing.md },
  card: { gap: Spacing.sm },
  title: { fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  meta: { fontFamily: UIFontLight, fontSize: FontSize.md, lineHeight: 19 },
  body: { fontFamily: UIFontLight, fontSize: FontSize.base, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  photos: { flexDirection: 'row', gap: Spacing.sm },
  photo: { flex: 1, aspectRatio: 1, borderRadius: BorderRadius.xs },
});
