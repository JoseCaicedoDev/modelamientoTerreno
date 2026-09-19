const ROLE_COLORS = Object.freeze({
  control: '#22c55e',
  gcp: '#f59e0b',
  checkpoint: '#a78bfa',
  auxiliar: '#22d3ee'
});

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function csvValue(value) {
  const text = String(value ?? '');
  return /[;"\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function pointsToCsv(plan) {
  const header = ['Código', 'Tipo', 'Este', 'Norte', 'Elevación', 'Acceso', 'Estado', 'Motivo'];
  const rows = plan.points.map(point => [
    point.id,
    point.roleLabel,
    point.x.toFixed(3),
    point.y.toFixed(3),
    Number.isFinite(point.z) ? point.z.toFixed(3) : '',
    point.access,
    point.proposed ? 'PROPUESTO' : 'CONTROL EXISTENTE',
    point.reason
  ]);
  return [header, ...rows].map(row => row.map(csvValue).join(';')).join('\r\n');
}

export function pointsToPenzd(plan) {
  return plan.points.map((point, index) => [
    index + 1,
    point.x.toFixed(3),
    point.y.toFixed(3),
    Number.isFinite(point.z) ? point.z.toFixed(3) : '',
    `${point.id}_${point.role.toUpperCase()}`
  ].join(',')).join('\r\n');
}

export function connectionsToCsv(plan) {
  const header = ['Código', 'Desde', 'Hasta', 'Método', 'Distancia_m', 'Visual', 'Despeje_m'];
  const rows = plan.connections.map(connection => [
    connection.id,
    connection.from,
    connection.to,
    connection.method.toUpperCase(),
    connection.distance.toFixed(2),
    connection.visible === null ? 'NO APLICA' : connection.visible ? 'LIBRE' : 'BLOQUEADA',
    Number.isFinite(connection.clearance) ? connection.clearance.toFixed(2) : ''
  ]);
  return [header, ...rows].map(row => row.map(csvValue).join(';')).join('\r\n');
}

function kmlColor(hex) {
  const normalized = hex.replace('#', '');
  return `ff${normalized.slice(4, 6)}${normalized.slice(2, 4)}${normalized.slice(0, 2)}`;
}

export function planToKml(plan, toWgs84) {
  const styles = Object.entries(ROLE_COLORS).map(([role, color]) => `
    <Style id="${role}"><IconStyle><color>${kmlColor(color)}</color><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle></Style>`).join('');
  const pointFeatures = plan.points.map(point => {
    const [longitude, latitude] = toWgs84(point.x, point.y);
    return `
    <Placemark><name>${escapeXml(point.id)}</name><styleUrl>#${point.role}</styleUrl><description>${escapeXml(`${point.roleLabel} · ${point.reason} · COORDENADA PROPUESTA`)}</description><Point><coordinates>${longitude.toFixed(8)},${latitude.toFixed(8)},${Number(point.z ?? 0).toFixed(3)}</coordinates></Point></Placemark>`;
  }).join('');
  const byId = new Map(plan.points.map(point => [point.id, point]));
  const lines = plan.connections.map(connection => {
    const start = byId.get(connection.from);
    const end = byId.get(connection.to);
    if (!start || !end) return '';
    const startWgs = toWgs84(start.x, start.y);
    const endWgs = toWgs84(end.x, end.y);
    const color = connection.visible === false ? 'ff4444ff' : 'ffffcc22';
    return `
    <Placemark><name>${escapeXml(connection.id)}</name><description>${escapeXml(`${connection.method.toUpperCase()} · ${connection.distance.toFixed(1)} m`)}</description><Style><LineStyle><color>${color}</color><width>3</width></LineStyle></Style><LineString><coordinates>${startWgs[0].toFixed(8)},${startWgs[1].toFixed(8)},${Number(start.z ?? 0).toFixed(3)} ${endWgs[0].toFixed(8)},${endWgs[1].toFixed(8)},${Number(end.z ?? 0).toFixed(3)}</coordinates></LineString></Placemark>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(plan.name || 'Plan de campo')}</name>${styles}${pointFeatures}${lines}</Document></kml>`;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function write16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function write32(view, offset, value) {
  view.setUint32(offset, value >>> 0, true);
}

// KMZ mínimo con una entrada doc.kml sin compresión. ZIP permite el método 0 y evita dependencias.
export function kmlToKmz(kml) {
  const encoder = new TextEncoder();
  const name = encoder.encode('doc.kml');
  const content = encoder.encode(kml);
  const localSize = 30 + name.length + content.length;
  const centralSize = 46 + name.length;
  const buffer = new ArrayBuffer(localSize + centralSize + 22);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const checksum = crc32(content);

  write32(view, 0, 0x04034b50);
  write16(view, 4, 20);
  write16(view, 8, 0);
  write32(view, 14, checksum);
  write32(view, 18, content.length);
  write32(view, 22, content.length);
  write16(view, 26, name.length);
  bytes.set(name, 30);
  bytes.set(content, 30 + name.length);

  const central = localSize;
  write32(view, central, 0x02014b50);
  write16(view, central + 4, 20);
  write16(view, central + 6, 20);
  write16(view, central + 10, 0);
  write32(view, central + 16, checksum);
  write32(view, central + 20, content.length);
  write32(view, central + 24, content.length);
  write16(view, central + 28, name.length);
  write32(view, central + 42, 0);
  bytes.set(name, central + 46);

  const end = central + centralSize;
  write32(view, end, 0x06054b50);
  write16(view, end + 8, 1);
  write16(view, end + 10, 1);
  write32(view, end + 12, centralSize);
  write32(view, end + 16, localSize);
  return new Blob([buffer], { type: 'application/vnd.google-earth.kmz' });
}

function boundsForReport(plan) {
  const points = [...plan.points, ...(plan.geometry ?? [])];
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function planSvg(plan) {
  if (!plan.points.length) return '';
  const bounds = boundsForReport(plan);
  const padding = 36;
  const width = 760;
  const height = 420;
  const scale = Math.min((width - padding * 2) / bounds.width, (height - padding * 2) / bounds.height);
  const project = point => ({
    x: padding + (point.x - bounds.minX) * scale,
    y: height - padding - (point.y - bounds.minY) * scale
  });
  const byId = new Map(plan.points.map(point => [point.id, point]));
  const lines = plan.connections.map(connection => {
    const start = project(byId.get(connection.from));
    const end = project(byId.get(connection.to));
    return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${connection.visible === false ? '#ef4444' : '#0f766e'}" stroke-width="2" stroke-dasharray="${connection.visible === false ? '6 4' : 'none'}"/>`;
  }).join('');
  const boundary = (plan.geometry ?? []).map(project).map(point => `${point.x},${point.y}`).join(' ');
  const boundaryElement = plan.settings?.tipo === 'corredor'
    ? `<polyline points="${boundary}" fill="none" stroke="#64748b" stroke-width="3"/>`
    : `<polygon points="${boundary}" fill="#0f766e12" stroke="#64748b" stroke-width="2"/>`;
  const points = plan.points.map(point => {
    const position = project(point);
    return `<g><circle cx="${position.x}" cy="${position.y}" r="7" fill="${ROLE_COLORS[point.role]}" stroke="#fff" stroke-width="2"/><text x="${position.x + 9}" y="${position.y - 7}" font-size="10" font-family="Arial" fill="#0f172a">${escapeXml(point.id)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Esquema del plan de campo">${boundaryElement}${lines}${points}</svg>`;
}

export function buildPrintableReport(plan, metadata = {}) {
  const pointRows = plan.points.map(point => `<tr><td>${escapeXml(point.id)}</td><td>${escapeXml(point.roleLabel)}</td><td>${point.x.toFixed(3)}</td><td>${point.y.toFixed(3)}</td><td>${Number.isFinite(point.z) ? point.z.toFixed(2) : '—'}</td><td>${escapeXml(point.access)}</td><td>${escapeXml(point.reason)}</td></tr>`).join('');
  const observationRows = plan.connections.map(connection => `<tr><td>${escapeXml(connection.id)}</td><td>${escapeXml(connection.from)} – ${escapeXml(connection.to)}</td><td>${escapeXml(connection.method.toUpperCase())}</td><td>${connection.distance.toFixed(1)} m</td><td>${connection.visible === null ? 'No aplica' : connection.visible ? 'Libre' : 'Revisar'}</td></tr>`).join('');
  const checks = [
    'Confirmar seguridad, permisos de acceso y estabilidad del terreno.',
    'Verificar obstáculos, vegetación y cielo visible antes de materializar.',
    'Medir y documentar los puntos con el método y precisión definidos.',
    'Mantener los checkpoints independientes del ajuste fotogramétrico.',
    'Actualizar las coordenadas propuestas con las observadas en campo.'
  ].map(item => `<li>${item}</li>`).join('');
  const warnings = plan.warnings.map(warning => `<li class="${warning.severity}">${escapeXml(warning.message)}</li>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escapeXml(plan.name || 'Plan de campo')}</title><style>
    @page{size:A4 landscape;margin:13mm}*{box-sizing:border-box}body{margin:0;font:10pt Arial,sans-serif;color:#0f172a}header{display:flex;justify-content:space-between;border-bottom:3px solid #0396a6;padding-bottom:8px;margin-bottom:12px}h1{margin:0;font-size:20pt;color:#015059}h2{margin:14px 0 7px;font-size:12pt;color:#015059}.meta{text-align:right;color:#475569}.badge{display:inline-block;padding:3px 7px;background:#e2f8f5;color:#015059;border-radius:10px;font-weight:bold}svg{width:100%;height:92mm;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc}table{width:100%;border-collapse:collapse;font-size:8.5pt}th,td{padding:5px 6px;border:1px solid #cbd5e1;text-align:left}th{background:#e2f8f5;color:#015059}.grid{display:grid;grid-template-columns:1.25fr .75fr;gap:12px}.legend{display:flex;gap:12px;margin:7px 0}.legend span:before{content:'';display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:4px;background:var(--c)}ul{margin:5px 0;padding-left:18px}.error{color:#b91c1c}.warning{color:#92400e}.info{color:#334155}.page-break{break-before:page}.note{padding:8px;background:#fff7ed;border-left:3px solid #f59e0b;font-size:9pt}footer{margin-top:10px;color:#64748b;font-size:8pt}@media print{button{display:none}}
  </style></head><body><header><div><span class="badge">PLANIFICACIÓN PRELIMINAR</span><h1>${escapeXml(plan.name || 'Plan de fotocontrol y red de apoyo')}</h1><p>Coordenadas propuestas para reconocimiento y materialización en campo</p></div><div class="meta"><strong>${escapeXml(metadata.crs || '')}</strong><br>${escapeXml(metadata.source || '')}<br>${new Date(plan.generatedAt).toLocaleString('es-CO')}</div></header>
  <div class="grid"><section>${planSvg(plan)}<div class="legend"><span style="--c:${ROLE_COLORS.control}">Control</span><span style="--c:${ROLE_COLORS.gcp}">GCP</span><span style="--c:${ROLE_COLORS.checkpoint}">Checkpoint</span><span style="--c:${ROLE_COLORS.auxiliar}">Auxiliar</span></div></section><section><h2>Resumen</h2><p>GCP: <strong>${plan.stats.gcp}</strong><br>Checkpoints: <strong>${plan.stats.checkpoint}</strong><br>Auxiliares: <strong>${plan.stats.auxiliar}</strong><br>Control existente: <strong>${plan.stats.control}</strong><br>Observaciones: <strong>${plan.connections.length}</strong></p><h2>Alertas y verificaciones</h2><ul>${warnings}</ul><p class="note">Este documento es una propuesta de planificación. La ubicación, seguridad, estabilidad, intervisibilidad y precisión deben confirmarse en campo por el profesional responsable.</p></section></div>
  <section class="page-break"><h2>Coordenadas propuestas y fichas básicas</h2><table><thead><tr><th>Código</th><th>Función</th><th>Este</th><th>Norte</th><th>Elev.</th><th>Acceso</th><th>Justificación</th></tr></thead><tbody>${pointRows}</tbody></table><h2>Conexiones recomendadas</h2><table><thead><tr><th>Código</th><th>Conexión</th><th>Método</th><th>Distancia</th><th>Visual</th></tr></thead><tbody>${observationRows}</tbody></table><h2>Lista de campo</h2><ul>${checks}</ul><footer>Gestiagro · Plan generado localmente · Las coordenadas permanecen como PROPUESTAS hasta su medición.</footer></section></body></html>`;
}

export function serializePlanningProject(project, plan) {
  return JSON.stringify({ format: 'gestiagro-plan', version: 1, project, plan }, null, 2);
}

export function parsePlanningProject(text) {
  const parsed = JSON.parse(text);
  if (parsed?.format !== 'gestiagro-plan' || parsed.version !== 1 || !parsed.project) {
    throw new Error('El archivo no es un proyecto de planificación compatible');
  }
  return parsed;
}
