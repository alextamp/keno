import React from 'react';
import { Platform, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';
import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import { Icon, IconName } from '@/components/ui/Icon';
import { TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { Translations } from '@/core/i18n';
import { EventCategory } from '@/features/events/domain/entities/event.entity';
import { areaLabel, WrappedStats, WrappedTraitId } from '@/features/wrapped/wrapped';

// Every slide is laid out in 1080×1920 design units (the Instagram story
// size) and multiplied by `s` to fit the screen — the exported image is
// captured at exactly 1080×1920 regardless of the device.
export const SLIDE_W = 1080;
export const SLIDE_H = 1920;

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });
const C = {
  terracotta: '#B8482A', ember: '#D9683F', paper: '#FAF7F2', ink: '#1F1B16',
  butter: '#F2C879', sage: '#9DB59A', plum: '#5B3A5E', blush: '#E39A7A',
};

export type SlideKey = 'tickets' | 'map' | 'people' | 'receipt' | 'persona' | 'weeks';

export interface SlideProps {
  stats: WrappedStats;
  s: number;
  t: Translations;
  /** Already shortened to "First L." — the only name ever printed on a slide. */
  userName: string;
  dateLocale?: Locale;
}

// Slides that would be empty for this user are skipped rather than shown
// with a zero (a map with one dot, a constellation with nobody in it).
export function slidesFor(stats: WrappedStats): SlideKey[] {
  const keys: SlideKey[] = ['tickets'];
  if (stats.areas.length >= 2) keys.push('map');
  if (stats.newPeopleMet > 0) keys.push('people');
  keys.push('receipt', 'persona', 'weeks');
  return keys;
}

const CATEGORY_KEYS: Record<EventCategory, keyof Translations> = {
  [EventCategory.Party]: 'catParty',
  [EventCategory.Sports]: 'catSports',
  [EventCategory.Study]: 'catStudy',
  [EventCategory.Chill]: 'catChill',
  [EventCategory.Coffee]: 'catCoffee',
  [EventCategory.Other]: 'catOther',
};

export function categoryLabel(category: EventCategory, t: Translations): string {
  return t[CATEGORY_KEYS[category]] as string;
}

const TICKET_COLORS: Record<EventCategory, { bg: string; fg: string }> = {
  [EventCategory.Coffee]: { bg: C.butter, fg: '#7A5A12' },
  [EventCategory.Study]: { bg: C.sage, fg: '#2F4F33' },
  [EventCategory.Party]: { bg: C.plum, fg: C.butter },
  [EventCategory.Sports]: { bg: '#3F7A55', fg: C.paper },
  [EventCategory.Chill]: { bg: C.blush, fg: '#6B2A14' },
  [EventCategory.Other]: { bg: '#CFC3B0', fg: '#4A4036' },
};

// Greek capitals drop the tonos ("ΧΑΡΤΗΣ", not "ΧΆΡΤΗΣ"); plain
// toUpperCase() keeps it, so strip accents first.
const TONOS: Record<string, string> = { ά: 'α', έ: 'ε', ή: 'η', ί: 'ι', ό: 'ο', ύ: 'υ', ώ: 'ω', ΐ: 'ι', ΰ: 'υ', ϊ: 'ι', ϋ: 'υ' };
export function upper(text: string): string {
  return text.replace(/[άέήίόύώΐΰϊϋ]/g, (ch) => TONOS[ch] ?? ch).toUpperCase();
}

export function semesterLabel(semesterId: string, t: Translations): string {
  const [year, season] = semesterId.split('-');
  return t.wrappedSemesterLabel(season === 'spring' ? 'spring' : 'fall', Number(year));
}

function Frame({ s, children }: { s: number; children: React.ReactNode }) {
  return <View style={{ width: SLIDE_W * s, height: SLIDE_H * s, overflow: 'hidden' }}>{children}</View>;
}

function Bg({ s, children }: { s: number; children: React.ReactNode }) {
  return (
    <Svg width={SLIDE_W * s} height={SLIDE_H * s} viewBox={`0 0 ${SLIDE_W} ${SLIDE_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      {children}
    </Svg>
  );
}

function Wordmark({ s, color, dot }: { s: number; color: string; dot: string }) {
  return (
    <Text style={{ fontFamily: TitleFont, fontSize: 46 * s, color, letterSpacing: -0.5 * s }}>
      keno<Text style={{ color: dot }}>.</Text>
    </Text>
  );
}

function Kicker({ s, color, children }: { s: number; color: string; children: string }) {
  return <Text style={{ fontFamily: UIFont, fontSize: 20 * s, letterSpacing: 4 * s, color }}>{children}</Text>;
}

/* ─────────────── 1 · Tickets ─────────────── */

export function TicketsSlide({ stats, s, t, dateLocale }: SlideProps) {
  const n = stats.tickets.length;
  const picks = [...new Set([0, Math.floor(n / 2), n - 1])].map((i) => stats.tickets[i]).filter(Boolean);
  const tilts = [-1.6, 1.1, -0.8];

  return (
    <Frame s={s}>
      <Bg s={s}>
        <Defs>
          <RadialGradient id="tkBg" cx="195" cy="-190" r="2100" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#D9683F" />
            <Stop offset="0.38" stopColor="#B8482A" />
            <Stop offset="1" stopColor="#7A2D18" />
          </RadialGradient>
        </Defs>
        <Rect width={SLIDE_W} height={SLIDE_H} fill="url(#tkBg)" />
        <Circle cx="980" cy="60" r="280" fill="#FFFFFF" opacity="0.06" />
      </Bg>

      <View style={{ paddingTop: 150 * s, paddingHorizontal: 88 * s, alignItems: 'center' }}>
        <Wordmark s={s} color={C.paper} dot={C.butter} />
        <View style={{ marginTop: 28 * s }}>
          <Kicker s={s} color="rgba(250,247,242,0.72)">{`WRAPPED · ${upper(semesterLabel(stats.semesterId, t))}`}</Kicker>
        </View>
        <Text style={{ marginTop: 22 * s, fontFamily: TitleFont, fontSize: 92 * s, lineHeight: 98 * s, color: C.paper, textAlign: 'center', letterSpacing: -1.5 * s }}>
          {`${t.wrappedTicketsCount(n)}\n${t.wrappedTicketsSemester}`}
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: 30 * s, paddingHorizontal: 100 * s }}>
        {picks.map((tk, i) => {
          const col = TICKET_COLORS[tk.category];
          const label = categoryLabel(tk.category, t);
          return (
            <View key={tk.eventId} style={{
              transform: [{ rotate: `${tilts[i]}deg` }], borderRadius: 26 * s, backgroundColor: '#FFFFFF',
              shadowColor: '#32140A', shadowOpacity: 0.35, shadowRadius: 20 * s, shadowOffset: { width: 0, height: 20 * s }, elevation: 10,
            }}>
              <View style={{ flexDirection: 'row', borderRadius: 26 * s, overflow: 'hidden', minHeight: 170 * s }}>
                <View style={{ width: 132 * s, backgroundColor: col.bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: TitleFont, fontSize: 56 * s, color: col.fg }}>{upper(label[0])}</Text>
                </View>
                <View style={{ width: 3 * s, alignSelf: 'stretch', justifyContent: 'space-evenly', overflow: 'hidden' }}>
                  {Array.from({ length: 10 }, (_, d) => <View key={d} style={{ height: 8 * s, backgroundColor: '#EADFCF' }} />)}
                </View>
                <View style={{ flex: 1, paddingVertical: 28 * s, paddingHorizontal: 36 * s, justifyContent: 'center', gap: 8 * s }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: UIFont, fontSize: 19 * s, letterSpacing: 1.5 * s, color: '#9A8E7E' }}>{upper(label)}</Text>
                    <Text style={{ fontFamily: TitleFont, fontSize: 22 * s, color: C.terracotta }}>{`No ${String(tk.serial).padStart(3, '0')}`}</Text>
                  </View>
                  <Text numberOfLines={1} style={{ fontFamily: TitleFont, fontSize: 40 * s, color: C.ink }}>{tk.title}</Text>
                  <Text numberOfLines={1} style={{ fontFamily: UIFontLight, fontSize: 20 * s, color: '#8A7F72' }}>
                    {`${format(tk.dateTime, 'EEE · HH:mm', { locale: dateLocale })} · ${areaLabel(tk.location)}`}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <View style={{ paddingHorizontal: 88 * s, paddingBottom: 190 * s, alignItems: 'center', minHeight: 230 * s }}>
        {n > picks.length && (
          <Text style={{ fontFamily: UIFontLight, fontSize: 21 * s, color: 'rgba(250,247,242,0.7)' }}>{t.wrappedTicketsMore(n - picks.length)}</Text>
        )}
      </View>
    </Frame>
  );
}

/* ─────────────── 2 · Semester map ─────────────── */

export function MapSlide({ stats, s, t }: SlideProps) {
  // Stylised projection of the real coordinates into the map box — the
  // shape of where you went, never a precise, readable map.
  const areas = stats.areas.slice(0, 6);
  const lats = areas.map((a) => a.lat);
  const lons = areas.map((a) => a.lon);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const box = { x0: 190, x1: 890, y0: 700, y1: 1300 };
  const pts = areas.map((a) => ({
    ...a,
    x: maxLon === minLon ? 540 : box.x0 + ((a.lon - minLon) / (maxLon - minLon)) * (box.x1 - box.x0),
    y: maxLat === minLat ? 1000 : box.y0 + ((maxLat - a.lat) / (maxLat - minLat)) * (box.y1 - box.y0),
    core: 10 + Math.min(a.count, 5) * 3,
  }));
  const route = [...pts].sort((a, b) => a.firstSeen - b.firstSeen);
  const routeD = route.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
  const gridLines = Array.from({ length: 15 }, (_, i) => i * 135);

  return (
    <Frame s={s}>
      <Bg s={s}>
        <Defs>
          <RadialGradient id="mpGlow" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={C.ember} stopOpacity="0.5" />
            <Stop offset="1" stopColor={C.ember} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width={SLIDE_W} height={SLIDE_H} fill="#1C1812" />
        {gridLines.map((p) => <Line key={`v${p}`} x1={p} y1={0} x2={p} y2={SLIDE_H} stroke="#FFFFFF" strokeOpacity="0.035" strokeWidth="1.5" />)}
        {gridLines.map((p) => <Line key={`h${p}`} x1={0} y1={p} x2={SLIDE_W} y2={p} stroke="#FFFFFF" strokeOpacity="0.035" strokeWidth="1.5" />)}
        <Path d={routeD} fill="none" stroke={C.ember} strokeWidth="3" strokeDasharray="2 14" strokeLinecap="round" opacity="0.7" />
        {pts.map((p) => (
          <React.Fragment key={`${p.lat},${p.lon}`}>
            <Circle cx={p.x} cy={p.y} r={p.core * 5} fill="url(#mpGlow)" />
            <Circle cx={p.x} cy={p.y} r={p.core + 7} fill={C.ember} opacity="0.3" />
            <Circle cx={p.x} cy={p.y} r={p.core} fill={C.paper} />
          </React.Fragment>
        ))}
        <Path d="M0,1500 C200,1560 420,1440 650,1485 C830,1520 960,1470 1080,1500 L1080,1920 L0,1920 Z" fill="#192A3E" />
      </Bg>

      {pts.map((p, i) => (
        <Text key={`l${i}`} numberOfLines={1} style={{
          position: 'absolute', left: (p.x - 160) * s, width: 320 * s, top: (p.y + p.core + 14) * s, textAlign: 'center',
          fontFamily: i === 0 ? UIFont : UIFontLight, fontSize: (i === 0 ? 21 : 19) * s, letterSpacing: 1 * s,
          color: i === 0 ? C.paper : 'rgba(250,247,242,0.6)',
        }}>{p.name}</Text>
      ))}

      <View style={{ paddingTop: 150 * s, paddingHorizontal: 88 * s, alignItems: 'center' }}>
        <Wordmark s={s} color={C.paper} dot={C.ember} />
        <View style={{ marginTop: 28 * s }}><Kicker s={s} color={C.ember}>{t.wrappedMapLabel}</Kicker></View>
        <Text style={{ marginTop: 22 * s, fontFamily: TitleFont, fontSize: 92 * s, lineHeight: 98 * s, color: C.paper, textAlign: 'center', letterSpacing: -1.5 * s }}>
          {t.wrappedMapHeadline}
        </Text>
      </View>

      <View style={{ position: 'absolute', left: 90 * s, right: 90 * s, top: 1580 * s, flexDirection: 'row', gap: 80 * s }}>
        <MapStat s={s} value={String(stats.areas.length)} label={t.wrappedMapAreas} />
        <MapStat s={s} value={String(stats.eventsAttended)} label={t.wrappedMapEvents} />
        <MapStat s={s} value={t.wrappedKm(stats.longestRouteKm)} label={t.wrappedMapRoute} />
      </View>
    </Frame>
  );
}

function MapStat({ s, value, label }: { s: number; value: string; label: string }) {
  return (
    <View>
      <Text style={{ fontFamily: TitleFont, fontSize: 62 * s, color: C.paper }}>{value}</Text>
      <Text style={{ marginTop: 4 * s, fontFamily: UIFontLight, fontSize: 19 * s, color: 'rgba(250,247,242,0.55)' }}>{label}</Text>
    </View>
  );
}

/* ─────────────── 3 · Constellation ─────────────── */

const STARS: [number, number][] = [[130, 345], [918, 230], [994, 1344], [65, 1440], [238, 1766], [842, 1805], [420, 120], [700, 1880], [1020, 760], [40, 900]];
const SAT_COLORS = [C.butter, C.sage, C.blush];

export function ConstellationSlide({ stats, s, t }: SlideProps) {
  // Each event that introduced you to someone becomes a cluster around
  // "you"; each new person is an anonymous dot — never a name or a face.
  const clusters = stats.tickets
    .filter((tk) => tk.newPeopleHere > 0)
    .sort((a, b) => b.newPeopleHere - a.newPeopleHere)
    .slice(0, 6);
  const cx = 540;
  const cy = 1170;
  const k = Math.max(clusters.length, 1);
  const nodes = clusters.map((c, i) => {
    const a = (i / k) * Math.PI * 2;
    const x = cx + Math.sin(a) * 230;
    const y = cy - Math.cos(a) * 230;
    const m = Math.min(c.newPeopleHere, 4);
    const sats = Array.from({ length: m }, (_, j) => {
      const sa = a + (j - (m - 1) / 2) * 0.3;
      return { x: cx + Math.sin(sa) * 340, y: cy - Math.cos(sa) * 340, r: 9 + ((i + j) % 2) * 2, color: SAT_COLORS[(i + j) % 3] };
    });
    return { x, y, r: 24 + Math.min(c.newPeopleHere, 6), sats };
  });

  return (
    <Frame s={s}>
      <Bg s={s}>
        <Defs>
          <RadialGradient id="csBg" cx="540" cy="800" r="1300" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#2E2038" />
            <Stop offset="0.7" stopColor="#1C1420" />
            <Stop offset="1" stopColor="#140D18" />
          </RadialGradient>
        </Defs>
        <Rect width={SLIDE_W} height={SLIDE_H} fill="url(#csBg)" />
        {STARS.map(([x, y]) => <Circle key={`${x},${y}`} cx={x} cy={y} r="2" fill="#FFFFFF" opacity="0.45" />)}
        {nodes.map((n, i) => <Line key={`sp${i}`} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={C.butter} strokeOpacity="0.35" strokeWidth="2" />)}
        {nodes.map((n, i) => n.sats.map((st, j) => (
          <Line key={`st${i}-${j}`} x1={n.x} y1={n.y} x2={st.x} y2={st.y} stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="1.5" />
        )))}
        <Circle cx={cx} cy={cy} r="68" fill={C.terracotta} opacity="0.25" />
        <Circle cx={cx} cy={cy} r="42" fill={C.ember} />
        {nodes.map((n, i) => <Circle key={`n${i}`} cx={n.x} cy={n.y} r={n.r} fill={C.paper} />)}
        {nodes.map((n, i) => n.sats.map((st, j) => <Circle key={`d${i}-${j}`} cx={st.x} cy={st.y} r={st.r} fill={st.color} />))}
      </Bg>

      <Text style={{ position: 'absolute', left: (cx - 60) * s, width: 120 * s, top: (cy - 14) * s, textAlign: 'center', fontFamily: UIFont, fontSize: 22 * s, color: C.paper }}>
        {t.wrappedYou}
      </Text>

      <View style={{ paddingTop: 150 * s, paddingHorizontal: 88 * s, alignItems: 'center' }}>
        <Wordmark s={s} color={C.paper} dot={C.butter} />
        <View style={{ marginTop: 28 * s }}><Kicker s={s} color={C.butter}>{t.wrappedPeopleLabel}</Kicker></View>
        <Text style={{ marginTop: 16 * s, fontFamily: TitleFont, fontSize: 150 * s, lineHeight: 160 * s, color: C.paper }}>{stats.newPeopleMet}</Text>
        <Text style={{ fontFamily: UIFontLight, fontSize: 26 * s, color: 'rgba(250,247,242,0.7)', textAlign: 'center' }}>{t.wrappedPeopleSub}</Text>
      </View>
    </Frame>
  );
}

/* ─────────────── 4 · Receipt ─────────────── */

// Decorative only — a fixed pattern, laid out once.
const BAR_WIDTHS = [3, 1, 2, 1, 3, 2, 1, 1, 4, 1, 2, 3, 1, 2, 1, 3, 1, 1, 2, 4, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 2, 1, 4, 1, 1, 2, 3, 1, 2, 1, 1, 3];
const BARS = BAR_WIDTHS.reduce<{ x: number; w: number }[]>((acc, w, i) => {
  const prev = acc[acc.length - 1];
  const x = prev ? prev.x + prev.w + ((i - 1) % 3 === 0 ? 7 : 5) : 0;
  return [...acc, { x, w: w * 3 }];
}, []);
const BARCODE_W = BARS[BARS.length - 1].x + BARS[BARS.length - 1].w;
const TEETH = Array.from({ length: 26 }, (_, i) => i * 30);

export function ReceiptSlide({ stats, s, t, userName }: SlideProps) {
  const mono = (size: number, color = C.ink, extra = {}) => ({ fontFamily: MONO, fontSize: size * s, color, ...extra });

  return (
    <Frame s={s}>
      <Bg s={s}>
        <Defs>
          <LinearGradient id="rcBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#E7DCC9" />
            <Stop offset="1" stopColor="#CBBC9E" />
          </LinearGradient>
        </Defs>
        <Rect width={SLIDE_W} height={SLIDE_H} fill="url(#rcBg)" />
      </Bg>

      <View style={{ paddingTop: 140 * s, alignItems: 'center' }}>
        <Wordmark s={s} color={C.ink} dot={C.terracotta} />
        <View style={{ marginTop: 24 * s }}><Kicker s={s} color="#5A4F40">{t.wrappedReceiptTitle}</Kicker></View>
      </View>

      <View style={{
        alignSelf: 'center', marginTop: 56 * s, width: 780 * s, transform: [{ rotate: '-0.9deg' }],
        shadowColor: '#1E140A', shadowOpacity: 0.28, shadowRadius: 34 * s, shadowOffset: { width: 0, height: 30 * s }, elevation: 12,
      }}>
        <View style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 64 * s, paddingTop: 60 * s, paddingBottom: 40 * s }}>
          <Text style={mono(17, '#9A8E7E', { textAlign: 'center', letterSpacing: 2 * s })}>{upper(semesterLabel(stats.semesterId, t))}</Text>
          <Text style={mono(16, '#B3A692', { textAlign: 'center', marginTop: 6 * s })}>{userName}</Text>

          <Dashes s={s} />
          {stats.categoryCounts.slice(0, 6).map((c) => (
            <View key={c.category} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 * s }}>
              <Text style={mono(24)}>{categoryLabel(c.category, t)}</Text>
              <Text style={mono(24)}>{`x${c.count}`}</Text>
            </View>
          ))}
          <Dashes s={s} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={mono(27, C.ink, { fontWeight: '700' })}>{t.wrappedReceiptTotal}</Text>
            <Text style={mono(27, C.ink, { fontWeight: '700' })}>{stats.eventsAttended}</Text>
          </View>
          <ReceiptRow s={s} label={t.wrappedReceiptNewPeople} value={stats.newPeopleMet} mono={mono} />
          <ReceiptRow s={s} label={t.wrappedReceiptStreak} value={stats.longestStreak} mono={mono} />
          {stats.eventsCreated > 0 && <ReceiptRow s={s} label={t.wrappedReceiptCreated} value={stats.eventsCreated} mono={mono} />}
          <Dashes s={s} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <Text style={mono(26, C.ink, { fontWeight: '700' })}>{t.wrappedReceiptDue}</Text>
            <Text style={{ fontFamily: TitleFont, fontSize: 44 * s, color: C.terracotta }}>0,00 €</Text>
          </View>
          <Text style={mono(16, '#9A8E7E', { textAlign: 'center', marginTop: 16 * s, fontStyle: 'italic' })}>{t.wrappedReceiptFree}</Text>

          <View style={{ marginTop: 46 * s, alignItems: 'center', gap: 14 * s }}>
            <Svg width={BARCODE_W * s} height={64 * s} viewBox={`0 0 ${BARCODE_W} 64`}>
              {BARS.map((b, i) => <Rect key={i} x={b.x} y={0} width={b.w} height={64} fill={C.ink} />)}
            </Svg>
            <Text style={mono(14, '#B3A692', { letterSpacing: 2 * s })}>{t.wrappedReceiptThanks}</Text>
          </View>
        </View>
        <Svg width={780 * s} height={22 * s} viewBox="0 0 780 22" preserveAspectRatio="none">
          <Path d={`M0 0 ${TEETH.map((tx) => `L${tx + 15} 22 L${tx + 30} 0`).join(' ')} Z`} fill="#FFFFFF" />
        </Svg>
      </View>
    </Frame>
  );
}

// Receipt is 780 wide with 64 padding each side → 652 of usable width.
function Dashes({ s }: { s: number }) {
  return (
    <Svg width={652 * s} height={4 * s} viewBox="0 0 652 4" style={{ marginVertical: 30 * s }}>
      <Line x1="0" y1="2" x2="652" y2="2" stroke="#DCD3C2" strokeWidth="2" strokeDasharray="8 7" />
    </Svg>
  );
}

function ReceiptRow({ s, label, value, mono }: { s: number; label: string; value: number; mono: (size: number, color?: string, extra?: object) => object }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 * s }}>
      <Text style={mono(20, '#8A7F6E')}>{label}</Text>
      <Text style={mono(20, '#8A7F6E')}>{value}</Text>
    </View>
  );
}

/* ─────────────── 5 · Persona ─────────────── */

const TRAIT_ICONS: Record<WrappedTraitId, IconName> = {
  reliable: 'clock', withFriends: 'users', organizes: 'edit', meetsPeople: 'user', topCategory: 'star',
};

export function PersonaSlide({ stats, s, t }: SlideProps) {
  const title = t.wrappedPersonaTitle(stats.persona.id, stats.persona.weekday, stats.persona.category);
  const topLabel = stats.topCategory ? categoryLabel(stats.topCategory, t) : '';
  const badge = stats.longestStreak > 0
    ? { value: stats.longestStreak, label: t.wrappedWeeksStreak }
    : { value: stats.eventsAttended, label: t.wrappedCheckins };

  return (
    <Frame s={s}>
      <Bg s={s}>
        <Defs>
          <LinearGradient id="psBg" x1="0" y1="0" x2="0.35" y2="1">
            <Stop offset="0" stopColor="#F6D492" />
            <Stop offset="0.46" stopColor="#F2C879" />
            <Stop offset="1" stopColor="#E0AD54" />
          </LinearGradient>
          <Pattern id="psDots" width="46" height="46" patternUnits="userSpaceOnUse">
            <Circle cx="23" cy="23" r="2.5" fill="#7A5A12" opacity="0.12" />
          </Pattern>
        </Defs>
        <Rect width={SLIDE_W} height={SLIDE_H} fill="url(#psBg)" />
        <Rect width={SLIDE_W} height={SLIDE_H} fill="url(#psDots)" />
        <Circle cx="100" cy="100" r="260" fill="#FFFFFF" opacity="0.18" />
      </Bg>

      <View style={{ paddingTop: 150 * s, paddingHorizontal: 90 * s }}>
        <Wordmark s={s} color={C.ink} dot={C.terracotta} />
        <Text style={{ marginTop: 70 * s, fontFamily: UIFont, fontSize: 24 * s, color: '#7A5A12' }}>{t.wrappedPersonaIntro}</Text>
        <Text style={{ marginTop: 14 * s, fontFamily: TitleFont, fontSize: 92 * s, lineHeight: 100 * s, color: C.ink, letterSpacing: -1.5 * s }}>{title}</Text>
        <Svg width={260 * s} height={24 * s} viewBox="0 0 260 24" style={{ marginTop: 12 * s }}>
          <Path d="M4 16 C 60 4, 120 22, 180 10 S 250 6, 256 14" stroke={C.terracotta} strokeWidth="5" fill="none" strokeLinecap="round" />
        </Svg>

        <View style={{ marginTop: 64 * s, gap: 22 * s, alignItems: 'flex-start' }}>
          {stats.traits.map((id) => {
            const dark = id === 'topCategory';
            return (
              <View key={id} style={{
                flexDirection: 'row', alignItems: 'center', gap: 14 * s, borderRadius: 999, borderWidth: 2.5 * s, borderColor: C.ink,
                backgroundColor: dark ? C.ink : C.paper, paddingVertical: 18 * s, paddingHorizontal: 32 * s,
              }}>
                <Icon name={TRAIT_ICONS[id]} size={26 * s} color={dark ? C.butter : C.ink} filled={dark} strokeWidth={2.2} />
                <Text style={{ fontFamily: UIFont, fontSize: 26 * s, color: dark ? C.paper : C.ink }}>{t.wrappedTrait(id, topLabel)}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{
        position: 'absolute', right: 90 * s, bottom: 200 * s, width: 280 * s, height: 280 * s, borderRadius: 140 * s,
        backgroundColor: C.terracotta, alignItems: 'center', justifyContent: 'center',
        shadowColor: '#783714', shadowOpacity: 0.35, shadowRadius: 24 * s, shadowOffset: { width: 0, height: 24 * s }, elevation: 10,
      }}>
        <Text style={{ fontFamily: TitleFont, fontSize: 96 * s, lineHeight: 104 * s, color: C.paper }}>{badge.value}</Text>
        <Text style={{ fontFamily: UIFont, fontSize: 19 * s, color: C.paper, textAlign: 'center', maxWidth: 200 * s }}>{badge.label}</Text>
      </View>
    </Frame>
  );
}

/* ─────────────── 6 · Weeks grid ─────────────── */

function weekColor(count: number, isPeak: boolean): string {
  if (isPeak) return C.butter;
  if (count === 0) return '#2A1E16';
  if (count === 1) return '#6E3A24';
  if (count === 2) return C.terracotta;
  if (count === 3) return C.ember;
  return '#E07F50';
}

export function WeeksSlide({ stats, s, t }: SlideProps) {
  const max = Math.max(...stats.weeks);
  const peak = max >= 2 ? stats.weeks.indexOf(max) : -1;
  const cellW = (SLIDE_W - 2 * 88 - 5 * 16) / 6;
  const rows = Math.ceil(stats.weeks.length / 6);
  const cellH = Math.min(112, (620 - (rows - 1) * 16) / rows);

  return (
    <Frame s={s}>
      <Bg s={s}>
        <Defs>
          <RadialGradient id="wkBg" cx="540" cy="0" r="1500" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#2A2019" />
            <Stop offset="0.55" stopColor="#1C1510" />
            <Stop offset="1" stopColor="#140F0B" />
          </RadialGradient>
          <LinearGradient id="wkLegend" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#2A1E16" />
            <Stop offset="0.3" stopColor="#6E3A24" />
            <Stop offset="0.55" stopColor={C.terracotta} />
            <Stop offset="0.8" stopColor="#E07F50" />
            <Stop offset="1" stopColor={C.butter} />
          </LinearGradient>
        </Defs>
        <Rect width={SLIDE_W} height={SLIDE_H} fill="url(#wkBg)" />
      </Bg>

      <View style={{ paddingTop: 140 * s, paddingHorizontal: 88 * s }}>
        <Wordmark s={s} color={C.paper} dot={C.ember} />
        <View style={{ marginTop: 28 * s }}><Kicker s={s} color={C.ember}>{t.wrappedWeeksLabel}</Kicker></View>
        <Text style={{ marginTop: 16 * s, fontFamily: TitleFont, fontSize: 80 * s, lineHeight: 88 * s, color: C.paper, letterSpacing: -1 * s }}>{t.wrappedWeeksHeadline}</Text>
      </View>

      <View style={{ marginTop: 60 * s, paddingHorizontal: 88 * s, flexDirection: 'row', flexWrap: 'wrap', gap: 16 * s }}>
        {stats.weeks.map((count, i) => (
          <View key={i} style={{
            width: cellW * s, height: cellH * s, borderRadius: 18 * s, padding: 12 * s, justifyContent: 'flex-end',
            backgroundColor: weekColor(count, i === peak),
            borderWidth: count === 0 ? 2 * s : 0, borderStyle: 'dashed', borderColor: 'rgba(250,247,242,0.18)',
          }}>
            <Text style={{ fontFamily: i === peak ? UIFont : UIFontLight, fontSize: 16 * s, color: i === peak ? '#7A5A12' : 'rgba(250,247,242,0.5)' }}>{i + 1}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 40 * s, paddingHorizontal: 88 * s, flexDirection: 'row', alignItems: 'center', gap: 16 * s }}>
        <Svg width={480 * s} height={14 * s} viewBox="0 0 480 14">
          <Rect width="480" height="14" rx="7" fill="url(#wkLegend)" />
        </Svg>
        <Text style={{ fontFamily: UIFontLight, fontSize: 17 * s, color: 'rgba(250,247,242,0.45)' }}>{t.wrappedWeeksLegend}</Text>
      </View>

      <View style={{ position: 'absolute', left: 88 * s, right: 88 * s, bottom: 190 * s, flexDirection: 'row', gap: 110 * s }}>
        <View>
          <Text style={{ fontFamily: TitleFont, fontSize: 92 * s, lineHeight: 100 * s, color: C.paper }}>{stats.longestStreak}</Text>
          <Text style={{ marginTop: 10 * s, fontFamily: UIFontLight, fontSize: 20 * s, color: 'rgba(250,247,242,0.55)' }}>{t.wrappedWeeksStreak}</Text>
        </View>
        <View>
          <Text style={{ fontFamily: TitleFont, fontSize: 92 * s, lineHeight: 100 * s, color: C.paper }}>{stats.freezeTokens}</Text>
          <Text style={{ marginTop: 10 * s, fontFamily: UIFontLight, fontSize: 20 * s, color: 'rgba(250,247,242,0.55)' }}>{t.wrappedWeeksFreeze}</Text>
        </View>
      </View>
    </Frame>
  );
}

export const SLIDE_COMPONENTS: Record<SlideKey, (p: SlideProps) => React.ReactElement> = {
  tickets: TicketsSlide,
  map: MapSlide,
  people: ConstellationSlide,
  receipt: ReceiptSlide,
  persona: PersonaSlide,
  weeks: WeeksSlide,
};
