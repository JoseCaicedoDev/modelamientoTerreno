# Formato de `terrain-data.js`

Un único archivo que asigna `window.TERRAIN_DATA` (JSON compacto, ≈344 KB). Lo genera
[el canal de datos](canal-de-datos.md) y lo consume [el visor](visor-3d.md). La malla actual es de
**160 columnas × 158 filas**.

| Clave | Tipo | Contenido |
| --- | --- | --- |
| `x` | `number[160]` | Este UTM del centro de cada columna, paso de 25 m, 3 decimales |
| `y` | `number[158]` | Norte UTM de cada fila, **descendente** (norte arriba) |
| `z` | `(number\|null)[158][160]` | Elevación en m.s.n.m., 1 decimal; `null` fuera del buffer |
| `satellite` | `(string\|null)[158][160]` | Color `#rrggbb` de la textura satelital por celda |
| `minElevation` | `number` | `0` — extremo inferior **fijo** de la escala de color |
| `maxElevation` | `number` | `55` — extremo superior fijo de la escala |
| `actualMinElevation` | `number` | `-13.6` — mínimo real de los datos |
| `actualMaxElevation` | `number` | `53.2` — máximo real |
| `aspectY` | `number` | `0.9874` — alto/ancho del área, para que la escena no se deforme |
| `crs` | `string` | `"EPSG:32620"` |
| `source` | `string` | `"SRTMGL1 / ALOS PALSAR RTC ALPSRP274680160"` |
| `boundary` | `[lat, lon][5]` | Polígono de estudio cerrado, en WGS 84 |
| `bufferMeters` | `number` | `500` — anchura de la zona de influencia; la interfaz rotula la leyenda con este valor |
| `buffer` | `[lat, lon][70]` | Zona de influencia, en WGS 84 |

## Detalles que importan al consumirlo

- **`boundary` y `buffer` van en `[lat, lon]`**, no `[lon, lat]`: es el orden que espera
  `L.polygon`. El resto del archivo está en UTM.
- **`null` es señal de "fuera del área"**, no de dato faltante: los huecos del DEM ya se rellenaron
  antes. `app.js` los usa para dejar agujeros en la superficie y para saltar vértices en la malla.
- **`aspectY`** se calcula como `(y[0] - y[-1]) / (x[-1] - x[0])` y se pasa tal cual a
  `scene.aspectratio.y`.
- `actualMinElevation` y `actualMaxElevation` alimentan el resumen de la cabecera y el rango del
  deslizador de cota de la herramienta de inundación.
