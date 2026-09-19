import { boundingBox, pointInPolygon } from './geometry.js';

const ROLES = Object.freeze({
  control: 'Control existente',
  gcp: 'GCP',
  checkpoint: 'Checkpoint',
  auxiliar: 'Punto auxiliar'
});

const DEFAULTS = Object.freeze({
  tipo: 'area',
  metodo: 'combinado',
  alternativa: 'cobertura',
  gcp: 5,
  checkpoints: 2,
  anchoCorredor: 250,
  distanciaAcceso: 250,
  alturaInstrumento: 1.5,
  alturaObjetivo: 2
});

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function closestPointOnSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return { ...start, progress: 0 };
  const progress = Math.max(0, Math.min(1,
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  ));
  return { x: start.x + dx * progress, y: start.y + dy * progress, progress };
}

export function distanceToPolyline(point, line) {
  if (!line?.length) return Infinity;
  if (line.length === 1) return distance(point, line[0]);
  let minimum = Infinity;
  for (let index = 1; index < line.length; index += 1) {
    minimum = Math.min(minimum, distance(point, closestPointOnSegment(point, line[index - 1], line[index])));
  }
  return minimum;
}

function distanceToRing(point, ring) {
  if (!ring?.length) return Infinity;
  let minimum = Infinity;
  for (let index = 0; index < ring.length; index += 1) {
    minimum = Math.min(minimum, distance(point, closestPointOnSegment(point, ring[index], ring[(index + 1) % ring.length])));
  }
  return minimum;
}

function insideExclusion(point, exclusions) {
  return exclusions.some(ring => ring.length >= 3 && pointInPolygon(point.x, point.y, ring));
}

function projectSettings(project) {
  return { ...DEFAULTS, ...(project.settings ?? {}) };
}

function validCandidates(project, { grid }) {
  const settings = projectSettings(project);
  const geometry = project.geometry ?? [];
  const exclusions = project.exclusions ?? [];
  const edgeMargin = Math.max(grid.cellSize * 2, 50);
  const candidates = [];
  for (let index = 0; index < grid.cellCount; index += 1) {
    if (!grid.isValid(index)) continue;
    const center = grid.cellCenter(index);
    const inProject = settings.tipo === 'corredor'
      ? distanceToPolyline(center, geometry) <= settings.anchoCorredor / 2
      : geometry.length >= 3 && pointInPolygon(center.x, center.y, geometry);
    if (!inProject || insideExclusion(center, exclusions)) continue;
    if (settings.tipo === 'area' && distanceToRing(center, geometry) < edgeMargin) continue;
    candidates.push({ ...center, z: grid.elevationAt(index), gridIndex: index });
  }
  return candidates;
}

function nearestCandidate(candidates, target, selected, minimumSeparation = 0) {
  let best = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    if (selected.some(point => distance(point, candidate) < minimumSeparation)) continue;
    const score = distance(candidate, target);
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function farthestCandidate(candidates, selected, accesses, minimumSeparation = 0) {
  let best = null;
  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const separation = selected.length
      ? Math.min(...selected.map(point => distance(point, candidate)))
      : 0;
    if (separation < minimumSeparation) continue;
    const accessBonus = accesses.length
      ? Math.max(0, 250 - Math.min(...accesses.map(line => distanceToPolyline(candidate, line)))) * 0.25
      : 0;
    const score = separation + accessBonus;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function pointAtPolyline(line, targetProgress) {
  if (!line?.length) return null;
  if (line.length === 1) return { ...line[0], angle: 0 };
  const lengths = [];
  let total = 0;
  for (let index = 1; index < line.length; index += 1) {
    const segment = distance(line[index - 1], line[index]);
    lengths.push(segment);
    total += segment;
  }
  let remaining = total * Math.max(0, Math.min(1, targetProgress));
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const ratio = lengths[index] ? remaining / lengths[index] : 0;
      const start = line[index];
      const end = line[index + 1];
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
        angle: Math.atan2(end.y - start.y, end.x - start.x)
      };
    }
    remaining -= lengths[index];
  }
  return { ...line.at(-1), angle: 0 };
}

function labelPoints(points, role, prefix, reason) {
  return points.map((point, index) => ({
    ...point,
    id: `${prefix}-${String(index + 1).padStart(2, '0')}`,
    role,
    roleLabel: ROLES[role],
    reason,
    fixed: Boolean(point.fixed),
    proposed: role !== 'control'
  }));
}

function selectAreaPoints(project, candidates, count, selected = []) {
  if (!candidates.length || count <= 0) return [];
  const box = boundingBox(project.geometry);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  const minimumSeparation = Math.max(50, Math.min(width, height) / Math.max(4, Math.sqrt(count) * 3));
  const targets = [
    [0.12, 0.12], [0.88, 0.12], [0.88, 0.88], [0.12, 0.88],
    [0.5, 0.5], [0.5, 0.14], [0.86, 0.5], [0.5, 0.86], [0.14, 0.5]
  ];
  const result = [];
  for (const [fx, fy] of targets) {
    if (result.length >= count) break;
    const target = { x: box.minX + width * fx, y: box.minY + height * fy };
    const candidate = nearestCandidate(candidates, target, [...selected, ...result], minimumSeparation);
    if (candidate) result.push(candidate);
  }
  while (result.length < count) {
    const candidate = farthestCandidate(candidates, [...selected, ...result], project.accesses ?? [], minimumSeparation);
    if (!candidate) break;
    result.push(candidate);
  }
  return result;
}

function selectCorridorPoints(project, candidates, count, selected = []) {
  const settings = projectSettings(project);
  const result = [];
  for (let index = 0; index < count; index += 1) {
    const progress = (index + 0.5) / count;
    const center = pointAtPolyline(project.geometry, progress);
    if (!center) continue;
    const direction = index % 2 ? 1 : -1;
    const offset = settings.anchoCorredor * 0.28 * direction;
    const target = {
      x: center.x - Math.sin(center.angle) * offset,
      y: center.y + Math.cos(center.angle) * offset
    };
    const candidate = nearestCandidate(candidates, target, [...selected, ...result], 50);
    if (candidate) result.push(candidate);
  }
  return result;
}

function selectPoints(project, candidates, count, selected = []) {
  return projectSettings(project).tipo === 'corredor'
    ? selectCorridorPoints(project, candidates, count, selected)
    : selectAreaPoints(project, candidates, count, selected);
}

function normalizedControl(control, index, terrain) {
  const sample = terrain.nearestPoint(control.x, control.y);
  return {
    ...control,
    id: control.id || `CTL-${String(index + 1).padStart(2, '0')}`,
    role: 'control',
    roleLabel: ROLES.control,
    z: Number.isFinite(control.z) ? control.z : sample?.z ?? null,
    fixed: true,
    proposed: false,
    reason: control.reason || 'Control existente suministrado por el usuario'
  };
}

function addAuxiliaryPoints(project, candidates, points) {
  const settings = projectSettings(project);
  const controls = points.filter(point => point.role === 'control');
  const targets = points.filter(point => point.role === 'gcp' || point.role === 'checkpoint');
  const auxiliaries = [];
  if (!targets.length || !candidates.length) return auxiliaries;

  if (!controls.length) {
    const first = farthestCandidate(candidates, targets, project.accesses ?? [], 100);
    if (first) auxiliaries.push(first);
    const second = farthestCandidate(candidates, [...targets, ...auxiliaries], project.accesses ?? [], 250);
    if (second) auxiliaries.push(second);
    return labelPoints(auxiliaries, 'auxiliar', 'AUX', 'Apoyo propuesto: no se cargó control existente');
  }

  const maximumDirect = settings.alternativa === 'economico' ? 900 : 650;
  for (const target of targets) {
    if (auxiliaries.length >= 4) break;
    const control = controls.reduce((best, candidate) => (
      !best || distance(target, candidate) < distance(target, best) ? candidate : best
    ), null);
    if (!control || distance(target, control) <= maximumDirect) continue;
    const midpoint = { x: (target.x + control.x) / 2, y: (target.y + control.y) / 2 };
    const candidate = nearestCandidate(candidates, midpoint, [...points, ...auxiliaries], 180);
    if (candidate) auxiliaries.push(candidate);
  }
  return labelPoints(auxiliaries, 'auxiliar', 'AUX', 'Reduce la distancia entre el control y el fotocontrol');
}

export function analyzeVisibility(start, end, terrain, options = {}) {
  const instrumentHeight = Number(options.instrumentHeight ?? DEFAULTS.alturaInstrumento);
  const targetHeight = Number(options.targetHeight ?? DEFAULTS.alturaObjetivo);
  const profile = terrain.sampleLine(start, end);
  if (profile.samples.length < 2) return { visible: false, clearance: null, samples: [] };
  const startSight = start.z + instrumentHeight;
  const endSight = end.z + targetHeight;
  let minimum = Infinity;
  profile.samples.forEach((sample, index) => {
    if (index === 0 || index === profile.samples.length - 1) return;
    const progress = sample.distance / profile.totalDistance;
    const sight = startSight + (endSight - startSight) * progress;
    minimum = Math.min(minimum, sight - sample.z);
  });
  if (!Number.isFinite(minimum)) minimum = Math.min(instrumentHeight, targetHeight);
  return { visible: minimum >= 0, clearance: minimum, samples: profile.samples };
}

function buildConnections(points, project, terrain) {
  const settings = projectSettings(project);
  const required = settings.metodo === 'gnss' ? 1 : 2;
  const connections = [];
  const seen = new Set();
  const controls = points.filter(point => point.role === 'control');
  const initialAnchors = controls.length ? controls : points.filter(point => point.role === 'auxiliar').slice(0, 1);
  const connected = [...(initialAnchors.length ? initialAnchors : points.slice(0, 1))];
  const pending = points.filter(point => !connected.some(anchor => anchor.id === point.id));

  function addConnection(point, neighbor) {
    const key = [point.id, neighbor.id].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
      const automaticMethod = settings.metodo === 'combinado'
        ? (distance(point, neighbor) > 700 ? 'gnss' : 'estacion')
        : settings.metodo;
      const connectionId = `OBS-${String(connections.length + 1).padStart(2, '0')}`;
      const method = project.connectionMethods?.[connectionId] ?? automaticMethod;
      const visibility = method === 'estacion'
        ? analyzeVisibility(point, neighbor, terrain, {
          instrumentHeight: settings.alturaInstrumento,
          targetHeight: settings.alturaObjetivo
        })
        : { visible: null, clearance: null };
      connections.push({
        id: connectionId,
        from: point.id,
        to: neighbor.id,
        method,
        distance: distance(point, neighbor),
        visible: visibility.visible,
        clearance: visibility.clearance
      });
    return true;
  }

  // Árbol de conexión mínimo: cada punto nuevo queda enlazado con la red ya construida.
  while (pending.length && connected.length) {
    let bestPending = 0;
    let bestAnchor = connected[0];
    let bestDistance = Infinity;
    pending.forEach((point, pendingIndex) => {
      connected.forEach(anchor => {
        const candidateDistance = distance(point, anchor);
        if (candidateDistance < bestDistance) {
          bestDistance = candidateDistance;
          bestPending = pendingIndex;
          bestAnchor = anchor;
        }
      });
    });
    const point = pending.splice(bestPending, 1)[0];
    addConnection(point, bestAnchor);
    connected.push(point);
  }

  // Estación total y redes combinadas necesitan una segunda relación para no dejar ramales ciegos.
  if (required > 1) {
    points.filter(point => point.role !== 'control').forEach(point => {
      if (pointConnectionCount(point, connections) >= required) return;
      const neighbor = points
        .filter(candidate => candidate.id !== point.id && !seen.has([point.id, candidate.id].sort().join('|')))
        .sort((first, second) => distance(point, first) - distance(point, second))[0];
      if (neighbor) addConnection(point, neighbor);
    });
  }
  return connections;
}

function pointConnectionCount(point, connections) {
  return connections.filter(connection => connection.from === point.id || connection.to === point.id).length;
}

function buildWarnings(project, points, connections) {
  const settings = projectSettings(project);
  const warnings = [];
  const controls = points.filter(point => point.role === 'control');
  if (!controls.length) {
    warnings.push({ severity: 'error', code: 'sin-control', message: 'No hay control existente: los auxiliares deben amarrarse en campo a una referencia conocida.' });
  }
  if (controls.length) {
    const reached = new Set(controls.map(point => point.id));
    let changed = true;
    while (changed) {
      changed = false;
      connections.forEach(connection => {
        if (reached.has(connection.from) && !reached.has(connection.to)) { reached.add(connection.to); changed = true; }
        if (reached.has(connection.to) && !reached.has(connection.from)) { reached.add(connection.from); changed = true; }
      });
    }
    points.filter(point => !reached.has(point.id)).forEach(point => {
      warnings.push({ severity: 'error', code: `aislado-${point.id}`, message: `${point.id} no está conectado con el control existente.` });
    });
  }
  const required = settings.metodo === 'gnss' ? 1 : 2;
  points.filter(point => point.role !== 'control').forEach(point => {
    if (pointConnectionCount(point, connections) < required) {
      warnings.push({ severity: 'error', code: `conexion-${point.id}`, message: `${point.id} no tiene las ${required} conexiones requeridas.` });
    }
  });
  connections.filter(connection => connection.visible === false).forEach(connection => {
    warnings.push({ severity: 'warning', code: `visual-${connection.id}`, message: `${connection.id} entre ${connection.from} y ${connection.to} tiene la visual bloqueada por el terreno.` });
  });
  const accesses = project.accesses ?? [];
  if (accesses.length) {
    points.filter(point => point.role !== 'control').forEach(point => {
      const accessDistance = Math.min(...accesses.map(line => distanceToPolyline(point, line)));
      if (accessDistance > settings.distanciaAcceso) {
        warnings.push({ severity: 'warning', code: `acceso-${point.id}`, message: `${point.id} queda a ${Math.round(accessDistance)} m del acceso dibujado.` });
      }
    });
  } else {
    warnings.push({ severity: 'info', code: 'sin-accesos', message: 'No se dibujaron accesos; la accesibilidad debe verificarse durante el reconocimiento.' });
  }
  if (points.filter(point => point.role === 'checkpoint').length < 1) {
    warnings.push({ severity: 'error', code: 'sin-checkpoint', message: 'El plan necesita al menos un checkpoint independiente.' });
  }
  if (!warnings.some(warning => warning.severity === 'error')) {
    warnings.push({ severity: 'info', code: 'reconocimiento', message: 'Propuesta lista para reconocimiento: confirma seguridad, estabilidad, cielo visible y obstáculos reales.' });
  }
  return warnings;
}

export function evaluatePlan(project, points, context) {
  const settings = projectSettings(project);
  const accesses = project.accesses ?? [];
  const evaluatedPoints = points.map(point => {
    if (!accesses.length) return { ...point, access: 'No evaluado' };
    const accessDistance = Math.min(...accesses.map(line => distanceToPolyline(point, line)));
    return { ...point, access: accessDistance <= settings.distanciaAcceso ? 'Próximo a acceso' : 'Revisar acceso' };
  });
  const connections = buildConnections(evaluatedPoints, project, context.terrain);
  const warnings = buildWarnings(project, evaluatedPoints, connections);
  return {
    ...project,
    points: evaluatedPoints,
    connections,
    warnings,
    generatedAt: new Date().toISOString(),
    stats: Object.fromEntries(Object.keys(ROLES).map(role => [role, evaluatedPoints.filter(point => point.role === role).length]))
  };
}

export function generatePlan(project, context) {
  const settings = projectSettings(project);
  if ((project.geometry ?? []).length < (settings.tipo === 'area' ? 3 : 2)) {
    throw new Error(settings.tipo === 'area' ? 'Dibuja un área de proyecto' : 'Dibuja el eje del corredor');
  }
  const candidates = validCandidates(project, context);
  if (!candidates.length) throw new Error('No hay celdas válidas para ubicar puntos con las restricciones actuales');
  const controls = (project.controls ?? []).map((control, index) => normalizedControl(control, index, context.terrain));
  const fixed = (project.fixedPoints ?? []).filter(point => point.fixed && point.role !== 'control');
  const fixedGcp = fixed.filter(point => point.role === 'gcp');
  const fixedCheckpoints = fixed.filter(point => point.role === 'checkpoint');
  const gcpNeeded = Math.max(0, settings.gcp - fixedGcp.length);
  const checkpointNeeded = Math.max(0, settings.checkpoints - fixedCheckpoints.length);
  const gcpSelected = selectPoints(project, candidates, gcpNeeded, [...controls, ...fixed]);
  const gcps = [
    ...fixedGcp,
    ...labelPoints(gcpSelected, 'gcp', 'GCP', 'Distribución equilibrada de apoyo fotogramétrico')
  ];
  const checkpointSelected = selectPoints(
    project,
    candidates,
    checkpointNeeded,
    [...controls, ...fixed, ...gcps]
  );
  const checkpoints = [
    ...fixedCheckpoints,
    ...labelPoints(checkpointSelected, 'checkpoint', 'CHK', 'Comprobación independiente, separada de los GCP')
  ];
  const basePoints = [...controls, ...gcps, ...checkpoints];
  const auxiliaries = [
    ...fixed.filter(point => point.role === 'auxiliar'),
    ...addAuxiliaryPoints(project, candidates, basePoints)
  ];
  const usedIds = new Set();
  const counters = { gcp: 1, checkpoint: 1, auxiliar: 1, control: 1 };
  const prefixes = { gcp: 'GCP', checkpoint: 'CHK', auxiliar: 'AUX', control: 'CTL' };
  const uniquePoints = [...basePoints, ...auxiliaries].map(point => {
    if (!usedIds.has(point.id)) {
      usedIds.add(point.id);
      return point;
    }
    while (usedIds.has(`${prefixes[point.role]}-${String(counters[point.role]).padStart(2, '0')}`)) counters[point.role] += 1;
    const id = `${prefixes[point.role]}-${String(counters[point.role]).padStart(2, '0')}`;
    counters[point.role] += 1;
    usedIds.add(id);
    return { ...point, id };
  });
  return evaluatePlan(project, uniquePoints, context);
}

export function movePlanPoint(plan, pointId, position, context) {
  const sample = context.terrain.nearestPoint(position.x, position.y);
  if (!sample) return plan;
  const points = plan.points.map(point => point.id === pointId
    ? { ...point, x: position.x, y: position.y, z: sample.z, fixed: true, reason: 'Ubicación fijada manualmente por el usuario' }
    : point
  );
  return evaluatePlan(plan, points, context);
}

export function removePlanPoint(plan, pointId, context) {
  return evaluatePlan(plan, plan.points.filter(point => point.id !== pointId), context);
}

export function addPlanPoint(plan, point, role, context) {
  const prefix = role === 'checkpoint' ? 'CHK' : role === 'auxiliar' ? 'AUX' : role === 'control' ? 'CTL' : 'GCP';
  let suffix = 1;
  while (plan.points.some(existing => existing.id === `${prefix}-${String(suffix).padStart(2, '0')}`)) suffix += 1;
  const sample = context.terrain.nearestPoint(point.x, point.y);
  if (!sample) return plan;
  const added = {
    id: `${prefix}-${String(suffix).padStart(2, '0')}`,
    role,
    roleLabel: ROLES[role],
    x: point.x,
    y: point.y,
    z: sample.z,
    fixed: true,
    proposed: role !== 'control',
    reason: 'Punto añadido manualmente por el usuario'
  };
  return evaluatePlan(plan, [...plan.points, added], context);
}

export { DEFAULTS as PLANNING_DEFAULTS, ROLES as PLANNING_ROLES };
