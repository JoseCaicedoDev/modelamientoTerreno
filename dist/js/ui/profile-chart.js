import { BRAND, coordinateFormatter, formatDistance } from '../config.js';
import { createStat } from './result-panel.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const SIZE = Object.freeze({ width: 640, height: 210 });
const PADDING = Object.freeze({ left: 52, right: 15, top: 12, bottom: 34 });

function svgElement(name, attributes = {}, text = '') {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text) element.textContent = text;
  return element;
}

export function createProfileChart({ chartElement, statsElement }) {
  function render({ samples, totalDistance }) {
    if (samples.length < 2 || totalDistance <= 0) return false;

    const elevations = samples.map(sample => sample.z);
    const minimum = Math.min(...elevations);
    const maximum = Math.max(...elevations);
    const zMin = Math.floor(minimum - 2);
    const zMax = Math.max(zMin + 1, Math.ceil(maximum + 2));
    const chartWidth = SIZE.width - PADDING.left - PADDING.right;
    const chartHeight = SIZE.height - PADDING.top - PADDING.bottom;
    const baseline = SIZE.height - PADDING.bottom;
    const xScale = distance => PADDING.left + (distance / totalDistance) * chartWidth;
    const yScale = elevation => PADDING.top + ((zMax - elevation) / (zMax - zMin)) * chartHeight;
    chartElement.replaceChildren();

    for (let index = 0; index <= 4; index += 1) {
      const elevation = zMin + ((zMax - zMin) * index) / 4;
      const y = yScale(elevation);
      chartElement.append(
        svgElement('line', { x1: PADDING.left, y1: y, x2: SIZE.width - PADDING.right, y2: y, stroke: 'rgba(148,163,184,0.2)', 'stroke-width': 1 }),
        svgElement('text', { x: PADDING.left - 8, y: y + 4, fill: BRAND.subtle, 'font-size': 10, 'text-anchor': 'end' }, elevation.toFixed(0))
      );
    }

    for (let index = 0; index <= 4; index += 1) {
      const distance = (totalDistance * index) / 4;
      const x = xScale(distance);
      chartElement.append(
        svgElement('line', { x1: x, y1: PADDING.top, x2: x, y2: baseline, stroke: 'rgba(148,163,184,0.12)', 'stroke-width': 1 }),
        svgElement('text', { x, y: SIZE.height - 12, fill: BRAND.subtle, 'font-size': 10, 'text-anchor': 'middle' }, formatDistance(distance))
      );
    }

    const profilePath = samples
      .map((sample, index) => `${index ? 'L' : 'M'} ${xScale(sample.distance).toFixed(2)} ${yScale(sample.z).toFixed(2)}`)
      .join(' ');
    const areaPath = `${profilePath} L ${xScale(totalDistance)} ${baseline} L ${PADDING.left} ${baseline} Z`;
    chartElement.append(
      svgElement('path', { d: areaPath, fill: 'rgba(0,203,169,0.18)' }),
      svgElement('path', { d: profilePath, fill: 'none', stroke: BRAND.accent, 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }),
      svgElement('circle', { cx: xScale(0), cy: yScale(samples[0].z), r: 5, fill: BRAND.profile, stroke: '#ffffff', 'stroke-width': 2 }),
      svgElement('circle', { cx: xScale(totalDistance), cy: yScale(samples.at(-1).z), r: 5, fill: BRAND.profile, stroke: '#ffffff', 'stroke-width': 2 }),
      svgElement('text', { x: 14, y: SIZE.height / 2, fill: BRAND.muted, 'font-size': 10, 'text-anchor': 'middle', transform: `rotate(-90 14 ${SIZE.height / 2})` }, 'Elevación (m.s.n.m.)')
    );

    statsElement.replaceChildren(
      createStat('Distancia', formatDistance(totalDistance)),
      createStat('Elevación mín.', `${coordinateFormatter.format(minimum)} m`),
      createStat('Elevación máx.', `${coordinateFormatter.format(maximum)} m`),
      createStat('Desnivel', `${coordinateFormatter.format(maximum - minimum)} m`)
    );
    return true;
  }

  function clear() {
    chartElement.replaceChildren();
    statsElement.replaceChildren();
  }

  return Object.freeze({ render, clear });
}
