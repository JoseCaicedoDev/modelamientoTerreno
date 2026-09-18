import { boundingBox, pointInPolygon, polygonArea, polylineLength, slopeFactor } from './geometry.js';

// Longitud siguiendo el relieve: se muestrea el segmento sobre la malla y se suma la
// hipotenusa de cada tramo, igual que hace el perfil topográfico.
function drapedSegmentLength(terrain, start, end) {
  const { samples } = terrain.sampleLine(start, end);
  if (samples.length < 2) return Math.hypot(end.x - start.x, end.y - start.y);
  let total = 0;
  for (let index = 1; index < samples.length; index += 1) {
    total += Math.hypot(
      samples[index].distance - samples[index - 1].distance,
      samples[index].z - samples[index - 1].z
    );
  }
  return total;
}

// Promedio del factor sec(pendiente) de las celdas cuyo centro cae dentro del polígono.
// Se descarta primero por el rectángulo envolvente porque casi siempre son pocas celdas.
function averageSlopeFactor(grid, ring) {
  const box = boundingBox(ring);
  const corners = [
    grid.cellIndex(box.minX, box.maxY),
    grid.cellIndex(box.maxX, box.minY)
  ];
  if (corners.some(index => index < 0)) return averageSlopeFactorAtCentroid(grid, ring);

  const firstRow = grid.rowOf(corners[0]);
  const lastRow = grid.rowOf(corners[1]);
  const firstColumn = grid.columnOf(corners[0]);
  const lastColumn = grid.columnOf(corners[1]);
  let total = 0;
  let counted = 0;
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const index = grid.toFlat(row, column);
      if (!grid.isValid(index)) continue;
      const center = grid.cellCenter(index);
      if (!pointInPolygon(center.x, center.y, ring)) continue;
      total += slopeFactor(grid, index);
      counted += 1;
    }
  }
  return counted ? total / counted : averageSlopeFactorAtCentroid(grid, ring);
}

// Polígonos más pequeños que una celda: se usa la pendiente local del centroide.
function averageSlopeFactorAtCentroid(grid, ring) {
  const centroid = ring.reduce(
    (accumulator, point) => ({ x: accumulator.x + point.x / ring.length, y: accumulator.y + point.y / ring.length }),
    { x: 0, y: 0 }
  );
  const index = grid.cellIndex(centroid.x, centroid.y);
  return grid.isValid(index) ? slopeFactor(grid, index) : 1;
}

export function measurePath(vertices, { terrain, grid, cerrado = false }) {
  if (vertices.length < 2) return null;
  const ring = cerrado ? [...vertices, vertices[0]] : vertices;

  let drapedLength = 0;
  for (let index = 1; index < ring.length; index += 1) {
    drapedLength += drapedSegmentLength(terrain, ring[index - 1], ring[index]);
  }

  const elevations = vertices.map(vertex => vertex.z).filter(value => Number.isFinite(value));
  const result = {
    vertices: vertices.length,
    cerrado,
    longitudProyectada: polylineLength(ring),
    longitudDrapeada: drapedLength,
    elevacionMinima: elevations.length ? Math.min(...elevations) : null,
    elevacionMaxima: elevations.length ? Math.max(...elevations) : null
  };
  result.desnivel = elevations.length ? result.elevacionMaxima - result.elevacionMinima : null;

  if (!cerrado) return result;

  const area = polygonArea(vertices);
  const factor = averageSlopeFactor(grid, vertices);
  return {
    ...result,
    perimetro: result.longitudProyectada,
    area,
    areaHectareas: area / 10000,
    factorDrapeado: factor,
    areaReal: area * factor,
    areaRealHectareas: (area * factor) / 10000
  };
}
