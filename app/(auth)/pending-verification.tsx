import React, { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { pickImage } from '@/core/utils/imagePicker';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { useTheme } from '@/core/theme';
import { BorderRadius, UIFont, TitleFont, UIFontLight, FontSize, FontWeight, Spacing } from '@/core/constants/theme';
import { useTranslation } from '@/core/i18n';

export default function PendingVerificationScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const resubmitIdVerification = useAuthStore((s) => s.resubmitIdVerification);
  const t = useTranslation();
  const rejected = user?.idVerificationStatus === 'rejected';

  const [newPhoto, setNewPhoto] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const pickPhoto = async () => {
    const uri = await pickImage();
    if (uri) setNewPhoto(uri);
  };

  const handleSignOut = async () => {
    await signOut();
    // A verified-but-pending user does become null here, which normally
    // re-triggers AuthGate's router effect — but navigate explicitly rather
    // than depend on that, same reasoning as the verify-email screen.
    router.replace('/(auth)/welcome' as any);
  };

  const handleResubmit = async () => {
    if (!newPhoto) return;
    setSubmitting(true);
    const ok = await resubmitIdVerification(newPhoto);
    setSubmitting(false);
    if (!ok) { Alert.alert(t.createAlertSaveError, t.authErrGeneric); return; }
    setNewPhoto(undefined);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.iconCircle, { backgroundColor: rejected ? colors.surfaceVariant : colors.accentSoft }]}>
        <Icon name={rejected ? 'x' : 'shield'} size={34} color={rejected ? colors.textHint : colors.primary} />
      </View>

      <View style={styles.textGroup}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {rejected ? t.pendingVerificationRejectedTitle : t.pendingVerificationTitle}
        </Text>
        <Text style={[styles.body, { color: colors.textHint }]}>
          {rejected ? t.pendingVerificationRejectedBody : t.pendingVerificationBody}
        </Text>
      </View>

      {rejected && (
        <View style={styles.resubmitForm}>
          {newPhoto && <Image source={{ uri: newPhoto }} style={styles.idPhotoPreview} />}
          <AnimatedPressable
            onPress={pickPhoto}
            style={[styles.idPhotoBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          >
            <Text style={[styles.idPhotoBtnText, { color: colors.primary }]}>
              {newPhoto ? t.authIdPhotoBtnChange : t.authIdPhotoBtnAdd}
            </Text>
          </AnimatedPressable>
        </View>
      )}

      <View style={styles.actions}>
        {rejected && (
          <Button
            label={t.pendingVerificationResubmitBtn}
            onPress={handleResubmit}
            loading={submitting}
            disabled={!newPhoto}
            fullWidth
          />
        )}
        <Button
          label={t.verifyBtnSignOut}
          onPress={handleSignOut}
          variant="ghost"
          labelStyle={{ color: colors.textSecondary }}
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textGroup: { gap: Spacing.sm, alignItems: 'center' },
  title: {
    fontSize: FontSize.display,
    fontWeight: FontWeight.bold,
    fontFamily: TitleFont,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  body: {
    fontSize: FontSize.base,
    fontFamily: UIFontLight,
    textAlign: 'center',
    lineHeight: 21,
  },
  resubmitForm: { width: '100%', alignItems: 'center', gap: Spacing.sm },
  idPhotoPreview: { width: '100%', height: 160, borderRadius: BorderRadius.md },
  idPhotoBtn: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 8 },
  idPhotoBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: UIFont },
  actions: { width: '100%', gap: Spacing.sm },
});
