import test from 'node:test';
import assert from 'node:assert/strict';
import {
  caudalDeLluvia,
  estimarLlenado,
  laminaEquivalente,
  REGIMEN_CAUDAL,
  REGIMEN_LLUVIA,
  tiempoDeLlenado
} from '../dist/js/domain/flood-timing.js';

test('el método racional convierte intensidad y área en caudal', () => {
  // 36 mm/h sobre 1 km² con C = 1 son exactamente 10 m³/s.
  const caudal = caudalDeLluvia({ areaAportante: 1e6, intensidad: 36, coeficiente: 1 });
  assert.equal(caudal, 10);
});

test('el coeficiente de escorrentía escala el caudal linealmente', () => {
  const total = caudalDeLluvia({ areaAportante: 1e6, intensidad: 36, coeficiente: 1 });
  const parcial = caudalDeLluvia({ areaAportante: 1e6, intensidad: 36, coeficiente: 0.4 });
  assert.ok(Math.abs(parcial - total * 0.4) < 1e-9);
});

test('sin intensidad, área o coeficiente no hay caudal', () => {
  assert.equal(caudalDeLluvia({ areaAportante: 0, intensidad: 36, coeficiente: 1 }), 0);
  assert.equal(caudalDeLluvia({ areaAportante: 1e6, intensidad: 0, coeficiente: 1 }), 0);
  assert.equal(caudalDeLluvia({ areaAportante: 1e6, intensidad: 36, coeficiente: 0 }), 0);
});

test('el tiempo de llenado es el volumen dividido por el caudal', () => {
  assert.equal(tiempoDeLlenado(3600, 1), 3600);
  assert.equal(tiempoDeLlenado(0, 10), 0);
  assert.equal(tiempoDeLlenado(100, 0), Infinity);
});

test('la lámina equivalente reparte el volumen sobre el área aportante', () => {
  // 1.000 m³ sobre 1 km² son 1 mm de escorrentía.
  assert.equal(laminaEquivalente(1000, { areaAportante: 1e6 }), 1);
  // Con C = 0,5 hace falta el doble de lluvia bruta.
  assert.equal(laminaEquivalente(1000, { areaAportante: 1e6, coeficiente: 0.5 }), 2);
});

test('el régimen de lluvia devuelve caudal, tiempo y lámina bruta', () => {
  const resultado = estimarLlenado(36000, REGIMEN_LLUVIA, {
    areaAportante: 1e6,
    intensidad: 36,
    coeficiente: 1
  });
  assert.equal(resultado.regimen, REGIMEN_LLUVIA);
  assert.equal(resultado.caudal, 10);
  assert.equal(resultado.segundos, 3600);
  assert.equal(resultado.lamina, 36);
});

test('el régimen de caudal ignora la lluvia y usa el aporte externo', () => {
  const resultado = estimarLlenado(36000, REGIMEN_CAUDAL, {
    areaAportante: 1e6,
    intensidad: 120,
    coeficiente: 1,
    caudal: 20
  });
  assert.equal(resultado.caudal, 20);
  assert.equal(resultado.segundos, 1800);
  // En modo caudal la lámina es escorrentía efectiva, sin dividir por el coeficiente.
  assert.equal(resultado.lamina, 36);
});

test('sin aporte el llenado no termina nunca', () => {
  const resultado = estimarLlenado(1000, REGIMEN_CAUDAL, { areaAportante: 1e6, caudal: 0 });
  assert.equal(resultado.segundos, Infinity);
});
