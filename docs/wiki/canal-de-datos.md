# Canal de datos

Dos scripts que se ejecutan a mano y una definición compartida del área:

| Archivo | Papel |
| --- | --- |
| [`scripts/terrain_grid.py`](../../scripts/terrain_grid.py) | Polígono, zona de influencia, submuestreo y rejilla del DEM |
| [`scripts/build_satellite_texture.py`](../../scripts/build_satellite_texture.py) | Descarga la imagen satelital y la remuestrea a la malla |
| [`scripts/build_terrain_data.py`](../../scripts/build_terrain_data.py) | Genera `dist/terrain-data.js` con el DEM y esa textura |

El orden importa: la textura primero, porque el segundo script la valida contra la malla y se
detiene si no coincide.

```
python scripts/build_satellite_texture.py
# 64 teselas descargadas o reutilizadas en zoom 16
# dist/assets/satellite-texture.jpg (9985 bytes, 160x158 px)

python scripts/build_terrain_data.py
# dist/terrain-data.js (352036 bytes, 158x160 celdas, buffer 500 m)
```

## Definición compartida del área

`terrain_grid.py` concentra lo que antes estaba duplicado o implícito:

- `COORDS`: los cuatro vértices del levantamiento preliminar.
- `BUFFER_METERS = 500`: la zona de influencia.
- `STEP = 2`: el submuestreo, que deja celdas de **25 m** a partir de los 12,5 m del producto RTC.
- `geotiff` / `geotiff_reference`: lectura del GeoTIFF y de su georreferencia sin cargar el
  arreglo completo.
- `study_area`, `crop_bounds`, `axes` y `grid_axes`: el recorte y los ejes de la malla.

Cambiar el polígono, el buffer o el submuestreo aquí obliga a **regenerar los dos productos**.

## Entradas

| Ruta | Qué aporta |
| --- | --- |
| `../ALOS_PALSAR/AP_27468_PLR_F0160_RT1/AP_27468_PLR_F0160_RT1.dem.tif` | DEM (SRTMGL1 remuestreado a la malla de 12,5 m del producto RTC) |
| Teselas de Esri World Imagery | Imagen satelital, descargadas por el script de la textura |

El DEM vive **fuera del repositorio**, en el directorio padre del proyecto. Cubre
E 438 335 – 480 010 y N 902 355 – 972 292, muy por encima de lo que necesita la zona de influencia
de 500 m, así que admite ampliaciones sin cambiar de fuente.

## Textura satelital

[`build_satellite_texture.py`](../../scripts/build_satellite_texture.py) calcula los ejes de la
malla, descarga en zoom 16 las teselas que cubren la extensión (64 teselas, cacheadas en
`../tmp/teselas`) y compone un mosaico. Para cada celda de 25 m proyecta sus cuatro esquinas al
mosaico y **promedia los píxeles que caen dentro**, en lugar de tomar el del centro: así no
aparecen el ruido ni el aliasing del muestreo puntual.

El resultado es un JPEG de un píxel por celda, hoy **160×158 px y 10 KB**. Las imágenes son de
Esri, Maxar, Earthstar Geographics y GIS User Community; el visor mantiene esa atribución visible.

## Modelo del terreno

[`build_terrain_data.py`](../../scripts/build_terrain_data.py), paso a paso:

1. **Área de trabajo**: polígono → UTM → buffer de 500 m → de vuelta a WGS 84.
2. **Recorte**: los límites del buffer se convierten a índices de fila y columna con dos celdas de
   margen para no truncar el borde.
3. **Relleno de huecos y suavizado**: los píxeles `nodata` se sustituyen por el valor válido más
   cercano (`distance_transform_edt`) y se aplica un `gaussian_filter` de σ=1.
4. **Máscara del área**: `contains_xy` marca qué centros de celda caen dentro del buffer.
5. **Submuestreo** a celdas de 25 m.
6. **Serialización**: las celdas fuera de la máscara se escriben como `null` en `z` y `satellite`;
   Plotly las deja como hueco gracias a `connectgaps: false`. La textura se convierte a un color
   hexadecimal por celda, previa validación de que sus dimensiones coinciden con la malla — si no,
   el script falla y pide ejecutar antes el generador de la textura.
7. **Escritura** de `window.TERRAIN_DATA` con un `json.dumps` compacto.

## Puntos a tener en cuenta

- `minElevation`/`maxElevation` siguen fijados a 0 y 55, independientes de los datos; los valores
  reales viajan aparte. Ver [Pendientes](pendientes.md).
- Hasta la versión con buffer de 200 m, el script leía además un hillshade externo y calculaba un
  relieve sombreado; ambos se retiraron junto con el modo "Relieve" del visor.
