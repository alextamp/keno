import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { UIFont, FontSize, FontWeight } from '@/core/constants/theme';
import { useTheme } from '@/core/theme';

// Warm Paper avatar pile (spec §4 event card anatomy): overlapping 24px
// circles with a 2px surface ring, −7px overlap, "+N" overflow bubble in
// accent.soft, optional caption text ("Ο Γιώργος και 6 ακόμα").

export interface PileProfile {
  uid: string;
  name: string;
  avatarColor?: string;
  photoUri?: string;
}

interface AvatarPileProps {
  profiles: PileProfile[];
  /** Total people count; when > profiles shown, renders the +N bubble. */
  totalCount?: number;
  maxShown?: number;
  size?: number;
  caption?: string;
  style?: ViewStyle;
}

export function AvatarPile({
  profiles,
  totalCount,
  maxShown = 3,
  size = 24,
  caption,
  style,
}: AvatarPileProps) {
  const { colors } = useTheme();
  const shown = profiles.slice(0, maxShown);
  const total = totalCount ?? profiles.length;
  const extra = total - shown.length;
  const overlap = -Math.round(size * 0.3);

  const circle = (i: number): ViewStyle => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    marginLeft: i === 0 ? 0 : overlap,
    zIndex: shown.length + 1 - i,
    borderWidth: 2,
    borderColor: colors.surface,
  });

  return (
    <View style={[styles.row, style]}>
      {shown.map((p, i) => (
        <View key={p.uid} style={[styles.avatar, circle(i), { backgroundColor: p.avatarColor ?? '#D6C3AB' }]}>
          {p.photoUri ? (
            <Image source={{ uri: p.photoUri }} style={{ width: size - 4, height: size - 4, borderRadius: size / 2 }} />
          ) : (
            <Text style={[styles.initial, { fontSize: size * 0.38 }]}>
              {(p.name?.[0] ?? '?').toUpperCase()}
            </Text>
          )}
        </View>
      ))}
      {extra > 0 && (
        <View style={[styles.avatar, circle(shown.length), { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.initial, { fontSize: size * 0.36, color: colors.accentInk }]}>+{extra}</Text>
        </View>
      )}
      {caption ? (
        <Text style={[styles.caption, { color: colors.textHint }]} numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  avatar: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontFamily: UIFont, fontWeight: FontWeight.bold, color: '#3A2E22' },
  caption: {
    fontSize: FontSize.xs + 0.5,
    fontFamily: UIFont,
    fontWeight: FontWeight.medium,
    marginLeft: 12,
    flexShrink: 1,
  },
});
