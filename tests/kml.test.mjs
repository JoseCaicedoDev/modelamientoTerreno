import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { kmlColorToCss, parseCoordinates } from '../dist/js/domain/kml.js';
import { extractKmlFromKmz, looksLikeZip } from '../dist/js/domain/kmz.js';

const fixture = name => fileURLToPath(new URL(`fixtures/${name}`, import.meta.url));

test('interpreta las coordenadas de un KML', () => {
  const coordinates = parseCoordinates('\n  -63.44,8.21,0 -63.43,8.22,15\n ');
  assert.deepEqual(coordinates, [[-63.44, 8.21, 0], [-63.43, 8.22, 15]]);
});

test('descarta tuplas incompletas', () => {
  assert.deepEqual(parseCoordinates('-63.44 8.21,x'), []);
  assert.deepEqual(parseCoordinates('-63.44,8.21'), [[-63.44, 8.21]]);
});

test('convierte el color aabbggrr de KML a #rrggbb', () => {
  assert.equal(kmlColorToCss('ff00ffaa'), '#aaff00');
  assert.equal(kmlColorToCss(''), null);
});

test('reconoce la firma de un archivo ZIP', () => {
  const kmz = readFileSync(fixture('muestra.kmz'));
  const kml = readFileSync(fixture('muestra.kml'));
  assert.equal(looksLikeZip(kmz.buffer.slice(kmz.byteOffset, kmz.byteOffset + kmz.byteLength)), true);
  assert.equal(looksLikeZip(kml.buffer.slice(kml.byteOffset, kml.byteOffset + kml.byteLength)), false);
});

test('extrae el KML comprimido dentro de un KMZ', async () => {
  const kmz = readFileSync(fixture('muestra.kmz'));
  const texto = await extractKmlFromKmz(kmz.buffer.slice(kmz.byteOffset, kmz.byteOffset + kmz.byteLength));
  const original = readFileSync(fixture('muestra.kml'), 'utf8');
  assert.equal(texto, original);
  assert.ok(texto.includes('<Placemark>'));
});

test('avisa cuando el KMZ no trae ningún KML', async () => {
  const kmz = readFileSync(fixture('muestra.kmz'));
  const copia = new Uint8Array(kmz);
  // Se renombra doc.kml a doc.txt allí donde aparezca, buscando sobre los bytes.
  const patron = [...'doc.kml'].map(letra => letra.charCodeAt(0));
  let renombrados = 0;
  for (let offset = 0; offset <= copia.length - patron.length; offset += 1) {
    if (patron.some((valor, indice) => copia[offset + indice] !== valor)) continue;
    copia.set([...'txt'].map(letra => letra.charCodeAt(0)), offset + 4);
    renombrados += 1;
  }
  assert.ok(renombrados >= 1);
  await assert.rejects(() => extractKmlFromKmz(copia.buffer), /no contiene ningún archivo/);
});
