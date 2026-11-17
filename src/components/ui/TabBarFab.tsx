import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Icon } from './Icon';
import { useTheme } from '@/core/theme';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';
import { haptics } from '@/core/utils/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** The raised round "+" in the middle of a tab bar (same look as the main app's create button). */
export function TabBarFab({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation(0.92);
  return (
    <View style={styles.slot}>
      <AnimatedPressable
        onPress={() => { haptics.medium(); onPress(); }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={[styles.wrap, animatedStyle]}
      >
        <View style={[styles.ring, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
            <Icon name="plus" size={25} color="#fff" strokeWidth={2} />
          </View>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { width: 66, height: 66, borderRadius: 33, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: -24 },
  fab: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.32, shadowRadius: 12, elevation: 10,
  },
});
