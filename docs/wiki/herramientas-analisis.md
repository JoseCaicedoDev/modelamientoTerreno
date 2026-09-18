# Herramientas de análisis

Herramientas interactivas del panel satelital. Todas se coordinan con
[`ui/tool-controller.js`](../../dist/js/ui/tool-controller.js), que mantiene **una sola activa a la
vez**, y muestran sus resultados en un panel construido con
[`ui/result-panel.js`](../../dist/js/ui/result-panel.js). `Escape` cierra cualquiera de ellas.

Los botones viven en `.pane-tools`, arriba a la izquierda del panel satelital
([`index.html:46`](../../dist/index.html#L46)).

| Herramienta | Módulo de dominio | Estado |
| --- | --- | --- |
| Perfil topográfico | [`domain/terrain.js`](../../dist/js/domain/terrain.js) (`sampleLine`) | Implementada |
| Medición de distancias y áreas | [`domain/measure.js`](../../dist/js/domain/measure.js) | Implementada |

## Perfil topográfico

Dos vértices ajustados al centro de la celda del DEM, con separación mínima de 30 m. Dibuja la
línea A–B sobre el mapa y muestra el perfil como SVG con distancia, elevación mínima, máxima y
desnivel. Ver [Visor 3D](visor-3d.md) para el muestreo.

## Medición de distancias y áreas

Dibujo de una polilínea sobre el mapa: cada clic añade un vértice, doble clic o `Enter` termina, y
**cerrar sobre el primer vértice convierte el recorrido en un polígono** y añade las áreas.

A diferencia del perfil, la medición **no ajusta los puntos a la celda** (`snap: false`): usa la
coordenada exacta del clic, porque redondear a la malla de 25 m falsearía longitudes y áreas. La
elevación sí procede de la celda más cercana.

### Qué calcula

| Resultado | Cómo |
| --- | --- |
| Longitud / perímetro | Suma de distancias planas entre vértices en UTM |
| Longitud sobre el relieve | Se muestrea cada segmento con `terrain.sampleLine` y se suman las hipotenusas de cada tramo |
| Área proyectada | Fórmula de Gauss sobre los vértices en UTM |
| Área real | Área proyectada × promedio de `sec(pendiente)` de las celdas cuyo centro cae dentro del polígono |
| Desnivel | Diferencia entre la cota máxima y mínima de los vértices |

El área proyectada se contrastó con `shapely`: para el polígono del área de estudio,
`geometry.js` y `shapely` dan el mismo valor, **5.913.840,2 m² (591,384 ha)** y un perímetro de
10.077,5 m. La diferencia es nula porque ambos aplican la misma fórmula sobre las mismas
coordenadas UTM.

### Límites

- El **área real es indicativa**: `sec(pendiente)` se calcula sobre un DEM de 25 m que además viene
  suavizado con `gaussian_filter(σ=1)` en
  [`build_terrain_data.py:50`](../../scripts/build_terrain_data.py#L50), de modo que subestima la
  rugosidad. El panel lo advierte.
- Solo se aceptan puntos **dentro de la zona de influencia**: fuera de ella el DEM es nulo y no hay
  elevación con la que drapear. Al tocar fuera, la herramienta lo indica y no añade el vértice.
- Se mide sobre el plano UTM; el factor de escala de la proyección introduce un error del orden del
  0,006 % en área, muy por debajo de la resolución del DEM.

### Pruebas

[`tests/measure.test.mjs`](../../tests/measure.test.mjs) cubre polilínea abierta, longitud drapeada
en pendiente, área y perímetro de un polígono, factor de drapeado sobre una rampa de pendiente
conocida y el descarte de recorridos de un solo vértice.
