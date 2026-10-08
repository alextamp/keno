import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/core/theme';

import { EventCategory } from '@/features/events/domain/entities/event.entity';

// Warm Paper duotone illustration scenes — ported from design/screens.html
// sc-* symbols. Used wherever an event/group has no photo: feed cards, hero
// headers, thumbs. Two fixed brand tones (duoA background / duoB shapes),
// NOT category colors — categories only ever appear as dots/tints per spec.

export type SceneName =
  | 'volley' | 'coffee' | 'hike' | 'party' | 'study' | 'food' | 'music' | 'cinema' | 'gym';

const DUO_LIGHT = { a: '#F3E3CF', b: '#8A4026' };
const DUO_DARK = { a: '#B4714A', b: '#22120A' };

export const CATEGORY_SCENES: Record<EventCategory, SceneName> = {
  [EventCategory.Sports]: 'volley',
  [EventCategory.Party]: 'party',
  [EventCategory.Study]: 'study',
  [EventCategory.Coffee]: 'coffee',
  [EventCategory.Chill]: 'hike',
  [EventCategory.Other]: 'music',
};

interface DuotoneSceneProps {
  scene?: SceneName;
  /** Convenience: derive the scene from an event category. */
  category?: EventCategory;
  height?: number;
  style?: ViewStyle;
}

export function DuotoneScene({ scene, category, height = 132, style }: DuotoneSceneProps) {
  const { isDark } = useTheme();
  const duo = isDark ? DUO_DARK : DUO_LIGHT;
  const name: SceneName = scene ?? (category != null ? CATEGORY_SCENES[category] : 'coffee');
  return (
    <View style={[{ height, backgroundColor: duo.a, overflow: 'hidden' }, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 300 160" preserveAspectRatio="xMidYMid slice">
        <G fill={duo.b}>{SCENES[name](duo.b)}</G>
      </Svg>
    </View>
  );
}

// Shapes are verbatim from the mockup's <symbol> defs. react-native-svg has no
// currentColor, so each scene takes the ink tone for its stroked shapes.
const SCENES: Record<SceneName, (ink: string) => React.ReactNode> = {
  volley: (ink) => (
    <>
      <Circle cx={240} cy={42} r={22} opacity={0.26} />
      <Path d="M0 112h300v48H0z" opacity={0.16} />
      <Path d="M0 112c40-10 74 6 112 2s62-17 96-13 62 15 92 11v48H0z" opacity={0.27} />
      <Rect x={50} y={48} width={3} height={66} opacity={0.62} />
      <Rect x={214} y={48} width={3} height={66} opacity={0.62} />
      <Rect x={50} y={48} width={167} height={3} opacity={0.62} />
      <G opacity={0.48}>
        <Rect x={50} y={59} width={167} height={1.6} />
        <Rect x={50} y={70} width={167} height={1.6} />
        <Rect x={50} y={81} width={167} height={1.6} />
      </G>
      <Circle cx={150} cy={30} r={10} opacity={0.7} />
      <G opacity={0.8}>
        <Circle cx={94} cy={80} r={7} />
        <Path d="M87 91c0-4 3-6 7-6s7 2 7 6v14h-4l-1 11h-4l-1-11h-4z" />
        <Circle cx={178} cy={72} r={7} />
        <Path d="M171 83c0-4 3-6 7-6s7 2 7 6v12l6 8-3 2-6-7-1 16h-4l-1-12-1 12h-4z" />
      </G>
    </>
  ),
  coffee: (ink) => (
    <>
      <Rect x={0} y={120} width={300} height={40} opacity={0.18} />
      <Rect x={30} y={16} width={90} height={70} rx={4} opacity={0.14} />
      <Rect x={180} y={16} width={90} height={70} rx={4} opacity={0.14} />
      <Path d="M96 74h58v28a14 14 0 0 1-14 14h-30a14 14 0 0 1-14-14z" opacity={0.72} />
      <Path d="M154 80h12a11 11 0 0 1 0 22h-12z" opacity={0.45} />
      <Ellipse cx={125} cy={120} rx={46} ry={5} opacity={0.3} />
      <G opacity={0.4}>
        <Rect x={112} y={46} width={4} height={18} rx={2} />
        <Rect x={126} y={40} width={4} height={24} rx={2} />
        <Rect x={140} y={48} width={4} height={16} rx={2} />
      </G>
      <Path d="M188 92h34v24h-34z" opacity={0.5} />
      <Ellipse cx={205} cy={120} rx={24} ry={4} opacity={0.3} />
    </>
  ),
  hike: (ink) => (
    <>
      <Circle cx={242} cy={36} r={19} opacity={0.26} />
      <Path d="M0 104 62 40l46 54 34-30 66 66 92-40v70H0z" opacity={0.62} />
      <Path d="M0 128l70-42 58 42 62-28 110 44v16H0z" opacity={0.34} />
      <G opacity={0.85}>
        <Circle cx={118} cy={76} r={5} />
        <Path d="M113 84c0-3 2.2-4.4 5-4.4s5 1.4 5 4.4v10h-3l-.6 9h-2.8l-.6-9h-3z" />
        <Circle cx={136} cy={82} r={5} />
        <Path d="M131 90c0-3 2.2-4.4 5-4.4s5 1.4 5 4.4v10h-3l-.6 9h-2.8l-.6-9h-3z" />
      </G>
    </>
  ),
  party: (ink) => (
    <>
      <Path d="M0 26q75 30 150 0t150 0" fill="none" stroke={ink} strokeWidth={1.6} opacity={0.35} />
      <G opacity={0.55}>
        <Circle cx={40} cy={36} r={4} />
        <Circle cx={86} cy={41} r={4} />
        <Circle cx={132} cy={39} r={4} />
        <Circle cx={178} cy={34} r={4} />
        <Circle cx={224} cy={29} r={4} />
        <Circle cx={266} cy={28} r={4} />
      </G>
      <Circle cx={150} cy={62} r={17} opacity={0.28} />
      <G opacity={0.72}>
        <Circle cx={34} cy={100} r={8} />
        <Circle cx={76} cy={94} r={8} />
        <Circle cx={120} cy={102} r={8} />
        <Circle cx={164} cy={96} r={8} />
        <Circle cx={208} cy={103} r={8} />
        <Circle cx={252} cy={97} r={8} />
        <Path d="M20 160v-42a14 14 0 0 1 28 0v42zM62 160v-46a14 14 0 0 1 28 0v46zM106 160v-40a14 14 0 0 1 28 0v40zM150 160v-46a14 14 0 0 1 28 0v46zM194 160v-39a14 14 0 0 1 28 0v39zM238 160v-45a14 14 0 0 1 28 0v45z" />
      </G>
    </>
  ),
  study: (ink) => (
    <>
      <Rect x={0} y={118} width={300} height={42} opacity={0.2} />
      <Path d="M96 70h108v46H96z" opacity={0.62} />
      <Path d="M84 116h132v6H84z" opacity={0.75} />
      <Rect x={30} y={96} width={44} height={7} rx={2} opacity={0.5} />
      <Rect x={34} y={86} width={40} height={7} rx={2} opacity={0.38} />
      <Rect x={28} y={76} width={46} height={7} rx={2} opacity={0.46} />
      <Path d="M236 116V72a14 14 0 0 1 28 0" fill="none" stroke={ink} strokeWidth={4} opacity={0.45} />
      <Circle cx={250} cy={60} r={12} opacity={0.34} />
      <G opacity={0.28}>
        <Rect x={108} y={80} width={60} height={4} rx={2} />
        <Rect x={108} y={90} width={84} height={4} rx={2} />
        <Rect x={108} y={100} width={44} height={4} rx={2} />
      </G>
    </>
  ),
  food: (ink) => (
    <>
      <Rect x={0} y={104} width={300} height={56} opacity={0.2} />
      <Circle cx={112} cy={80} r={38} opacity={0.55} />
      <Circle cx={112} cy={80} r={24} opacity={0.3} />
      <Circle cx={216} cy={92} r={24} opacity={0.45} />
      <Circle cx={216} cy={92} r={14} opacity={0.26} />
      <G opacity={0.5}>
        <Rect x={166} y={56} width={4} height={46} rx={2} />
        <Rect x={256} y={56} width={4} height={46} rx={2} />
        <Path d="M250 56v16h16V56" fill="none" stroke={ink} strokeWidth={3} />
      </G>
      <Path d="M44 62h22v26a11 11 0 0 1-22 0z" opacity={0.5} />
    </>
  ),
  music: (ink) => (
    <>
      <Path d="M110 0 60 74h180L190 0z" opacity={0.14} />
      <Rect x={70} y={66} width={160} height={26} rx={3} opacity={0.5} />
      <Rect x={42} y={52} width={24} height={46} rx={3} opacity={0.45} />
      <Rect x={234} y={52} width={24} height={46} rx={3} opacity={0.45} />
      <G opacity={0.78}>
        <Circle cx={150} cy={56} r={9} />
        <Path d="M141 92V72a9 9 0 0 1 18 0v20z" />
        <G opacity={0.9}>
          <Circle cx={46} cy={112} r={8} />
          <Circle cx={92} cy={106} r={8} />
          <Circle cx={140} cy={114} r={8} />
          <Circle cx={188} cy={106} r={8} />
          <Circle cx={238} cy={113} r={8} />
          <Path d="M32 160v-32a14 14 0 0 1 28 0v32zM78 160v-38a14 14 0 0 1 28 0v38zM126 160v-30a14 14 0 0 1 28 0v30zM174 160v-38a14 14 0 0 1 28 0v38zM224 160v-31a14 14 0 0 1 28 0v31z" />
          <Path d="M28 132l-8-20 5-2 8 20zM254 130l8-20 5 2-8 20z" />
        </G>
      </G>
    </>
  ),
  cinema: (ink) => (
    <>
      <Rect x={34} y={14} width={232} height={74} rx={3} opacity={0.5} />
      <Rect x={46} y={24} width={208} height={54} rx={2} opacity={0.22} />
      <G opacity={0.72}>
        <Circle cx={46} cy={122} r={9} />
        <Circle cx={98} cy={118} r={9} />
        <Circle cx={150} cy={124} r={9} />
        <Circle cx={202} cy={118} r={9} />
        <Circle cx={254} cy={122} r={9} />
        <Path d="M30 160v-26a16 16 0 0 1 32 0v26zM82 160v-30a16 16 0 0 1 32 0v30zM134 160v-24a16 16 0 0 1 32 0v24zM186 160v-30a16 16 0 0 1 32 0v30zM238 160v-26a16 16 0 0 1 32 0v26z" />
      </G>
    </>
  ),
  gym: (ink) => (
    <>
      <Rect x={0} y={122} width={300} height={38} opacity={0.2} />
      <Rect x={70} y={72} width={160} height={9} rx={4} opacity={0.6} />
      <Rect x={46} y={56} width={20} height={42} rx={5} opacity={0.7} />
      <Rect x={234} y={56} width={20} height={42} rx={5} opacity={0.7} />
      <Rect x={24} y={64} width={18} height={26} rx={5} opacity={0.5} />
      <Rect x={258} y={64} width={18} height={26} rx={5} opacity={0.5} />
      <G opacity={0.72}>
        <Circle cx={150} cy={104} r={9} />
        <Path d="M136 160v-32a14 14 0 0 1 28 0v32z" />
      </G>
    </>
  ),
};
