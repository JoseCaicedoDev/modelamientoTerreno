import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrid } from '../dist/js/domain/grid.js';
import { createTerrainModel } from '../dist/js/domain/terrain.js';
import { measurePath } from '../dist/js/domain/measure.js';

// Malla plana de 5x5 con celdas de 10 m, cota constante.
const plano = {
  x: [0, 10, 20, 30, 40],
  y: [40, 30, 20, 10, 0],
  z: Array.from({ length: 5 }, () => new Array(5).fill(10))
};

// Rampa: sube 10 m por cada 10 m hacia el este, pendiente del 100 %.
const rampa = {
  x: [0, 10, 20, 30, 40],
  y: [40, 30, 20, 10, 0],
  z: Array.from({ length: 5 }, () => [0, 10, 20, 30, 40])
};

function contexto(data) {
  return { terrain: createTerrainModel(data), grid: createGrid(data) };
}

test('mide una polilínea abierta sobre terreno plano', () => {
  const medida = measurePath(
    [{ x: 0, y: 40, z: 10 }, { x: 40, y: 40, z: 10 }],
    { ...contexto(plano), cerrado: false }
  );
  assert.equal(medida.cerrado, false);
  assert.equal(medida.longitudProyectada, 40);
  assert.ok(Math.abs(medida.longitudDrapeada - 40) < 1e-6);
  assert.equal(medida.desnivel, 0);
  assert.equal(medida.area, undefined);
});

test('la longitud sobre el relieve supera a la proyectada en pendiente', () => {
  const medida = measurePath(
    [{ x: 0, y: 40, z: 0 }, { x: 40, y: 40, z: 40 }],
    { ...contexto(rampa), cerrado: false }
  );
  assert.equal(medida.longitudProyectada, 40);
  assert.ok(medida.longitudDrapeada > medida.longitudProyectada);
  assert.ok(Math.abs(medida.longitudDrapeada - Math.hypot(40, 40)) < 1);
  assert.equal(medida.desnivel, 40);
});

test('mide un polígono cerrado y su área real', () => {
  const cuadrado = [
    { x: 0, y: 40, z: 10 },
    { x: 40, y: 40, z: 10 },
    { x: 40, y: 0, z: 10 },
    { x: 0, y: 0, z: 10 }
  ];
  const medida = measurePath(cuadrado, { ...contexto(plano), cerrado: true });
  assert.equal(medida.area, 1600);
  assert.equal(medida.areaHectareas, 0.16);
  assert.equal(medida.perimetro, 160);
  assert.equal(medida.factorDrapeado, 1);
  assert.equal(medida.areaReal, 1600);
});

test('en pendiente el área real supera a la proyectada', () => {
  const cuadrado = [
    { x: 0, y: 40, z: 0 },
    { x: 40, y: 40, z: 40 },
    { x: 40, y: 0, z: 40 },
    { x: 0, y: 0, z: 0 }
  ];
  const medida = measurePath(cuadrado, { ...contexto(rampa), cerrado: true });
  assert.equal(medida.area, 1600);
  assert.ok(Math.abs(medida.factorDrapeado - Math.SQRT2) < 0.05);
  assert.ok(medida.areaReal > medida.area);
});

test('descarta recorridos de menos de dos vértices', () => {
  assert.equal(measurePath([{ x: 0, y: 0, z: 1 }], contexto(plano)), null);
});
