import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Spacing, TitleFont, UIFont } from '@/core/constants/theme';
import { AvatarPile, PileProfile } from './AvatarPile';
import { Tag } from './Tag';

// Warm Paper "Ticket" component (design/KENO_v3_ADDENDUM.md §4, plan section
// B): one white card, 1px border, 14px radius, two notch circles cut into
// the vertical middle of the left/right edges, one dashed rule separating
// header from footer. Never rotated, never textured — its whole meaning is
// "you were actually there."
//
// The notch circles can't use CSS clip-path (RN has none), so per the
// addendum they're plain absolutely-positioned Views colored to match
// whatever's behind the card — half of each circle sticks outside the
// card's bounds and gets clipped by the card's own `overflow:hidden`,
// leaving a clean semicircle bite out of the edge.
export interface TicketProps {
  /** Small uppercase label above the title — "ΕΙΣΙΤΗΡΙΟ" by default, or a
   *  category label (mockup 22: "ΑΘΛΗΤΙΚΑ") when used in the full list. */
  topLabel?: string;
  title: string;
  /** Ticket serial — rendered as "Νº 0XX", zero-padded to 3 digits. */
  number: number;
  /** Footer-left text: date/time, e.g. "Αύρ 2 Αυγ · 18:03". */
  footerLeft: string;
  /** Footer-right: either an attendee pile or a plain string ("μαζί με 7"). */
  attendees?: PileProfile[];
  attendeesTotal?: number;
  footerRightText?: string;
  /** Shown as an accent Tag beneath the footer (check-in success screen). */
  xpLabel?: string;
  /** Tighter padding + smaller title, for the compact profile row (mockup 21). */
  compact?: boolean;
  /** The ticket sits on a tinted (surfaceVariant/"paper2") screen rather than
   *  the default page background — the notch color must match whichever it is. */
  onSurface?: boolean;
  style?: ViewStyle;
}

export function Ticket({
  topLabel,
  title,
  number,
  footerLeft,
  attendees,
  attendeesTotal,
  footerRightText,
  xpLabel,
  compact = false,
  onSurface = false,
  style,
}: TicketProps) {
  const { colors } = useTheme();
  const notchColor = onSurface ? colors.surfaceVariant : colors.background;
  const serial = `Nº ${String(number).padStart(3, '0')}`;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        compact ? styles.cardCompact : styles.cardFull,
        style,
      ]}
    >
      <View style={[styles.notch, styles.notchLeft, { backgroundColor: notchColor, borderColor: colors.border }]} />
      <View style={[styles.notch, styles.notchRight, { backgroundColor: notchColor, borderColor: colors.border }]} />

      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          {!!topLabel && <Text style={[styles.label, { color: colors.textHint }]}>{topLabel}</Text>}
          <Text
            style={[compact ? styles.titleCompact : styles.title, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {title}
          </Text>
        </View>
        <Text style={[styles.label, styles.serial, { color: colors.textHint }]}>{serial}</Text>
      </View>

      <View style={styles.dashedWrap}>
        <Svg width="100%" height={1}>
          <Line x1="0" y1="0.5" x2="100%" y2="0.5" stroke={colors.border} strokeWidth={1} strokeDasharray="4,4" />
        </Svg>
      </View>

      <View style={styles.footerRow}>
        <Text style={[styles.meta, { color: colors.textHint }]}>{footerLeft}</Text>
        {attendees ? (
          <AvatarPile profiles={attendees} totalCount={attendeesTotal} size={20} />
        ) : footerRightText ? (
          <Text style={[styles.meta, { color: colors.textHint }]}>{footerRightText}</Text>
        ) : null}
      </View>

      {!!xpLabel && <Tag label={xpLabel} variant="accent" style={styles.xpTag} />}
    </View>
  );
}

const NOTCH_SIZE = 18;

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  cardFull: { padding: Spacing.md + 2 },
  cardCompact: { padding: Spacing.md },
  notch: {
    position: 'absolute',
    top: '50%',
    width: NOTCH_SIZE,
    height: NOTCH_SIZE,
    borderRadius: NOTCH_SIZE / 2,
    borderWidth: 1,
    marginTop: -NOTCH_SIZE / 2,
    zIndex: 2,
  },
  notchLeft: { left: -NOTCH_SIZE / 2 },
  notchRight: { right: -NOTCH_SIZE / 2 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: UIFont, letterSpacing: 1.6, textTransform: 'uppercase' },
  serial: {},
  title: { fontSize: FontSize.xl, fontFamily: TitleFont, fontWeight: FontWeight.semibold, marginTop: 5, letterSpacing: -0.25 },
  titleCompact: { fontSize: FontSize.lg, fontFamily: TitleFont, fontWeight: FontWeight.semibold, marginTop: 3, letterSpacing: -0.2 },
  dashedWrap: { marginVertical: 11 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  meta: { fontSize: FontSize.md, fontWeight: FontWeight.medium, fontFamily: UIFont },
  xpTag: { marginTop: 11, alignSelf: 'flex-start' },
});
