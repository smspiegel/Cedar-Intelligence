export type GlassSettings = {
  displacementScale: number;
  blurAmount: number;
  saturation: number;
  aberrationIntensity: number;
  elasticity: number;
  edgeStrength: number;
};

export const defaultGlassSettings: GlassSettings = {
  displacementScale: 38,
  blurAmount: 0.14,
  saturation: 132,
  aberrationIntensity: 1.4,
  elasticity: 0.06,
  edgeStrength: 0.82,
};

export const glassLimits: Record<keyof GlassSettings, readonly [number, number]> = {
  displacementScale: [0, 80],
  blurAmount: [0, 0.3],
  saturation: [80, 180],
  aberrationIntensity: [0, 3],
  elasticity: [0, 0.25],
  edgeStrength: [0, 1],
};

export const glassSteps: Record<keyof GlassSettings, number> = {
  displacementScale: 1,
  blurAmount: 0.01,
  saturation: 1,
  aberrationIntensity: 0.1,
  elasticity: 0.005,
  edgeStrength: 0.05,
};
