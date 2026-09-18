# Canal de datos

[`scripts/build_terrain_data.py`](../../scripts/build_terrain_data.py) — 95 líneas, script de un
solo paso, sin funciones más allá del lector de GeoTIFF. Se ejecuta a mano cuando cambian el
polígono, la resolución o la textura satelital.

```
python scripts/build_terrain_data.py
# imprime: dist/terrain-data.js (…bytes, 134x136 cells)
```

## Entradas

| Ruta | Qué aporta |
| --- | --- |
| `../ALOS_PALSAR/AP_27468_PLR_F0160_RT1/AP_27468_PLR_F0160_RT1.dem.tif` | DEM (SRTMGL1 remuestreado a la malla de 12,5 m del producto RTC) |
| `dist/assets/satellite-texture.jpg` | Textura satelital ya recortada a la malla, 136×134 px |

El DEM vive **fuera del repositorio**, en el directorio padre del proyecto
([`build_terrain_data.py:13-17`](../../scripts/build_terrain_data.py#L13-L17)). La textura
satelital sí está versionada, en `dist/assets/`.

## Pasos

1. **Lectura del GeoTIFF** (`geotiff`, líneas 27-34). Saca el arreglo, la escala de píxel
   (`ModelPixelScaleTag`), el punto de anclaje (`ModelTiepointTag`) y el `GDAL_NODATA`
   directamente de las etiquetas TIFF, sin rasterio ni GDAL.
2. **Área de trabajo** (37-40). Polígono → UTM → buffer de 200 m → de vuelta a WGS 84.
3. **Recorte** (42-47). Convierte los límites del buffer a índices de fila/columna y añade
   2–3 celdas de margen para no truncar el borde.
4. **Relleno de huecos y suavizado** (48-50). Los píxeles `nodata` se sustituyen por el valor
   válido más cercano (`distance_transform_edt` con `return_indices`) y se aplica un
   `gaussian_filter` de σ=1 para quitar el escalonado del DEM.
5. **Máscara del área** (52-55). Malla de centros de celda en UTM; `contains_xy` marca qué celdas
   caen dentro del buffer.
6. **Submuestreo** (57-62). `step = 2`: de celdas de 12,5 m a **25 m**, ≈134×136. El comentario
   justifica la decisión: rotación fluida en móvil sin perder el detalle real del origen.
7. **Serialización** (64-78). Las celdas fuera de la máscara se escriben como `null` en `z` y
   `satellite`; Plotly las deja como hueco gracias a `connectgaps: false`. La textura
   satelital se convierte a un color hexadecimal por celda, previa validación de que sus
   dimensiones coinciden con la malla — si no, el script falla con `ValueError` (línea 74).
8. **Escritura** (79-95). Un `json.dumps` compacto envuelto en `window.TERRAIN_DATA = …;`.

## Puntos a tener en cuenta

- Hasta `cdadfeb` el script leía además un hillshade externo y calculaba un relieve sombreado desde
  los gradientes del DEM; ambos se retiraron junto con el modo "Relieve" del visor.
- `minElevation`/`maxElevation` están fijados a 0 y 55 (líneas 84-85), independientes de los
  datos; los valores reales van aparte. Ver [Pendientes](pendientes.md).
- La textura satelital debe regenerarse por separado si cambia el polígono o el `step`; el script
  no la produce, solo la valida y la consume.
