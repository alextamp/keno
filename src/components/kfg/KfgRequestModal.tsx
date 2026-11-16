import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, UIFont, UIFontLight } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';

/** Ask to join a private mission with a short note — the private-event request modal. */
export function KfgRequestModal({ visible, busy, onClose, onSend }: {
  visible: boolean; busy: boolean; onClose: () => void; onSend: (message: string) => void;
}) {
  const { colors } = useTheme();
  const t = useTranslation();
  const [message, setMessage] = useState('');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t.eventRequestJoin}</Text>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>{t.eventRequestMessageHint}</Text>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            value={message}
            onChangeText={setMessage}
            placeholder={t.eventRequestMessagePlaceholder}
            placeholderTextColor={colors.textHint}
            multiline
            maxLength={300}
          />
          <View style={styles.row}>
            <Button label={t.settingsBtnCancel} variant="outline" onPress={onClose} disabled={busy} style={styles.flex} />
            <Button
              label={t.eventRequestSendBtn}
              onPress={() => onSend(message.trim())}
              loading={busy}
              disabled={!message.trim()}
              style={styles.flex}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: Spacing.lg, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.sm },
  title: { fontFamily: UIFont, fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  hint: { fontFamily: UIFontLight, fontSize: FontSize.md, lineHeight: 19 },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, minHeight: 90, textAlignVertical: 'top', fontFamily: UIFont },
  row: { flexDirection: 'row', gap: Spacing.sm, marginTop: 4 },
  flex: { flex: 1 },
});
