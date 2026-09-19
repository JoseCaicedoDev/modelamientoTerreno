import {
  addPlanPoint,
  evaluatePlan,
  generatePlan,
  movePlanPoint,
  PLANNING_DEFAULTS,
  removePlanPoint
} from '../domain/planning.js';
import {
  buildPrintableReport,
  connectionsToCsv,
  kmlToKmz,
  parsePlanningProject,
  planToKml,
  pointsToCsv,
  pointsToPenzd,
  serializePlanningProject
} from '../domain/planning-export.js';

const STORAGE_KEY = 'gestiagro.planificacion.v1';
const COLORS = Object.freeze({ area: '#f8fafc', exclusion: '#ef4444', access: '#facc15', control: '#22c55e', gcp: '#f59e0b', checkpoint: '#a78bfa', auxiliar: '#22d3ee' });

// Los grupos ordenan la lista como se recorre el trabajo: primero lo que ya existe, después lo
// propuesto. La descripción explica para qué sirve cada rol sin obligar a abrir la documentación.
const ROLE_GROUPS = Object.freeze([
  { role: 'control', title: 'Control conocido', hint: 'Coordenadas ya establecidas; el plan se amarra a ellas.' },
  { role: 'gcp', title: 'Puntos de control (GCP)', hint: 'Fijan el vuelo al terreno durante el ajuste.' },
  { role: 'checkpoint', title: 'Puntos de chequeo', hint: 'Solo verifican la precisión; no entran en el ajuste.' },
  { role: 'auxiliar', title: 'Puntos auxiliares', hint: 'Apoyan la red cuando el control queda lejos.' }
]);

// El dominio usa etiquetas cortas; en pantalla se explican en lenguaje de campo.
const ACCESS_LABELS = Object.freeze({
  'No evaluado': 'Acceso por verificar',
  'Próximo a acceso': 'Cerca de un acceso',
  'Revisar acceso': 'Lejos del acceso dibujado'
});

const METHOD_LABELS = Object.freeze({ gnss: 'GNSS', estacion: 'Estación total', nivelacion: 'Nivelación' });

const SEVERITY_TAGS = Object.freeze({ error: 'Corregir', warning: 'Revisar', info: 'Nota' });

function plural(count, singular, many) {
  return `${count} ${count === 1 ? singular : many}`;
}

function download(content, filename, type = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slug(value) {
  return String(value || 'plan-campo').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan-campo';
}

function parseControlCsv(text) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const separator = lines[0].includes(';') ? ';' : lines[0].includes(',') ? ',' : /\s+/;
  const cells = line => typeof separator === 'string' ? line.split(separator) : line.split(separator);
  const first = cells(lines[0]).map(value => value.trim().toLowerCase());
  const hasHeader = first.some(value => /este|easting|norte|northing|elev|codigo|id/.test(value));
  const find = patterns => first.findIndex(value => patterns.some(pattern => value.includes(pattern)));
  const indexes = hasHeader ? {
    id: find(['codigo', 'código', 'id', 'punto']),
    x: find(['este', 'easting', 'x']),
    y: find(['norte', 'northing', 'y']),
    z: find(['elev', 'cota', 'z'])
  } : { id: 0, x: 1, y: 2, z: 3 };
  if (indexes.x < 0 || indexes.y < 0) throw new Error('El CSV debe incluir columnas de Este y Norte');
  return lines.slice(hasHeader ? 1 : 0).map((line, index) => {
    const row = cells(line).map(value => value.trim().replace(',', '.'));
    const x = Number(row[indexes.x]);
    const y = Number(row[indexes.y]);
    const z = indexes.z >= 0 ? Number(row[indexes.z]) : null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      id: indexes.id >= 0 && row[indexes.id] ? row[indexes.id] : `CTL-${String(index + 1).padStart(2, '0')}`,
      x, y, z: Number.isFinite(z) ? z : null
    };
  }).filter(Boolean);
}

function button(label, className, onClick, { title, ariaLabel, pressed } = {}) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  if (title) element.title = title;
  if (ariaLabel) element.setAttribute('aria-label', ariaLabel);
  if (pressed !== undefined) element.setAttribute('aria-pressed', String(pressed));
  element.addEventListener('click', onClick);
  return element;
}

export function createPlanningController({
  panel,
  satelliteMap,
  terrain,
  grid,
  data,
  project,
  setInstruction,
  onClose
}) {
  const byId = id => panel.querySelector(`#${id}`);
  const elements = {
    name: byId('planning-name'),
    type: byId('planning-type'),
    method: byId('planning-method'),
    alternative: byId('planning-alternative'),
    gcp: byId('planning-gcp'),
    checkpoints: byId('planning-checkpoints'),
    drawGeometry: byId('planning-draw-geometry'),
    drawExclusion: byId('planning-draw-exclusion'),
    drawAccess: byId('planning-draw-access'),
    addControl: byId('planning-add-control'),
    controlsFile: byId('planning-controls-file'),
    controlsInput: byId('planning-controls-input'),
    generate: byId('planning-generate'),
    save: byId('planning-save'),
    restore: byId('planning-restore'),
    projectFile: byId('planning-project-file'),
    projectInput: byId('planning-project-input'),
    exportProject: byId('planning-export-project'),
    addGcp: byId('planning-add-gcp'),
    addCheckpoint: byId('planning-add-checkpoint'),
    addAuxiliary: byId('planning-add-auxiliary'),
    stats: byId('planning-stats'),
    warnings: byId('planning-warnings'),
    points: byId('planning-points'),
    pointsCount: byId('planning-points-count'),
    connections: byId('planning-connections'),
    connectionsCount: byId('planning-connections-count'),
    contextCount: byId('planning-context-count'),
    exports: byId('planning-exports'),
    exportsEmpty: byId('planning-exports-empty'),
    close: byId('planning-close'),
    collapse: byId('planning-collapse'),
    body: panel.querySelector('.planning-body'),
    error: byId('planning-error')
  };
  const context = { terrain, grid };
  let currentProject = project;
  let currentPlan = null;
  let selectedPointId = null;

  function showMessage(message, tone = 'error') {
    elements.error.textContent = message || '';
    elements.error.hidden = !message;
    elements.error.classList.toggle('is-ok', Boolean(message) && tone === 'ok');
  }

  function showError(message) {
    showMessage(message, 'error');
  }

  function syncProjectFromForm() {
    currentProject = {
      ...currentProject,
      name: elements.name.value.trim() || 'Plan de fotocontrol y red de apoyo',
      settings: {
        ...PLANNING_DEFAULTS,
        ...(currentProject.settings ?? {}),
        tipo: elements.type.value,
        metodo: elements.method.value,
        alternativa: elements.alternative.value,
        gcp: Math.max(1, Number(elements.gcp.value) || 1),
        checkpoints: Math.max(1, Number(elements.checkpoints.value) || 1)
      }
    };
  }

  function syncForm() {
    const settings = { ...PLANNING_DEFAULTS, ...(currentProject.settings ?? {}) };
    elements.name.value = currentProject.name || '';
    elements.type.value = settings.tipo;
    elements.method.value = settings.metodo;
    elements.alternative.value = settings.alternativa;
    elements.gcp.value = settings.gcp;
    elements.checkpoints.value = settings.checkpoints;
    elements.drawGeometry.textContent = settings.tipo === 'corredor' ? 'Dibujar eje' : 'Redibujar área';
  }

  function statTile(value, label) {
    return `<span><strong>${value}</strong>${label}</span>`;
  }

  function renderStats() {
    if (!currentPlan) {
      elements.stats.innerHTML = statTile(currentProject.controls?.length ?? 0, 'controles conocidos')
        + statTile(currentProject.exclusions?.length ?? 0, 'zonas excluidas')
        + statTile(currentProject.accesses?.length ?? 0, 'vías de acceso');
      return;
    }
    elements.stats.innerHTML = statTile(currentPlan.stats.gcp, 'GCP')
      + statTile(currentPlan.stats.checkpoint, 'de chequeo')
      + statTile(currentPlan.stats.auxiliar, 'auxiliares')
      + statTile(currentPlan.connections.length, 'observaciones');
  }

  function renderContextCount() {
    if (!elements.contextCount) return;
    const parts = [];
    const controls = currentProject.controls?.length ?? 0;
    const exclusions = currentProject.exclusions?.length ?? 0;
    const accesses = currentProject.accesses?.length ?? 0;
    if (controls) parts.push(plural(controls, 'control', 'controles'));
    if (exclusions) parts.push(plural(exclusions, 'exclusión', 'exclusiones'));
    if (accesses) parts.push(plural(accesses, 'acceso', 'accesos'));
    elements.contextCount.textContent = parts.length ? parts.join(' · ') : 'ninguno';
  }

  function renderWarnings() {
    elements.warnings.replaceChildren();
    if (!currentPlan) return;
    currentPlan.warnings.forEach(warning => {
      const item = document.createElement('li');
      item.className = `planning-alert planning-alert-${warning.severity}`;
      const tag = document.createElement('span');
      tag.className = 'planning-alert-tag';
      tag.textContent = SEVERITY_TAGS[warning.severity] ?? 'Nota';
      const text = document.createElement('span');
      text.textContent = warning.message;
      item.append(tag, text);
      elements.warnings.append(item);
    });
  }

  function updateFixedPoints() {
    currentProject.fixedPoints = currentPlan?.points.filter(point => point.fixed && point.role !== 'control') ?? [];
  }

  function refreshEvaluation() {
    if (!currentPlan) return;
    currentPlan = evaluatePlan(currentProject, currentPlan.points, context);
    updateFixedPoints();
    render();
  }

  function pointRow(point) {
    const item = document.createElement('li');
    item.className = `planning-point planning-point-${point.role}`;
    if (point.id === selectedPointId) item.classList.add('is-selected');
    item.dataset.pointId = point.id;

    // La fila completa centra el punto: es el gesto que más se repite al revisar la propuesta.
    const locate = document.createElement('button');
    locate.type = 'button';
    locate.className = 'planning-point-main';
    locate.title = `Centrar ${point.id} en la imagen satelital`;
    const title = document.createElement('strong');
    title.textContent = point.id;
    const coordinates = document.createElement('span');
    coordinates.className = 'planning-point-coords';
    coordinates.textContent = `E ${point.x.toFixed(1)} · N ${point.y.toFixed(1)} · cota ${Number(point.z ?? 0).toFixed(1)} m`;
    const state = document.createElement('span');
    state.className = `planning-point-state planning-access-${point.access === 'Revisar acceso' ? 'revisar' : point.access === 'Próximo a acceso' ? 'ok' : 'pendiente'}`;
    state.textContent = ACCESS_LABELS[point.access] ?? point.access;
    locate.append(title, coordinates, state);
    locate.addEventListener('click', () => selectPoint(point.id));

    const actions = document.createElement('div');
    actions.className = 'planning-point-actions';
    if (point.role !== 'control') {
      actions.append(button(point.fixed ? 'Fijado' : 'Fijar', point.fixed ? 'is-active' : '', () => {
        currentPlan.points = currentPlan.points.map(candidate => candidate.id === point.id
          ? { ...candidate, fixed: !candidate.fixed }
          : candidate);
        refreshEvaluation();
      }, {
        title: point.fixed
          ? `${point.id} se conservará al generar de nuevo. Pulsa para liberarlo.`
          : `Conservar ${point.id} donde está al generar de nuevo`,
        ariaLabel: `Fijar ${point.id}`,
        pressed: Boolean(point.fixed)
      }));
    }
    actions.append(button('Quitar', 'is-danger', () => {
      currentPlan = removePlanPoint(currentPlan, point.id, context);
      if (point.role === 'control') currentProject.controls = currentProject.controls.filter(control => control.id !== point.id);
      if (selectedPointId === point.id) selectedPointId = null;
      updateFixedPoints();
      render();
    }, { title: `Eliminar ${point.id} del plan`, ariaLabel: `Quitar ${point.id}` }));

    item.append(locate, actions);
    return item;
  }

  function renderPoints() {
    elements.points.replaceChildren();
    if (elements.pointsCount) elements.pointsCount.textContent = currentPlan ? String(currentPlan.points.length) : '';
    if (!currentPlan) {
      const empty = document.createElement('p');
      empty.className = 'planning-hint';
      empty.textContent = 'Todavía no hay puntos. Genera la propuesta en el paso 2.';
      elements.points.append(empty);
      return;
    }
    ROLE_GROUPS.forEach(group => {
      const points = currentPlan.points.filter(point => point.role === group.role);
      if (!points.length) return;
      const section = document.createElement('section');
      section.className = `planning-group planning-group-${group.role}`;
      const heading = document.createElement('h4');
      const dot = document.createElement('span');
      dot.className = 'planning-group-dot';
      const count = document.createElement('span');
      count.className = 'planning-chip-count';
      count.textContent = String(points.length);
      heading.append(dot, document.createTextNode(group.title), count);
      const hint = document.createElement('p');
      hint.className = 'planning-hint';
      hint.textContent = group.hint;
      const list = document.createElement('ul');
      list.className = 'planning-point-list';
      points.forEach(point => list.append(pointRow(point)));
      section.append(heading, hint, list);
      elements.points.append(section);
    });
  }

  function renderConnections() {
    elements.connections.replaceChildren();
    if (elements.connectionsCount) elements.connectionsCount.textContent = currentPlan ? String(currentPlan.connections.length) : '';
    if (!currentPlan) return;
    currentPlan.connections.forEach(connection => {
      const item = document.createElement('li');
      item.className = connection.visible === false ? 'planning-connection is-blocked' : 'planning-connection';
      const label = document.createElement('div');
      const pair = document.createElement('strong');
      pair.textContent = `${connection.from} → ${connection.to}`;
      const detail = document.createElement('span');
      detail.textContent = connection.visible === false
        ? `${Math.round(connection.distance)} m · el terreno tapa la visual`
        : `${Math.round(connection.distance)} m · visual libre`;
      label.append(pair, detail);
      const select = document.createElement('select');
      select.setAttribute('aria-label', `Método de la observación ${connection.from} a ${connection.to}`);
      Object.entries(METHOD_LABELS).forEach(([value, text]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        option.selected = connection.method === value;
        select.append(option);
      });
      select.addEventListener('change', () => {
        currentProject.connectionMethods = { ...(currentProject.connectionMethods ?? {}), [connection.id]: select.value };
        refreshEvaluation();
      });
      item.append(label, select);
      elements.connections.append(item);
    });
  }

  // Seleccionar sincroniza las dos vistas: resalta la fila y centra el marcador en la imagen.
  function selectPoint(id, { fromMap = false } = {}) {
    selectedPointId = id;
    elements.points.querySelectorAll('.planning-point').forEach(row => {
      row.classList.toggle('is-selected', row.dataset.pointId === id);
    });
    if (fromMap) {
      elements.points.querySelector(`.planning-point[data-point-id="${id}"]`)
        ?.scrollIntoView({ block: 'nearest' });
      return;
    }
    satelliteMap.focusPlanningPoint?.(id);
  }

  function render() {
    renderStats();
    renderContextCount();
    renderWarnings();
    renderPoints();
    renderConnections();
    elements.exports.hidden = !currentPlan;
    if (elements.exportsEmpty) elements.exportsEmpty.hidden = Boolean(currentPlan);
    satelliteMap.renderPlanning(currentPlan, currentProject, {
      onMove: (id, position) => {
        currentPlan = movePlanPoint(currentPlan, id, position, context);
        updateFixedPoints();
        render();
      },
      onSelect: id => selectPoint(id, { fromMap: true })
    });
  }

  function drawGeometry() {
    syncProjectFromForm();
    const area = currentProject.settings.tipo === 'area';
    satelliteMap.beginDrawing({
      modo: area ? 'poligono' : 'polilinea',
      grupo: 'planificador-dibujo',
      color: COLORS.area,
      snap: false,
      permitirCierre: area,
      onFinalizar: points => {
        currentProject.geometry = points.map(({ x, y, z }) => ({ x, y, z }));
        currentPlan = null;
        setInstruction(null);
        render();
      }
    });
    setInstruction(area
      ? 'Marca el área · cierra sobre el primer punto o pulsa Enter'
      : 'Marca el eje del corredor · doble clic o Enter para terminar');
  }

  function drawCollection(key, mode, color, instruction) {
    satelliteMap.beginDrawing({
      modo: mode,
      grupo: 'planificador-dibujo',
      color,
      snap: false,
      permitirCierre: mode === 'poligono',
      onFinalizar: points => {
        currentProject[key] = [...(currentProject[key] ?? []), points.map(({ x, y, z }) => ({ x, y, z }))];
        setInstruction(null);
        render();
      }
    });
    setInstruction(instruction);
  }

  function addPoint(role) {
    satelliteMap.beginPoint({
      grupo: 'planificador-dibujo',
      color: COLORS[role],
      onFinalizar: point => {
        if (role === 'control') {
          const index = (currentProject.controls?.length ?? 0) + 1;
          const control = { id: `CTL-${String(index).padStart(2, '0')}`, x: point.x, y: point.y, z: point.z };
          currentProject.controls = [...(currentProject.controls ?? []), control];
          if (currentPlan) currentPlan = addPlanPoint(currentPlan, control, 'control', context);
        } else if (currentPlan) {
          currentPlan = addPlanPoint(currentPlan, point, role, context);
          updateFixedPoints();
        }
        setInstruction(null);
        render();
      }
    });
    setInstruction(`Selecciona la ubicación del ${role === 'control' ? 'control existente' : role}`);
  }

  function generate() {
    try {
      showError(null);
      syncProjectFromForm();
      currentPlan = generatePlan(currentProject, context);
      updateFixedPoints();
      render();
      showMessage(`Propuesta lista: ${plural(currentPlan.points.length, 'punto', 'puntos')} y ${plural(currentPlan.connections.length, 'observación', 'observaciones')}. Revísala abajo.`, 'ok');
    } catch (error) {
      showError(error.message);
    }
  }

  function saveLocal() {
    syncProjectFromForm();
    localStorage.setItem(STORAGE_KEY, serializePlanningProject(currentProject, currentPlan));
    showMessage('Proyecto guardado en este navegador.', 'ok');
  }

  function restoreLocal() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return showError('No hay un proyecto guardado en este navegador.');
    loadProject(stored);
  }

  function loadProject(text) {
    try {
      const loaded = parsePlanningProject(text);
      currentProject = loaded.project;
      currentPlan = loaded.plan?.points?.length
        ? evaluatePlan(currentProject, loaded.plan.points, context)
        : null;
      syncForm();
      render();
      showMessage('Proyecto cargado.', 'ok');
    } catch (error) {
      showError(error.message);
    }
  }

  function requirePlan(action) {
    if (!currentPlan) return showError('Primero genera la propuesta en el paso 2.');
    showError(null);
    action();
  }

  function exportKml() {
    const kml = planToKml(currentPlan, (x, y) => window.proj4(data.crs, 'EPSG:4326', [x, y]));
    return { kml, filename: `${slug(currentPlan.name)}.kml` };
  }

  elements.type.addEventListener('change', () => { syncProjectFromForm(); syncForm(); });
  elements.drawGeometry.addEventListener('click', drawGeometry);
  elements.drawExclusion.addEventListener('click', () => drawCollection('exclusions', 'poligono', COLORS.exclusion, 'Dibuja la exclusión · cierra sobre el primer punto'));
  elements.drawAccess.addEventListener('click', () => drawCollection('accesses', 'polilinea', COLORS.access, 'Dibuja el acceso · doble clic o Enter para terminar'));
  elements.addControl.addEventListener('click', () => addPoint('control'));
  elements.addGcp.addEventListener('click', () => addPoint('gcp'));
  elements.addCheckpoint.addEventListener('click', () => addPoint('checkpoint'));
  elements.addAuxiliary.addEventListener('click', () => addPoint('auxiliar'));
  elements.controlsFile.addEventListener('click', () => elements.controlsInput.click());
  elements.controlsInput.addEventListener('change', async () => {
    try {
      const controls = parseControlCsv(await elements.controlsInput.files[0].text());
      currentProject.controls = [...(currentProject.controls ?? []), ...controls];
      currentPlan = null;
      render();
    } catch (error) { showError(error.message); }
    elements.controlsInput.value = '';
  });
  elements.generate.addEventListener('click', generate);
  elements.save.addEventListener('click', saveLocal);
  elements.restore.addEventListener('click', restoreLocal);
  elements.projectFile.addEventListener('click', () => elements.projectInput.click());
  elements.projectInput.addEventListener('change', async () => {
    if (elements.projectInput.files[0]) loadProject(await elements.projectInput.files[0].text());
    elements.projectInput.value = '';
  });
  elements.exportProject.addEventListener('click', () => {
    syncProjectFromForm();
    download(serializePlanningProject(currentProject, currentPlan), `${slug(currentProject.name)}.gestiagro.json`, 'application/json');
  });
  elements.exports.addEventListener('click', event => {
    const format = event.target.closest('[data-planning-export]')?.dataset.planningExport;
    if (!format) return;
    requirePlan(() => {
      const base = slug(currentPlan.name);
      if (format === 'csv') download(pointsToCsv(currentPlan), `${base}-puntos.csv`, 'text/csv;charset=utf-8');
      if (format === 'penzd') download(pointsToPenzd(currentPlan), `${base}.penzd.csv`, 'text/csv;charset=utf-8');
      if (format === 'observaciones') download(connectionsToCsv(currentPlan), `${base}-observaciones.csv`, 'text/csv;charset=utf-8');
      if (format === 'kml') {
        const result = exportKml();
        download(result.kml, result.filename, 'application/vnd.google-earth.kml+xml');
      }
      if (format === 'kmz') {
        const result = exportKml();
        download(kmlToKmz(result.kml), `${base}.kmz`, 'application/vnd.google-earth.kmz');
      }
      if (format === 'pdf') {
        const reportWindow = window.open('', '_blank');
        if (!reportWindow) return showError('El navegador bloqueó el informe. Permite ventanas emergentes para imprimir el PDF.');
        reportWindow.document.write(buildPrintableReport(currentPlan, { crs: data.crs, source: data.source }));
        reportWindow.document.close();
        reportWindow.addEventListener('load', () => reportWindow.print(), { once: true });
      }
    });
  });
  elements.close.addEventListener('click', onClose);
  elements.collapse.addEventListener('click', () => {
    panel.classList.toggle('is-collapsed');
    const collapsed = panel.classList.contains('is-collapsed');
    elements.collapse.textContent = collapsed ? '+' : '–';
    elements.collapse.setAttribute('aria-expanded', String(!collapsed));
  });
  panel.addEventListener('click', event => event.stopPropagation());

  syncForm();
  render();

  return Object.freeze({
    show() { panel.hidden = false; render(); },
    hide() { panel.hidden = true; satelliteMap.cancelDrawing(); setInstruction(null); },
    generate,
    get project() { return currentProject; },
    get plan() { return currentPlan; }
  });
}
