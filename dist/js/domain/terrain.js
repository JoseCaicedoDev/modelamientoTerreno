export function createTerrainModel(data) {
  const xStep = data.x[1] - data.x[0];
  const yStep = data.y[1] - data.y[0];

  function nearestPoint(easting, northing) {
    const column = Math.round((easting - data.x[0]) / xStep);
    const row = Math.round((northing - data.y[0]) / yStep);
    if (column < 0 || column >= data.x.length || row < 0 || row >= data.y.length) return null;

    let nearest = null;
    for (let radius = 0; radius <= 5 && !nearest; radius += 1) {
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
          const candidateRow = row + rowOffset;
          const candidateColumn = column + columnOffset;
          if (candidateRow < 0 || candidateRow >= data.y.length || candidateColumn < 0 || candidateColumn >= data.x.length) continue;
          const elevation = data.z[candidateRow][candidateColumn];
          if (elevation === null) continue;
          const distance = Math.hypot(data.x[candidateColumn] - easting, data.y[candidateRow] - northing);
          if (!nearest || distance < nearest.distance) {
            nearest = {
              x: data.x[candidateColumn],
              y: data.y[candidateRow],
              z: elevation,
              distance
            };
          }
        }
      }
    }
    return nearest;
  }

  function sampleLine(start, end) {
    const totalDistance = Math.hypot(end.x - start.x, end.y - start.y);
    if (totalDistance <= 0) return { samples: [], totalDistance: 0 };
    const sampleCount = Math.min(240, Math.max(2, Math.ceil(totalDistance / 30) + 1));
    const samples = [];
    for (let index = 0; index < sampleCount; index += 1) {
      const progress = index / (sampleCount - 1);
      const point = nearestPoint(
        start.x + (end.x - start.x) * progress,
        start.y + (end.y - start.y) * progress
      );
      if (point) samples.push({ ...point, distance: totalDistance * progress });
    }
    return { samples, totalDistance };
  }

  return Object.freeze({ data, nearestPoint, sampleLine });
}

export function buildSatelliteMeshData(data) {
  const x = [];
  const y = [];
  const z = [];
  const vertexcolor = [];
  const vertexIndex = data.z.map(row => row.map(() => -1));

  data.z.forEach((row, rowIndex) => {
    row.forEach((elevation, columnIndex) => {
      if (elevation === null) return;
      vertexIndex[rowIndex][columnIndex] = x.length;
      x.push(data.x[columnIndex]);
      y.push(data.y[rowIndex]);
      z.push(elevation);
      vertexcolor.push(data.satellite[rowIndex][columnIndex]);
    });
  });

  const i = [];
  const j = [];
  const k = [];
  for (let row = 0; row < vertexIndex.length - 1; row += 1) {
    for (let column = 0; column < vertexIndex[row].length - 1; column += 1) {
      const northwest = vertexIndex[row][column];
      const northeast = vertexIndex[row][column + 1];
      const southwest = vertexIndex[row + 1][column];
      const southeast = vertexIndex[row + 1][column + 1];
      if ([northwest, northeast, southwest, southeast].some(index => index < 0)) continue;
      i.push(northwest, northeast);
      j.push(southwest, southwest);
      k.push(northeast, southeast);
    }
  }

  return { x, y, z, vertexcolor, i, j, k };
}
