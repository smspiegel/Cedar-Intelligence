// TypeScript's resolver uses this implementation for project-wide type checking.
// Metro selects the .web or .native implementation at runtime.
export { LiquidGlassSurface, supportsLiquidRefraction } from './liquid-glass-surface.native';
