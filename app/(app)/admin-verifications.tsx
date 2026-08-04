import React, { useEffect, useState } from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { UIFont, UIFontLight, TitleFont, FontSize, FontWeight, Spacing, BorderRadius } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { Icon } from '@/components/ui/Icon';

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
    const unsub = onSnapshot(q, async (snap) => {
      // The photo itself lives in each user's private subcollection (owner +
      // admin read only) rather than on this document, so it takes a
      // separate fetch per pending user.
      const withPhotos = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data() as any;
        const privateSnap = await getDoc(doc(db, 'users', d.id, 'private', 'verification'));
        return {
          id: d.id,
          name: data.name,
          universityEmail: data.universityEmail,
          universityName: data.universityName,
          department: data.department,
          idVerificationPhotoUri: privateSnap.exists() ? (privateSnap.data().photoUri as string) : undefined,
        };
      }));
      setPending(withPhotos);
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

  const bs = colors.border;

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
          <Icon name="shield" size={38} color={colors.textDecor} />
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
  photo: { width: '100%', height: 200, borderRadius: BorderRadius.md, marginBottom: 4 },
  name: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  meta: { fontSize: FontSize.sm, fontFamily: UIFontLight },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: 8 },
  actionBtn: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.md, paddingVertical: 10, alignItems: 'center' },
  actionText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
});
