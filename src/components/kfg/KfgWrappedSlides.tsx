import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { Icon } from '@/components/ui/Icon';
import {
  BARCODE_W, BARS, Bg, C, Dashes, Frame, Kicker, MONO, ReceiptRow, SLIDE_H, SLIDE_W, TEETH, semesterLabel, upper,
} from '@/components/wrapped/WrappedSlides';
import { KfgCharacter } from './KfgCharacter';
import { CAUSE_ICONS } from './KfgMissionRow';
import { TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { Translations } from '@/core/i18n';
import { KfgCause, KfgProfile } from '@/features/kfg/domain/entities/kfg.entity';
import { formatPoints, kfgLevelInfo } from '@/features/kfg/format';
import { KfgWrappedStats } from '@/features/kfg/wrapped';

// Keno for Good Wrapped — same 1080×1920 story format and primitives as the
// regular Wrapped (WrappedSlides), in the KfG green, with the character.

export { SLIDE_H, SLIDE_W };

const G = { deep: '#1F4A33', green: '#3F7A55', leaf: '#5E9C70', mint: '#CFE3D2' };

export type KfgSlideKey = 'character' | 'missions' | 'receipt';

export interface KfgSlideProps {
  stats: KfgWrappedStats;
  profile: KfgProfile;
  s: number;
  t: Translations;
  language: 'el' | 'en';
  userName: string;
  dateLocale?: Locale;
}

export const KFG_SLIDES: KfgSlideKey[] = ['character', 'missions', 'receipt'];

const CAUSE_COLORS: Record<KfgCause, { bg: string; fg: string }> = {
  food: { bg: C.butter, fg: '#7A5A12' },
  animals: { bg: C.blush, fg: '#6B2A14' },
  environment: { bg: C.sage, fg: '#2F4F33' },
  recycling: { bg: G.green, fg: C.paper },
  people: { bg: C.plum, fg: C.butter },
  other: { bg: '#CFC3B0', fg: '#4A4036' },
};

function KfgWordmark({ s, color, dot }: { s: number; color: string; dot: string }) {
  return (
    <Text style={{ fontFamily: TitleFont, fontSize: 46 * s, color, letterSpacing: -0.5 * s }}>
      keno<Text style={{ color: dot }}>.</Text>
      <Text style={{ fontSize: 30 * s }}> for good</Text>
    </Text>
  );
}

/* ─────────────── 1 · Your character ─────────────── */

export function KfgCharacterSlide({ stats, profile, s, t, language }: KfgSlideProps) {
  const level = kfgLevelInfo(profile.lifetimePoints, language);
  return (
    <Frame s={s}>
      <Bg s={s}>
        <Defs>
          <RadialGradient id="kcBg" cx="540" cy="-200" r="2200" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={G.leaf} />
            <Stop offset="0.45" stopColor={G.green} />
            <Stop offset="1" stopColor={G.deep} />
          </RadialGradient>
          <Pattern id="kcDots" width="46" height="46" patternUnits="userSpaceOnUse">
            <Circle cx="23" cy="23" r="2.5" fill="#FFFFFF" opacity="0.07" />
          </Pattern>
        </Defs>
        <Rect width={SLIDE_W} height={SLIDE_H} fill="url(#kcBg)" />
        <Rect width={SLIDE_W} height={SLIDE_H} fill="url(#kcDots)" />
      </Bg>

      <View style={{ paddingTop: 150 * s, paddingHorizontal: 88 * s, alignItems: 'center' }}>
        <KfgWordmark s={s} color={C.paper} dot={C.butter} />
        <View style={{ marginTop: 28 * s }}>
          <Kicker s={s} color="rgba(250,247,242,0.72)">{`WRAPPED · ${upper(semesterLabel(stats.semesterId, t))}`}</Kicker>
        </View>
        <Text style={{ marginTop: 22 * s, fontFamily: TitleFont, fontSize: 92 * s, lineHeight: 98 * s, color: C.paper, textAlign: 'center', letterSpacing: -1.5 * s }}>
          {t.kfgWrappedHeroTitle}
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: 640 * s, height: 640 * s, borderRadius: 320 * s, backgroundColor: G.mint,
          alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden',
        }}>
          <KfgCharacter size={560 * s} equipped={profile.equipped} character={profile.character} />
        </View>
      </View>

      <View style={{ paddingBottom: 200 * s, alignItems: 'center', gap: 10 * s }}>
        <Text style={{ fontFamily: TitleFont, fontSize: 64 * s, color: C.paper }}>{level.label}</Text>
        <Text style={{ fontFamily: UIFont, fontSize: 26 * s, color: 'rgba(250,247,242,0.8)' }}>
          {`${t.kfgLevel(level.level)} · ${t.kfgPoints(formatPoints(stats.points, language))}`}
        </Text>
      </View>
    </Frame>
  );
}

/* ─────────────── 2 · Missions as tickets ─────────────── */

export function KfgMissionsSlide({ stats, s, t, dateLocale }: KfgSlideProps) {
  const n = stats.tickets.length;
  const picks = [...new Set([0, Math.floor(n / 2), n - 1])].map((i) => stats.tickets[i]).filter(Boolean);
  const tilts = [-1.6, 1.1, -0.8];

  return (
    <Frame s={s}>
      <Bg s={s}>
        <Defs>
          <LinearGradient id="kmBg" x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor="#F3EBDD" />
            <Stop offset="1" stopColor="#DCCDB4" />
          </LinearGradient>
        </Defs>
        <Rect width={SLIDE_W} height={SLIDE_H} fill="url(#kmBg)" />
        <Circle cx="980" cy="60" r="280" fill={G.green} opacity="0.08" />
      </Bg>

      <View style={{ paddingTop: 150 * s, paddingHorizontal: 88 * s, alignItems: 'center' }}>
        <KfgWordmark s={s} color={C.ink} dot={G.green} />
        <Text style={{ marginTop: 40 * s, fontFamily: TitleFont, fontSize: 92 * s, lineHeight: 98 * s, color: C.ink, textAlign: 'center', letterSpacing: -1.5 * s }}>
          {`${t.kfgWrappedMissions(n)}\n${t.kfgWrappedThisSemester}`}
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: 30 * s, paddingHorizontal: 100 * s }}>
        {picks.map((tk, i) => {
          const col = CAUSE_COLORS[tk.mission.cause];
          return (
            <View key={tk.mission.id} style={{
              transform: [{ rotate: `${tilts[i]}deg` }], borderRadius: 26 * s, backgroundColor: '#FFFFFF',
              shadowColor: '#1E2A20', shadowOpacity: 0.25, shadowRadius: 20 * s, shadowOffset: { width: 0, height: 20 * s }, elevation: 10,
            }}>
              <View style={{ flexDirection: 'row', borderRadius: 26 * s, overflow: 'hidden', minHeight: 170 * s }}>
                <View style={{ width: 132 * s, backgroundColor: col.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={CAUSE_ICONS[tk.mission.cause]} size={56 * s} color={col.fg} strokeWidth={2} />
                </View>
                <View style={{ flex: 1, paddingVertical: 28 * s, paddingHorizontal: 36 * s, justifyContent: 'center', gap: 8 * s }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: UIFont, fontSize: 19 * s, letterSpacing: 1.5 * s, color: '#9A8E7E' }}>{upper(t.kfgCause(tk.mission.cause))}</Text>
                    <Text style={{ fontFamily: TitleFont, fontSize: 22 * s, color: G.green }}>{`No ${String(tk.serial).padStart(3, '0')}`}</Text>
                  </View>
                  <Text numberOfLines={1} style={{ fontFamily: TitleFont, fontSize: 40 * s, color: C.ink }}>{tk.mission.title}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: UIFontLight, fontSize: 20 * s, color: '#8A7F72' }}>
                    {`${format(tk.doneAt, 'EEE d MMM', { locale: dateLocale })} · ${tk.mission.creatorName}`}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: 88 * s, paddingBottom: 190 * s, alignItems: 'center', minHeight: 230 * s }}>
        {n > picks.length && (
          <Text style={{ fontFamily: UIFontLight, fontSize: 21 * s, color: '#6F6455' }}>{t.kfgWrappedMore(n - picks.length)}</Text>
        )}
      </View>
    </Frame>
  );
}

/* ─────────────── 3 · Receipt ─────────────── */

export function KfgReceiptSlide({ stats, s, t, language, userName }: KfgSlideProps) {
  const mono = (size: number, color = C.ink, extra = {}) => ({ fontFamily: MONO, fontSize: size * s, color, ...extra });
  const hours = String(stats.hours).replace('.', language === 'el' ? ',' : '.');

  return (
    <Frame s={s}>
      <Bg s={s}>
        <Defs>
          <LinearGradient id="krBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={G.green} />
            <Stop offset="1" stopColor={G.deep} />
          </LinearGradient>
        </Defs>
        <Rect width={SLIDE_W} height={SLIDE_H} fill="url(#krBg)" />
      </Bg>

      <View style={{ paddingTop: 140 * s, alignItems: 'center' }}>
        <KfgWordmark s={s} color={C.paper} dot={C.butter} />
        <View style={{ marginTop: 24 * s }}><Kicker s={s} color="rgba(250,247,242,0.75)">{t.kfgWrappedReceiptTitle}</Kicker></View>
      </View>

      <View style={{
        alignSelf: 'center', marginTop: 56 * s, width: 780 * s, transform: [{ rotate: '-0.9deg' }],
        shadowColor: '#0B1A10', shadowOpacity: 0.35, shadowRadius: 34 * s, shadowOffset: { width: 0, height: 30 * s }, elevation: 12,
      }}>
        <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 64 * s, paddingTop: 60 * s, paddingBottom: 40 * s }}>
          <Text style={mono(17, '#9A8E7E', { textAlign: 'center', letterSpacing: 2 * s })}>{upper(semesterLabel(stats.semesterId, t))}</Text>
          <Text style={mono(16, '#B3A692', { textAlign: 'center', marginTop: 6 * s })}>{userName}</Text>

          <Dashes s={s} />
          {stats.causeCounts.slice(0, 6).map((c) => (
            <View key={c.cause} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 * s }}>
              <Text style={mono(24)}>{t.kfgCause(c.cause)}</Text>
              <Text style={mono(24)}>{`x${c.count}`}</Text>
            </View>
          ))}
          <Dashes s={s} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={mono(27, C.ink, { fontWeight: '700' })}>{t.kfgWrappedTotal}</Text>
            <Text style={mono(27, C.ink, { fontWeight: '700' })}>{stats.missions}</Text>
          </View>
          {stats.hours > 0 && <ReceiptRow s={s} label={t.kfgWrappedHours} value={hours} mono={mono} />}
          <ReceiptRow s={s} label={t.kfgWrappedPoints} value={formatPoints(stats.points, language)} mono={mono} />
          {stats.organizations > 0 && <ReceiptRow s={s} label={t.kfgWrappedOrgs} value={stats.organizations} mono={mono} />}
          <Dashes s={s} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={mono(26, C.ink, { fontWeight: '700' })}>{t.kfgWrappedValue}</Text>
            <Text style={{ fontFamily: TitleFont, fontSize: 44 * s, color: G.green }}>{t.kfgWrappedPriceless}</Text>
          </View>
          <Text style={mono(16, '#9A8E7E', { textAlign: 'center', marginTop: 16 * s, fontStyle: 'italic' })}>{t.kfgWrappedFootnote}</Text>

          <View style={{ marginTop: 46 * s, alignItems: 'center', gap: 14 * s }}>
            <Svg width={BARCODE_W * s} height={64 * s} viewBox={`0 0 ${BARCODE_W} 64`}>
              {BARS.map((b, i) => <Rect key={i} x={b.x} y={0} width={b.w} height={64} fill={C.ink} />)}
            </Svg>
            <Text style={mono(14, '#B3A692', { letterSpacing: 2 * s })}>{t.kfgWrappedThanks}</Text>
          </View>
        </View>
        <Svg width={780 * s} height={22 * s} viewBox="0 0 780 22" preserveAspectRatio="none">
          <Path d={`M0 0 ${TEETH.map((tx) => `L${tx + 15} 22 L${tx + 30} 0`).join(' ')} Z`} fill="#FFFFFF" />
        </Svg>
      </View>
    </Frame>
  );
}

export const KFG_SLIDE_COMPONENTS: Record<KfgSlideKey, (p: KfgSlideProps) => React.ReactElement> = {
  character: KfgCharacterSlide,
  missions: KfgMissionsSlide,
  receipt: KfgReceiptSlide,
};
