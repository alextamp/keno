import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

interface FadeInViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  duration?: number;
}

// Simple mount-in fade + scale pop, built on React Native's core Animated
// API (not react-native-reanimated's newer Layout Animations subsystem —
// deliberately avoided here since it's the more fragile, native-runtime-
// dependent part of that library; this is the same plain approach already
// used by Skeleton.tsx's pulse animation elsewhere in the app).
export function FadeInView({ children, style, duration = 220 }: FadeInViewProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
