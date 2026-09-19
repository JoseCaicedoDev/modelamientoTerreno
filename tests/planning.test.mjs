import test from 'node:test';
import assert from 'node:assert/strict';
import { createGrid } from '../dist/js/domain/grid.js';
import { createTerrainModel } from '../dist/js/domain/terrain.js';
import {
  analyzeVisibility,
  generatePlan,
  movePlanPoint,
  removePlanPoint
} from '../dist/js/domain/planning.js';
import {
  buildPrintableReport,
  kmlToKmz,
  parsePlanningProject,
  planToKml,
  pointsToCsv,
  pointsToPenzd,
  serializePlanningProject
} from '../dist/js/domain/planning-export.js';
import { extractKmlFromKmz, looksLikeZip } from '../dist/js/domain/kmz.js';

function terrainData({ ridge = false } = {}) {
  const x = Array.from({ length: 21 }, (_, index) => index * 25);
  const y = Array.from({ length: 21 }, (_, index) => 500 - index * 25);
  const z = y.map((_, row) => x.map((__, column) => ridge && column === 10 ? 80 : 10 + row * 0.2));
  return { x, y, z };
}

function context(options) {
  const data = terrainData(options);
  return { terrain: createTerrainModel(data), grid: createGrid(data) };
}

function areaProject(overrides = {}) {
  return {
    name: 'Prueba de campo',
    geometry: [{ x: 25, y: 475 }, { x: 475, y: 475 }, { x: 475, y: 25 }, { x: 25, y: 25 }],
    exclusions: [],
    accesses: [[{ x: 25, y: 250 }, { x: 475, y: 250 }]],
    controls: [{ id: 'CTL-01', x: 50, y: 450, z: 10 }],
    fixedPoints: [],
    settings: { tipo: 'area', metodo: 'combinado', alternativa: 'cobertura', gcp: 5, checkpoints: 2 },
    ...overrides
  };
}

test('genera GCP, checkpoints independientes y conexiones para un área', () => {
  const plan = generatePlan(areaProject(), context());
  assert.equal(plan.stats.gcp, 5);
  assert.equal(plan.stats.checkpoint, 2);
  assert.equal(plan.stats.control, 1);
  assert.ok(plan.connections.length >= 7);
  assert.equal(new Set(plan.points.map(point => point.id)).size, plan.points.length);
  assert.ok(plan.points.filter(point => point.role === 'checkpoint').every(point => !point.id.startsWith('GCP')));
});

test('respeta una zona excluida', () => {
  const exclusion = [{ x: 0, y: 500 }, { x: 250, y: 500 }, { x: 250, y: 250 }, { x: 0, y: 250 }];
  const plan = generatePlan(areaProject({ exclusions: [exclusion] }), context());
  assert.ok(plan.points.filter(point => point.role !== 'control').every(point => !(point.x < 250 && point.y > 250)));
});

test('distribuye puntos alternados en un corredor', () => {
  const project = areaProject({
    geometry: [{ x: 25, y: 250 }, { x: 475, y: 250 }],
    settings: { tipo: 'corredor', metodo: 'gnss', alternativa: 'cobertura', gcp: 6, checkpoints: 2, anchoCorredor: 250 }
  });
  const plan = generatePlan(project, context());
  const gcps = plan.points.filter(point => point.role === 'gcp');
  assert.equal(gcps.length, 6);
  assert.ok(gcps.some(point => point.y > 250));
  assert.ok(gcps.some(point => point.y < 250));
});

test('una cresta bloquea la visual de estación total', () => {
  const terrain = context({ ridge: true }).terrain;
  const result = analyzeVisibility(
    { x: 50, y: 250, z: 10 },
    { x: 450, y: 250, z: 10 },
    terrain,
    { instrumentHeight: 1.5, targetHeight: 2 }
  );
  assert.equal(result.visible, false);
  assert.ok(result.clearance < 0);
});

test('mover fija el punto y eliminar actualiza las conexiones', () => {
  const ctx = context();
  const project = areaProject();
  const original = generatePlan(project, ctx);
  const target = original.points.find(point => point.role === 'gcp');
  const moved = movePlanPoint(original, target.id, { x: 300, y: 300 }, ctx);
  assert.equal(moved.points.find(point => point.id === target.id).fixed, true);
  const reduced = removePlanPoint(moved, target.id, ctx);
  assert.equal(reduced.points.some(point => point.id === target.id), false);
  assert.ok(reduced.connections.every(connection => connection.from !== target.id && connection.to !== target.id));
});

test('regenerar conserva el punto fijado sin duplicar identificadores', () => {
  const ctx = context();
  const project = areaProject();
  const original = generatePlan(project, ctx);
  const target = original.points.find(point => point.role === 'gcp');
  const moved = movePlanPoint(original, target.id, { x: 300, y: 300 }, ctx);
  const regenerated = generatePlan({ ...project, fixedPoints: moved.points.filter(point => point.fixed && point.role !== 'control') }, ctx);
  assert.equal(regenerated.points.find(point => point.id === target.id).x, 300);
  assert.equal(new Set(regenerated.points.map(point => point.id)).size, regenerated.points.length);
});

test('exporta puntos coherentes en CSV, PENZD, KML, KMZ e informe', async () => {
  const project = areaProject();
  const plan = generatePlan(project, context());
  const csv = pointsToCsv(plan);
  const penzd = pointsToPenzd(plan);
  const kml = planToKml(plan, (x, y) => [x / 1000, y / 1000]);
  const kmz = kmlToKmz(kml);
  const buffer = await kmz.arrayBuffer();
  const report = buildPrintableReport(plan, { crs: 'EPSG:32620', source: 'DEM de prueba' });
  assert.ok(csv.includes('GCP-01'));
  assert.ok(penzd.includes('GCP-01_GCP'));
  assert.ok(kml.includes('<kml'));
  assert.equal(looksLikeZip(buffer), true);
  assert.equal(await extractKmlFromKmz(buffer), kml);
  assert.ok(report.includes('Coordenadas propuestas'));
});

test('guarda y abre un proyecto portable', () => {
  const project = areaProject();
  const plan = generatePlan(project, context());
  const serialized = serializePlanningProject(project, plan);
  const restored = parsePlanningProject(serialized);
  assert.equal(restored.project.name, project.name);
  assert.equal(restored.plan.points.length, plan.points.length);
});
