import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/core/constants/colors';
import { FontSize, FontWeight } from '@/core/constants/theme';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message }: LoadingScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>keno</Text>
      <ActivityIndicator size="large" color={Colors.primary} style={styles.spinner} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logo: {
    fontSize: 42,
    fontWeight: FontWeight.extrabold,
    color: Colors.primary,
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  spinner: { marginTop: 4 },
  message: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: FontWeight.medium,
    marginTop: 4,
  },
});
