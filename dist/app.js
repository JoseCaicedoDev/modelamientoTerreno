(() => {
  const data = window.TERRAIN_DATA;
  const plot = document.getElementById('terrain-plot');
  const satelliteMapElement = document.getElementById('satellite-map');
  const sourceLabel = document.getElementById('source-label');
  const terrainCoordinate = document.getElementById('terrain-coordinate');
  const mapCoordinate = document.getElementById('map-coordinate');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const exaggeration = document.getElementById('exaggeration');
  const exaggerationValue = document.getElementById('exaggeration-value');
  const exaggerationToggle = document.getElementById('exaggeration-toggle');
  const exaggerationPanel = document.getElementById('exaggeration-panel');
  const contoursButton = document.getElementById('contours-toggle');
  const resetButton = document.getElementById('reset-camera');
  const colorButtons = [...document.querySelectorAll('[data-color-mode]')];
  const touchHint = document.getElementById('touch-hint');

  const elevationScale = [
    [0.00, '#173a72'],
    [0.18, '#2488bd'],
    [0.36, '#4fbf91'],
    [0.55, '#c8d878'],
    [0.72, '#d7bb78'],
    [0.86, '#936d5b'],
    [1.00, '#f2efe6']
  ];
  const camera = { eye: { x: 1.34, y: -1.5, z: 0.78 }, center: { x: 0, y: 0, z: -0.08 } };
  let colorMode = 'elevation';
  let contoursVisible = true;
  let satelliteMap;
  let studyAreaBounds;
  let mapCursorMarker;
  let cursorClearTimer;
  let lastCursorKey;

  function zAspect() {
    return 0.055 * Number(exaggeration.value);
  }

  const surface = {
    type: 'surface',
    x: data.x,
    y: data.y,
    z: data.z,
    surfacecolor: data.z,
    colorscale: elevationScale,
    cmin: data.minElevation,
    cmax: data.maxElevation,
    connectgaps: false,
    showscale: true,
    colorbar: {
      title: { text: 'Elevación<br>(m.s.n.m.)', side: 'right', font: { color: '#f1f5f9', size: 13, family: 'Montserrat' } },
      tickfont: { color: '#cbd5e1', size: 12, family: 'Montserrat' },
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

  function buildSatelliteMesh() {
    const x = [];
    const y = [];
    const z = [];
    const vertexcolor = [];
    const vertexIndex = data.z.map(row => row.map(() => -1));

    data.z.forEach((row, rowIndex) => {
      row.forEach((elevation, columnIndex) => {
        if (elevation === null) return;
        vertexIndex[rowIndex][columnIndex] = x.length;
        x.push(data.x[columnIndex]);
        y.push(data.y[rowIndex]);
        z.push(elevation);
        vertexcolor.push(data.satellite[rowIndex][columnIndex]);
      });
    });

    const i = [];
    const j = [];
    const k = [];
    for (let row = 0; row < vertexIndex.length - 1; row += 1) {
      for (let column = 0; column < vertexIndex[row].length - 1; column += 1) {
        const northwest = vertexIndex[row][column];
        const northeast = vertexIndex[row][column + 1];
        const southwest = vertexIndex[row + 1][column];
        const southeast = vertexIndex[row + 1][column + 1];
        if ([northwest, northeast, southwest, southeast].some(index => index < 0)) continue;
        i.push(northwest, northeast);
        j.push(southwest, southwest);
        k.push(northeast, southeast);
      }
    }

    return {
      type: 'mesh3d',
      x,
      y,
      z,
      i,
      j,
      k,
      vertexcolor,
      visible: false,
      flatshading: false,
      showscale: false,
      lighting: { ambient: 0.88, diffuse: 0.5, specular: 0.02, roughness: 1, fresnel: 0 },
      lightposition: { x: -120, y: -160, z: 220 },
      hovertemplate: 'Este UTM: %{x:,.1f} m<br>Norte UTM: %{y:,.1f} m<br>Elevación: %{z:.1f} m.s.n.m.<extra></extra>'
    };
  }

  const satelliteMesh = buildSatelliteMesh();
  const synchronizedMarker = {
    type: 'scatter3d',
    mode: 'markers',
    x: [],
    y: [],
    z: [],
    hoverinfo: 'skip',
    showlegend: false,
    marker: {
      size: 6,
      color: '#00cba9',
      symbol: 'diamond',
      line: { color: '#ffffff', width: 2 },
      opacity: 1
    }
  };

  const layout = {
    autosize: true,
    margin: { l: 0, r: 0, t: 0, b: 0 },
    font: { family: 'Montserrat, system-ui, sans-serif', color: '#f1f5f9' },
    paper_bgcolor: '#020617',
    plot_bgcolor: '#020617',
    showlegend: false,
    scene: {
      camera,
      aspectmode: 'manual',
      aspectratio: { x: 1, y: data.aspectY, z: zAspect() },
      bgcolor: '#020617',
      xaxis: {
        title: { text: 'Este UTM (m)', font: { color: '#cbd5e1', size: 12 } },
        tickformat: ',.0f',
        tickfont: { color: '#94a3b8', size: 10 },
        gridcolor: 'rgba(148,163,184,0.18)', zerolinecolor: 'rgba(3,150,166,0.46)',
        backgroundcolor: '#0f172a', showbackground: true, color: '#cbd5e1'
      },
      yaxis: {
        title: { text: 'Norte UTM (m)', font: { color: '#cbd5e1', size: 12 } },
        tickformat: ',.0f',
        tickfont: { color: '#94a3b8', size: 10 },
        gridcolor: 'rgba(148,163,184,0.18)', zerolinecolor: 'rgba(3,150,166,0.46)',
        backgroundcolor: '#0f172a', showbackground: true, color: '#cbd5e1'
      },
      zaxis: {
        title: { text: 'Elevación (m.s.n.m.)', font: { color: '#cbd5e1', size: 12 } },
        tickfont: { color: '#94a3b8', size: 10 },
        gridcolor: 'rgba(148,163,184,0.18)', zerolinecolor: 'rgba(3,150,166,0.46)',
        backgroundcolor: '#0f172a', showbackground: true, color: '#cbd5e1',
        range: [data.minElevation - 2, data.maxElevation + 3]
      }
    }
  };

  const config = {
    responsive: true,
    displaylogo: false,
    scrollZoom: true,
    modeBarButtonsToRemove: ['toImage', 'sendDataToCloud', 'lasso2d', 'select2d']
  };
  const requestedColorMode = new URLSearchParams(window.location.search).get('color');
  const utm20n = '+proj=utm +zone=20 +datum=WGS84 +units=m +no_defs';
  const coordinateFormatter = new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });

  function nearestTerrainPoint(easting, northing) {
    const xStep = data.x[1] - data.x[0];
    const yStep = data.y[1] - data.y[0];
    const column = Math.round((easting - data.x[0]) / xStep);
    const row = Math.round((northing - data.y[0]) / yStep);
    if (column < 0 || column >= data.x.length || row < 0 || row >= data.y.length) return null;

    let nearest = null;
    for (let radius = 0; radius <= 5 && !nearest; radius += 1) {
      for (let rowOffset = -radius; rowOffset <= radius; rowOffset += 1) {
        for (let columnOffset = -radius; columnOffset <= radius; columnOffset += 1) {
          const candidateRow = row + rowOffset;
          const candidateColumn = column + columnOffset;
          if (candidateRow < 0 || candidateRow >= data.y.length || candidateColumn < 0 || candidateColumn >= data.x.length) continue;
          const elevation = data.z[candidateRow][candidateColumn];
          if (elevation === null) continue;
          const distance = Math.hypot(
            data.x[candidateColumn] - easting,
            data.y[candidateRow] - northing
          );
          if (!nearest || distance < nearest.distance) {
            nearest = {
              x: data.x[candidateColumn],
              y: data.y[candidateRow],
              z: elevation,
              distance
            };
          }
        }
      }
    }
    return nearest;
  }

  function synchronizedLabel(point) {
    return `E ${coordinateFormatter.format(point.x)} m · N ${coordinateFormatter.format(point.y)} m · Elev. ${coordinateFormatter.format(point.z)} m.s.n.m.`;
  }

  function showSynchronizedCursor(point) {
    if (!point) {
      scheduleSynchronizedCursorClear();
      return;
    }
    window.clearTimeout(cursorClearTimer);
    const cursorKey = `${point.x}:${point.y}`;
    if (cursorKey === lastCursorKey) return;
    lastCursorKey = cursorKey;

    Plotly.restyle(plot, {
      x: [[point.x]],
      y: [[point.y]],
      z: [[point.z + 0.8]]
    }, [2]);

    const [longitude, latitude] = proj4(utm20n, 'EPSG:4326', [point.x, point.y]);
    if (!mapCursorMarker) {
      mapCursorMarker = L.circleMarker([latitude, longitude], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: '#00cba9',
        fillOpacity: 1,
        opacity: 1,
        className: 'sync-cursor-marker',
        interactive: false
      }).addTo(satelliteMap);
    } else {
      mapCursorMarker.setLatLng([latitude, longitude]);
    }

    const label = synchronizedLabel(point);
    terrainCoordinate.textContent = label;
    mapCoordinate.textContent = label;
    terrainCoordinate.hidden = false;
    mapCoordinate.hidden = false;
  }

  function clearSynchronizedCursor() {
    lastCursorKey = null;
    Plotly.restyle(plot, { x: [[]], y: [[]], z: [[]] }, [2]);
    if (mapCursorMarker && satelliteMap) {
      satelliteMap.removeLayer(mapCursorMarker);
      mapCursorMarker = null;
    }
    terrainCoordinate.hidden = true;
    mapCoordinate.hidden = true;
  }

  function scheduleSynchronizedCursorClear() {
    window.clearTimeout(cursorClearTimer);
    cursorClearTimer = window.setTimeout(clearSynchronizedCursor, 60);
  }

  function setColorMode(mode) {
    colorMode = mode;
    const satellite = mode === 'satellite';
    Plotly.restyle(plot, { visible: !satellite }, [0]);
    Plotly.restyle(plot, { visible: satellite }, [1]);
    if (!satellite) {
      Plotly.restyle(plot, {
        surfacecolor: [data.z],
        colorscale: [elevationScale],
        cmin: data.minElevation,
        cmax: data.maxElevation,
        'colorbar.title.text': 'Elevación<br>(m.s.n.m.)',
        showscale: true
      }, [0]);
    }
    contoursButton.disabled = satellite;
    contoursButton.title = satellite ? 'Las curvas están disponibles en la coloración de elevación' : '';
    colorButtons.forEach(button => button.classList.toggle('active', button.dataset.colorMode === mode));
    updateSourceLabel();
  }

  function setContours(next) {
    contoursVisible = next;
    Plotly.restyle(plot, { 'contours.z.show': next, 'contours.z.project.z': next }, [0]);
    contoursButton.classList.toggle('active', next);
    contoursButton.setAttribute('aria-pressed', String(next));
  }

  function initializeSatelliteMap() {
    if (satelliteMap || !window.L || !data.boundary || !data.buffer) return;

    satelliteMap = L.map(satelliteMapElement, {
      zoomControl: false,
      attributionControl: true
    });

    L.control.zoom({ position: 'topright' }).addTo(satelliteMap);
    addResetAreaControl();
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(satelliteMap);

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics y GIS User Community'
      }
    ).addTo(satelliteMap);

    const bufferLayer = L.polygon(data.buffer, {
      color: '#0396a6',
      weight: 2,
      dashArray: '8 7',
      fillColor: '#0396a6',
      fillOpacity: 0.08
    }).addTo(satelliteMap);

    L.polygon(data.boundary, {
      color: '#00cba9',
      weight: 3,
      fillColor: '#00cba9',
      fillOpacity: 0.12
    }).addTo(satelliteMap);

    studyAreaBounds = bufferLayer.getBounds();
    fitStudyArea();

    satelliteMap.on('mousemove', event => {
      const [easting, northing] = proj4('EPSG:4326', utm20n, [event.latlng.lng, event.latlng.lat]);
      showSynchronizedCursor(nearestTerrainPoint(easting, northing));
    });
    satelliteMapElement.addEventListener('mouseleave', scheduleSynchronizedCursorClear);
  }

  function fitStudyArea() {
    if (studyAreaBounds) satelliteMap.fitBounds(studyAreaBounds, { padding: [34, 34] });
  }

  function addResetAreaControl() {
    const control = L.control({ position: 'topright' });
    control.onAdd = () => {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control map-reset');
      const button = L.DomUtil.create('a', '', container);
      button.href = '#';
      button.role = 'button';
      button.title = 'Volver al área de estudio';
      button.setAttribute('aria-label', 'Volver al área de estudio');
      button.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
        + '<path d="M3 8V4h4M21 8V4h-4M3 16v4h4M21 16v4h-4"/><circle cx="12" cy="12" r="3.2"/></svg>';
      L.DomEvent.on(button, 'click', event => {
        L.DomEvent.stop(event);
        fitStudyArea();
      });
      L.DomEvent.disableClickPropagation(container);
      return container;
    };
    control.addTo(satelliteMap);
  }

  function updateSourceLabel() {
    if (colorMode === 'satellite') {
      sourceLabel.textContent = 'World Imagery © Esri, Maxar, Earthstar Geographics y GIS User Community · sobre DEM SRTMGL1';
    } else {
      sourceLabel.textContent = 'DEM SRTMGL1 · ALOS PALSAR RTC ALPSRP274680160';
    }
  }

  if (!window.Plotly || !window.L || !window.proj4 || !data) {
    loading.hidden = true;
    error.hidden = false;
    return;
  }

  Plotly.newPlot(plot, [surface, satelliteMesh, synchronizedMarker], layout, config)
    .then(() => {
      loading.hidden = true;
      initializeSatelliteMap();
      plot.on('plotly_hover', event => {
        const hoveredPoint = event.points?.[0];
        if (!hoveredPoint || hoveredPoint.curveNumber === 2) return;
        showSynchronizedCursor(nearestTerrainPoint(Number(hoveredPoint.x), Number(hoveredPoint.y)));
      });
      plot.on('plotly_unhover', scheduleSynchronizedCursorClear);
      if (['elevation', 'satellite'].includes(requestedColorMode)) {
        setColorMode(requestedColorMode);
      }
    })
    .catch(() => { loading.hidden = true; error.hidden = false; });

  exaggeration.addEventListener('input', () => {
    exaggerationValue.textContent = `${exaggeration.value}×`;
    Plotly.relayout(plot, { 'scene.aspectratio.z': zAspect() });
  });

  function setExaggerationPanel(open) {
    exaggerationPanel.hidden = !open;
    exaggerationToggle.classList.toggle('open', open);
    exaggerationToggle.setAttribute('aria-expanded', String(open));
  }

  exaggerationToggle.addEventListener('click', event => {
    event.stopPropagation();
    setExaggerationPanel(exaggerationPanel.hidden);
  });
  exaggerationPanel.addEventListener('click', event => event.stopPropagation());
  document.addEventListener('click', () => setExaggerationPanel(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setExaggerationPanel(false);
  });

  colorButtons.forEach(button => button.addEventListener('click', () => setColorMode(button.dataset.colorMode)));
  contoursButton.addEventListener('click', () => setContours(!contoursVisible));
  resetButton.addEventListener('click', () => Plotly.relayout(plot, { 'scene.camera': camera }));
  window.addEventListener('resize', () => {
    Plotly.Plots.resize(plot);
    satelliteMap?.invalidateSize();
  });
  window.setTimeout(() => { touchHint.style.opacity = '0'; }, 3600);
})();
