import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withSequence, interpolate, Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme';
import { UIFont, FontSize, FontWeight } from '@/core/constants/theme';
import { TAB_BAR_BASE_HEIGHT } from '@/core/constants/layout';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';
import { Icon, IconName } from './Icon';

// The app's bottom tab bar, shared by the main AppHub and the Keno for Good
// section so both are pixel-identical. Colors come from useTheme(), so inside
// an <AccentScopeProvider value="kfg"> the active state is green.

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TabBarItem({
  icon, label, focused, badge, onPress,
}: {
  icon: IconName;
  label: string;
  focused: boolean;
  badge?: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressAnimation(0.88);
  const focusAnim = useSharedValue(focused ? 1 : 0);
  // Separate from focusAnim on purpose: this always settles back to exactly 1,
  // so the active tab's icon never sits at a fractional scale (that soft/blurry
  // look) — it only pulses at the instant of switching, then snaps crisp.
  const pulse = useSharedValue(1);

  useEffect(() => {
    focusAnim.value = withSpring(focused ? 1 : 0, { damping: 18, stiffness: 240 });
    if (focused) {
      pulse.value = withSequence(
        withSpring(1.22, { damping: 10, stiffness: 350 }),
        withSpring(1, { damping: 12, stiffness: 280 }),
      );
    }
  }, [focused]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: focusAnim.value,
    transform: [{ scale: interpolate(focusAnim.value, [0, 1], [0.5, 1], Extrapolation.CLAMP) }],
  }));

  const iconWrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const color = focused ? colors.primary : colors.textDecor;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      style={[styles.tabItem, pressStyle]}
    >
      <Animated.View style={[styles.iconWrap, iconWrapStyle]}>
        <Animated.View style={[styles.activePill, { backgroundColor: colors.accentSoft }, pillStyle]} />
        <Icon name={icon} size={23} color={color} strokeWidth={1.8} />
        {!!badge && badge > 0 && (
          <View style={[styles.notifBadge, { backgroundColor: colors.primary, borderColor: colors.surface }]}>
            <Text style={styles.notifBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </Animated.View>
      <Text style={[styles.tabLabel, { color, fontFamily: UIFont, opacity: focused ? 1 : 0.8 }]}>{label}</Text>
    </AnimatedPressable>
  );
}

/** The bar itself: white, 1px top border, safe-area padded. Children are the items. */
export function TabBar({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.tabBar,
        {
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom + 4,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#241F19',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 8 },
    }),
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  tabLabel: {
    fontSize: FontSize.xs, fontWeight: FontWeight.bold, letterSpacing: 0.15,
    includeFontPadding: false, textAlignVertical: 'center',
  },
  iconWrap: { width: 46, height: 32, alignItems: 'center', justifyContent: 'center' },
  activePill: {
    position: 'absolute',
    width: 40, height: 32, borderRadius: 13,
  },
  notifBadge: {
    position: 'absolute', top: -2, right: 2,
    minWidth: 15, height: 15, borderRadius: 8, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold },
});
