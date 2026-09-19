// Tiempo de llenado de la lámina simulada, por balance de volumen.
//
// No es un tránsito hidráulico: no propaga la onda de crecida ni resuelve Saint-Venant. Responde
// una sola pregunta, la que un balance sí puede responder: con este aporte constante, cuánto tarda
// en entrar el volumen que la cota necesita.
//
// Dos regímenes, porque en esta llanura el agua puede llegar por dos vías distintas:
//   - lluvia: escorrentía generada sobre el área aportante (método racional, Q = C·i·A).
//   - caudal: aporte externo conocido en m³/s (crecida de río, rotura, bombeo).

export const REGIMEN_LLUVIA = 'lluvia';
export const REGIMEN_CAUDAL = 'caudal';

const MILIMETROS_POR_METRO = 1000;
const SEGUNDOS_POR_HORA = 3600;

// Q = C · i · A, con la intensidad en mm/h y el área en m². Devuelve m³/s.
export function caudalDeLluvia({ areaAportante, intensidad, coeficiente }) {
  if (!(areaAportante > 0) || !(intensidad > 0) || !(coeficiente > 0)) return 0;
  return (coeficiente * intensidad * areaAportante) / (MILIMETROS_POR_METRO * SEGUNDOS_POR_HORA);
}

// Segundos que tarda un caudal constante en aportar el volumen pedido.
export function tiempoDeLlenado(volumen, caudal) {
  if (!(volumen > 0)) return 0;
  if (!(caudal > 0)) return Infinity;
  return volumen / caudal;
}

// Lámina de agua que el volumen representa repartida sobre el área aportante, en mm.
// Con coeficiente es la lluvia bruta que hay que caer; sin él, la escorrentía efectiva.
export function laminaEquivalente(volumen, { areaAportante, coeficiente = 1 }) {
  if (!(areaAportante > 0) || !(coeficiente > 0)) return Infinity;
  return (volumen * MILIMETROS_POR_METRO) / (areaAportante * coeficiente);
}

// Resumen completo del régimen elegido, listo para el panel.
export function estimarLlenado(volumen, regimen, parametros) {
  const caudal = regimen === REGIMEN_CAUDAL
    ? Number(parametros.caudal) || 0
    : caudalDeLluvia(parametros);
  return {
    regimen,
    caudal,
    segundos: tiempoDeLlenado(volumen, caudal),
    lamina: regimen === REGIMEN_LLUVIA
      ? laminaEquivalente(volumen, parametros)
      : laminaEquivalente(volumen, { areaAportante: parametros.areaAportante })
  };
}
