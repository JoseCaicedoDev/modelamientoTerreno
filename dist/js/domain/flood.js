// Inundación por cota sobre la malla del DEM.
//
// El orden de celdas por elevación se calcula una sola vez: con él, el área y el volumen de
// cualquier cota se obtienen con una búsqueda binaria y una suma acumulada, sin recorrer la malla.

export function createFloodModel(grid) {
  const ordered = grid.indicesByElevation();
  const elevations = grid.elevationArray();
  const prefixElevation = new Float64Array(ordered.length + 1);
  for (let position = 0; position < ordered.length; position += 1) {
    prefixElevation[position + 1] = prefixElevation[position] + elevations[ordered[position]];
  }

  const minimum = ordered.length ? elevations[ordered[0]] : 0;
  const maximum = ordered.length ? elevations[ordered[ordered.length - 1]] : 0;

  // Número de celdas con cota menor o igual al nivel dado.
  function countBelow(level) {
    let low = 0;
    let high = ordered.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (elevations[ordered[middle]] <= level) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  function bathtubMask(level, count) {
    const mask = new Uint8Array(grid.cellCount);
    for (let position = 0; position < count; position += 1) mask[ordered[position]] = 1;
    return mask;
  }

  // Solo el agua que puede alcanzar el borde del área: descarta depresiones cerradas sin aporte.
  function connectedMask(level) {
    const mask = new Uint8Array(grid.cellCount);
    const queue = [];
    for (let position = 0; position < ordered.length; position += 1) {
      const index = ordered[position];
      if (elevations[index] > level) break;
      if (!grid.isBorderCell(index)) continue;
      mask[index] = 1;
      queue.push(index);
    }
    while (queue.length) {
      const index = queue.pop();
      grid.forEachNeighbor(index, neighbor => {
        if (mask[neighbor] || !grid.isValid(neighbor)) return;
        if (elevations[neighbor] > level) return;
        mask[neighbor] = 1;
        queue.push(neighbor);
      });
    }
    return mask;
  }

  function summarize(mask, level) {
    let celdas = 0;
    let volumen = 0;
    for (let index = 0; index < mask.length; index += 1) {
      if (!mask[index]) continue;
      celdas += 1;
      volumen += level - elevations[index];
    }
    return { celdas, volumen: volumen * grid.cellArea };
  }

  function floodAt(level, { conectado = false } = {}) {
    const count = countBelow(level);
    if (!conectado) {
      const volumen = (count * level - prefixElevation[count]) * grid.cellArea;
      return {
        mask: bathtubMask(level, count),
        celdas: count,
        area: count * grid.cellArea,
        volumen,
        nivel: level
      };
    }
    const mask = connectedMask(level);
    const resumen = summarize(mask, level);
    return {
      mask,
      celdas: resumen.celdas,
      area: resumen.celdas * grid.cellArea,
      volumen: resumen.volumen,
      nivel: level
    };
  }

  return Object.freeze({
    floodAt,
    minimum,
    maximum,
    validCells: ordered.length,
    validArea: ordered.length * grid.cellArea
  });
}
