import { BRAND, ELEVATION_SCALE, INITIAL_CAMERA } from '../config.js';
import { buildSatelliteMeshData } from '../domain/terrain.js';

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
        range: [data.minElevation - 2, data.maxElevation + 3]
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

export function createTerrainPlot({ element, data, plotly = window.Plotly, onHover, onLeave }) {
  let initialized = false;

  async function initialize(exaggeration = 2) {
    await plotly.newPlot(
      element,
      [createSurfaceTrace(data), createSatelliteTrace(data), createCursorTrace()],
      createLayout(data, exaggeration),
      PLOT_CONFIG
    );
    element.on('plotly_hover', event => {
      const point = event.points?.[0];
      if (!point || point.curveNumber === 2) return;
      onHover?.(Number(point.x), Number(point.y));
    });
    element.on('plotly_unhover', () => onLeave?.());
    initialized = true;
  }

  function setColorMode(mode) {
    if (!initialized) return;
    const satellite = mode === 'satellite';
    plotly.restyle(element, { visible: !satellite }, [0]);
    plotly.restyle(element, { visible: satellite }, [1]);
  }

  function setContours(visible) {
    if (!initialized) return;
    plotly.restyle(element, { 'contours.z.show': visible, 'contours.z.project.z': visible }, [0]);
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
    }, [2]);
  }

  function clearCursor() {
    if (initialized) plotly.restyle(element, { x: [[]], y: [[]], z: [[]] }, [2]);
  }

  function resize() {
    if (initialized) plotly.Plots.resize(element);
  }

  return Object.freeze({ initialize, setColorMode, setContours, setExaggeration, resetCamera, showCursor, clearCursor, resize });
}
