# Bitácora

Qué aportó cada commit, del más reciente al más antiguo.

## Sin commitear — Controles en barra inferior en móvil

Por debajo de 760 px el panel de controles deja de flotar sobre el mapa y pasa a una barra al pie
del visor, con los grupos repartidos en dos columnas y botones de 42 px. Solo CSS.
→ [Interfaz y marca](interfaz-y-marca.md)

## Sin commitear — Retirada del relieve sombreado

Se elimina la coloración "Relieve": desaparecen el cálculo del sombreado y la clave `hillshade` del
payload, la escala gris y el tercer botón, la regla `.segmented.three-options` y el valor `shade`
del parámetro `?color`. El modelo 3D queda con dos coloraciones: elevación y satélite.
→ [Canal de datos](canal-de-datos.md), [Visor 3D](visor-3d.md)

## `cdadfeb` — Drape satellite imagery over 3D terrain

Coloración **Satélite** dentro del modelo 3D. Añade la traza `mesh3d` con color por vértice y
`buildSatelliteMesh`, la clave `satellite` del payload (un hex por celda) con validación de tamaño
frente a la malla, el tercer botón de coloración y el bloqueo de las curvas en ese modo.
→ [Visor 3D](visor-3d.md)

## `7d88ac3` — Add satellite imagery view for study area

Vista 2D completa: mapa Leaflet con teselas Esri, polígonos de lindero y buffer, leyenda, selector
de vista, inicialización perezosa y parámetro `?view=satellite`. Añade `boundary` y `buffer` al
payload. → [Vista satelital](vista-satelital.md)

## `e5ab14d` — Apply Gestiagro brand system to terrain viewer

Rediseño completo: tokens de marca, degradado de cabecera, Montserrat, logos, panel de controles
rehecho y ajuste de la paleta de la escena Plotly al nuevo sistema.
→ [Interfaz y marca](interfaz-y-marca.md)

## `4c6f09a` — Show real UTM coordinates in terrain viewer

Los ejes pasan de índices de celda a coordenadas UTM reales: el script publica `x`/`y` en metros y
el visor los rotula con `tickformat` y los muestra en los tooltips.
→ [Formato de terrain-data.js](formato-terrain-data.md)

## `3f47818` — Finalize Pages configuration / `92227b4` — Configure GitHub Pages deployment

Workflow de publicación, permisos OIDC, concurrencia y URL del sitio en el README.
→ [Despliegue](despliegue.md)

## `761db34` — begin

Base del proyecto: canal de datos en Python (recorte al buffer, relleno de `nodata`, suavizado,
sombreado desde gradientes, submuestreo), visor Plotly con superficie, curvas de nivel, deslizador
de exageración y alternancia elevación/relieve, y el esqueleto de la página.
