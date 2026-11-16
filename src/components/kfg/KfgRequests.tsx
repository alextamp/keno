import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useTheme } from '@/core/theme';
import { FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { isLeft } from '@/core/utils/either';
import { haptics } from '@/core/utils/haptics';
import { fetchUserProfiles, UserProfile } from '@/core/utils/userProfiles';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { KfgMission } from '@/features/kfg/domain/entities/kfg.entity';

/** Pending join requests on a private mission — for the creator and co-hosts (kfgDecideRequest). */
export function KfgRequests({ mission }: { mission: KfgMission }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const uids = Object.keys(mission.joinRequests);
  const key = uids.sort().join(',');

  useEffect(() => {
    if (!key) return;
    fetchUserProfiles(key.split(',')).then(setProfiles);
  }, [key]);

  if (uids.length === 0) return null;

  const decide = async (uid: string, accept: boolean) => {
    setBusy(uid);
    const r = await kfgRepository.decideRequest(mission.id, uid, accept);
    setBusy(null);
    if (isLeft(r)) { Alert.alert(mission.title, t.kfgError(r.left.message)); return; }
    haptics.success();
  };

  return (
    <View style={styles.section}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{`${t.kfgRequestsTitle} (${uids.length})`}</Text>
      {uids.map((uid) => (
        <Card key={uid} padded style={styles.card}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{profiles[uid]?.name ?? '…'}</Text>
          {!!mission.joinRequests[uid] && (
            <Text style={[styles.msg, { color: colors.textSecondary }]}>{mission.joinRequests[uid]}</Text>
          )}
          <View style={styles.row}>
            <Button label={t.kfgDecline} variant="outline" size="sm" onPress={() => decide(uid, false)} disabled={busy === uid} style={styles.flex} />
            <Button label={t.kfgAccept} size="sm" onPress={() => decide(uid, true)} disabled={busy === uid} style={styles.flex} />
          </View>
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  title: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  card: { gap: 6 },
  name: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  msg: { fontFamily: UIFontLight, fontSize: FontSize.md, lineHeight: 19 },
  row: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  flex: { flex: 1 },
});
