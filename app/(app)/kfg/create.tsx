import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { format } from 'date-fns';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { Button } from '@/components/ui/Button';
import { Icon, IconName } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { CAUSE_ICONS } from '@/components/kfg/KfgMissionRow';
import { AccentScopeProvider, useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { KFG_LIMITS, KFG_POINTS, KfgMissionKind } from '@/core/constants/kfg';
import { getDateLocale, useLanguageStore, useTranslation } from '@/core/i18n';
import { isLeft } from '@/core/utils/either';
import { analytics } from '@/core/utils/analytics';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { kfgRepository } from '@/features/kfg/data/repositories/kfg.repository.impl';
import { KfgCause } from '@/features/kfg/domain/entities/kfg.entity';

const CAUSES: KfgCause[] = ['food', 'animals', 'environment', 'recycling', 'people', 'other'];
const KINDS: KfgMissionKind[] = ['partnerQr', 'group', 'photo'];
const KIND_ICONS: Record<KfgMissionKind, IconName> = { partnerQr: 'qr', group: 'users', photo: 'camera' };
const POINT_OPTIONS = [KFG_POINTS.partnerQrMin, KFG_POINTS.partnerQrDefault, KFG_POINTS.partnerQrMax];

function defaultStart(): Date {
  const d = new Date(Date.now() + 2 * 86_400_000);
  d.setHours(10, 0, 0, 0);
  return d;
}

export default function KfgCreateScreen() {
  return (
    <AccentScopeProvider value="kfg">
      <CreateInner />
    </AccentScopeProvider>
  );
}

function Chip({ label, icon, on, onPress }: { label: string; icon?: IconName; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface }]}
    >
      {icon && <Icon name={icon} size={14} color={on ? colors.accentInk : colors.textSecondary} />}
      <Text style={[styles.chipText, { color: on ? colors.accentInk : colors.textSecondary }]}>{label}</Text>
    </AnimatedPressable>
  );
}

function Stepper({ value, label, onChange }: { value: number; label: string; onChange: (delta: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stepper}>
      <AnimatedPressable accessibilityRole="button" accessibilityLabel="−" onPress={() => onChange(-1)} style={[styles.stepBtn, { borderColor: colors.border }]}>
        <Text style={[styles.stepText, { color: colors.textPrimary }]}>−</Text>
      </AnimatedPressable>
      <Text style={[styles.stepValue, { color: colors.textPrimary }]} accessibilityLabel={`${label}: ${value}`}>{value}</Text>
      <AnimatedPressable accessibilityRole="button" accessibilityLabel="+" onPress={() => onChange(1)} style={[styles.stepBtn, { borderColor: colors.border }]}>
        <Text style={[styles.stepText, { color: colors.textPrimary }]}>+</Text>
      </AnimatedPressable>
    </View>
  );
}

function CreateInner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useTranslation();
  const { language } = useLanguageStore();
  const user = useAuthStore((s) => s.user);
  const isOrg = user?.isOrganization === true;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [infoText, setInfoText] = useState('');
  const [cause, setCause] = useState<KfgCause>('food');
  const [kind, setKind] = useState<KfgMissionKind>('partnerQr');
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [durationMin, setDurationMin] = useState(180);
  const [minStayMin, setMinStayMin] = useState(120);
  const [areaLabel, setAreaLabel] = useState('');
  const [address, setAddress] = useState('');
  const [capacity, setCapacity] = useState(10);
  const [points, setPoints] = useState<number>(KFG_POINTS.partnerQrDefault);
  const [picker, setPicker] = useState<'date' | 'start' | null>(null);
  const [saving, setSaving] = useState(false);

  const effectiveKind: KfgMissionKind = isOrg ? kind : 'partnerQr';
  const endsAt = new Date(startsAt.getTime() + durationMin * 60_000);
  const minStay = Math.min(minStayMin, durationMin);
  const valid = title.trim().length >= 3 && description.trim().length >= 10 && areaLabel.trim().length >= 2;

  const onPick = (_: unknown, selected?: Date) => {
    if (Platform.OS === 'android') setPicker(null);
    if (!selected) return;
    const d = new Date(startsAt);
    if (picker === 'date') d.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
    else d.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
    setStartsAt(d);
  };

  const submit = async () => {
    if (!valid || saving) return;
    if (startsAt.getTime() <= Date.now()) {
      Alert.alert(t.kfgCreateTitle, t.kfgInvalidTimes(KFG_LIMITS.maxDurationHours));
      return;
    }
    if ([title, description, infoText, areaLabel, address].some((x) => containsBlockedContent(x))) {
      Alert.alert(t.kfgCreateTitle, t.validContentBlocked);
      return;
    }
    setSaving(true);
    let coords: { latitude: number; longitude: number } | null = null;
    if (address.trim()) {
      // Best effort, for the distance shown on the mission page.
      coords = await Location.geocodeAsync(`${address.trim()}, ${areaLabel.trim()}`)
        .then((r) => (r[0] ? { latitude: r[0].latitude, longitude: r[0].longitude } : null))
        .catch(() => null);
    }
    const r = await kfgRepository.createMission({
      title: title.trim(), description: description.trim(), infoText: infoText.trim() || undefined,
      kind: effectiveKind, cause, startsAt, endsAt,
      minDurationMin: effectiveKind === 'partnerQr' ? minStay : 0,
      areaLabel: areaLabel.trim(), address: address.trim() || undefined,
      latitude: coords?.latitude, longitude: coords?.longitude,
      capacity, points: isOrg && effectiveKind === 'partnerQr' ? points : undefined,
    });
    setSaving(false);
    if (isLeft(r)) {
      const code = r.left.message;
      Alert.alert(t.kfgCreateTitle, code === 'endsAt' ? t.kfgInvalidTimes(KFG_LIMITS.maxDurationHours) : t.kfgError(code));
      return;
    }
    analytics.track('kfg_mission_created', { kind: effectiveKind, status: r.right.status });
    if (r.right.status === 'pending') {
      Alert.alert(t.kfgCreateTitle, t.kfgCreatedPending, [{ text: 'OK', onPress: () => router.back() }]);
    } else {
      router.replace(`/(app)/kfg/mission/${r.right.missionId}` as any);
    }
  };

  const locale = getDateLocale(language);
  const durationLabel = (min: number) => t.kfgDuration(Math.floor(min / 60), min % 60);

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: Spacing.gutter }}>
        <ScreenHeader title={t.kfgCreateTitle} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        {!isOrg && (
          <Text style={[styles.note, { color: colors.textHint }]}>{t.kfgCreateStudentNote(KFG_LIMITS.studentMissionsPerMonth)}</Text>
        )}

        <Input label={t.kfgFieldTitle} value={title} onChangeText={setTitle} maxLength={80} />
        <Input label={t.kfgFieldDescription} value={description} onChangeText={setDescription} maxLength={1000} multiline />

        <SectionLabel label={t.kfgFieldCause} />
        <View style={styles.chips}>
          {CAUSES.map((c) => (
            <Chip key={c} label={t.kfgCause(c)} icon={CAUSE_ICONS[c]} on={cause === c} onPress={() => setCause(c)} />
          ))}
        </View>

        {isOrg && (
          <>
            <SectionLabel label={t.kfgFieldKind} />
            <View style={styles.chips}>
              {KINDS.map((k) => (
                <Chip key={k} label={t.kfgVerifyLabel(k, false)} icon={KIND_ICONS[k]} on={kind === k} onPress={() => setKind(k)} />
              ))}
            </View>
            <Text style={[styles.note, { color: colors.textHint }]}>{t.kfgVerifyHow(kind, false)}</Text>
          </>
        )}

        <SectionLabel label={t.kfgFieldDate} />
        <View style={styles.dateRow}>
          <Chip label={format(startsAt, 'EEE d MMM', { locale })} icon="cal" on={picker === 'date'} onPress={() => setPicker(picker === 'date' ? null : 'date')} />
          <Chip label={`${t.kfgFieldStart} ${format(startsAt, 'HH:mm')}`} icon="clock" on={picker === 'start'} onPress={() => setPicker(picker === 'start' ? null : 'start')} />
        </View>
        {picker && (
          <DateTimePicker
            value={startsAt}
            mode={picker === 'date' ? 'date' : 'time'}
            is24Hour
            minimumDate={picker === 'date' ? new Date() : undefined}
            onChange={onPick}
          />
        )}

        <View style={styles.stepRow}>
          <View style={styles.stepLabel}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>{t.kfgFieldEnd}</Text>
            <Text style={[styles.note, { color: colors.textHint }]}>{format(endsAt, 'HH:mm')} · {durationLabel(durationMin)}</Text>
          </View>
          <Stepper
            value={durationMin / 60}
            label={t.kfgFieldEnd}
            onChange={(d) => setDurationMin((v) => Math.min(KFG_LIMITS.maxDurationHours * 60, Math.max(30, v + d * 30)))}
          />
        </View>

        {effectiveKind === 'partnerQr' && (
          <View style={styles.stepRow}>
            <View style={styles.stepLabel}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>{t.kfgFieldMinDuration}</Text>
              <Text style={[styles.note, { color: colors.textHint }]}>{durationLabel(minStay)}</Text>
            </View>
            <Stepper value={minStay / 60} label={t.kfgFieldMinDuration} onChange={(d) => setMinStayMin((v) => Math.min(durationMin, Math.max(0, v + d * 30)))} />
          </View>
        )}

        <Input label={t.kfgFieldArea} hint={t.kfgFieldAreaHint} value={areaLabel} onChangeText={setAreaLabel} maxLength={60} />
        <Input label={t.kfgFieldAddress} value={address} onChangeText={setAddress} maxLength={160} />

        <View style={styles.stepRow}>
          <Text style={[styles.label, styles.stepLabel, { color: colors.textPrimary }]}>{t.kfgFieldCapacity}</Text>
          <Stepper value={capacity} label={t.kfgFieldCapacity} onChange={(d) => setCapacity((v) => Math.min(KFG_LIMITS.maxCapacity, Math.max(1, v + d)))} />
        </View>

        {isOrg && effectiveKind === 'partnerQr' && (
          <>
            <SectionLabel label={t.kfgFieldPoints} />
            <View style={styles.chips}>
              {POINT_OPTIONS.map((p) => <Chip key={p} label={`+${p}`} on={points === p} onPress={() => setPoints(p)} />)}
            </View>
          </>
        )}

        <Input label={t.kfgFieldInfo} hint={t.kfgFieldInfoHint} value={infoText} onChangeText={setInfoText} maxLength={500} multiline />

        <Button
          label={isOrg ? t.kfgPublishBtn : t.kfgSubmitForReviewBtn}
          onPress={submit}
          loading={saving}
          disabled={!valid}
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: Spacing.gutter, gap: Spacing.md },
  note: { fontFamily: UIFontLight, fontSize: FontSize.md, lineHeight: 19 },
  label: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.bold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44,
    borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: 14,
  },
  chipText: { fontFamily: UIFont, fontSize: FontSize.md, fontWeight: FontWeight.bold },
  dateRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepLabel: { flex: 1, gap: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: UIFont, fontSize: FontSize.xl },
  stepValue: { fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold, minWidth: 34, textAlign: 'center' },
});
