// Lector de KML sin dependencias: cubre el subconjunto que producen Google Earth y QGIS para
// linderos y recorridos (Folder, Placemark, Point, LineString, Polygon, MultiGeometry).
// Devuelve GeoJSON, que es lo que consume Leaflet.
//
// Queda fuera a propósito: NetworkLink, gx:Track, Model, StyleMap e iconos remotos.

export function parseCoordinates(text) {
  return String(text)
    .trim()
    .split(/\s+/)
    .map(tuple => tuple.split(',').map(Number))
    .filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude))
    .map(([longitude, latitude, altitude]) => (
      Number.isFinite(altitude) ? [longitude, latitude, altitude] : [longitude, latitude]
    ));
}

// El color KML viene como aabbggrr; se convierte al #rrggbb que entiende CSS.
export function kmlColorToCss(value) {
  if (typeof value !== 'string' || value.trim().length < 8) return null;
  const hex = value.trim().slice(-8);
  const blue = hex.slice(2, 4);
  const green = hex.slice(4, 6);
  const red = hex.slice(6, 8);
  return `#${red}${green}${blue}`.toLowerCase();
}

function firstText(element, selector) {
  const found = element.querySelector(selector);
  return found ? found.textContent.trim() : null;
}

function polygonRings(element) {
  const outer = element.querySelector('outerBoundaryIs coordinates');
  if (!outer) return null;
  const rings = [parseCoordinates(outer.textContent)];
  element.querySelectorAll('innerBoundaryIs coordinates').forEach(inner => {
    rings.push(parseCoordinates(inner.textContent));
  });
  return rings.filter(ring => ring.length >= 3);
}

function geometryFrom(element) {
  const name = element.tagName.replace(/^.*:/, '');
  if (name === 'Point') {
    const coordinates = parseCoordinates(firstText(element, 'coordinates') ?? '');
    return coordinates.length ? { type: 'Point', coordinates: coordinates[0] } : null;
  }
  if (name === 'LineString' || name === 'LinearRing') {
    const coordinates = parseCoordinates(firstText(element, 'coordinates') ?? '');
    return coordinates.length >= 2 ? { type: 'LineString', coordinates } : null;
  }
  if (name === 'Polygon') {
    const rings = polygonRings(element);
    return rings?.length ? { type: 'Polygon', coordinates: rings } : null;
  }
  if (name === 'MultiGeometry') {
    const geometries = [...element.children].map(geometryFrom).filter(Boolean);
    return geometries.length ? { type: 'GeometryCollection', geometries } : null;
  }
  return null;
}

function featureFrom(placemark) {
  const geometries = [...placemark.children]
    .map(geometryFrom)
    .filter(Boolean);
  if (!geometries.length) return null;
  const geometry = geometries.length === 1 ? geometries[0] : { type: 'GeometryCollection', geometries };
  return {
    type: 'Feature',
    properties: {
      name: firstText(placemark, 'name'),
      description: firstText(placemark, 'description')
    },
    geometry
  };
}

export function documentToGeoJson(document) {
  const placemarks = [...document.querySelectorAll('Placemark')];
  const features = placemarks.map(featureFrom).filter(Boolean);
  const color = kmlColorToCss(firstText(document, 'LineStyle color') ?? firstText(document, 'PolyStyle color') ?? '');
  return {
    geojson: { type: 'FeatureCollection', features },
    nombre: firstText(document, 'Document > name') ?? firstText(document, 'Folder > name'),
    color
  };
}

export function parseKml(text, { domParser = new DOMParser() } = {}) {
  const document = domParser.parseFromString(text, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('El archivo KML no se pudo interpretar');
  }
  return documentToGeoJson(document);
}
