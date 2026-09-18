import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrid } from '../dist/js/domain/grid.js';
import { boundingBox, fanTriangulation, pointInPolygon, polygonArea, polylineLength, slopeFactor } from '../dist/js/domain/geometry.js';

// Malla de 3x3 con celdas de 10 m y un hueco en el centro, como el de las zonas fuera del área.
const terrainData = {
  x: [0, 10, 20],
  y: [20, 10, 0],
  z: [
    [1, 2, 3],
    [4, null, 6],
    [7, 8, 9]
  ]
};

test('convierte entre coordenadas UTM e índices de celda', () => {
  const grid = createGrid(terrainData);
  assert.equal(grid.rows, 3);
  assert.equal(grid.columns, 3);
  assert.equal(grid.cellArea, 100);
  assert.equal(grid.cellIndex(0, 20), 0);
  assert.equal(grid.cellIndex(20, 0), 8);
  assert.equal(grid.cellIndex(-40, 20), -1);
  assert.deepEqual(grid.cellCenter(4), { x: 10, y: 10 });
});

test('marca como inválidas las celdas nulas', () => {
  const grid = createGrid(terrainData);
  assert.equal(grid.isValid(4), false);
  assert.equal(grid.isValid(0), true);
  assert.ok(Number.isNaN(grid.elevationAt(4)));
});

test('ordena los índices válidos por elevación ascendente', () => {
  const grid = createGrid(terrainData);
  const ordered = [...grid.indicesByElevation()];
  assert.equal(ordered.length, 8);
  assert.equal(grid.elevationAt(ordered[0]), 1);
  assert.equal(grid.elevationAt(ordered.at(-1)), 9);
});

test('recorre los ocho vecinos con su distancia', () => {
  const grid = createGrid(terrainData);
  const distances = [];
  grid.forEachNeighbor(4, (_, distance) => distances.push(Math.round(distance)));
  assert.equal(distances.length, 8);
  assert.equal(distances.filter(distance => distance === 10).length, 4);
  assert.equal(distances.filter(distance => distance === 14).length, 4);
});

test('calcula longitudes y áreas planas', () => {
  const cuadrado = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  assert.equal(polygonArea(cuadrado), 10000);
  assert.equal(polylineLength([{ x: 0, y: 0 }, { x: 30, y: 40 }]), 50);
  assert.deepEqual(boundingBox(cuadrado), { minX: 0, minY: 0, maxX: 100, maxY: 100 });
  assert.equal(pointInPolygon(50, 50, cuadrado), true);
  assert.equal(pointInPolygon(150, 50, cuadrado), false);
});

test('el factor de drapeado crece con la pendiente', () => {
  const plano = createGrid({
    x: [0, 10, 20],
    y: [20, 10, 0],
    z: [[5, 5, 5], [5, 5, 5], [5, 5, 5]]
  });
  assert.equal(slopeFactor(plano, 4), 1);

  // Rampa de 10 m de desnivel cada 10 m: pendiente 1, factor sqrt(2).
  const rampa = createGrid({
    x: [0, 10, 20],
    y: [20, 10, 0],
    z: [[0, 10, 20], [0, 10, 20], [0, 10, 20]]
  });
  assert.ok(Math.abs(slopeFactor(rampa, 4) - Math.SQRT2) < 1e-6);
});

test('triangula un polígono convexo en abanico', () => {
  const mesh = fanTriangulation([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }]);
  assert.equal(mesh.x.length, 5);
  assert.equal(mesh.i.length, 4);
  assert.deepEqual(mesh.i, [0, 0, 0, 0]);
});
