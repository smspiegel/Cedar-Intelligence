import type { ReactNode } from 'react';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { StyleSheet, View } from 'react-native';
import type { GlassSettings } from './glass-settings';

export function LiquidGlassSurface({ children, settings }: { children: ReactNode; settings: GlassSettings }) {
  // GlassView is the native material on iOS 26+. Other native targets retain a
  // high-contrast frost so live workspace content never relies on transparency.
  if (isGlassEffectAPIAvailable()) {
    const tint = Math.min(0.32, 0.12 + settings.blurAmount * 1.1);
    return <GlassView glassEffectStyle="regular" tintColor={`rgba(245, 251, 242, ${tint})`} style={s.surface}>{children}</GlassView>;
  }
  const fallbackOpacity = Math.min(0.86, 0.58 + settings.blurAmount);
  return <View style={[s.surface, s.frostedFallback, { backgroundColor: `rgba(247, 252, 244, ${fallbackOpacity})` }]}>{children}</View>;
}

const s = StyleSheet.create({
  surface: { width: '100%', minHeight: 1, position: 'relative' },
  frostedFallback: { backgroundColor: 'rgba(247, 252, 244, 0.68)' },
});
