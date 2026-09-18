// Hidrología derivada del DEM: relleno de depresiones, direcciones de flujo D8 y acumulación.
// Todo se calcula en el navegador la primera vez que se pide y se conserva en memoria.

const FLAT_EPSILON = 1e-5;

// Montículo binario mínimo sobre índices de celda, ordenado por la cota rellenada.
function createMinHeap(priorities) {
  const items = [];

  function swap(first, second) {
    const temporary = items[first];
    items[first] = items[second];
    items[second] = temporary;
  }

  function push(index) {
    items.push(index);
    let position = items.length - 1;
    while (position > 0) {
      const parent = (position - 1) >> 1;
      if (priorities[items[parent]] <= priorities[items[position]]) break;
      swap(parent, position);
      position = parent;
    }
  }

  function pop() {
    const top = items[0];
    const last = items.pop();
    if (items.length) {
      items[0] = last;
      let position = 0;
      for (;;) {
        const left = position * 2 + 1;
        const right = left + 1;
        let smallest = position;
        if (left < items.length && priorities[items[left]] < priorities[items[smallest]]) smallest = left;
        if (right < items.length && priorities[items[right]] < priorities[items[smallest]]) smallest = right;
        if (smallest === position) break;
        swap(smallest, position);
        position = smallest;
      }
    }
    return top;
  }

  return { push, pop, get size() { return items.length; } };
}

export function createHydrologyModel(grid) {
  let cache = null;

  // Priority-Flood: rellena las depresiones partiendo del borde del área hacia adentro.
  function fillDepressions() {
    const elevations = grid.elevationArray();
    const filled = new Float32Array(grid.cellCount).fill(Number.NaN);
    const closed = new Uint8Array(grid.cellCount);
    const heap = createMinHeap(filled);

    for (let index = 0; index < grid.cellCount; index += 1) {
      if (!grid.isValid(index) || !grid.isBorderCell(index)) continue;
      filled[index] = elevations[index];
      closed[index] = 1;
      heap.push(index);
    }

    while (heap.size) {
      const index = heap.pop();
      grid.forEachNeighbor(index, neighbor => {
        if (closed[neighbor] || !grid.isValid(neighbor)) return;
        filled[neighbor] = Math.max(elevations[neighbor], filled[index] + FLAT_EPSILON);
        closed[neighbor] = 1;
        heap.push(neighbor);
      });
    }
    return filled;
  }

  // Dirección de flujo D8 sobre el DEM rellenado: vecino de mayor pendiente descendente.
  function flowDirections(filled) {
    const receivers = new Int32Array(grid.cellCount).fill(-1);
    for (let index = 0; index < grid.cellCount; index += 1) {
      if (!grid.isValid(index)) continue;
      let bestSlope = 0;
      let best = -1;
      grid.forEachNeighbor(index, (neighbor, distance) => {
        if (!grid.isValid(neighbor)) return;
        const slope = (filled[index] - filled[neighbor]) / distance;
        if (slope > bestSlope) {
          bestSlope = slope;
          best = neighbor;
        }
      });
      receivers[index] = best;
    }
    return receivers;
  }

  // Acumulación: una pasada de mayor a menor cota rellenada, empujando el aporte al receptor.
  function flowAccumulation(filled, receivers) {
    const accumulation = new Float32Array(grid.cellCount);
    const order = [];
    for (let index = 0; index < grid.cellCount; index += 1) {
      if (!grid.isValid(index)) continue;
      accumulation[index] = 1;
      order.push(index);
    }
    order.sort((first, second) => filled[second] - filled[first]);
    for (const index of order) {
      const receiver = receivers[index];
      if (receiver >= 0) accumulation[receiver] += accumulation[index];
    }
    return accumulation;
  }

  function compute() {
    if (cache) return cache;
    const started = performance.now();
    const elevations = grid.elevationArray();
    const filled = fillDepressions();
    const depth = new Float32Array(grid.cellCount);
    let maximumDepth = 0;
    for (let index = 0; index < grid.cellCount; index += 1) {
      if (!grid.isValid(index)) continue;
      depth[index] = Math.max(0, filled[index] - elevations[index]);
      if (depth[index] > maximumDepth) maximumDepth = depth[index];
    }
    const receivers = flowDirections(filled);
    const accumulation = flowAccumulation(filled, receivers);
    cache = {
      filled,
      depth,
      receivers,
      accumulation,
      maximumDepth,
      duracion: performance.now() - started
    };
    return cache;
  }

  // Umbral expresado en hectáreas de cuenca aportante.
  function cellsForCatchment(hectares) {
    return Math.max(1, (hectares * 10000) / grid.cellArea);
  }

  function streams(hectares) {
    const { accumulation, receivers } = compute();
    const minimumCells = cellsForCatchment(hectares);
    const cells = [];
    for (let index = 0; index < grid.cellCount; index += 1) {
      if (grid.isValid(index) && accumulation[index] >= minimumCells) cells.push(index);
    }
    return { cells, minimumCells, receivers };
  }

  // Tramos cauce → receptor, listos para dibujarse como líneas en el 3D.
  function streamSegments(hectares, elevationOffset = 0.3) {
    const { cells, minimumCells } = streams(hectares);
    const { accumulation, receivers } = compute();
    const elevations = grid.elevationArray();
    const x = [];
    const y = [];
    const z = [];
    let length = 0;
    for (const index of cells) {
      const receiver = receivers[index];
      if (receiver < 0 || accumulation[receiver] < minimumCells) continue;
      const from = grid.cellCenter(index);
      const to = grid.cellCenter(receiver);
      x.push(from.x, to.x, null);
      y.push(from.y, to.y, null);
      z.push(elevations[index] + elevationOffset, elevations[receiver] + elevationOffset, null);
      length += Math.hypot(to.x - from.x, to.y - from.y);
    }
    return { x, y, z, length, cells };
  }

  function ponding(minimumDepth) {
    const { depth } = compute();
    const cells = [];
    for (let index = 0; index < grid.cellCount; index += 1) {
      if (grid.isValid(index) && depth[index] >= minimumDepth) cells.push(index);
    }
    return { cells, area: cells.length * grid.cellArea, depth };
  }

  return Object.freeze({ compute, streams, streamSegments, ponding, cellsForCatchment });
}
