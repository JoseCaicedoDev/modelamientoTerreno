// Geometría plana sobre coordenadas UTM (metros). Sin DOM ni dependencias externas.

export function polylineLength(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return total;
}

// Fórmula del área de Gauss. El anillo puede venir abierto o cerrado.
export function polygonArea(ring) {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

export function pointInPolygon(x, y, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const current = ring[index];
    const other = ring[previous];
    const crosses = (current.y > y) !== (other.y > y)
      && x < ((other.x - current.x) * (y - current.y)) / (other.y - current.y) + current.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function boundingBox(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  return { minX, minY, maxX, maxY };
}

// Factor de drapeado de una celda: sec(pendiente) por diferencias centradas.
// Multiplica el área proyectada para estimar el área real sobre el relieve.
export function slopeFactor(grid, index) {
  const row = grid.rowOf(index);
  const column = grid.columnOf(index);
  const east = grid.isValid(grid.toFlat(row, column + 1)) ? grid.toFlat(row, column + 1) : index;
  const west = grid.isValid(grid.toFlat(row, column - 1)) ? grid.toFlat(row, column - 1) : index;
  const north = row > 0 && grid.isValid(grid.toFlat(row - 1, column)) ? grid.toFlat(row - 1, column) : index;
  const south = row < grid.rows - 1 && grid.isValid(grid.toFlat(row + 1, column)) ? grid.toFlat(row + 1, column) : index;
  if (column <= 0 || column >= grid.columns - 1) return 1;
  const runX = (east === index || west === index ? 1 : 2) * grid.cellSize;
  const runY = (north === index || south === index ? 1 : 2) * grid.cellSize;
  const slopeX = (grid.elevationAt(east) - grid.elevationAt(west)) / runX;
  const slopeY = (grid.elevationAt(north) - grid.elevationAt(south)) / runY;
  if (Number.isNaN(slopeX) || Number.isNaN(slopeY)) return 1;
  return Math.sqrt(1 + slopeX * slopeX + slopeY * slopeY);
}

// Triangulación en abanico desde el centroide. Válida para los polígonos convexos
// del área de estudio y de su zona de influencia.
export function fanTriangulation(ring) {
  const centroid = ring.reduce(
    (accumulator, point) => ({ x: accumulator.x + point.x / ring.length, y: accumulator.y + point.y / ring.length }),
    { x: 0, y: 0 }
  );
  const x = [centroid.x];
  const y = [centroid.y];
  const i = [];
  const j = [];
  const k = [];
  ring.forEach(point => {
    x.push(point.x);
    y.push(point.y);
  });
  for (let index = 1; index <= ring.length; index += 1) {
    const next = index === ring.length ? 1 : index + 1;
    i.push(0);
    j.push(index);
    k.push(next);
  }
  return { x, y, i, j, k };
}
