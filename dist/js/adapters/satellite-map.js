import { BRAND, UTM_20N } from '../config.js';

const PROFILE_COLOR = '#f4b860';

export function createSatelliteMap({
  element,
  data,
  nearestPoint,
  leaflet = window.L,
  project = window.proj4,
  onPointer,
  onPointerLeave,
  onProfileState,
  onProfileComplete
}) {
  let map;
  let studyAreaBounds;
  let cursorMarker;
  let profileLayerGroup;
  let profilePreviewLine;
  let profileDrawing = false;
  let profilePoints = [];

  function toTerrainPoint(latlng) {
    const [easting, northing] = project('EPSG:4326', UTM_20N, [latlng.lng, latlng.lat]);
    const point = nearestPoint(easting, northing);
    if (!point) return null;
    const [longitude, latitude] = project(UTM_20N, 'EPSG:4326', [point.x, point.y]);
    return { ...point, latlng: leaflet.latLng(latitude, longitude) };
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

  function handlePointerMove(event) {
    const point = toTerrainPoint(event.latlng);
    onPointer?.(point);
    if (profileDrawing && profilePoints.length === 1 && profilePreviewLine) {
      profilePreviewLine.setLatLngs([profilePoints[0].latlng, event.latlng]);
    }
  }

  function addProfilePoint(point, label) {
    leaflet.circleMarker(point.latlng, {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: PROFILE_COLOR,
      fillOpacity: 1,
      className: 'profile-point-marker',
      interactive: false
    }).bindTooltip(label, {
      permanent: true,
      direction: 'top',
      className: 'profile-map-label'
    }).addTo(profileLayerGroup);
  }

  function handleProfileClick(event) {
    if (!profileDrawing) return;
    const point = toTerrainPoint(event.latlng);
    if (!point) {
      onProfileState?.({ active: true, drawing: true, instruction: 'Selecciona un punto dentro del terreno' });
      return;
    }
    if (profilePoints.length === 1 && Math.hypot(point.x - profilePoints[0].x, point.y - profilePoints[0].y) < 30) {
      onProfileState?.({ active: true, drawing: true, instruction: 'Selecciona un punto final a más de 30 m' });
      return;
    }

    profilePoints.push(point);
    addProfilePoint(point, profilePoints.length === 1 ? 'A' : 'B');
    if (profilePoints.length === 1) {
      onProfileState?.({ active: true, drawing: true, instruction: 'Selecciona el punto final del perfil' });
      profilePreviewLine = leaflet.polyline([point.latlng, point.latlng], {
        color: PROFILE_COLOR,
        weight: 3,
        dashArray: '7 6',
        interactive: false
      }).addTo(profileLayerGroup);
      return;
    }

    profilePreviewLine.setLatLngs(profilePoints.map(profilePoint => profilePoint.latlng));
    profilePreviewLine.setStyle({ weight: 4, dashArray: null });
    profileDrawing = false;
    onProfileState?.({ active: true, drawing: false, instruction: null });
    onProfileComplete?.(profilePoints[0], profilePoints[1]);
  }

  function initialize() {
    if (map) return;
    map = leaflet.map(element, { zoomControl: false, attributionControl: true });
    profileLayerGroup = leaflet.layerGroup().addTo(map);
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
    map.on('click', handleProfileClick);
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

  function beginProfile() {
    if (!map) return;
    clearProfile();
    profileDrawing = true;
    onProfileState?.({ active: true, drawing: true, instruction: 'Selecciona el punto inicial del perfil' });
  }

  function clearProfile() {
    profileDrawing = false;
    profilePoints = [];
    profilePreviewLine = null;
    profileLayerGroup?.clearLayers();
    onProfileState?.({ active: false, drawing: false, instruction: null });
  }

  function resize() {
    map?.invalidateSize();
  }

  return Object.freeze({ initialize, showCursor, clearCursor, beginProfile, clearProfile, resize });
}
