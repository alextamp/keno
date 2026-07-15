import React, { useEffect, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';

interface PendingUser {
  id: string;
  name: string;
  universityEmail: string;
  universityName: string;
  department: string;
  idVerificationPhotoUri?: string;
}

export default function AdminVerificationsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslation();

  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('idVerificationStatus', '==', 'pending'));
    const unsub = onSnapshot(q, (snap) => {
      setPending(snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name,
          universityEmail: data.universityEmail,
          universityName: data.universityName,
          department: data.department,
          idVerificationPhotoUri: data.idVerificationPhotoUri,
        };
      }));
      setLoading(false);
    });
    return unsub;
  }, []);

  const decide = async (uid: string, status: 'approved' | 'rejected') => {
    setBusyId(uid);
    try {
      await updateDoc(doc(db, 'users', uid), { idVerificationStatus: status });
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    } finally {
      setBusyId(null);
    }
  };

  const bs = colors.borderStrong;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title={t.adminVerificationsTitle} />

      {loading ? (
        <ActivityIndicator style={{ marginTop: Spacing.xl }} color={colors.primary} />
      ) : pending.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: bs }]}>
          <Text style={styles.emptyEmoji}>🪪</Text>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{t.adminVerificationsEmpty}</Text>
          <Text style={[styles.emptyBody, { color: colors.textHint }]}>{t.adminVerificationsEmptyBody}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {pending.map((u) => {
            const isBusy = busyId === u.id;
            return (
              <View key={u.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: bs }]}>
                {u.idVerificationPhotoUri && (
                  <Image source={{ uri: u.idVerificationPhotoUri }} style={styles.photo} resizeMode="cover" />
                )}
                <Text style={[styles.name, { color: colors.textPrimary }]}>{u.name}</Text>
                <Text style={[styles.meta, { color: colors.textSecondary }]}>{u.universityName} · {u.department}</Text>
                <Text style={[styles.meta, { color: colors.textHint }]}>{u.universityEmail}</Text>

                <View style={styles.actions}>
                  <AnimatedPressable
                    onPress={() => decide(u.id, 'rejected')}
                    disabled={isBusy}
                    style={[styles.actionBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.actionText, { color: colors.textSecondary }]}>{t.adminVerificationsReject}</Text>
                  </AnimatedPressable>
                  <AnimatedPressable
                    onPress={() => decide(u.id, 'approved')}
                    disabled={isBusy}
                    style={[styles.actionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={[styles.actionText, { color: '#fff' }]}>{t.adminVerificationsApprove}</Text>
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
  card: { borderWidth: 2.5, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: 6, ...Shadow.sm },
  photo: { width: '100%', height: 200, borderRadius: BorderRadius.md, marginBottom: 4 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  meta: { fontSize: FontSize.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  actionBtn: { flex: 1, borderWidth: 2, borderRadius: BorderRadius.full, paddingVertical: 10, alignItems: 'center' },
  actionText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
});
