import { boundingBox, pointInPolygon } from './geometry.js';

const TILE_SIZE = 256;
const TERRARIUM_ZOOM = 12;
const DEFAULT_BUFFER_METERS = 500;
const MIN_CELL_SIZE = 35;
const MAX_GRID_CELLS = 50000;
const MAX_BOUNDS_AREA = 250e6;
const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

export function terrariumElevation(red, green, blue) {
  return red * 256 + green + blue / 256 - 32768;
}

export function utmZoneForLongitude(longitude) {
  return Math.max(1, Math.min(60, Math.floor((longitude + 180) / 6) + 1));
}

export function utmCrsForRing(ring) {
  const longitude = ring.reduce((sum, coordinate) => sum + coordinate[0], 0) / ring.length;
  const latitude = ring.reduce((sum, coordinate) => sum + coordinate[1], 0) / ring.length;
  const zone = utmZoneForLongitude(longitude);
  const south = latitude < 0;
  return {
    zone,
    code: `EPSG:${south ? 32700 + zone : 32600 + zone}`,
    definition: `+proj=utm +zone=${zone} ${south ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`
  };
}

function signedArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(area) / 2;
}

function polygonRings(geometry, output) {
  if (!geometry) return;
  if (geometry.type === 'Polygon' && geometry.coordinates?.[0]?.length >= 3) {
    output.push(geometry.coordinates[0]);
    return;
  }
  if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach(polygon => {
      if (polygon?.[0]?.length >= 3) output.push(polygon[0]);
    });
    return;
  }
  if (geometry.type === 'GeometryCollection') {
    geometry.geometries?.forEach(child => polygonRings(child, output));
  }
}

export function studyRingFromGeoJson(geojson) {
  const rings = [];
  if (geojson?.type === 'FeatureCollection') {
    geojson.features?.forEach(feature => polygonRings(feature.geometry, rings));
  } else if (geojson?.type === 'Feature') {
    polygonRings(geojson.geometry, rings);
  } else {
    polygonRings(geojson, rings);
  }
  if (!rings.length) throw new Error('La capa necesita al menos un polígono para crear una zona de estudio');
  const ring = rings.sort((first, second) => signedArea(second) - signedArea(first))[0]
    .map(coordinate => [Number(coordinate[0]), Number(coordinate[1])]);
  if (ring.length > 3 && ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1]) ring.pop();
  if (ring.some(([longitude, latitude]) => !Number.isFinite(longitude) || !Number.isFinite(latitude))) {
    throw new Error('El polígono contiene coordenadas inválidas');
  }
  return ring;
}

export function validateVenezuelaRing(ring) {
  const insideCoverage = ring.every(([longitude, latitude]) => (
    longitude >= -74 && longitude <= -58 && latitude >= 0 && latitude <= 16
  ));
  if (!insideCoverage) {
    throw new Error('El MVP admite zonas ubicadas dentro de Venezuela y sus islas cercanas');
  }
}

export function lonLatToGlobalPixel(longitude, latitude, zoom = TERRARIUM_ZOOM) {
  const scale = TILE_SIZE * 2 ** zoom;
  const limitedLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
  const radians = limitedLatitude * Math.PI / 180;
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) * scale / 2
  };
}

function distanceToSegment(x, y, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return Math.hypot(x - start.x, y - start.y);
  const progress = Math.max(0, Math.min(1, ((x - start.x) * dx + (y - start.y) * dy) / lengthSquared));
  return Math.hypot(x - (start.x + progress * dx), y - (start.y + progress * dy));
}

function insideBufferedPolygon(x, y, ring, bufferMeters) {
  if (pointInPolygon(x, y, ring)) return true;
  for (let index = 0; index < ring.length; index += 1) {
    if (distanceToSegment(x, y, ring[index], ring[(index + 1) % ring.length]) <= bufferMeters) return true;
  }
  return false;
}

function convexHull(points) {
  const sorted = [...points].sort((first, second) => first.x - second.x || first.y - second.y);
  if (sorted.length <= 2) return sorted;
  const cross = (origin, first, second) => (
    (first.x - origin.x) * (second.y - origin.y) - (first.y - origin.y) * (second.x - origin.x)
  );
  const lower = [];
  sorted.forEach(point => {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  });
  const upper = [];
  [...sorted].reverse().forEach(point => {
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  });
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function bufferedDisplayRing(ring, bufferMeters) {
  const samples = [];
  ring.forEach(vertex => {
    for (let index = 0; index < 12; index += 1) {
      const angle = index * Math.PI * 2 / 12;
      samples.push({
        x: vertex.x + Math.cos(angle) * bufferMeters,
        y: vertex.y + Math.sin(angle) * bufferMeters
      });
    }
  });
  return convexHull(samples);
}

function tileKey(x, y) {
  return `${x}:${y}`;
}

function tileUrl(x, y, zoom) {
  return TILE_URL.replace('{z}', zoom).replace('{x}', x).replace('{y}', y);
}

async function defaultLoadTile(x, y, zoom) {
  const response = await fetch(tileUrl(x, y, zoom), { mode: 'cors' });
  if (!response.ok) throw new Error(`No se pudo descargar la tesela de elevación ${x}/${y}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close?.();
  return context.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;
}

function requiredTiles(corners, zoom) {
  const pixels = corners.map(([longitude, latitude]) => lonLatToGlobalPixel(longitude, latitude, zoom));
  const minX = Math.floor(Math.min(...pixels.map(point => point.x)) / TILE_SIZE);
  const maxX = Math.floor(Math.max(...pixels.map(point => point.x)) / TILE_SIZE);
  const minY = Math.floor(Math.min(...pixels.map(point => point.y)) / TILE_SIZE);
  const maxY = Math.floor(Math.max(...pixels.map(point => point.y)) / TILE_SIZE);
  const tiles = [];
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) tiles.push({ x, y });
  }
  return tiles;
}

function elevationAt(tiles, longitude, latitude, zoom) {
  const pixel = lonLatToGlobalPixel(longitude, latitude, zoom);
  const tileX = Math.floor(pixel.x / TILE_SIZE);
  const tileY = Math.floor(pixel.y / TILE_SIZE);
  const column = Math.max(0, Math.min(TILE_SIZE - 1, Math.floor(pixel.x - tileX * TILE_SIZE)));
  const row = Math.max(0, Math.min(TILE_SIZE - 1, Math.floor(pixel.y - tileY * TILE_SIZE)));
  const bytes = tiles.get(tileKey(tileX, tileY));
  if (!bytes) return null;
  const offset = (row * TILE_SIZE + column) * 4;
  if (bytes[offset + 3] === 0) return null;
  const elevation = terrariumElevation(bytes[offset], bytes[offset + 1], bytes[offset + 2]);
  return elevation <= -32768 ? null : elevation;
}

export async function buildTerrainFromTerrarium(ring, {
  project = window.proj4,
  loadTile = defaultLoadTile,
  bufferMeters = DEFAULT_BUFFER_METERS,
  zoom = TERRARIUM_ZOOM,
  maxCells = MAX_GRID_CELLS,
  onProgress
} = {}) {
  validateVenezuelaRing(ring);
  const crs = utmCrsForRing(ring);
  const projectedRing = ring.map(([longitude, latitude]) => {
    const [x, y] = project('EPSG:4326', crs.definition, [longitude, latitude]);
    return { x, y };
  });
  const bounds = boundingBox(projectedRing);
  const width = bounds.maxX - bounds.minX + bufferMeters * 2;
  const height = bounds.maxY - bounds.minY + bufferMeters * 2;
  if (width * height > MAX_BOUNDS_AREA) {
    throw new Error('La zona es demasiado extensa para este MVP. Divide el proyecto en áreas menores de 250 km²');
  }
  const adaptiveSize = Math.ceil(Math.sqrt((width * height) / maxCells) / 5) * 5;
  const cellSize = Math.max(MIN_CELL_SIZE, adaptiveSize);
  const minX = Math.floor((bounds.minX - bufferMeters) / cellSize) * cellSize + cellSize / 2;
  const maxX = Math.ceil((bounds.maxX + bufferMeters) / cellSize) * cellSize - cellSize / 2;
  const minY = Math.floor((bounds.minY - bufferMeters) / cellSize) * cellSize + cellSize / 2;
  const maxY = Math.ceil((bounds.maxY + bufferMeters) / cellSize) * cellSize - cellSize / 2;
  const x = [];
  const y = [];
  for (let value = minX; value <= maxX; value += cellSize) x.push(Number(value.toFixed(3)));
  for (let value = maxY; value >= minY; value -= cellSize) y.push(Number(value.toFixed(3)));

  const geographicCorners = [
    [minX, minY], [minX, maxY], [maxX, minY], [maxX, maxY]
  ].map(coordinate => project(crs.definition, 'EPSG:4326', coordinate));
  const tileList = requiredTiles(geographicCorners, zoom);
  onProgress?.(`Descargando ${tileList.length} teselas de elevación…`);
  const tileEntries = await Promise.all(tileList.map(async tile => [
    tileKey(tile.x, tile.y),
    await loadTile(tile.x, tile.y, zoom)
  ]));
  const tiles = new Map(tileEntries);

  onProgress?.('Construyendo la malla del terreno…');
  const z = [];
  const satellite = [];
  const values = [];
  for (const northing of y) {
    const row = [];
    const colorRow = [];
    for (const easting of x) {
      if (!insideBufferedPolygon(easting, northing, projectedRing, bufferMeters)) {
        row.push(null);
        colorRow.push(null);
        continue;
      }
      const [longitude, latitude] = project(crs.definition, 'EPSG:4326', [easting, northing]);
      const elevation = elevationAt(tiles, longitude, latitude, zoom);
      const rounded = elevation === null ? null : Math.round(elevation * 10) / 10;
      row.push(rounded);
      colorRow.push(rounded === null ? null : '#64748b');
      if (rounded !== null) values.push(rounded);
    }
    z.push(row);
    satellite.push(colorRow);
  }
  if (!values.length) throw new Error('La fuente de elevación no devolvió datos para esta zona');
  const actualMinElevation = Math.min(...values);
  const actualMaxElevation = Math.max(...values);
  const displayBuffer = bufferedDisplayRing(projectedRing, bufferMeters);
  const toLatLon = point => {
    const [longitude, latitude] = project(crs.definition, 'EPSG:4326', [point.x, point.y]);
    return [Number(latitude.toFixed(8)), Number(longitude.toFixed(8))];
  };
  const boundary = projectedRing.map(toLatLon);
  boundary.push(boundary[0]);
  const buffer = displayBuffer.map(toLatLon);
  buffer.push(buffer[0]);
  let minElevation = Math.floor(actualMinElevation / 10) * 10;
  let maxElevation = Math.ceil(actualMaxElevation / 10) * 10;
  if (minElevation === maxElevation) maxElevation = minElevation + 10;

  return {
    x,
    y,
    z,
    satellite,
    minElevation,
    maxElevation,
    actualMinElevation,
    actualMaxElevation,
    aspectY: Number(((y[0] - y.at(-1)) / (x.at(-1) - x[0])).toFixed(4)),
    crs: crs.definition,
    crsCode: crs.code,
    crsLabel: `WGS 84 / UTM zona ${crs.zone}N · ${crs.code}`,
    source: 'Mapzen Terrain Tiles · SRTM y fuentes abiertas',
    resolutionMeters: cellSize,
    bufferMeters,
    boundary,
    buffer,
    hasSatelliteTexture: false,
    showOrinocoReferences: false,
    dynamic: true
  };
}
