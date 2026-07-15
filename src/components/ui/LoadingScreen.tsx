import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/core/theme';
import { FontSize, FontWeight } from '@/core/constants/theme';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image source={require('../../../assets/images/icon.png')} style={styles.logo} />
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
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 8,
  },
  spinner: { marginTop: 4 },
  message: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.medium,
    marginTop: 4,
  },
});
