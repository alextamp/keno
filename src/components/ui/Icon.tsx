import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

// Warm Paper line-icon set — ported 1:1 from design/screens.html symbol
// library. 24×24 grid, 1.6px stroke, round caps/joins. Single source of
// truth for every UI-chrome icon in the app (spec rule 2: no emoji icons).

export type IconName =
  | 'home' | 'search' | 'plus' | 'trophy' | 'user' | 'bell' | 'chat' | 'send'
  | 'camera' | 'cal' | 'pin' | 'users' | 'bookmark' | 'back' | 'fwd' | 'clock'
  | 'flame' | 'star' | 'gift' | 'filter' | 'qr' | 'settings' | 'share' | 'check'
  | 'x' | 'shield' | 'image' | 'lock' | 'more' | 'map' | 'heart' | 'ticket'
  | 'zap' | 'edit' | 'eye' | 'eye-off' | 'mail' | 'flag' | 'snow' | 'trash'
  | 'logout' | 'globe' | 'moon' | 'sun' | 'alert' | 'doc' | 'crown' | 'coffee';

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  /** Fill the shape with `color` instead of stroking it (bookmark/heart/star saved states). */
  filled?: boolean;
  strokeWidth?: number;
}

export function Icon({ name, size = 19, color, filled = false, strokeWidth = 1.6 }: IconProps) {
  const s = {
    stroke: filled ? 'none' : color,
    fill: filled ? color : 'none',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {renderPaths(name, s, color)}
    </Svg>
  );
}

type S = {
  stroke: string; fill: string; strokeWidth: number;
  strokeLinecap: 'round'; strokeLinejoin: 'round';
};

function renderPaths(name: IconName, s: S, color: string): React.ReactNode {
  switch (name) {
    case 'home':
      return <Path {...s} d="M3 11.2 12 3l9 8.2M5.4 10.2V20h13.2v-9.8" />;
    case 'search':
      return (<>
        <Circle {...s} cx={11} cy={11} r={7} />
        <Path {...s} d="M20 20l-4.2-4.2" />
      </>);
    case 'plus':
      return <Path {...s} d="M12 5v14M5 12h14" />;
    case 'trophy':
      return <Path {...s} d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13.5V17M8.5 20h7" />;
    case 'user':
      return (<>
        <Circle {...s} cx={12} cy={8} r={4} />
        <Path {...s} d="M4.5 20c0-4.1 3.4-6.5 7.5-6.5s7.5 2.4 7.5 6.5" />
      </>);
    case 'bell':
      return <Path {...s} d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />;
    case 'chat':
      return <Path {...s} d="M4 5h16v11H9l-5 4z" />;
    case 'send':
      return <Path {...s} d="M21.5 2.5 10.5 13.5M21.5 2.5l-7 19-4-8.5-8.5-4z" />;
    case 'camera':
      return (<>
        <Path {...s} d="M4 7.5h3.2L8.7 5.2h6.6l1.5 2.3H20v11H4z" />
        <Circle {...s} cx={12} cy={13} r={3.4} />
      </>);
    case 'cal':
      return (<>
        <Rect {...s} x={3} y={5} width={18} height={16} rx={2.4} />
        <Path {...s} d="M3 10h18M8 3v4M16 3v4" />
      </>);
    case 'pin':
      return (<>
        <Path {...s} d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
        <Circle {...s} cx={12} cy={10} r={2.6} />
      </>);
    case 'users':
      return (<>
        <Circle {...s} cx={9} cy={8} r={3.6} />
        <Path {...s} d="M2.5 20c0-3.6 2.9-5.8 6.5-5.8s6.5 2.2 6.5 5.8M16.5 5.2a3.6 3.6 0 0 1 0 6.6M17.5 14.6c2.5.5 4 2.5 4 5.4" />
      </>);
    case 'bookmark':
      return <Path {...s} d="M6 3h12v18l-6-4.5L6 21z" />;
    case 'back':
      return <Path {...s} d="M15 5l-7 7 7 7" />;
    case 'fwd':
      return <Path {...s} d="M9 5l7 7-7 7" />;
    case 'clock':
      return (<>
        <Circle {...s} cx={12} cy={12} r={9} />
        <Path {...s} d="M12 7v5.2l3.4 2" />
      </>);
    case 'flame':
      return <Path {...s} d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-2.4 1.4-4 2.5-5.2.3 1.4 1 2.2 2 2.7C12.2 7.4 12 5 12 3z" />;
    case 'star':
      return <Path {...s} d="M12 3.5l2.7 5.6 6.1.8-4.4 4.3 1.1 6.1-5.5-3-5.5 3 1.1-6.1L3.2 9.9l6.1-.8z" />;
    case 'gift':
      return (<>
        <Rect {...s} x={3} y={8} width={18} height={4} rx={1} />
        <Path {...s} d="M5 12v9h14v-9M12 8v13M12 8C10 8 7.5 7.5 7.5 5.8A2.3 2.3 0 0 1 12 5.2M12 8c2 0 4.5-.5 4.5-2.2A2.3 2.3 0 0 0 12 5.2" />
      </>);
    case 'filter':
      return <Path {...s} d="M4 6h16M7 12h10M10 18h4" />;
    case 'qr':
      return <Path {...s} d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z" />;
    case 'settings':
      return (<>
        <Path {...s} d="M4 7h8M17 7h3M4 12h3M12 12h8M4 17h8M17 17h3" />
        <Circle {...s} cx={14.5} cy={7} r={2.1} />
        <Circle {...s} cx={9.5} cy={12} r={2.1} />
        <Circle {...s} cx={14.5} cy={17} r={2.1} />
      </>);
    case 'share':
      return (<>
        <Circle {...s} cx={6} cy={12} r={2.6} />
        <Circle {...s} cx={17} cy={6} r={2.6} />
        <Circle {...s} cx={17} cy={18} r={2.6} />
        <Path {...s} d="M8.3 10.8 14.7 7.4M8.3 13.2l6.4 3.4" />
      </>);
    case 'check':
      return <Path {...s} d="M20 6 9 17l-5-5" />;
    case 'x':
      return <Path {...s} d="M6 6l12 12M18 6 6 18" />;
    case 'shield':
      return (<>
        <Path {...s} d="M12 3 4 6.5v5c0 5 3.4 8.6 8 9.5 4.6-.9 8-4.5 8-9.5v-5z" />
        <Path {...s} d="M9 12l2 2 4-4" />
      </>);
    case 'image':
      return (<>
        <Rect {...s} x={3} y={5} width={18} height={14} rx={2.2} />
        <Circle {...s} cx={8.5} cy={10} r={1.7} />
        <Path {...s} d="M5 17.5l5-5 4 4 2.5-2.5 3.5 3.5" />
      </>);
    case 'lock':
      return (<>
        <Rect {...s} x={5} y={11} width={14} height={9} rx={2.2} />
        <Path {...s} d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
      </>);
    case 'more':
      return (<>
        <Circle cx={5} cy={12} r={1.5} fill={color} />
        <Circle cx={12} cy={12} r={1.5} fill={color} />
        <Circle cx={19} cy={12} r={1.5} fill={color} />
      </>);
    case 'map':
      return <Path {...s} d="M9 4 3 6.5v14L9 18l6 2.5 6-2.5v-14L15 6.5zM9 4v14M15 6.5v14" />;
    case 'heart':
      return <Path {...s} d="M12 20s-7-4.6-7-9.5a3.9 3.9 0 0 1 7-2.4 3.9 3.9 0 0 1 7 2.4c0 4.9-7 9.5-7 9.5z" />;
    case 'ticket':
      return (<>
        <Rect {...s} x={3} y={7} width={18} height={10} rx={2.2} />
        <Path {...s} d="M12 7v10" strokeDasharray="2.4 2.6" />
      </>);
    case 'zap':
      return <Path {...s} d="M13 3 5 14h6l-1 7 8-11h-6z" />;
    case 'edit':
      return <Path {...s} d="M4 20h4L19.5 8.5l-4-4L4 16z" />;
    case 'eye':
      return (<>
        <Path {...s} d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
        <Circle {...s} cx={12} cy={12} r={3} />
      </>);
    case 'eye-off':
      return (<>
        <Path {...s} d="M4 5.5C2.8 7 2 8.5 2 8.5s3.6 6 10 6c1.2 0 2.3-.2 3.3-.6M9.9 4.3A11 11 0 0 1 12 4.1c6.4 0 10 6 10 6s-.8 1.3-2.2 2.7" transform="translate(0,1.9)" />
        <Path {...s} d="M4 4l16 16" />
      </>);
    case 'mail':
      return (<>
        <Rect {...s} x={3} y={5} width={18} height={14} rx={2.2} />
        <Path {...s} d="M3.5 6.5 12 13l8.5-6.5" />
      </>);
    case 'flag':
      return <Path {...s} d="M5 21V4M5 4h13l-2.5 4L18 12H5" />;
    case 'snow':
      return <Path {...s} d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />;
    case 'trash':
      return <Path {...s} d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 10.5v6M14 10.5v6" />;
    case 'logout':
      return <Path {...s} d="M9 4H5v16h4M15 8l4 4-4 4M19 12H10" />;
    case 'globe':
      return (<>
        <Circle {...s} cx={12} cy={12} r={9} />
        <Path {...s} d="M3 12h18M12 3c2.6 2.6 3.6 5.6 3.6 9S14.6 18.4 12 21c-2.6-2.6-3.6-5.6-3.6-9S9.4 5.6 12 3z" />
      </>);
    case 'moon':
      return <Path {...s} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />;
    case 'sun':
      return (<>
        <Circle {...s} cx={12} cy={12} r={4.2} />
        <Path {...s} d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
      </>);
    case 'alert':
      return (<>
        <Path {...s} d="M12 3 2.5 20h19z" />
        <Path {...s} d="M12 9.5v4.5" />
        <Circle cx={12} cy={17} r={1.1} fill={color} />
      </>);
    case 'doc':
      return (<>
        <Path {...s} d="M6 3h9l4 4v14H6z" />
        <Path {...s} d="M15 3v4h4" />
        <Path {...s} d="M9 12h6M9 15.5h6M9 8.5h3" />
      </>);
    case 'crown':
      return <Path {...s} d="M4 18L5 10L8 13L12 7L16 13L19 10L20 18Z" />;
    case 'coffee':
      return (<>
        <Path {...s} d="M18 8h1a4 4 0 0 1 0 8h-1" />
        <Path {...s} d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z" />
        <Path {...s} d="M6 1v3M10 1v3M14 1v3" />
      </>);
  }
}
