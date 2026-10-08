import React from 'react';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTabNavigation } from '@/core/tabNavigation';
import { useTheme } from '@/core/theme';
import { Spacing } from '@/core/constants/theme';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { Icon } from '@/components/ui/Icon';
import { PeopleSearchView } from '@/screens/PeopleSearchView';

export default function SearchScreen() {
  const router = useRouter();
  const { goToTab } = useTabNavigation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <AnimatedPressable onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Icon name="back" size={16} color={colors.textPrimary} />
        </AnimatedPressable>
      </View>

      <PeopleSearchView
        autoFocus
        onPressUser={(uid) => {
          if (uid === user?.id) {
            router.navigate('/(app)');
            // PagerView.setPage() is unreliable while the tab screen isn't
            // focused/visible yet — give the navigation a tick to land first.
            setTimeout(() => goToTab(4), 50);
          } else router.push(`/(app)/user/${uid}` as any);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.md, flexDirection: 'row', alignItems: 'center' },
  backBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
