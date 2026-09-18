import { formatCoordinateLabel, UTM_20N } from './js/config.js';
import { createTerrainModel } from './js/domain/terrain.js';
import { createGrid } from './js/domain/grid.js';
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
  profileInstruction: byId('profile-instruction'),
  profilePanel: byId('profile-panel'),
  profileChart: byId('profile-chart'),
  profileStats: byId('profile-stats'),
  profileClose: byId('profile-close'),
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
    visibleClass: 'profile-visible',
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

  function setInstruction(text) {
    elements.profileInstruction.textContent = text || '';
    elements.profileInstruction.hidden = !text;
  }

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
      const requestedMode = new URLSearchParams(window.location.search).get('color');
      if (['elevation', 'satellite'].includes(requestedMode)) setColorMode(requestedMode);
      elements.loading.hidden = true;
    })
    .catch(error => {
      console.error('No se pudo iniciar el visor', error);
      elements.loading.hidden = true;
      elements.error.hidden = false;
    });

  window.setTimeout(() => { elements.touchHint.style.opacity = '0'; }, 3600);
}
