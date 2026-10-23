import type { ReactNode } from 'react';
import LiquidGlass from 'liquid-glass-react';
import type { GlassSettings } from './glass-settings';
import './liquid-glass-surface.web.css';

export function LiquidGlassSurface({ children, settings, fill = false }: { children: ReactNode; settings: GlassSettings; fill?: boolean }) {
  const materialStyle = {
    minHeight: fill ? undefined : '100%',
    height: fill ? '100%' : undefined,
    position: 'relative',
    width: '100%',
    '--cedar-glass-blur': `${4 + settings.blurAmount * 32}px`,
    '--cedar-glass-saturation': `${settings.saturation}%`,
    '--cedar-edge-strength': String(settings.edgeStrength),
  } as React.CSSProperties;
  return <LiquidGlass
    className="cedar-liquid-frame"
    mode="prominent"
    displacementScale={settings.displacementScale}
    blurAmount={settings.blurAmount}
    saturation={settings.saturation}
    aberrationIntensity={settings.aberrationIntensity}
    elasticity={settings.elasticity}
    cornerRadius={26}
    padding="0"
    style={materialStyle}
  >
    {children}
  </LiquidGlass>;
}
