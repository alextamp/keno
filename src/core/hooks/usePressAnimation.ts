import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { haptics } from '@/core/utils/haptics';
import { sounds } from '@/core/utils/sounds';

// Shared spring-scale + haptic + click-sound press feedback for interactive
// components. Damping/stiffness tuned so the release settles fast (no
// wobble) — an underdamped release previously read as "laggy" even though
// it wasn't.
export function usePressAnimation(pressedScale = 0.95) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = () => {
    haptics.light();
    sounds.play('click');
    scale.value = withSpring(pressedScale, { damping: 15, stiffness: 400 });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 300 });
  };

  return { animatedStyle, onPressIn, onPressOut };
}
