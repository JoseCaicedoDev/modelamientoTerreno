import {
  BRAND,
  ELEVATION_SCALE,
  INITIAL_CAMERA,
  PLANNING_COLORS,
  PLANNING_PIN_HEIGHT,
  WATER_COLOR
} from '../config.js';
import { buildSatelliteMeshData } from '../domain/terrain.js';
import { fanTriangulation } from '../domain/geometry.js';

// Índices de traza estables. Todas se reservan en el newPlot inicial y se muestran u ocultan
// con restyle; nunca se añaden ni se eliminan trazas en caliente para no desplazar los índices.
export const TRAZA = Object.freeze({
  superficie: 0,
  satelital: 1,
  cursor: 2,
  cauces: 3,
  mastiles: 4,
  pines: 5,
  agua: 6
});

function createSurfaceTrace(data) {
  return {
    type: 'surface',
    x: data.x,
    y: data.y,
    z: data.z,
    surfacecolor: data.z,
    colorscale: ELEVATION_SCALE,
    cmin: data.minElevation,
    cmax: data.maxElevation,
    connectgaps: false,
    showscale: true,
    colorbar: {
      title: { text: 'Elevación<br>(m.s.n.m.)', side: 'right', font: { color: BRAND.text, size: 13, family: 'Montserrat' } },
      tickfont: { color: BRAND.muted, size: 12, family: 'Montserrat' },
      thickness: 14,
      len: 0.58,
      x: 0.97,
      outlinewidth: 0,
      bgcolor: 'rgba(15,23,42,0.72)'
    },
    lighting: { ambient: 0.62, diffuse: 0.76, specular: 0.12, roughness: 0.82, fresnel: 0.08 },
    lightposition: { x: -120, y: -160, z: 220 },
    contours: {
      z: {
        show: true,
        start: 0,
        end: 60,
        size: 10,
        color: 'rgba(25,20,18,0.72)',
        width: 2,
        usecolormap: false,
        highlight: false,
        project: { z: true }
      }
    },
    hovertemplate: 'Este UTM: %{x:,.1f} m<br>Norte UTM: %{y:,.1f} m<br>Elevación: %{z:.1f} m.s.n.m.<extra></extra>'
  };
}

function createSatelliteTrace(data) {
  return {
    type: 'mesh3d',
    ...buildSatelliteMeshData(data),
    visible: false,
    flatshading: false,
    showscale: false,
    lighting: { ambient: 0.88, diffuse: 0.5, specular: 0.02, roughness: 1, fresnel: 0 },
    lightposition: { x: -120, y: -160, z: 220 },
    hovertemplate: 'Este UTM: %{x:,.1f} m<br>Norte UTM: %{y:,.1f} m<br>Elevación: %{z:.1f} m.s.n.m.<extra></extra>'
  };
}

function createCursorTrace() {
  return {
    type: 'scatter3d',
    mode: 'lines+markers',
    x: [],
    y: [],
    z: [],
    hoverinfo: 'skip',
    showlegend: false,
    line: { color: '#00f5d4', width: 7 },
    marker: {
      size: [6, 14],
      color: [BRAND.accent, BRAND.accent],
      symbol: ['circle', 'diamond'],
      line: { color: '#ffffff', width: 3 },
      opacity: 1
    }
  };
}

// Mástil vertical de cada punto del plan: sale del relieve y sostiene la cabeza del pin.
function createPinMastsTrace() {
  return {
    type: 'scatter3d',
    mode: 'lines',
    x: [],
    y: [],
    z: [],
    visible: false,
    hoverinfo: 'skip',
    showlegend: false,
    line: { color: 'rgba(241,245,249,0.75)', width: 4 }
  };
}

// Cabeza del pin, con el color del rol y el código del punto como etiqueta.
function createPinHeadsTrace() {
  return {
    type: 'scatter3d',
    mode: 'markers+text',
    x: [],
    y: [],
    z: [],
    text: [],
    customdata: [],
    visible: false,
    showlegend: false,
    textposition: 'top center',
    textfont: { family: 'Montserrat, system-ui, sans-serif', color: BRAND.text, size: 10 },
    marker: {
      size: 9,
      color: [],
      symbol: 'circle',
      line: { color: '#ffffff', width: 2 },
      opacity: 1
    },
    hovertemplate: '%{customdata}<extra></extra>'
  };
}

function createStreamsTrace() {
  return {
    type: 'scatter3d',
    mode: 'lines',
    x: [],
    y: [],
    z: [],
    visible: false,
    hoverinfo: 'skip',
    showlegend: false,
    line: { color: '#38bdf8', width: 3 }
  };
}

// Plano de agua recortado al polígono recibido. Cambiar la cota es un restyle de z, y la
// intersección con el relieve la resuelve el z-buffer de WebGL: las lomas emergen solas.
// Debe ser la última traza y la única translúcida para evitar artefactos de ordenación.
function createWaterTrace(ring) {
  const mesh = ring?.length ? fanTriangulation(ring) : { x: [], y: [], i: [], j: [], k: [] };
  return {
    type: 'mesh3d',
    x: mesh.x,
    y: mesh.y,
    z: mesh.x.map(() => 0),
    i: mesh.i,
    j: mesh.j,
    k: mesh.k,
    visible: false,
    color: WATER_COLOR,
    opacity: 0.55,
    flatshading: true,
    showscale: false,
    hoverinfo: 'skip',
    lighting: { ambient: 0.92, diffuse: 0.3, specular: 0.05, roughness: 0.6, fresnel: 0.1 }
  };
}

function axis(title) {
  return {
    title: { text: title, font: { color: BRAND.muted, size: 12 } },
    tickformat: ',.0f',
    tickfont: { color: BRAND.subtle, size: 10 },
    gridcolor: 'rgba(148,163,184,0.18)',
    zerolinecolor: 'rgba(3,150,166,0.46)',
    backgroundcolor: BRAND.surface,
    showbackground: true,
    color: BRAND.muted
  };
}

// Rango vertical de la escena. Plotly recorta cuanto cae fuera de él, así que también acota los
// pines del plan de campo: sin esto, un punto alto empuja su cabeza por encima del techo y el pin
// entero desaparece.
function elevationRange(data) {
  return [data.minElevation - 2, data.maxElevation + 3];
}

function createLayout(data, exaggeration) {
  return {
    autosize: true,
    margin: { l: 0, r: 0, t: 0, b: 0 },
    font: { family: 'Montserrat, system-ui, sans-serif', color: BRAND.text },
    paper_bgcolor: BRAND.background,
    plot_bgcolor: BRAND.background,
    showlegend: false,
    scene: {
      camera: INITIAL_CAMERA,
      aspectmode: 'manual',
      aspectratio: { x: 1, y: data.aspectY, z: 0.055 * exaggeration },
      bgcolor: BRAND.background,
      xaxis: axis('Este UTM (m)'),
      yaxis: axis('Norte UTM (m)'),
      zaxis: {
        ...axis('Elevación (m.s.n.m.)'),
        tickformat: undefined,
        range: elevationRange(data)
      }
    }
  };
}

const PLOT_CONFIG = Object.freeze({
  responsive: true,
  displaylogo: false,
  scrollZoom: true,
  modeBarButtonsToRemove: ['toImage', 'sendDataToCloud', 'lasso2d', 'select2d']
});

export function createTerrainPlot({ element, data, waterRing, plotly = window.Plotly, onHover, onLeave }) {
  let initialized = false;

  async function initialize(exaggeration = 2) {
    await plotly.newPlot(
      element,
      [
        createSurfaceTrace(data),
        createSatelliteTrace(data),
        createCursorTrace(),
        createStreamsTrace(),
        createPinMastsTrace(),
        createPinHeadsTrace(),
        createWaterTrace(waterRing)
      ],
      createLayout(data, exaggeration),
      PLOT_CONFIG
    );
    element.on('plotly_hover', event => {
      const point = event.points?.[0];
      if (!point || point.curveNumber !== TRAZA.superficie && point.curveNumber !== TRAZA.satelital) return;
      onHover?.(Number(point.x), Number(point.y));
    });
    element.on('plotly_unhover', () => onLeave?.());
    initialized = true;
  }

  function setColorMode(mode) {
    if (!initialized) return;
    const satellite = mode === 'satellite';
    plotly.restyle(element, { visible: !satellite }, [TRAZA.superficie]);
    plotly.restyle(element, { visible: satellite }, [TRAZA.satelital]);
  }

  function setContours(visible) {
    if (!initialized) return;
    plotly.restyle(element, { 'contours.z.show': visible, 'contours.z.project.z': visible }, [TRAZA.superficie]);
  }

  function setExaggeration(value) {
    if (initialized) plotly.relayout(element, { 'scene.aspectratio.z': 0.055 * Number(value) });
  }

  function resetCamera() {
    if (initialized) plotly.relayout(element, { 'scene.camera': INITIAL_CAMERA });
  }

  function showCursor(point) {
    if (!initialized) return;
    plotly.restyle(element, {
      x: [[point.x, point.x]],
      y: [[point.y, point.y]],
      z: [[point.z + 0.5, point.z + 8]]
    }, [TRAZA.cursor]);
  }

  function clearCursor() {
    if (initialized) plotly.restyle(element, { x: [[]], y: [[]], z: [[]] }, [TRAZA.cursor]);
  }

  function setWaterLevel(level) {
    if (!initialized) return;
    if (level === null || level === undefined) {
      plotly.restyle(element, { visible: false }, [TRAZA.agua]);
      return;
    }
    const vertices = element.data[TRAZA.agua].x.length;
    plotly.restyle(element, {
      z: [new Array(vertices).fill(level)],
      visible: true
    }, [TRAZA.agua]);
  }

  // lines: { x, y, z } con null como separador entre tramos, o null para ocultar la traza.
  function setStreams(lines) {
    if (!initialized) return;
    if (!lines) {
      plotly.restyle(element, { visible: false, x: [[]], y: [[]], z: [[]] }, [TRAZA.cauces]);
      return;
    }
    plotly.restyle(element, {
      x: [lines.x],
      y: [lines.y],
      z: [lines.z],
      visible: true
    }, [TRAZA.cauces]);
  }

  // points: puntos del plan de campo ({ id, x, y, z, role, roleLabel }), o null para ocultarlos.
  function setPlanningPins(points) {
    if (!initialized) return;
    if (!points?.length) {
      plotly.restyle(element, { visible: false, x: [[], []], y: [[], []], z: [[], []] }, [TRAZA.mastiles, TRAZA.pines]);
      return;
    }
    const [floor, ceiling] = elevationRange(data);
    const clampElevation = value => Math.min(Math.max(value, floor), ceiling);
    const headElevation = point => clampElevation(Number(point.z ?? 0) + PLANNING_PIN_HEIGHT);
    const mast = { x: [], y: [], z: [] };
    points.forEach(point => {
      mast.x.push(point.x, point.x, null);
      mast.y.push(point.y, point.y, null);
      mast.z.push(clampElevation(Number(point.z ?? 0)), headElevation(point), null);
    });
    plotly.restyle(element, {
      x: [mast.x],
      y: [mast.y],
      z: [mast.z],
      visible: true
    }, [TRAZA.mastiles]);
    plotly.restyle(element, {
      x: [points.map(point => point.x)],
      y: [points.map(point => point.y)],
      z: [points.map(headElevation)],
      text: [points.map(point => point.id)],
      customdata: [points.map(point => `${point.id} · ${point.roleLabel}<br>Elevación: ${Number(point.z ?? 0).toFixed(1)} m.s.n.m.`)],
      'marker.color': [points.map(point => PLANNING_COLORS[point.role] ?? BRAND.accent)],
      visible: true
    }, [TRAZA.pines]);
  }

  function resize() {
    if (initialized) plotly.Plots.resize(element);
  }

  return Object.freeze({
    initialize,
    setColorMode,
    setContours,
    setExaggeration,
    resetCamera,
    showCursor,
    clearCursor,
    setWaterLevel,
    setStreams,
    setPlanningPins,
    resize
  });
}
