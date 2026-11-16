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

/**
 * The events' manual roll-call, for a QR mission: when a code won't scan,
 * the creator/co-host ticks the person in (and out after the minimum stay).
 * Same server path as a scan (kfgRollCall → applyScan); you can't tick yourself.
 */
export function KfgRollCall({ mission, me }: { mission: KfgMission; me: string }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const people = mission.participantIds.filter((u) => u !== me);
  const key = people.join(',');

  useEffect(() => {
    if (!key) return;
    fetchUserProfiles(key.split(',')).then(setProfiles);
  }, [key]);

  if (people.length === 0) return null;

  const tick = async (uid: string) => {
    setBusy(uid);
    const r = await kfgRepository.rollCall(mission.id, uid);
    setBusy(null);
    if (isLeft(r)) { Alert.alert(t.kfgRollCallTitle, t.kfgError(r.left.message)); return; }
    haptics.success();
    const res = r.right;
    Alert.alert(t.kfgRollCallTitle, t.kfgScanResult(res.result, res.name, res.result === 'tooEarly' ? res.remainingMin : undefined));
  };

  return (
    <Card padded style={styles.card}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t.kfgRollCallTitle}</Text>
      <Text style={[styles.hint, { color: colors.textHint }]}>{t.kfgRollCallHint}</Text>
      {people.map((uid) => {
        const here = mission.presentIds.includes(uid);
        return (
          <View key={uid} style={styles.row}>
            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
              {here ? '✓ ' : ''}{profiles[uid]?.name ?? '…'}
            </Text>
            <Button
              label={here ? t.kfgRollCallOut : t.kfgRollCallIn}
              variant={here ? 'outline' : 'soft'}
              size="sm"
              loading={busy === uid}
              onPress={() => tick(uid)}
            />
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  title: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  hint: { fontFamily: UIFontLight, fontSize: FontSize.md, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 4 },
  name: { flex: 1, fontFamily: UIFont, fontSize: FontSize.base },
});
