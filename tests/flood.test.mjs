import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrid } from '../dist/js/domain/grid.js';
import { createFloodModel } from '../dist/js/domain/flood.js';

// Malla de 5x5 con celdas de 10 m: meseta a 10 m y una depresión aislada a 1 m en el centro,
// más un canal bajo en la primera columna que llega al borde.
const data = {
  x: [0, 10, 20, 30, 40],
  y: [40, 30, 20, 10, 0],
  z: [
    [2, 10, 10, 10, 10],
    [2, 10, 10, 10, 10],
    [2, 10, 1, 10, 10],
    [2, 10, 10, 10, 10],
    [2, 10, 10, 10, 10]
  ]
};

const grid = createGrid(data);
const flood = createFloodModel(grid);

test('publica el rango real de elevaciones', () => {
  assert.equal(flood.minimum, 1);
  assert.equal(flood.maximum, 10);
  assert.equal(flood.validCells, 25);
});

test('la cota simple inunda toda celda por debajo del nivel', () => {
  const resultado = flood.floodAt(5);
  // Cinco celdas del canal a 2 m más la depresión a 1 m.
  assert.equal(resultado.celdas, 6);
  assert.equal(resultado.area, 600);
  assert.equal(resultado.volumen, (5 * 6 - (2 * 5 + 1)) * 100);
});

test('el modo conectado descarta la depresión aislada', () => {
  const simple = flood.floodAt(5);
  const conectado = flood.floodAt(5, { conectado: true });
  assert.equal(conectado.celdas, simple.celdas - 1);
  assert.equal(conectado.mask[grid.toFlat(2, 2)], 0);
  assert.equal(conectado.mask[grid.toFlat(0, 0)], 1);
});

test('con la cota máxima se inunda toda el área', () => {
  const resultado = flood.floodAt(flood.maximum);
  assert.equal(resultado.celdas, flood.validCells);
  assert.equal(resultado.area, flood.validArea);
});

test('por debajo del mínimo no hay agua', () => {
  const resultado = flood.floodAt(flood.minimum - 1);
  assert.equal(resultado.celdas, 0);
  assert.equal(resultado.volumen, 0);
});
