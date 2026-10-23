import type { ReactNode } from 'react';
import LiquidGlass from 'liquid-glass-react';
import './liquid-glass-surface.web.css';

export function LiquidGlassSurface({ children }: { children: ReactNode }) {
  return <LiquidGlass
    className="cedar-liquid-frame"
    mode="prominent"
    displacementScale={24}
    blurAmount={0.09}
    saturation={122}
    aberrationIntensity={0.7}
    elasticity={0.025}
    cornerRadius={26}
    padding="0"
    style={{ minHeight: '100%', position: 'relative', width: '100%' }}
  >
    {children}
  </LiquidGlass>;
}
