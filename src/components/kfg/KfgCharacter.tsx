import React from 'react';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '@/core/theme';
import { KfgSlot } from '@/core/constants/kfg';

// The Keno for Good character: a base body plus one optional item per slot
// (head, face, neck), drawn in the same 1.6px line style as the icon set.
// Placeholder art — every item is its own <G>, so final illustrations can
// replace them one at a time without touching callers. Colors come from the
// theme, so inside the KfG accent scope the accents are green.

export type KfgEquipped = Partial<Record<KfgSlot, string | null>>;

const STROKE = 1.6;

export function KfgCharacter({ size = 96, equipped = {}, character = 'classic' }: {
  size?: number; equipped?: KfgEquipped; character?: string;
}) {
  const { colors } = useTheme();
  const ink = colors.textPrimary;
  const accent = colors.primary;
  const soft = colors.accentSoft;
  const line = { stroke: ink, strokeWidth: STROKE, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const fur = colors.categoryCoffee;
  const pink = colors.categoryChill;
  const animal = character !== 'classic';
  const grin = equipped.face === 'hero_grin';

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      {/* Body */}
      <Path d="M18 60 C18 46 24 41 32 41 C40 41 46 46 46 60" fill={soft} {...line} />

      {/* Ears sit behind the head, so hats still cover their base */}
      {character === 'bunny' && (
        <G>
          <Path d="M24 15 C21.5 9 22.5 2.5 26 2.8 C29.5 3.2 30 9 28.5 14" fill={colors.surface} {...line} />
          <Path d="M35.5 14 C34 9 34.5 3.2 38 2.8 C41.5 2.5 42.5 9 40 15" fill={colors.surface} {...line} />
          <Path d="M25.5 12 C24.8 8.5 25.2 5.5 26.4 5.5 C27.6 5.8 27.6 8.5 27 12" fill={pink} opacity={0.35} />
          <Path d="M37 12 C36.4 8.5 36.4 5.8 37.6 5.5 C38.8 5.5 39.2 8.5 38.5 12" fill={pink} opacity={0.35} />
        </G>
      )}
      {(character === 'kitty' || character === 'fox') && (
        <G>
          <Path d={character === 'fox' ? 'M20 21 L20.5 6 L30 14 Z' : 'M21 20 L22.5 9 L29.5 14.5 Z'} fill={character === 'fox' ? fur : colors.surface} {...line} />
          <Path d={character === 'fox' ? 'M44 21 L43.5 6 L34 14 Z' : 'M43 20 L41.5 9 L34.5 14.5 Z'} fill={character === 'fox' ? fur : colors.surface} {...line} />
          {character === 'kitty' && <Path d="M23 17 L23.6 12.5 L27 15 Z M41 17 L40.4 12.5 L37 15 Z" fill={pink} opacity={0.4} />}
          {character === 'fox' && <Path d="M20.4 9 L20.5 6 L23 8 Z M43.6 9 L43.5 6 L41 8 Z" fill={ink} />}
        </G>
      )}
      {character === 'bear' && (
        <G>
          <Circle cx={22} cy={15.5} r={4.2} fill={fur} {...line} />
          <Circle cx={42} cy={15.5} r={4.2} fill={fur} {...line} />
          <Circle cx={22} cy={15.5} r={1.8} fill={soft} />
          <Circle cx={42} cy={15.5} r={1.8} fill={soft} />
        </G>
      )}
      {character === 'pup' && (
        <G>
          <Path d="M21.5 16 C14 16.5 13 29 18 33 C21 31.5 22.5 22 21.5 16 Z" fill={fur} {...line} />
          <Path d="M42.5 16 C50 16.5 51 29 46 33 C43 31.5 41.5 22 42.5 16 Z" fill={fur} {...line} />
        </G>
      )}

      {/* Head */}
      <Circle cx={32} cy={26} r={13} fill={colors.surface} {...line} />
      {(character === 'bear' || character === 'fox' || character === 'pup') && (
        <Circle cx={32} cy={26} r={12.2} fill={fur} opacity={character === 'pup' ? 0.18 : 0.35} />
      )}
      {character === 'fox' && <Path d="M21 28 Q26 26 32 33 Q38 26 43 28 Q40 37 32 38.5 Q24 37 21 28 Z" fill={colors.surface} />}
      {(character === 'bear' || character === 'pup') && (
        <Ellipse cx={32} cy={31} rx={5.2} ry={3.8} fill={colors.surface} {...line} />
      )}

      {/* Face (hero_grin replaces eyes and mouth) */}
      {!grin && (
        <G>
          <Circle cx={27.5} cy={25} r={1.3} fill={ink} />
          <Circle cx={36.5} cy={25} r={1.3} fill={ink} />
          {animal
            ? <Path d="M30 32 Q32 33.8 34 32" fill="none" {...line} />
            : <Path d="M28.5 30.5 Q32 33 35.5 30.5" fill="none" {...line} />}
        </G>
      )}
      {animal && (
        <Ellipse
          cx={32}
          cy={29.6}
          rx={1.6}
          ry={1.1}
          fill={character === 'kitty' || character === 'bunny' ? pink : ink}
        />
      )}
      {(character === 'kitty' || character === 'fox') && (
        <Path d="M25.5 30 L19 29 M25.5 31.5 L19.5 32.5 M38.5 30 L45 29 M38.5 31.5 L44.5 32.5" stroke={ink} strokeWidth={0.9} strokeLinecap="round" />
      )}

      {equipped.face === 'hero_grin' && (
        <G>
          <Path d="M26 25 Q27.5 23.5 29 25" fill="none" {...line} />
          <Path d="M35 25 Q36.5 23.5 38 25" fill="none" {...line} />
          <Path d="M27 29.5 Q32 35 37 29.5 Z" fill={ink} {...line} />
          <Circle cx={24.5} cy={29} r={1.8} fill={accent} opacity={0.35} />
          <Circle cx={39.5} cy={29} r={1.8} fill={accent} opacity={0.35} />
        </G>
      )}
      {equipped.face === 'glasses_round' && (
        <G>
          <Circle cx={27.5} cy={25} r={3.6} fill="none" {...line} />
          <Circle cx={36.5} cy={25} r={3.6} fill="none" {...line} />
          <Line x1={31.1} y1={25} x2={32.9} y2={25} {...line} />
        </G>
      )}
      {equipped.face === 'sunglasses' && (
        <G>
          <Rect x={23} y={22.5} width={8} height={5} rx={2} fill={ink} {...line} />
          <Rect x={33} y={22.5} width={8} height={5} rx={2} fill={ink} {...line} />
          <Line x1={31} y1={24.5} x2={33} y2={24.5} {...line} />
        </G>
      )}

      {/* Head slot */}
      {equipped.head === 'cap_green' && (
        <G>
          <Path d="M19.5 20 C20 11 44 11 44.5 20 Z" fill={accent} {...line} />
          <Path d="M44.5 20 L51 20.5" {...line} />
        </G>
      )}
      {equipped.head === 'beanie' && (
        <G>
          <Path d="M20 19 C20 8 44 8 44 19 Z" fill={soft} {...line} />
          <Rect x={19} y={17.5} width={26} height={4} rx={2} fill={accent} {...line} />
          <Circle cx={32} cy={8.5} r={2.2} fill={accent} {...line} />
        </G>
      )}
      {equipped.head === 'sunhat' && (
        <G>
          <Ellipse cx={32} cy={17.5} rx={20} ry={3.2} fill={colors.categoryCoffee} opacity={0.35} {...line} />
          <Path d="M23 17 C23 9 41 9 41 17" fill={colors.surface} {...line} />
          <Path d="M23.5 15 L40.5 15" stroke={accent} strokeWidth={2} />
        </G>
      )}

      {/* Neck slot */}
      {equipped.neck === 'scarf' && (
        <G>
          <Path d="M23 41 Q32 46 41 41 L41 44.5 Q32 49.5 23 44.5 Z" fill={accent} {...line} />
          <Path d="M36 46 L37.5 54 L33.5 53 Z" fill={accent} {...line} />
        </G>
      )}
      {equipped.neck === 'whistle' && (
        <G>
          <Path d="M25 41 Q32 51 39 41" fill="none" {...line} />
          <Rect x={29} y={48} width={6} height={4} rx={1.5} fill={accent} {...line} />
        </G>
      )}
      {equipped.neck === 'medal_top100' && (
        <G>
          <Path d="M27 41 L31 50 M37 41 L33 50" {...line} stroke={accent} />
          <Circle cx={32} cy={52.5} r={4} fill={colors.categoryCoffee} {...line} />
          <Path d="M32 50.5 L32.8 52.1 L34.5 52.3 L33.2 53.4 L33.6 55 L32 54.2 L30.4 55 L30.8 53.4 L29.5 52.3 L31.2 52.1 Z" fill={colors.surface} />
        </G>
      )}
    </Svg>
  );
}
