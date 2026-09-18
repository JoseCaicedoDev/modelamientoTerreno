import {
  formatArea,
  formatCoordinateLabel,
  formatDistance,
  formatElevation,
  formatVolume,
  MEASURE_COLOR,
  UTM_20N
} from './js/config.js';
import { createTerrainModel } from './js/domain/terrain.js';
import { createGrid } from './js/domain/grid.js';
import { measurePath } from './js/domain/measure.js';
import { createFloodModel } from './js/domain/flood.js';
import { packColor } from './js/adapters/raster-overlay.js';
import { createTerrainPlot } from './js/adapters/terrain-plot.js';
import { createSatelliteMap } from './js/adapters/satellite-map.js';
import { createProfileChart } from './js/ui/profile-chart.js';
import { createToolController } from './js/ui/tool-controller.js';
import { createResultPanel } from './js/ui/result-panel.js';

const byId = id => document.getElementById(id);

const elements = Object.freeze({
  plot: byId('terrain-plot'),
  satelliteMap: byId('satellite-map'),
  satellitePane: document.querySelector('.satellite-pane'),
  sourceLabel: byId('source-label'),
  terrainCoordinate: byId('terrain-coordinate'),
  mapCoordinate: byId('map-coordinate'),
  loading: byId('loading'),
  error: byId('error'),
  exaggeration: byId('exaggeration'),
  exaggerationValue: byId('exaggeration-value'),
  exaggerationToggle: byId('exaggeration-toggle'),
  exaggerationPanel: byId('exaggeration-panel'),
  contours: byId('contours-toggle'),
  profileTool: byId('profile-tool'),
  toolInstruction: byId('tool-instruction'),
  profilePanel: byId('profile-panel'),
  profileChart: byId('profile-chart'),
  profileStats: byId('profile-stats'),
  profileClose: byId('profile-close'),
  measureTool: byId('measure-tool'),
  measurePanel: byId('measure-panel'),
  measureStats: byId('measure-stats'),
  measureClose: byId('measure-close'),
  floodTool: byId('flood-tool'),
  floodPanel: byId('flood-panel'),
  floodStats: byId('flood-stats'),
  floodClose: byId('flood-close'),
  floodLevel: byId('flood-level'),
  floodLevelValue: byId('flood-level-value'),
  floodConnected: byId('flood-connected'),
  resetCamera: byId('reset-camera'),
  touchHint: byId('touch-hint'),
  colorButtons: [...document.querySelectorAll('[data-color-mode]')]
});

const data = window.TERRAIN_DATA;
const dependenciesReady = Boolean(window.Plotly && window.L && window.proj4 && data);

if (!dependenciesReady) {
  elements.loading.hidden = true;
  elements.error.hidden = false;
} else {
  startApplication();
}

function startApplication() {
  const terrain = createTerrainModel(data);
  const grid = createGrid(data);
  const profileChart = createProfileChart({
    chartElement: elements.profileChart,
    statsElement: elements.profileStats
  });
  const tools = createToolController();
  let colorMode = 'elevation';
  let contoursVisible = true;
  let cursorClearTimer;
  let lastCursorKey;

  // Anillo de la zona de influencia en UTM: define hasta dónde llega el plano de agua del 3D.
  const waterRing = data.buffer.map(([latitude, longitude]) => {
    const [x, y] = window.proj4('EPSG:4326', UTM_20N, [longitude, latitude]);
    return { x, y };
  });

  const terrainPlot = createTerrainPlot({
    element: elements.plot,
    data,
    waterRing,
    onHover: (easting, northing) => showSynchronizedCursor(terrain.nearestPoint(easting, northing)),
    onLeave: scheduleCursorClear
  });

  const satelliteMap = createSatelliteMap({
    element: elements.satelliteMap,
    data,
    nearestPoint: terrain.nearestPoint,
    onPointer: showSynchronizedCursor,
    onPointerLeave: scheduleCursorClear
  });

  const profilePanel = createResultPanel({
    panel: elements.profilePanel,
    stats: elements.profileStats,
    pane: elements.satellitePane,
    visibleClass: 'panel-visible',
    closeButton: elements.profileClose,
    onClose: () => tools.deactivateAll()
  });

  function showSynchronizedCursor(point) {
    if (!point) {
      scheduleCursorClear();
      return;
    }
    window.clearTimeout(cursorClearTimer);
    const cursorKey = `${point.x}:${point.y}`;
    if (cursorKey === lastCursorKey) return;
    lastCursorKey = cursorKey;
    terrainPlot.showCursor(point);
    satelliteMap.showCursor(point);
    const label = formatCoordinateLabel(point);
    elements.terrainCoordinate.textContent = label;
    elements.mapCoordinate.textContent = label;
    elements.terrainCoordinate.hidden = false;
    elements.mapCoordinate.hidden = false;
  }

  function clearSynchronizedCursor() {
    lastCursorKey = null;
    terrainPlot.clearCursor();
    satelliteMap.clearCursor();
    elements.terrainCoordinate.hidden = true;
    elements.mapCoordinate.hidden = true;
  }

  function scheduleCursorClear() {
    window.clearTimeout(cursorClearTimer);
    cursorClearTimer = window.setTimeout(clearSynchronizedCursor, 60);
  }

  function setColorMode(mode) {
    colorMode = mode;
    const satellite = mode === 'satellite';
    terrainPlot.setColorMode(mode);
    elements.contours.disabled = satellite;
    elements.contours.title = satellite ? 'Las curvas están disponibles en la coloración de elevación' : '';
    elements.colorButtons.forEach(button => button.classList.toggle('active', button.dataset.colorMode === mode));
    elements.sourceLabel.textContent = satellite
      ? 'World Imagery © Esri, Maxar, Earthstar Geographics y GIS User Community · sobre DEM SRTMGL1'
      : 'DEM SRTMGL1 · ALOS PALSAR RTC ALPSRP274680160';
  }

  function toggleContours() {
    contoursVisible = !contoursVisible;
    terrainPlot.setContours(contoursVisible);
    elements.contours.classList.toggle('active', contoursVisible);
    elements.contours.setAttribute('aria-pressed', String(contoursVisible));
  }

  function setExaggerationPanel(open) {
    elements.exaggerationPanel.hidden = !open;
    elements.exaggerationToggle.classList.toggle('open', open);
    elements.exaggerationToggle.setAttribute('aria-expanded', String(open));
  }

  const measurePanel = createResultPanel({
    panel: elements.measurePanel,
    stats: elements.measureStats,
    pane: elements.satellitePane,
    visibleClass: 'panel-visible',
    closeButton: elements.measureClose,
    onClose: () => tools.deactivateAll()
  });

  function setInstruction(text) {
    elements.toolInstruction.textContent = text || '';
    elements.toolInstruction.hidden = !text;
  }

  function showMeasurement(vertices, cerrado) {
    const medida = measurePath(vertices, { terrain, grid, cerrado });
    if (!medida) return;
    const stats = [
      [medida.cerrado ? 'Perímetro' : 'Longitud', formatDistance(medida.longitudProyectada)],
      ['Sobre el relieve', formatDistance(medida.longitudDrapeada)]
    ];
    if (medida.cerrado) {
      stats.push(['Área proyectada', formatArea(medida.area)]);
      stats.push(['Área real', formatArea(medida.areaReal)]);
    }
    stats.push(['Vértices', String(medida.vertices)]);
    if (medida.desnivel !== null) stats.push(['Desnivel', formatElevation(medida.desnivel)]);
    measurePanel.setStats(stats);
    measurePanel.show();
  }

  const floodPanel = createResultPanel({
    panel: elements.floodPanel,
    stats: elements.floodStats,
    pane: elements.satellitePane,
    visibleClass: 'panel-visible',
    closeButton: elements.floodClose,
    onClose: () => tools.deactivateAll()
  });

  const flood = createFloodModel(grid);
  let floodRaster = null;
  let floodFrame = 0;

  function prepareFloodSlider() {
    const minimum = Math.floor(flood.minimum);
    const maximum = Math.ceil(flood.maximum);
    elements.floodLevel.min = String(minimum);
    elements.floodLevel.max = String(maximum);
    if (!elements.floodLevel.dataset.ready) {
      elements.floodLevel.value = String(Math.round(minimum + (maximum - minimum) * 0.25));
      elements.floodLevel.dataset.ready = 'si';
    }
  }

  // Azul más oscuro cuanto mayor es la lámina de agua, hasta 5 m de profundidad.
  function floodColors(result) {
    const colors = new Uint32Array(grid.cellCount);
    const elevations = grid.elevationArray();
    for (let index = 0; index < result.mask.length; index += 1) {
      if (!result.mask[index]) continue;
      const depth = Math.min(1, (result.nivel - elevations[index]) / 5);
      colors[index] = packColor(
        Math.round(96 - 60 * depth),
        Math.round(178 - 70 * depth),
        Math.round(226 - 40 * depth),
        Math.round(140 + 70 * depth)
      );
    }
    return colors;
  }

  function updateFlood() {
    const level = Number(elements.floodLevel.value);
    const conectado = elements.floodConnected.checked;
    const result = flood.floodAt(level, { conectado });
    elements.floodLevelValue.textContent = formatElevation(level);
    terrainPlot.setWaterLevel(level);

    window.cancelAnimationFrame(floodFrame);
    floodFrame = window.requestAnimationFrame(() => {
      if (!floodRaster) floodRaster = satelliteMap.createRaster({ grid, opacity: 0.72, className: 'flood-raster' });
      floodRaster.show();
      floodRaster.render(floodColors(result));
    });

    floodPanel.setStats([
      ['Cota simulada', formatElevation(level)],
      ['Área inundada', formatArea(result.area)],
      ['Volumen', formatVolume(result.volumen)],
      ['Del área de estudio', `${((result.area / flood.validArea) * 100).toFixed(1)} %`]
    ]);
    floodPanel.show();
  }

  tools.register('inundacion', {
    button: elements.floodTool,
    activate: () => {
      prepareFloodSlider();
      updateFlood();
    },
    deactivate: () => {
      floodRaster?.hide();
      terrainPlot.setWaterLevel(null);
      floodPanel.hide();
    }
  });

  elements.floodTool.addEventListener('click', () => tools.toggle('inundacion'));
  elements.floodLevel.addEventListener('input', () => {
    if (tools.isActive('inundacion')) updateFlood();
  });
  elements.floodConnected.addEventListener('change', () => {
    if (tools.isActive('inundacion')) updateFlood();
  });
  elements.floodPanel.addEventListener('click', event => event.stopPropagation());

  function renderProfile(start, end) {
    const profile = terrain.sampleLine(start, end);
    if (!profileChart.render(profile)) return;
    setInstruction(null);
    profilePanel.show();
  }

  tools.register('perfil', {
    button: elements.profileTool,
    activate: () => satelliteMap.beginProfile({
      onInstruccion: setInstruction,
      onFinalizar: renderProfile
    }),
    deactivate: () => {
      satelliteMap.cancelDrawing();
      setInstruction(null);
      profilePanel.hide();
      profileChart.clear();
    }
  });

  tools.register('medicion', {
    button: elements.measureTool,
    activate: () => {
      satelliteMap.beginDrawing({
        modo: 'polilinea',
        grupo: 'medicion',
        color: MEASURE_COLOR,
        snap: false,
        permitirCierre: true,
        onInstruccion: setInstruction,
        onVertice: (_, vertices) => {
          if (vertices.length >= 2) showMeasurement(vertices, false);
        },
        onFinalizar: (vertices, { cerrado }) => {
          setInstruction(null);
          showMeasurement(vertices, cerrado);
        }
      });
      setInstruction('Toca puntos para medir · doble clic o Enter para terminar · cierra sobre el primer punto para el área');
    },
    deactivate: () => {
      satelliteMap.cancelDrawing();
      setInstruction(null);
      measurePanel.hide();
    }
  });

  elements.measureTool.addEventListener('click', () => tools.toggle('medicion'));

  elements.exaggeration.addEventListener('input', () => {
    elements.exaggerationValue.textContent = `${elements.exaggeration.value}×`;
    terrainPlot.setExaggeration(elements.exaggeration.value);
  });
  elements.exaggerationToggle.addEventListener('click', event => {
    event.stopPropagation();
    setExaggerationPanel(elements.exaggerationPanel.hidden);
  });
  elements.exaggerationPanel.addEventListener('click', event => event.stopPropagation());
  elements.colorButtons.forEach(button => button.addEventListener('click', () => setColorMode(button.dataset.colorMode)));
  elements.contours.addEventListener('click', toggleContours);
  elements.profileTool.addEventListener('click', () => tools.toggle('perfil'));
  elements.resetCamera.addEventListener('click', () => terrainPlot.resetCamera());
  document.addEventListener('click', () => setExaggerationPanel(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      setExaggerationPanel(false);
      tools.deactivateAll();
    }
    if (event.key === 'Enter') satelliteMap.finishDrawing();
  });
  window.addEventListener('resize', () => {
    terrainPlot.resize();
    satelliteMap.resize();
  });

  terrainPlot.initialize(Number(elements.exaggeration.value))
    .then(() => {
      satelliteMap.initialize();
      applyUrlParameters();
      elements.loading.hidden = true;
    })
    .catch(error => {
      console.error('No se pudo iniciar el visor', error);
      elements.loading.hidden = true;
      elements.error.hidden = false;
    });

  // Parámetros de consulta: permiten reproducir un estado exacto en capturas y enlaces.
  function applyUrlParameters() {
    const parameters = new URLSearchParams(window.location.search);
    const requestedMode = parameters.get('color');
    if (['elevation', 'satellite'].includes(requestedMode)) setColorMode(requestedMode);

    const herramienta = parameters.get('herramienta');
    if (!herramienta) return;
    if (herramienta === 'inundacion') {
      prepareFloodSlider();
      const cota = Number(parameters.get('cota'));
      if (Number.isFinite(cota) && parameters.has('cota')) elements.floodLevel.value = String(cota);
      if (parameters.get('conectado') === 'si') elements.floodConnected.checked = true;
    }
    tools.activate(herramienta);
  }

  window.setTimeout(() => { elements.touchHint.style.opacity = '0'; }, 3600);
}
