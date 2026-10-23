import type { ReactNode } from 'react';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';

export function LiquidGlassSurface({ children }: { children: ReactNode }) {
  // GlassView is the native material on iOS 26+. Other native targets retain a
  // high-contrast frost so live workspace content never relies on transparency.
  if (isGlassEffectAPIAvailable()) {
    return <GlassView glassEffectStyle="regular" tintColor="rgba(245, 251, 242, 0.22)" style={s.surface}>{children}</GlassView>;
  }
  return <View style={[s.surface, s.frostedFallback]}>{children}</View>;
}

const s = StyleSheet.create({
  surface: { width: '100%', minHeight: 1, position: 'relative' },
  frostedFallback: { backgroundColor: 'rgba(247, 252, 244, 0.68)' },
});
