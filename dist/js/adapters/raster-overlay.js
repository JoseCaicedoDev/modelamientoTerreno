import { UTM_20N } from '../config.js';

// Capa de Leaflet que pinta rásteres derivados de la malla (inundación, encharcamiento, cauces)
// escribiendo ImageData directamente sobre un canvas.
//
// Se evita L.imageOverlay a propósito: obliga a codificar un PNG con toDataURL y a decodificarlo
// de forma asíncrona en cada cambio, lo que parpadea al arrastrar un deslizador.
//
// Para no proyectar píxel a píxel con proj4 se construye una tabla de correspondencia
// píxel → celda una sola vez, interpolando una rejilla de control. A esta escala (3,4 km, a 0,45°
// del meridiano central de la zona 20) la transformación es prácticamente afín y el error del
// muestreo queda muy por debajo de la celda de 25 m.

const CONTROL_POINTS = 5;
const PIXELS_PER_CELL = 4;

export function packColor(red, green, blue, alpha) {
  // Orden ABGR porque el buffer de ImageData se interpreta como Uint32 en arquitecturas little-endian.
  return ((alpha << 24) | (blue << 16) | (green << 8) | red) >>> 0;
}

export const TRANSPARENT = 0;

function gridBounds(grid, data, project, leaflet) {
  const corners = [
    [data.x[0], data.y[0]],
    [data.x[grid.columns - 1], data.y[0]],
    [data.x[0], data.y[grid.rows - 1]],
    [data.x[grid.columns - 1], data.y[grid.rows - 1]]
  ].map(([easting, northing]) => project(UTM_20N, 'EPSG:4326', [easting, northing]));
  const longitudes = corners.map(corner => corner[0]);
  const latitudes = corners.map(corner => corner[1]);
  return leaflet.latLngBounds(
    [Math.min(...latitudes), Math.min(...longitudes)],
    [Math.max(...latitudes), Math.max(...longitudes)]
  );
}

function buildLookup({ grid, bounds, width, height, project }) {
  const west = bounds.getWest();
  const east = bounds.getEast();
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const controlEasting = new Float64Array(CONTROL_POINTS * CONTROL_POINTS);
  const controlNorthing = new Float64Array(CONTROL_POINTS * CONTROL_POINTS);

  for (let row = 0; row < CONTROL_POINTS; row += 1) {
    for (let column = 0; column < CONTROL_POINTS; column += 1) {
      const longitude = west + ((east - west) * column) / (CONTROL_POINTS - 1);
      const latitude = north - ((north - south) * row) / (CONTROL_POINTS - 1);
      const [easting, northing] = project('EPSG:4326', UTM_20N, [longitude, latitude]);
      controlEasting[row * CONTROL_POINTS + column] = easting;
      controlNorthing[row * CONTROL_POINTS + column] = northing;
    }
  }

  const lookup = new Int32Array(width * height);
  for (let pixelRow = 0; pixelRow < height; pixelRow += 1) {
    const v = ((pixelRow + 0.5) / height) * (CONTROL_POINTS - 1);
    const rowIndex = Math.min(CONTROL_POINTS - 2, Math.floor(v));
    const rowFraction = v - rowIndex;
    for (let pixelColumn = 0; pixelColumn < width; pixelColumn += 1) {
      const u = ((pixelColumn + 0.5) / width) * (CONTROL_POINTS - 1);
      const columnIndex = Math.min(CONTROL_POINTS - 2, Math.floor(u));
      const columnFraction = u - columnIndex;
      const topLeft = rowIndex * CONTROL_POINTS + columnIndex;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + CONTROL_POINTS;
      const bottomRight = bottomLeft + 1;
      const easting =
        controlEasting[topLeft] * (1 - columnFraction) * (1 - rowFraction) +
        controlEasting[topRight] * columnFraction * (1 - rowFraction) +
        controlEasting[bottomLeft] * (1 - columnFraction) * rowFraction +
        controlEasting[bottomRight] * columnFraction * rowFraction;
      const northing =
        controlNorthing[topLeft] * (1 - columnFraction) * (1 - rowFraction) +
        controlNorthing[topRight] * columnFraction * (1 - rowFraction) +
        controlNorthing[bottomLeft] * (1 - columnFraction) * rowFraction +
        controlNorthing[bottomRight] * columnFraction * rowFraction;
      lookup[pixelRow * width + pixelColumn] = grid.cellIndex(easting, northing);
    }
  }
  return lookup;
}

export function createRasterOverlay({
  map,
  grid,
  data,
  leaflet = window.L,
  project = window.proj4,
  opacity = 0.6,
  className = ''
}) {
  const width = grid.columns * PIXELS_PER_CELL;
  const height = grid.rows * PIXELS_PER_CELL;
  const bounds = gridBounds(grid, data, project, leaflet);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.className = `raster-overlay ${className}`.trim();
  canvas.style.opacity = String(opacity);
  const context = canvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  const image = context.createImageData(width, height);
  const pixels = new Uint32Array(image.data.buffer);
  let lookup = null;
  let visible = false;

  const RasterLayer = leaflet.Layer.extend({
    onAdd(targetMap) {
      this._map = targetMap;
      targetMap.getPanes().overlayPane.appendChild(canvas);
      this._reposition();
    },
    onRemove() {
      canvas.remove();
    },
    getEvents() {
      return { zoom: this._reposition, viewreset: this._reposition, zoomend: this._reposition };
    },
    _reposition() {
      if (!this._map) return;
      const topLeft = this._map.latLngToLayerPoint(bounds.getNorthWest());
      const bottomRight = this._map.latLngToLayerPoint(bounds.getSouthEast());
      leaflet.DomUtil.setPosition(canvas, topLeft);
      canvas.style.width = `${bottomRight.x - topLeft.x}px`;
      canvas.style.height = `${bottomRight.y - topLeft.y}px`;
    }
  });

  const layer = new RasterLayer();

  function ensureLookup() {
    if (!lookup) lookup = buildLookup({ grid, bounds, width, height, project });
    return lookup;
  }

  // cellColors: Uint32Array de tamaño grid.cellCount con colores empaquetados por packColor.
  function render(cellColors) {
    const table = ensureLookup();
    for (let pixel = 0; pixel < table.length; pixel += 1) {
      const cell = table[pixel];
      pixels[pixel] = cell < 0 ? TRANSPARENT : cellColors[cell];
    }
    context.putImageData(image, 0, 0);
  }

  function show() {
    if (visible) return;
    layer.addTo(map);
    visible = true;
  }

  function hide() {
    if (!visible) return;
    map.removeLayer(layer);
    visible = false;
  }

  function setOpacity(value) {
    canvas.style.opacity = String(value);
  }

  return Object.freeze({ render, show, hide, setOpacity, bounds, get visible() { return visible; } });
}
