// Modelo de la malla regular del DEM: conversión índice ↔ coordenada UTM y recorrido de vecinos.
// Independiente del DOM para poder probarse sin navegador.

const NEIGHBOR_OFFSETS = Object.freeze([
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1]
]);

export function createGrid(data) {
  const columns = data.x.length;
  const rows = data.y.length;
  const xStep = data.x[1] - data.x[0];
  const yStep = data.y[1] - data.y[0];
  const cellArea = Math.abs(xStep * yStep);
  const cellSize = Math.abs(xStep);
  const cellCount = rows * columns;
  let elevations = null;

  function toFlat(row, column) {
    return row * columns + column;
  }

  function rowOf(index) {
    return Math.floor(index / columns);
  }

  function columnOf(index) {
    return index % columns;
  }

  // Las celdas nulas (fuera de la zona de influencia) se representan con NaN para poder
  // trabajar sobre un arreglo tipado plano en los algoritmos hidrológicos.
  function elevationArray() {
    if (elevations) return elevations;
    elevations = new Float32Array(cellCount);
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const value = data.z[row][column];
        elevations[toFlat(row, column)] = value === null ? Number.NaN : value;
      }
    }
    return elevations;
  }

  function cellIndex(easting, northing) {
    const column = Math.round((easting - data.x[0]) / xStep);
    const row = Math.round((northing - data.y[0]) / yStep);
    if (row < 0 || row >= rows || column < 0 || column >= columns) return -1;
    return toFlat(row, column);
  }

  function cellCenter(index) {
    return { x: data.x[columnOf(index)], y: data.y[rowOf(index)] };
  }

  function elevationAt(index) {
    return elevationArray()[index];
  }

  function isValid(index) {
    return index >= 0 && index < cellCount && !Number.isNaN(elevationArray()[index]);
  }

  function forEachNeighbor(index, callback) {
    const row = rowOf(index);
    const column = columnOf(index);
    for (const [rowOffset, columnOffset] of NEIGHBOR_OFFSETS) {
      const neighborRow = row + rowOffset;
      const neighborColumn = column + columnOffset;
      if (neighborRow < 0 || neighborRow >= rows || neighborColumn < 0 || neighborColumn >= columns) continue;
      const distance = rowOffset && columnOffset ? cellSize * Math.SQRT2 : cellSize;
      callback(toFlat(neighborRow, neighborColumn), distance);
    }
  }

  function isBorderCell(index) {
    const row = rowOf(index);
    const column = columnOf(index);
    if (row === 0 || column === 0 || row === rows - 1 || column === columns - 1) return true;
    let touchesVoid = false;
    forEachNeighbor(index, neighbor => {
      if (!isValid(neighbor)) touchesVoid = true;
    });
    return touchesVoid;
  }

  // Índices válidos ordenados por elevación ascendente: permite mover la cota de inundación
  // avanzando un puntero en lugar de recorrer la malla completa en cada cambio.
  function indicesByElevation() {
    const values = elevationArray();
    const indices = [];
    for (let index = 0; index < cellCount; index += 1) {
      if (!Number.isNaN(values[index])) indices.push(index);
    }
    indices.sort((first, second) => values[first] - values[second]);
    return Int32Array.from(indices);
  }

  return Object.freeze({
    rows,
    columns,
    cellCount,
    cellArea,
    cellSize,
    xStep,
    yStep,
    toFlat,
    rowOf,
    columnOf,
    cellIndex,
    cellCenter,
    elevationAt,
    elevationArray,
    isValid,
    isBorderCell,
    forEachNeighbor,
    indicesByElevation
  });
}
