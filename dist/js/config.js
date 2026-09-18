export const BRAND = Object.freeze({
  dark: '#015059',
  primary: '#0396a6',
  accent: '#00cba9',
  focus: '#03c0d0',
  profile: '#f4b860',
  text: '#f1f5f9',
  muted: '#cbd5e1',
  subtle: '#94a3b8',
  surface: '#0f172a',
  background: '#020617'
});

export const ELEVATION_SCALE = Object.freeze([
  [0.00, '#173a72'],
  [0.18, '#2488bd'],
  [0.36, '#4fbf91'],
  [0.55, '#c8d878'],
  [0.72, '#d7bb78'],
  [0.86, '#936d5b'],
  [1.00, '#f2efe6']
]);

export const INITIAL_CAMERA = Object.freeze({
  eye: { x: 1.34, y: -1.5, z: 0.78 },
  center: { x: 0, y: 0, z: -0.08 }
});

export const MEASURE_COLOR = '#f7b955';

export const WATER_COLOR = '#2488bd';

export const STREAM_COLOR = '#38bdf8';

export const UTM_20N = '+proj=utm +zone=20 +datum=WGS84 +units=m +no_defs';

export const coordinateFormatter = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

export function formatDistance(distance) {
  return distance >= 1000
    ? `${(distance / 1000).toLocaleString('es-CO', { maximumFractionDigits: 2 })} km`
    : `${Math.round(distance).toLocaleString('es-CO')} m`;
}

export function formatArea(squareMeters) {
  const hectares = squareMeters / 10000;
  return hectares >= 1
    ? `${hectares.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ha`
    : `${Math.round(squareMeters).toLocaleString('es-CO')} m²`;
}

export function formatVolume(cubicMeters) {
  return cubicMeters >= 1e6
    ? `${(cubicMeters / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 2 })} hm³`
    : `${Math.round(cubicMeters).toLocaleString('es-CO')} m³`;
}

export function formatElevation(value) {
  return `${coordinateFormatter.format(value)} m`;
}

export function formatCoordinateLabel(point) {
  return `E ${coordinateFormatter.format(point.x)} m · N ${coordinateFormatter.format(point.y)} m · Elev. ${coordinateFormatter.format(point.z)} m.s.n.m.`;
}
