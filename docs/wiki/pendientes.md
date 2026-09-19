# Pendientes y discrepancias

Observaciones verificadas que siguen abiertas después de la modularización v2.3.0.

## Datos

- `minElevation`/`maxElevation` se fijan en 0 y 55 en
  [`scripts/build_terrain_data.py`](../../scripts/build_terrain_data.py), mientras el payload también
  informa valores reales de -13,6 y 53,2 m.s.n.m. Con la zona de influencia de 500 m, el **6,0 % de
  las celdas queda por debajo de 0 m** y se satura en el color inferior de la rampa. Falta decidir
  si la escala debe seguir a los datos o si el recorte es una exclusión intencional del ruido
  próximo al agua.
- La cabecera ya no trae un valor escrito a mano: muestra el rango real del payload
  (`-14 a 53 m.s.n.m.`), igual que la leyenda muestra `bufferMeters`.
- La cabecera indica 30 m de resolución por el origen SRTMGL1, aunque la malla publicada queda en
  aproximadamente 25 m después del submuestreo del producto RTC. Conviene explicar esta diferencia
  al usuario o unificar el indicador.

## Herramientas de análisis

- La medición rechaza los puntos que caen fuera de la zona de influencia, porque ahí el DEM es nulo
  y no hay elevación con la que drapear. Es coherente, pero impide medir en el entorno del área.
- El área real y el análisis hidrológico heredan el suavizado gaussiano del canal de datos: ambos
  subestiman la rugosidad y no deben usarse como cubicación ni como diseño hidráulico.
- Priority-Flood trata todo el borde del área como salida, de modo que una depresión pegada al
  límite puede quedar infravalorada.
- Las capas KML y KMZ solo se dibujan en el mapa; no se drapean sobre el modelo 3D.
- Las capas cargadas viven en memoria: al recargar la página se pierden, porque no hay servidor
  donde guardarlas.
- El tiempo de llenado usa **toda la zona de influencia** como área aportante, no la cuenca real
  de la depresión inundada. `hydrology.js` ya calcula direcciones D8 y acumulación: cruzarlo con la
  máscara de inundación daría el área aportante verdadera y acortaría la sobrestimación.
- Las cotas de referencia del Orinoco proceden del limnígrafo del INAMEH en Ciudad Bolívar; el DEM
  es ALOS PALSAR RTC. **No se ha verificado que compartan datum vertical**, así que la comparación
  es orientativa. Confirmarlo exigiría la documentación del datum de ambos productos.
- El método racional se aplica a llenados de días, fuera del rango de duraciones para el que fue
  concebido. Un hidrograma de tormenta o un balance mensual con la serie de lluvia real darían una
  respuesta mejor, pero exigen datos de lluvia que el repositorio no tiene.
- Las cifras de lluvia con las que se contrasta el resultado (1.280 mm/año, julio 159 mm) son de
  fuentes climatológicas públicas de Ciudad Bolívar, no de una serie medida en el área, y viven en
  la wiki, no en el código. Con curvas IDF locales podrían convertirse en preajustes del panel.

## Reproducibilidad

- El DEM de entrada vive fuera del repositorio y falta documentar una fuente de descarga reproducible.
- No existe `requirements.txt` con versiones fijadas para el canal Python.

## Frontend

- Los logos PNG pesan varios megabytes para el tamaño en que se muestran; deben optimizarse.
- Las dependencias CDN no incluyen atributos SRI.
- El núcleo geoespacial tiene pruebas con `node:test`, pero las integraciones Plotly/Leaflet todavía
  se validan mediante navegador y no forman parte del workflow de GitHub Actions.
- `terrain-data.js` sigue exponiendo un global porque es una salida generada. Migrarlo a módulo
  requeriría coordinar el script Python y la carga inicial.

## Resuelto al ampliar a 500 m

- La generación de `satellite-texture.jpg` dejó de ser un paso manual sin documentar: la produce
  [`scripts/build_satellite_texture.py`](../../scripts/build_satellite_texture.py).
- El polígono, la zona de influencia y el submuestreo dejaron de estar duplicados entre scripts:
  viven en [`scripts/terrain_grid.py`](../../scripts/terrain_grid.py).
- La leyenda y el resumen de la cabecera se llenan desde el payload, así que no pueden volver a
  desincronizarse del modelo publicado.

## Resuelto con las herramientas de análisis

- `actualMinElevation` y `actualMaxElevation` ya se usan: definen el rango del deslizador de cota.
- El visor dejó de ser solo de consulta: mide, simula inundación, deriva drenaje y carga capas.
- La simulación de nivel de agua ya no es solo estática: informa el tiempo de llenado y sitúa la
  cota frente a los niveles históricos del Orinoco.
- El deslizador de cota ya no sugiere como plausibles cotas que el río nunca ha alcanzado: las
  marcas del `<datalist>` y la línea de contexto lo dicen explícitamente.

## Resuelto en v2.3.0

- `app.js` dejó de concentrar dominio, Plotly, Leaflet, SVG y eventos en una única IIFE.
- Los colores usados por JavaScript se centralizaron en `dist/js/config.js`.
- La búsqueda espacial, el muestreo del perfil y la triangulación ahora son funciones puras probadas.
- La wiki dejó de describir la antigua interfaz por pestañas y documenta la vista dividida actual.
