// Extracción del KML que viaja dentro de un KMZ, que no es más que un ZIP.
//
// Se lee el directorio central del ZIP a mano y se descomprime con DecompressionStream, que ya
// trae el navegador: así no hace falta ninguna dependencia nueva para soportar el formato.

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_DIRECTORY = 0x06054b50;
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

export function looksLikeZip(buffer) {
  const bytes = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  return ZIP_SIGNATURE.every((value, index) => bytes[index] === value);
}

function findEndOfDirectory(view, length) {
  const from = Math.max(0, length - 66000);
  for (let offset = length - 22; offset >= from; offset -= 1) {
    if (view.getUint32(offset, true) === END_OF_DIRECTORY) return offset;
  }
  return -1;
}

function readEntries(view, buffer) {
  const end = findEndOfDirectory(view, buffer.byteLength);
  if (end < 0) throw new Error('El archivo KMZ está incompleto o dañado');
  const total = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const entries = [];
  const decoder = new TextDecoder();

  for (let index = 0; index < total; index += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_HEADER) break;
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));
    entries.push({ name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflate(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error('Este navegador no puede descomprimir KMZ: carga el archivo .kml');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).arrayBuffer();
}

export async function extractKmlFromKmz(buffer) {
  const view = new DataView(buffer);
  const entries = readEntries(view, buffer);
  const entry = entries.find(candidate => candidate.name.toLowerCase().endsWith('.kml'));
  if (!entry) throw new Error('El KMZ no contiene ningún archivo .kml');

  if (view.getUint32(entry.localOffset, true) !== LOCAL_HEADER) {
    throw new Error('El archivo KMZ está dañado');
  }
  const nameLength = view.getUint16(entry.localOffset + 26, true);
  const extraLength = view.getUint16(entry.localOffset + 28, true);
  const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = new Uint8Array(buffer, dataOffset, entry.compressedSize);

  if (entry.method === 0) return new TextDecoder().decode(compressed);
  if (entry.method !== 8) throw new Error('El KMZ usa una compresión no soportada');
  return new TextDecoder().decode(await inflate(compressed));
}
