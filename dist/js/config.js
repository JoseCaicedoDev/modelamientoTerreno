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

// Colores de los puntos del plan de campo. Los comparten el panel, los marcadores del mapa y los
// pines del modelo 3D; `dist/styles.css` los duplica para los bordes y las etiquetas de la lista.
export const PLANNING_COLORS = Object.freeze({
  control: '#22c55e',
  gcp: '#f59e0b',
  checkpoint: '#a78bfa',
  auxiliar: '#22d3ee'
});

// Altura del mástil de cada pin sobre el terreno, en metros del propio modelo.
export const PLANNING_PIN_HEIGHT = 12;

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

// Niveles de referencia del Orinoco en Ciudad Bolívar (estación 0870 del INAMEH), la estación
// de aforo más cercana al área. Sitúan la cota simulada frente a lo que el río ha hecho de
// verdad. Son cotas del limnígrafo: el DEM es ALOS PALSAR RTC y su datum vertical puede no
// coincidir exactamente, así que la comparación es orientativa.
export const REFERENCIAS_ORINOCO = Object.freeze([
  Object.freeze({ cota: 16.5, etiqueta: 'Alerta verde' }),
  Object.freeze({ cota: 18.0, etiqueta: 'Riesgo de desborde' }),
  Object.freeze({ cota: 18.34, etiqueta: 'Récord 2018' }),
  Object.freeze({ cota: 19.14, etiqueta: 'Máximo histórico 1892' })
]);

const MINUTO = 60;
const HORA = 3600;
const DIA = 86400;

export function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'sin aporte';
  if (seconds < MINUTO) return `${Math.round(seconds)} s`;
  if (seconds < HORA) return `${(seconds / MINUTO).toLocaleString('es-CO', { maximumFractionDigits: 0 })} min`;
  if (seconds < 2 * DIA) return `${(seconds / HORA).toLocaleString('es-CO', { maximumFractionDigits: 1 })} h`;
  if (seconds < 365 * DIA) return `${(seconds / DIA).toLocaleString('es-CO', { maximumFractionDigits: 1 })} días`;
  return `${(seconds / (365 * DIA)).toLocaleString('es-CO', { maximumFractionDigits: 1 })} años`;
}

export function formatRainfall(millimeters) {
  return `${millimeters.toLocaleString('es-CO', { maximumFractionDigits: millimeters < 10 ? 1 : 0 })} mm`;
}

export function formatDischarge(cubicMetersPerSecond) {
  return `${cubicMetersPerSecond.toLocaleString('es-CO', { maximumFractionDigits: cubicMetersPerSecond < 10 ? 2 : 0 })} m³/s`;
}
