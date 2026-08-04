import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { BorderRadius } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';

// Warm Paper card: white surface, 1px border, radius 14, no shadow (spec §4).
// `padded` applies the standard 12px content padding; photo-topped cards keep
// it off and pad their own body so the image sits flush with the edges.
export function Card({ padded = false, style, children, ...rest }: ViewProps & { padded?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        padded && styles.padded,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  padded: { padding: 12 },
});
