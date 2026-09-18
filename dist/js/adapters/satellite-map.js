import { BRAND, UTM_20N } from '../config.js';
import { createRasterOverlay } from './raster-overlay.js';

const PROFILE_COLOR = BRAND.profile;
const CLOSE_TOLERANCE_PIXELS = 16;

export function createSatelliteMap({
  element,
  data,
  nearestPoint,
  leaflet = window.L,
  project = window.proj4,
  onPointer,
  onPointerLeave
}) {
  let map;
  let studyAreaBounds;
  let cursorMarker;
  let drawing = null;
  const groups = new Map();
  const userLayers = new Map();
  let nextUserLayerId = 1;

  // Punto ajustado al centro de la celda del DEM: lo usa el perfil, que muestrea la malla.
  function toTerrainPoint(latlng) {
    const [easting, northing] = project('EPSG:4326', UTM_20N, [latlng.lng, latlng.lat]);
    const point = nearestPoint(easting, northing);
    if (!point) return null;
    const [longitude, latitude] = project(UTM_20N, 'EPSG:4326', [point.x, point.y]);
    return { ...point, latlng: leaflet.latLng(latitude, longitude) };
  }

  // Punto exacto donde se hizo clic, con la elevación de la celda más cercana.
  // La medición lo prefiere: ajustar a la celda de 25 m falsearía longitudes y áreas.
  function toExactPoint(latlng) {
    const [easting, northing] = project('EPSG:4326', UTM_20N, [latlng.lng, latlng.lat]);
    const sample = nearestPoint(easting, northing);
    if (!sample) return null;
    return { x: easting, y: northing, z: sample.z, latlng };
  }

  function layerGroup(name) {
    if (!groups.has(name)) groups.set(name, leaflet.layerGroup().addTo(map));
    return groups.get(name);
  }

  function clearGroup(name) {
    groups.get(name)?.clearLayers();
  }

  function fitStudyArea() {
    if (studyAreaBounds) map.fitBounds(studyAreaBounds, { padding: [34, 34] });
  }

  function addResetAreaControl() {
    const control = leaflet.control({ position: 'topright' });
    control.onAdd = () => {
      const container = leaflet.DomUtil.create('div', 'leaflet-bar leaflet-control map-reset');
      const button = leaflet.DomUtil.create('a', '', container);
      button.href = '#';
      button.role = 'button';
      button.title = 'Volver al área de estudio';
      button.setAttribute('aria-label', 'Volver al área de estudio');
      button.innerHTML = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">'
        + '<path d="M3 8V4h4M21 8V4h-4M3 16v4h4M21 16v4h-4"/><circle cx="12" cy="12" r="3.2"/></svg>';
      leaflet.DomEvent.on(button, 'click', event => {
        leaflet.DomEvent.stop(event);
        fitStudyArea();
      });
      leaflet.DomEvent.disableClickPropagation(container);
      return container;
    };
    control.addTo(map);
  }

  function addVertexMarker(point, label, color) {
    const marker = leaflet.circleMarker(point.latlng, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: color,
      fillOpacity: 1,
      className: 'profile-point-marker',
      interactive: false
    }).addTo(drawing.group);
    if (label) {
      marker.bindTooltip(label, { permanent: true, direction: 'top', className: 'profile-map-label' });
    }
  }

  function finishDrawing() {
    if (!drawing?.active) return;
    const { config, points, preview } = drawing;
    const minimum = config.modo === 'poligono' ? 3 : 2;
    if (points.length < minimum) return;
    if (config.modo === 'poligono') {
      preview?.remove();
      drawing.preview = null;
      leaflet.polygon(points.map(point => point.latlng), {
        color: config.color,
        weight: 3,
        fillColor: config.color,
        fillOpacity: 0.16,
        interactive: false
      }).addTo(drawing.group);
    } else {
      preview?.setLatLngs(points.map(point => point.latlng));
      preview?.setStyle({ weight: 4, dashArray: null });
    }
    drawing.active = false;
    element.closest('.satellite-pane')?.classList.remove('drawing-active');
    config.onFinalizar?.(points.slice());
  }

  function handleDrawingClick(event) {
    if (!drawing?.active) return;
    const { config, points } = drawing;
    const point = config.snap === false ? toExactPoint(event.latlng) : toTerrainPoint(event.latlng);
    if (!point) {
      config.onInstruccion?.('Selecciona un punto dentro del terreno');
      return;
    }

    if (config.modo === 'poligono' && points.length >= 3) {
      const first = map.latLngToContainerPoint(points[0].latlng);
      const current = map.latLngToContainerPoint(event.latlng);
      if (first.distanceTo(current) <= CLOSE_TOLERANCE_PIXELS) {
        finishDrawing();
        return;
      }
    }

    if (config.minSeparation && points.length >= 1) {
      const previous = points[points.length - 1];
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < config.minSeparation) {
        config.onInstruccion?.('Selecciona un punto a más de ' + config.minSeparation + ' m');
        return;
      }
    }

    points.push(point);
    addVertexMarker(point, config.etiquetas?.[points.length - 1] ?? '', config.color);

    if (!drawing.preview) {
      drawing.preview = leaflet.polyline([point.latlng, point.latlng], {
        color: config.color,
        weight: 3,
        dashArray: '7 6',
        interactive: false
      }).addTo(drawing.group);
    } else {
      drawing.preview.setLatLngs([...points.map(vertex => vertex.latlng), event.latlng]);
    }

    config.onVertice?.(point, points.slice());

    if (config.maxVertices && points.length >= config.maxVertices) finishDrawing();
  }

  function handlePointerMove(event) {
    const point = toTerrainPoint(event.latlng);
    onPointer?.(point);
    if (drawing?.active && drawing.preview && drawing.points.length) {
      drawing.preview.setLatLngs([...drawing.points.map(vertex => vertex.latlng), event.latlng]);
    }
  }

  function beginDrawing(config) {
    if (!map) return;
    cancelDrawing();
    const group = layerGroup(config.grupo ?? 'dibujo');
    group.clearLayers();
    drawing = { config, group, points: [], preview: null, active: true };
    element.closest('.satellite-pane')?.classList.add('drawing-active');
  }

  function cancelDrawing() {
    if (drawing) {
      drawing.group.clearLayers();
      drawing = null;
    }
    element.closest('.satellite-pane')?.classList.remove('drawing-active');
  }

  function createRaster(options) {
    return createRasterOverlay({ map, data, leaflet, project, ...options });
  }

  function addUserLayer(geojson, { color = BRAND.accent } = {}) {
    const id = nextUserLayerId;
    nextUserLayerId += 1;
    const layer = leaflet.geoJSON(geojson, {
      style: () => ({ color, weight: 3, fillColor: color, fillOpacity: 0.12 }),
      pointToLayer: (feature, latlng) => leaflet.circleMarker(latlng, {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1
      }),
      onEachFeature: (feature, target) => {
        const name = feature.properties?.name;
        const description = feature.properties?.description;
        if (!name && !description) return;
        const content = document.createElement('div');
        content.className = 'kml-popup';
        if (name) {
          const title = document.createElement('strong');
          title.textContent = name;
          content.append(title);
        }
        if (description) {
          const text = document.createElement('p');
          // textContent a propósito: las descripciones KML traen HTML dentro de CDATA.
          text.textContent = description;
          content.append(text);
        }
        target.bindPopup(content);
      }
    }).addTo(map);
    userLayers.set(id, layer);
    return id;
  }

  function setUserLayerVisible(id, visible) {
    const layer = userLayers.get(id);
    if (!layer) return;
    if (visible) layer.addTo(map);
    else map.removeLayer(layer);
  }

  function removeUserLayer(id) {
    const layer = userLayers.get(id);
    if (!layer) return;
    map.removeLayer(layer);
    userLayers.delete(id);
  }

  function zoomToUserLayer(id) {
    const layer = userLayers.get(id);
    if (!layer) return;
    const bounds = layer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
  }

  function initialize() {
    if (map) return;
    map = leaflet.map(element, { zoomControl: false, attributionControl: true, doubleClickZoom: false });
    leaflet.control.zoom({ position: 'topright' }).addTo(map);
    addResetAreaControl();
    leaflet.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

    leaflet.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Imágenes © Esri, Maxar, Earthstar Geographics y GIS User Community' }
    ).addTo(map);

    const bufferLayer = leaflet.polygon(data.buffer, {
      color: BRAND.primary,
      weight: 2,
      dashArray: '8 7',
      fillColor: BRAND.primary,
      fillOpacity: 0.08
    }).addTo(map);

    leaflet.polygon(data.boundary, {
      color: BRAND.accent,
      weight: 3,
      fillColor: BRAND.accent,
      fillOpacity: 0.12
    }).addTo(map);

    studyAreaBounds = bufferLayer.getBounds();
    fitStudyArea();
    map.on('mousemove', handlePointerMove);
    map.on('click', handleDrawingClick);
    map.on('dblclick', () => finishDrawing());
    element.addEventListener('mouseleave', () => onPointerLeave?.());
  }

  function showCursor(point) {
    if (!map || !point) return;
    const [longitude, latitude] = project(UTM_20N, 'EPSG:4326', [point.x, point.y]);
    if (!cursorMarker) {
      cursorMarker = leaflet.circleMarker([latitude, longitude], {
        radius: 8,
        color: '#ffffff',
        weight: 2,
        fillColor: BRAND.accent,
        fillOpacity: 1,
        opacity: 1,
        className: 'sync-cursor-marker',
        interactive: false
      }).addTo(map);
    } else {
      cursorMarker.setLatLng([latitude, longitude]);
    }
  }

  function clearCursor() {
    if (!cursorMarker || !map) return;
    map.removeLayer(cursorMarker);
    cursorMarker = null;
  }

  function resize() {
    map?.invalidateSize();
  }

  // El perfil topográfico es un dibujo de dos vértices ajustados a la malla.
  function beginProfile({ onInstruccion, onFinalizar }) {
    beginDrawing({
      modo: 'linea',
      grupo: 'perfil',
      color: PROFILE_COLOR,
      maxVertices: 2,
      minSeparation: 30,
      etiquetas: ['A', 'B'],
      snap: true,
      onInstruccion,
      onVertice: (_, points) => {
        if (points.length === 1) onInstruccion?.('Selecciona el punto final del perfil');
      },
      onFinalizar: points => onFinalizar?.(points[0], points[1])
    });
    onInstruccion?.('Selecciona el punto inicial del perfil');
  }

  return Object.freeze({
    initialize,
    showCursor,
    clearCursor,
    beginDrawing,
    beginProfile,
    cancelDrawing,
    finishDrawing,
    layerGroup,
    clearGroup,
    createRaster,
    addUserLayer,
    setUserLayerVisible,
    removeUserLayer,
    zoomToUserLayer,
    fitStudyArea,
    resize
  });
}
