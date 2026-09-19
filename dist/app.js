import {
  formatArea,
  formatCoordinateLabel,
  formatDischarge,
  formatDistance,
  formatDuration,
  formatElevation,
  formatRainfall,
  formatVolume,
  MEASURE_COLOR,
  REFERENCIAS_ORINOCO,
  UTM_20N
} from './js/config.js';
import { createTerrainModel } from './js/domain/terrain.js';
import { createGrid } from './js/domain/grid.js';
import { measurePath } from './js/domain/measure.js';
import { createFloodModel } from './js/domain/flood.js';
import { estimarLlenado, REGIMEN_CAUDAL, REGIMEN_LLUVIA } from './js/domain/flood-timing.js';
import { createHydrologyModel } from './js/domain/hydrology.js';
import { parseKml } from './js/domain/kml.js';
import { extractKmlFromKmz, looksLikeZip } from './js/domain/kmz.js';
import { packColor } from './js/adapters/raster-overlay.js';
import { createTerrainPlot } from './js/adapters/terrain-plot.js';
import { createSatelliteMap } from './js/adapters/satellite-map.js';
import { createProfileChart } from './js/ui/profile-chart.js';
import { createToolController } from './js/ui/tool-controller.js';
import { createResultPanel } from './js/ui/result-panel.js';
import { createLayersPanel } from './js/ui/layers-panel.js';

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
  profileCollapse: byId('profile-collapse'),
  measureTool: byId('measure-tool'),
  measurePanel: byId('measure-panel'),
  measureStats: byId('measure-stats'),
  measureClose: byId('measure-close'),
  measureCollapse: byId('measure-collapse'),
  floodTool: byId('flood-tool'),
  floodPanel: byId('flood-panel'),
  floodStats: byId('flood-stats'),
  floodClose: byId('flood-close'),
  floodCollapse: byId('flood-collapse'),
  floodLevel: byId('flood-level'),
  floodLevelValue: byId('flood-level-value'),
  floodConnected: byId('flood-connected'),
  floodMarks: byId('flood-marks'),
  floodReference: byId('flood-reference'),
  floodAssumption: byId('flood-assumption'),
  floodRainControls: byId('flood-rain-controls'),
  floodFlowControls: byId('flood-flow-controls'),
  floodIntensity: byId('flood-intensity'),
  floodIntensityValue: byId('flood-intensity-value'),
  floodRunoff: byId('flood-runoff'),
  floodRunoffValue: byId('flood-runoff-value'),
  floodDischarge: byId('flood-discharge'),
  floodDischargeValue: byId('flood-discharge-value'),
  floodRegimes: Array.from(document.querySelectorAll('[data-flood-regime]')),
  drainageTool: byId('drainage-tool'),
  drainagePanel: byId('drainage-panel'),
  drainageStats: byId('drainage-stats'),
  drainageClose: byId('drainage-close'),
  drainageCollapse: byId('drainage-collapse'),
  drainageThreshold: byId('drainage-threshold'),
  drainageThresholdValue: byId('drainage-threshold-value'),
  drainageDepth: byId('drainage-depth'),
  drainageDepthValue: byId('drainage-depth-value'),
  layersTool: byId('layers-tool'),
  layersPanel: byId('layers-panel'),
  layersClose: byId('layers-close'),
  layersCollapse: byId('layers-collapse'),
  layersAdd: byId('layers-add'),
  layersInput: byId('layers-input'),
  layersList: byId('layers-list'),
  layersEmpty: byId('layers-empty'),
  layersError: byId('layers-error'),
  resetCamera: byId('reset-camera'),
  touchHint: byId('touch-hint'),
  summaryElevation: byId('summary-elevation'),
  legendBuffer: byId('legend-buffer'),
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

  // El resumen y la leyenda se llenan desde el payload para que nunca se desincronicen
  // del modelo publicado.
  elements.summaryElevation.textContent =
    `${Math.round(data.actualMinElevation)} a ${Math.round(data.actualMaxElevation)} m.s.n.m.`;
  elements.legendBuffer.textContent = `Zona de influencia · ${data.bufferMeters} m`;

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
    collapseButton: elements.profileCollapse,
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
    collapseButton: elements.measureCollapse,
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
    collapseButton: elements.floodCollapse,
    onClose: () => tools.deactivateAll()
  });

  const flood = createFloodModel(grid);
  let floodRaster = null;
  let floodFrame = 0;
  let floodRegime = REGIMEN_LLUVIA;

  function prepareFloodSlider() {
    const minimum = Math.floor(flood.minimum);
    const maximum = Math.ceil(flood.maximum);
    elements.floodLevel.min = String(minimum);
    elements.floodLevel.max = String(maximum);
    if (!elements.floodLevel.dataset.ready) {
      elements.floodLevel.value = String(Math.round(minimum + (maximum - minimum) * 0.25));
      elements.floodLevel.dataset.ready = 'si';
      elements.floodMarks.replaceChildren(...REFERENCIAS_ORINOCO
        .filter(referencia => referencia.cota >= minimum && referencia.cota <= maximum)
        .map(referencia => {
          const marca = document.createElement('option');
          marca.value = String(referencia.cota);
          marca.label = referencia.etiqueta;
          return marca;
        }));
    }
  }

  // El deslizador llega mucho más arriba de lo que el Orinoco ha alcanzado nunca: sin esta
  // referencia es fácil leer como plausible una cota que el río no produce.
  function describeFloodReference(level) {
    const debajo = REFERENCIAS_ORINOCO.filter(referencia => referencia.cota <= level);
    const maximo = REFERENCIAS_ORINOCO[REFERENCIAS_ORINOCO.length - 1];
    if (!debajo.length) {
      const proxima = REFERENCIAS_ORINOCO[0];
      return `${formatElevation(proxima.cota - level)} por debajo de la ${proxima.etiqueta.toLowerCase()} del Orinoco (${formatElevation(proxima.cota)}.s.n.m.).`;
    }
    const alcanzada = debajo[debajo.length - 1];
    if (alcanzada === maximo) {
      return `${formatElevation(level - maximo.cota)} por encima del ${maximo.etiqueta.toLowerCase()} del Orinoco en Ciudad Bolívar: escenario sin precedente registrado.`;
    }
    return `Supera la referencia «${alcanzada.etiqueta}» del Orinoco (${formatElevation(alcanzada.cota)}.s.n.m.).`;
  }

  // El deslizador de caudal recorre cuatro órdenes de magnitud, de 1 a 10.000 m³/s.
  function floodDischargeValue() {
    return 10 ** (Number(elements.floodDischarge.value) / 25);
  }

  function setFloodRegime(regime) {
    floodRegime = regime;
    elements.floodRegimes.forEach(button => {
      const activo = button.dataset.floodRegime === regime;
      button.classList.toggle('is-active', activo);
      button.setAttribute('aria-pressed', activo ? 'true' : 'false');
    });
    elements.floodRainControls.hidden = regime !== REGIMEN_LLUVIA;
    elements.floodFlowControls.hidden = regime !== REGIMEN_CAUDAL;
  }

  // El aporte se genera sobre toda la zona de influencia: es la única cuenca que el DEM publica.
  function estimateFloodTiming(volumen) {
    const intensidad = Number(elements.floodIntensity.value);
    const coeficiente = Number(elements.floodRunoff.value);
    const caudal = floodDischargeValue();
    elements.floodIntensityValue.textContent = `${intensidad} mm/h`;
    elements.floodRunoffValue.textContent = coeficiente.toLocaleString('es-CO', { minimumFractionDigits: 2 });
    elements.floodDischargeValue.textContent = formatDischarge(caudal);
    return estimarLlenado(volumen, floodRegime, {
      areaAportante: flood.validArea,
      intensidad,
      coeficiente,
      caudal
    });
  }

  function describeFloodAssumption(timing) {
    if (!(timing.caudal > 0)) return 'Sin aporte no hay tiempo de llenado.';
    if (timing.regimen === REGIMEN_LLUVIA) {
      return `Aporte de ${formatDischarge(timing.caudal)} generado sobre ${formatArea(flood.validArea)} de zona de influencia. Hacen falta ${formatRainfall(timing.lamina)} de lluvia bruta.`;
    }
    return `Aporte externo constante de ${formatDischarge(timing.caudal)}, equivalente a ${formatRainfall(timing.lamina)} repartidos sobre ${formatArea(flood.validArea)}.`;
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

    const timing = estimateFloodTiming(result.volumen);
    elements.floodReference.textContent = describeFloodReference(level);
    elements.floodAssumption.textContent = describeFloodAssumption(timing);

    floodPanel.setStats([
      ['Área inundada', formatArea(result.area)],
      ['Volumen', formatVolume(result.volumen)],
      ['Del área de estudio', `${((result.area / flood.validArea) * 100).toFixed(1)} %`],
      ['Tiempo de llenado', formatDuration(timing.segundos)]
    ]);
    floodPanel.show();
  }

  tools.register('inundacion', {
    button: elements.floodTool,
    activate: () => {
      prepareFloodSlider();
      setFloodRegime(floodRegime);
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
  [elements.floodIntensity, elements.floodRunoff, elements.floodDischarge].forEach(control => {
    control.addEventListener('input', () => {
      if (tools.isActive('inundacion')) updateFlood();
    });
  });
  elements.floodRegimes.forEach(button => {
    button.addEventListener('click', () => {
      setFloodRegime(button.dataset.floodRegime);
      if (tools.isActive('inundacion')) updateFlood();
    });
  });
  elements.floodPanel.addEventListener('click', event => event.stopPropagation());

  const drainagePanel = createResultPanel({
    panel: elements.drainagePanel,
    stats: elements.drainageStats,
    pane: elements.satellitePane,
    visibleClass: 'panel-visible',
    closeButton: elements.drainageClose,
    collapseButton: elements.drainageCollapse,
    onClose: () => tools.deactivateAll()
  });

  const hydrology = createHydrologyModel(grid);
  let drainageRaster = null;
  let drainageFrame = 0;

  const PONDING_COLOR = [3, 150, 166];
  const STREAM_COLOR = [56, 189, 248];

  function drainageColors(encharcamiento, cauces, profundidadMinima) {
    const colors = new Uint32Array(grid.cellCount);
    const maximo = Math.max(profundidadMinima * 3, 1);
    encharcamiento.cells.forEach(index => {
      const intensidad = Math.min(1, encharcamiento.depth[index] / maximo);
      colors[index] = packColor(
        PONDING_COLOR[0],
        PONDING_COLOR[1],
        PONDING_COLOR[2],
        Math.round(90 + 120 * intensidad)
      );
    });
    // Los cauces se pintan encima del encharcamiento.
    cauces.cells.forEach(index => {
      colors[index] = packColor(STREAM_COLOR[0], STREAM_COLOR[1], STREAM_COLOR[2], 235);
    });
    return colors;
  }

  function updateDrainage({ conTrazas3D = false } = {}) {
    const hectareas = Number(elements.drainageThreshold.value);
    const profundidad = Number(elements.drainageDepth.value);
    elements.drainageThresholdValue.textContent = `${hectareas} ha`;
    elements.drainageDepthValue.textContent = formatElevation(profundidad);

    const cauces = hydrology.streamSegments(hectareas);
    const encharcamiento = hydrology.ponding(profundidad);

    window.cancelAnimationFrame(drainageFrame);
    drainageFrame = window.requestAnimationFrame(() => {
      if (!drainageRaster) drainageRaster = satelliteMap.createRaster({ grid, opacity: 0.8, className: 'drainage-raster' });
      drainageRaster.show();
      drainageRaster.render(drainageColors(encharcamiento, cauces, profundidad));
    });

    // Redibujar miles de segmentos en la escena 3D solo al soltar el deslizador.
    if (conTrazas3D) terrainPlot.setStreams(cauces);

    drainagePanel.setStats([
      ['Longitud de cauces', formatDistance(cauces.length)],
      ['Área encharcada', formatArea(encharcamiento.area)],
      ['Profundidad máxima', formatElevation(hydrology.compute().maximumDepth)],
      ['Celdas con cauce', String(cauces.cells.length)]
    ]);
    drainagePanel.show();
  }

  tools.register('drenaje', {
    button: elements.drainageTool,
    activate: () => updateDrainage({ conTrazas3D: true }),
    deactivate: () => {
      drainageRaster?.hide();
      terrainPlot.setStreams(null);
      drainagePanel.hide();
    }
  });

  elements.drainageTool.addEventListener('click', () => tools.toggle('drenaje'));
  [elements.drainageThreshold, elements.drainageDepth].forEach(control => {
    control.addEventListener('input', () => {
      if (tools.isActive('drenaje')) updateDrainage();
    });
    control.addEventListener('change', () => {
      if (tools.isActive('drenaje')) updateDrainage({ conTrazas3D: true });
    });
  });
  elements.drainagePanel.addEventListener('click', event => event.stopPropagation());

  const layersPanel = createResultPanel({
    panel: elements.layersPanel,
    pane: elements.satellitePane,
    visibleClass: 'panel-visible',
    closeButton: elements.layersClose,
    collapseButton: elements.layersCollapse,
    onClose: () => tools.deactivateAll()
  });

  const layersList = createLayersPanel({
    list: elements.layersList,
    empty: elements.layersEmpty,
    onToggle: (id, visible) => satelliteMap.setUserLayerVisible(id, visible),
    onZoom: id => satelliteMap.zoomToUserLayer(id),
    onRemove: id => satelliteMap.removeUserLayer(id)
  });

  function showLayerError(message) {
    elements.layersError.textContent = message || '';
    elements.layersError.hidden = !message;
  }

  function contarElementos(geojson) {
    return geojson.features.length;
  }

  async function leerCapa(file) {
    if (file.name.toLowerCase().endsWith('.kmz')) {
      const buffer = await file.arrayBuffer();
      if (!looksLikeZip(buffer)) throw new Error(`${file.name} no parece un archivo KMZ`);
      return parseKml(await extractKmlFromKmz(buffer));
    }
    return parseKml(await file.text());
  }

  async function cargarCapas(files) {
    tools.activate('capas');
    showLayerError(null);
    for (const file of files) {
      try {
        const { geojson, nombre } = await leerCapa(file);
        if (!geojson.features.length) {
          showLayerError(`${file.name} no contiene geometrías que se puedan dibujar`);
          continue;
        }
        const id = satelliteMap.addUserLayer(geojson);
        layersList.add({ id, nombre: nombre || file.name, elementos: contarElementos(geojson) });
        satelliteMap.zoomToUserLayer(id);
      } catch (error) {
        console.error('No se pudo cargar la capa', file.name, error);
        showLayerError(error.message || `No se pudo leer ${file.name}`);
      }
    }
  }

  tools.register('capas', {
    button: elements.layersTool,
    activate: () => layersPanel.show(),
    deactivate: () => {
      layersPanel.hide();
      showLayerError(null);
    }
  });

  elements.layersTool.addEventListener('click', () => tools.toggle('capas'));
  elements.layersAdd.addEventListener('click', () => elements.layersInput.click());
  elements.layersInput.addEventListener('change', () => {
    cargarCapas([...elements.layersInput.files]);
    elements.layersInput.value = '';
  });
  elements.layersPanel.addEventListener('click', event => event.stopPropagation());

  // Arrastrar y soltar sobre el panel satelital.
  ['dragenter', 'dragover'].forEach(type => {
    elements.satellitePane.addEventListener(type, event => {
      if (!event.dataTransfer?.types.includes('Files')) return;
      event.preventDefault();
      elements.satellitePane.classList.add('drop-target');
    });
  });
  elements.satellitePane.addEventListener('dragleave', event => {
    if (event.target !== elements.satellitePane) return;
    elements.satellitePane.classList.remove('drop-target');
  });
  elements.satellitePane.addEventListener('drop', event => {
    if (!event.dataTransfer?.files.length) return;
    event.preventDefault();
    elements.satellitePane.classList.remove('drop-target');
    cargarCapas([...event.dataTransfer.files]);
  });

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
    if (herramienta === 'drenaje') {
      const umbral = Number(parameters.get('umbral'));
      if (parameters.has('umbral') && Number.isFinite(umbral)) elements.drainageThreshold.value = String(umbral);
      const profundidad = Number(parameters.get('profundidad'));
      if (parameters.has('profundidad') && Number.isFinite(profundidad)) elements.drainageDepth.value = String(profundidad);
    }
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
