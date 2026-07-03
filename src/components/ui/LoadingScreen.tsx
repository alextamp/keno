import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/core/theme';
import { FontSize, FontWeight, LogoFont } from '@/core/constants/theme';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.logo, { color: colors.primary }]}>KeNo.</Text>
      <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
      {message && <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logo: {
    fontSize: 48,
    fontWeight: FontWeight.extrabold,
    fontFamily: LogoFont,
    marginBottom: 8,
  },
  spinner: { marginTop: 4 },
  message: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    marginTop: 4,
  },
});
