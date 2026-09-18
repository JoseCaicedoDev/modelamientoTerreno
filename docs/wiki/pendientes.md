# Pendientes y discrepancias

Observaciones sobre el estado actual del código. No son fallos que rompan el visor; son cosas que
alguien que retome el proyecto debería conocer.

## Datos

- **La escala de elevación no cubre los datos reales.** `minElevation`/`maxElevation` están fijados
  a 0 y 55 ([`build_terrain_data.py:84-85`](../../scripts/build_terrain_data.py#L84-L85)),
  mientras el terreno va de **-9,4 a 53,2 m.s.n.m.**. Las celdas bajo 0 m se saturan en el color
  inferior de la rampa y el eje Z arranca en -2. Decidir si el recorte es intencional (ruido del
  DEM cerca del agua) o si la escala debe seguir a los datos.
- **La cabecera dice "0-54 m.s.n.m."** ([`index.html:32`](../../dist/index.html#L32)), un tercer
  valor que no coincide ni con la escala ni con el dato real.
- **`actualMinElevation` y `actualMaxElevation` no los lee nadie.** Se publican en el payload pero
  `app.js` nunca los usa.
- **"30 m de resolución nominal"** en la cabecera se refiere al origen SRTMGL1; la malla publicada
  tiene celdas de **25 m**. Es correcto pero se presta a confusión.

## Reproducibilidad

- El DEM de entrada vive fuera del repositorio y no está documentado dónde obtenerlo más allá del
  identificador del producto (`ALPSRP274680160`). Sin esos archivos el canal de datos no se puede
  re-ejecutar.
- `satellite-texture.jpg` se consume pero **no se genera** con el script; el procedimiento para
  recrearla no está registrado en ninguna parte del repositorio.
- No hay `requirements.txt` ni versiones fijadas para las dependencias de Python.

## Estado del árbol de trabajo

**Sin commitear**: el botón de "volver al área de estudio" (`app.js`, `styles.css`) y la
exageración vertical por defecto de 2× (`index.html`).

## Frontend

- **Los logos pesan 2,8 MB combinados** para mostrarse a 110 px. Redimensionarlos es la mejora de
  rendimiento más grande y más barata del proyecto.
- `setColorMode` conserva un `Plotly.restyle` que reestiliza la traza 0 con valores siempre
  idénticos: resto de cuando existían dos coloraciones sobre la superficie.
- La paleta de la escena Plotly está duplicada como literales en `app.js` en vez de leer los tokens
  CSS; un cambio de marca exige tocar dos archivos.
- Las dependencias de CDN no llevan `integrity`/SRI.
- No hay pruebas de ningún tipo, ni verificación en el workflow.
