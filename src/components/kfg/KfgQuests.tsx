import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ProgressTrack } from '@/components/ui/ProgressTrack';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useTheme } from '@/core/theme';
import { FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { KFG_QUESTS, KfgQuestDef } from '@/core/constants/kfg';
import { useLanguageStore, useTranslation } from '@/core/i18n';
import { getISOWeekId } from '@/core/utils/weekId';
import { isLeft } from '@/core/utils/either';
import { haptics } from '@/core/utils/haptics';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { KfgMission } from '@/features/kfg/domain/entities/kfg.entity';
import { useKfgStore } from '@/features/kfg/presentation/store/kfg.store';
import { formatPoints } from '@/features/kfg/format';
import { questClaimId, questProgress } from '@/features/kfg/quests';
import { completedParticipations } from '@/features/kfg/tickets';

/** Weekly quests + lifetime challenges, like the events' Αποστολές page — rewards are KfG points (not ranked). */
export function KfgQuests() {
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const { participations, claims } = useKfgStore();
  const [missions, setMissions] = useState<KfgMission[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [weekId] = useState(() => getISOWeekId(new Date()));

  const doneIds = completedParticipations(participations).map((p) => p.missionId).sort().join(',');
  useEffect(() => {
    if (!doneIds) return;
    kfgRepository.getMissions(doneIds.split(',')).then(setMissions);
  }, [doneIds]);

  const done = useMemo(() => {
    const byId = new Map(missions.map((m) => [m.id, m]));
    return completedParticipations(participations).map((p) => {
      const m = byId.get(p.missionId);
      return m ? { weekId: p.completedWeekId ?? '', cause: m.cause, creatorId: m.creatorId, creatorType: m.creatorType } : null;
    }).filter((d): d is NonNullable<typeof d> => !!d);
  }, [participations, missions]);

  const claim = async (q: KfgQuestDef) => {
    setBusy(q.id);
    const r = await kfgRepository.claimQuest(q.id);
    setBusy(null);
    if (isLeft(r)) { Alert.alert(q.name[language], t.kfgError(r.left.message)); return; }
    haptics.success();
  };

  const row = (q: KfgQuestDef) => {
    const progress = questProgress(q, done, weekId);
    const claimed = claims.includes(questClaimId(q, weekId));
    const ready = progress >= q.target && !claimed;
    return (
      <View key={q.id} style={styles.row}>
        <View style={styles.text}>
          <Text style={[styles.name, { color: colors.textPrimary }]}>{q.name[language]}</Text>
          <ProgressTrack progress={progress / q.target} style={styles.track} />
          <Text style={[styles.meta, { color: colors.textHint }]}>{`${progress}/${q.target} · +${formatPoints(q.points, language)}`}</Text>
        </View>
        {claimed
          ? <Text style={[styles.claimed, { color: colors.accentInk }]}>{t.kfgClaimed}</Text>
          : <Button label={t.kfgClaimBtn(formatPoints(q.points, language))} size="sm" disabled={!ready} loading={busy === q.id} onPress={() => claim(q)} />}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <SectionLabel label={t.kfgQuestsWeekly} />
      <Card padded style={styles.card}>{KFG_QUESTS.filter((q) => q.weekly).map(row)}</Card>
      <SectionLabel label={t.kfgChallenges} />
      <Card padded style={styles.card}>{KFG_QUESTS.filter((q) => !q.weekly).map(row)}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  card: { gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  text: { flex: 1, gap: 3 },
  name: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  meta: { fontFamily: UIFontLight, fontSize: FontSize.sm },
  track: { marginVertical: 2 },
  claimed: { fontFamily: UIFont, fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
