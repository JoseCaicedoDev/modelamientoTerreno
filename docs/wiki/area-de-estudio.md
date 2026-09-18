# Área de estudio

## Polígono

Cuatro vértices en WGS 84 geográficas, codificados en `COORDS` de
[`build_terrain_data.py:20-25`](../../scripts/build_terrain_data.py#L20-L25):

| # | Longitud | Latitud |
| --- | --- | --- |
| 1 | -63.42829166 | 8.22632648 |
| 2 | -63.45447851 | 8.22354461 |
| 3 | -63.45287913 | 8.20037443 |
| 4 | -63.42807181 | 8.21191255 |

En la interfaz se rotula como **"Levantamiento preliminar"**. Es el único dato de entrada escrito
a mano en el proyecto: cualquier corrección del lindero se hace ahí y obliga a regenerar
`terrain-data.js`.

## Zona de influencia

El polígono se reproyecta a UTM y se expande con `shapely.buffer(BUFFER_METERS)` — **500 metros**
en todas las direcciones, definidos en
[`scripts/terrain_grid.py`](../../scripts/terrain_grid.py). Ese buffer, no el polígono original, define:

- el recorte del DEM,
- la máscara de celdas visibles en 3D (todo lo que cae fuera queda como `null`),
- el encuadre inicial del mapa satelital.

Se devuelve también a WGS 84 para dibujarlo en Leaflet (70 vértices tras el redondeado del buffer).

## Sistemas de coordenadas

- **EPSG:4326** (WGS 84 geográficas) — entrada del polígono y salida de `boundary` / `buffer`,
  porque Leaflet trabaja en lat/lon.
- **EPSG:32620** (WGS 84 / UTM zona 20N) — malla, recorte, buffer y ejes del visor 3D. Es el CRS
  del DEM y el que se rotula en la cabecera del sitio.

Las conversiones usan `pyproj.Transformer` con `always_xy=True`, definidas una sola vez en
[`terrain_grid.py`](../../scripts/terrain_grid.py) y compartidas por los dos scripts del canal.

## Extensión y malla resultante

| Propiedad | Valor |
| --- | --- |
| Este UTM | 449 416,4 – 453 391,4 m (≈4,0 km) |
| Norte UTM | 905 948,9 – 909 873,9 m (≈3,9 km) |
| Malla | 160 columnas × 158 filas, celdas de 25 m |
| Celdas con dato | 18 776 de 25 280 (el resto cae fuera del buffer) |
| Superficie de la zona de influencia | 1 173,7 ha |
| Elevación real | -13,6 a 53,2 m.s.n.m. |
| Escala de color | fijada a 0–55 m.s.n.m. |

Ver [Pendientes](pendientes.md) sobre la diferencia entre la elevación real y la escala mostrada:
con la ampliación a 500 m, el 6,0 % de las celdas queda por debajo de 0 m y se satura en el color
inferior de la rampa.
