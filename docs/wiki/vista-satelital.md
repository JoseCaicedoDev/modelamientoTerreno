# Vista satelital

La mitad derecha del visor es un mapa Leaflet 1.9.4 encapsulado en
[`dist/js/adapters/satellite-map.js`](../../dist/js/adapters/satellite-map.js). Se inicializa al
terminar la escena 3D y permanece visible en paralelo con ella.

## Capas y controles

| Capa | Estilo | Origen |
| --- | --- | --- |
| Teselas base | `maxZoom: 19` | Esri World Imagery |
| Zona de influencia | línea azul discontinua y relleno al 8 % | `data.buffer` |
| Área de estudio | línea turquesa y relleno al 12 % | `data.boundary` |

El mapa incluye zoom arriba a la derecha, reencuadre del área debajo y escala métrica abajo a la
izquierda. `fitStudyArea` encuadra el buffer con 34 px de margen. La atribución de Esri, Maxar,
Earthstar Geographics y GIS User Community permanece visible.

## Coordenadas y sincronización

Proj4 transforma el movimiento del puntero desde WGS 84 a EPSG:32620. El adaptador entrega el punto
al orquestador y recibe de vuelta la celda DEM ajustada. Esa celda se representa con un círculo
turquesa de borde blanco y, simultáneamente, con la baliza de la escena 3D.

La transformación inversa UTM → WGS 84 posiciona el marcador Leaflet. Las dos vistas muestran la
misma etiqueta con Este, Norte y elevación.

## Perfil topográfico

El botón de perfil pertenece visualmente al mapa. Al activarlo:

1. El cursor cambia a retícula y se solicita el punto inicial A.
2. El movimiento dibuja una previsualización discontinua.
3. Un segundo clic, al menos a 30 m, fija el punto B y la línea continua.
4. `terrain.sampleLine` toma una muestra aproximadamente cada 30 m, con un máximo de 240.
5. [`dist/js/ui/profile-chart.js`](../../dist/js/ui/profile-chart.js) dibuja el SVG y presenta
   distancia, elevación mínima, máxima y desnivel.

La captura y las capas A–B pertenecen al adaptador Leaflet; el muestreo pertenece al dominio; el
gráfico solo representa resultados. Cerrar el panel, pulsar de nuevo el botón o presionar `Esc`
limpia la línea y sus marcadores.

## Diferencia entre las dos imágenes satelitales

- El mapa 2D usa teselas en vivo y permite acercamiento hasta nivel 19.
- La coloración satelital del modelo 3D usa colores almacenados en `terrain-data.js`; no gana
  detalle al acercarse y puede funcionar una vez cargados los archivos estáticos.
