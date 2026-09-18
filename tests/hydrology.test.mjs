import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrid } from '../dist/js/domain/grid.js';
import { createHydrologyModel } from '../dist/js/domain/hydrology.js';

// Ladera de 5x5 con celdas de 10 m que baja hacia el este.
const ladera = {
  x: [0, 10, 20, 30, 40],
  y: [40, 30, 20, 10, 0],
  z: Array.from({ length: 5 }, () => [40, 30, 20, 10, 0])
};

// La misma ladera con un hoyo cerrado en el centro: más bajo que todos sus vecinos.
const conHoyo = {
  x: [0, 10, 20, 30, 40],
  y: [40, 30, 20, 10, 0],
  z: [
    [40, 30, 20, 10, 0],
    [40, 30, 20, 10, 0],
    [40, 30, 5, 10, 0],
    [40, 30, 20, 10, 0],
    [40, 30, 20, 10, 0]
  ]
};

test('el DEM rellenado nunca queda por debajo del original', () => {
  const grid = createGrid(conHoyo);
  const { filled } = createHydrologyModel(grid).compute();
  const elevations = grid.elevationArray();
  for (let index = 0; index < grid.cellCount; index += 1) {
    if (!grid.isValid(index)) continue;
    assert.ok(filled[index] >= elevations[index] - 1e-6);
  }
});

test('rellena la depresión hasta el nivel de desborde', () => {
  const grid = createGrid(conHoyo);
  const { depth, maximumDepth } = createHydrologyModel(grid).compute();
  const hoyo = grid.toFlat(2, 2);
  // El hoyo está a 5 m y desborda por su vecino más bajo, que está a 10 m.
  assert.ok(depth[hoyo] > 4.9 && depth[hoyo] < 5.1);
  assert.ok(Math.abs(maximumDepth - depth[hoyo]) < 1e-6);
});

test('el flujo desciende por la ladera y se acumula en la salida', () => {
  const grid = createGrid(ladera);
  const { receivers, accumulation } = createHydrologyModel(grid).compute();
  const centro = grid.toFlat(2, 2);
  assert.equal(receivers[centro], grid.toFlat(2, 3));
  // Cada fila aporta sus cinco celdas a la columna de salida.
  assert.equal(accumulation[grid.toFlat(2, 4)], 5);
  assert.equal(receivers[grid.toFlat(2, 4)], -1);
});

test('el umbral de cuenca se expresa en hectáreas', () => {
  const grid = createGrid(ladera);
  const hydrology = createHydrologyModel(grid);
  // Celdas de 100 m²: una hectárea son cien celdas de cuenca aportante.
  assert.equal(hydrology.cellsForCatchment(1), 100);
  const exigente = hydrology.streams(1);
  const laxo = hydrology.streams(0.01);
  assert.ok(laxo.cells.length > exigente.cells.length);
});

test('el encharcamiento crece al bajar el umbral de profundidad', () => {
  const hydrology = createHydrologyModel(createGrid(conHoyo));
  assert.equal(hydrology.ponding(6).cells.length, 0);
  assert.equal(hydrology.ponding(1).cells.length, 1);
});
