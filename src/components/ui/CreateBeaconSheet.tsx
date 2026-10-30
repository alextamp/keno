import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from './AnimatedPressable';
import { Button } from './Button';
import { Icon } from './Icon';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';
import { BEACON_DURATIONS_MIN, BeaconEntity } from '@/features/beacons/beacon.entity';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (durationMinutes: BeaconEntity['durationMinutes'], note: string) => void;
}

const DURATION_LABEL_KEYS = ['beacon30m', 'beacon1h', 'beacon2h'] as const;

export function CreateBeaconSheet({ visible, onClose, onSubmit }: Props) {
  const { colors } = useTheme();
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const [duration, setDuration] = useState<BeaconEntity['durationMinutes']>(60);
  const [note, setNote] = useState('');

  const handleStart = () => {
    onSubmit(duration, note.trim());
    setNote('');
    setDuration(60);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + Spacing.lg }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: colors.accentSoft }]}>
              <Icon name="coffee" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{t.beaconCreateTitle}</Text>
            <Text style={[styles.body, { color: colors.textHint }]}>{t.beaconCreateBody}</Text>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textHint }]}>{t.beaconDurationLabel}</Text>
          <View style={styles.durationRow}>
            {BEACON_DURATIONS_MIN.map((mins, i) => (
              <AnimatedPressable key={mins} onPress={() => setDuration(mins)} style={{ flex: 1 }}>
                <View style={[
                  styles.durationChip,
                  duration === mins
                    ? { backgroundColor: colors.primary, borderColor: colors.primary }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}>
                  <Text style={[styles.durationText, { color: duration === mins ? '#fff' : colors.textPrimary }]}>
                    {t[DURATION_LABEL_KEYS[i]]}
                  </Text>
                </View>
              </AnimatedPressable>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { color: colors.textHint }]}>{t.beaconNotePlaceholder}</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
            value={note}
            onChangeText={setNote}
            placeholder={t.beaconNotePlaceholder}
            placeholderTextColor={colors.textHint}
            maxLength={80}
          />

          <Button label={t.beaconStartBtn(duration)} onPress={handleStart} fullWidth style={{ marginTop: Spacing.md }} />
          <AnimatedPressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.textHint }]}>{t.beaconCancelBtn}</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(36,31,25,0.45)' },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.md, paddingHorizontal: Spacing.gutter, gap: Spacing.sm,
  },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  header: { alignItems: 'center', gap: 6, marginBottom: 4 },
  iconCircle: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, fontFamily: TitleFont, marginTop: 2 },
  body: { fontSize: FontSize.sm, textAlign: 'center', lineHeight: 18, fontFamily: UIFontLight, paddingHorizontal: 8 },
  sectionLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: UIFont, marginTop: Spacing.sm },
  durationRow: { flexDirection: 'row', gap: Spacing.sm },
  durationChip: { borderRadius: BorderRadius.md, borderWidth: 1.5, paddingVertical: 12, alignItems: 'center' },
  durationText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, fontFamily: UIFont },
  input: { borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: 12, fontSize: FontSize.base, fontFamily: UIFontLight },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  cancelText: { fontSize: FontSize.sm, fontWeight: FontWeight.semibold, fontFamily: UIFont },
});
