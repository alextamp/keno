import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AccentScopeProvider, useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { useLanguageStore, useTranslation } from '@/core/i18n';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { KfgProfile } from '@/features/kfg/domain/entities/kfg.entity';
import { formatPoints, kfgLevelInfo } from '@/features/kfg/format';
import { KfgCharacter } from './KfgCharacter';

/** Read-only Keno for Good card on someone else's profile. Hidden if they've never used KfG. */
export function KfgProfileCard({ uid }: { uid: string }) {
  const [profile, setProfile] = useState<KfgProfile | null>(null);
  useEffect(() => {
    let alive = true;
    kfgRepository.getPublicProfile(uid).then((p) => { if (alive) setProfile(p); });
    return () => { alive = false; };
  }, [uid]);
  if (!profile) return null;
  return (
    <AccentScopeProvider value="kfg">
      <CardInner profile={profile} />
    </AccentScopeProvider>
  );
}

function CardInner({ profile }: { profile: KfgProfile }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const level = kfgLevelInfo(profile.lifetimePoints, language);

  return (
    <View
      accessible
      accessibilityLabel={`Keno for Good, ${level.label}, ${t.kfgPoints(formatPoints(profile.lifetimePoints, language))}`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.accentSoft }]}>
        <KfgCharacter size={50} equipped={profile.equipped} character={profile.character} />
      </View>
      <View style={styles.text}>
        <View style={styles.labelRow}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.label, { color: colors.textHint }]}>KENO FOR GOOD</Text>
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{level.label}</Text>
        <Text style={[styles.meta, { color: colors.textHint }]}>
          {t.kfgLevel(level.level)} · {t.kfgPoints(formatPoints(profile.lifetimePoints, language))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.md },
  thumb: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden' },
  text: { flex: 1, gap: 2 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { fontFamily: UIFont, fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 1.2 },
  title: { fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  meta: { fontFamily: UIFontLight, fontSize: FontSize.md },
});
