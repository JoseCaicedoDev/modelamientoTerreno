import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSatelliteMeshData, createTerrainModel } from '../dist/js/domain/terrain.js';

const terrainData = {
  x: [0, 10, 20],
  y: [0, 10, 20],
  z: [
    [1, 2, 3],
    [4, null, 6],
    [7, 8, 9]
  ]
};

test('encuentra la celda válida más cercana y respeta los límites', () => {
  const terrain = createTerrainModel(terrainData);
  assert.deepEqual(terrain.nearestPoint(9, 1), { x: 10, y: 0, z: 2, distance: Math.sqrt(2) });
  assert.equal(terrain.nearestPoint(-50, -50), null);
});

test('muestrea una línea con distancia acumulada y extremos válidos', () => {
  const terrain = createTerrainModel(terrainData);
  const profile = terrain.sampleLine({ x: 0, y: 0 }, { x: 20, y: 20 });
  assert.equal(profile.samples.length, 2);
  assert.equal(profile.samples[0].z, 1);
  assert.equal(profile.samples[1].z, 9);
  assert.equal(profile.samples[1].distance, profile.totalDistance);
  assert.ok(Math.abs(profile.totalDistance - Math.hypot(20, 20)) < Number.EPSILON);
});

test('construye dos triángulos para una celda completa', () => {
  const mesh = buildSatelliteMeshData({
    x: [0, 10],
    y: [0, 10],
    z: [[1, 2], [3, 4]],
    satellite: [['#111111', '#222222'], ['#333333', '#444444']]
  });
  assert.equal(mesh.x.length, 4);
  assert.equal(mesh.i.length, 2);
  assert.deepEqual(mesh.vertexcolor, ['#111111', '#222222', '#333333', '#444444']);
});
