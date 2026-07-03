import React from 'react';
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';

const Base = Animated.createAnimatedComponent(Pressable);

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}

// Drop-in replacement for Pressable with the app's standard spring-scale +
// haptic press feedback (see usePressAnimation for the tuning rationale).
export function AnimatedPressable({ style, scaleTo = 0.95, onPressIn, onPressOut, ...rest }: AnimatedPressableProps) {
  const { animatedStyle, onPressIn: animIn, onPressOut: animOut } = usePressAnimation(scaleTo);
  return (
    <Base
      {...rest}
      onPressIn={(e) => { animIn(); onPressIn?.(e); }}
      onPressOut={(e) => { animOut(); onPressOut?.(e); }}
      style={[style, animatedStyle]}
    />
  );
}
