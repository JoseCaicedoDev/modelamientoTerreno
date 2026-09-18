# Pendientes y discrepancias

Observaciones verificadas que siguen abiertas después de la modularización v2.3.0.

## Datos

- `minElevation`/`maxElevation` se fijan en 0 y 55 en
  [`scripts/build_terrain_data.py`](../../scripts/build_terrain_data.py), mientras el payload también
  informa valores reales cercanos a -9,4 y 53,2 m.s.n.m. Las elevaciones negativas se saturan en el
  color inferior. Falta decidir si es una exclusión intencional del ruido próximo al agua.
- La cabecera resume `0-54 m.s.n.m.`, valor editorial que no coincide exactamente con ninguna de las
  parejas anteriores.
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

## Reproducibilidad

- El DEM de entrada vive fuera del repositorio y falta documentar una fuente de descarga reproducible.
- `satellite-texture.jpg` se consume pero su proceso de generación no está automatizado ni documentado.
- No existe `requirements.txt` con versiones fijadas para el canal Python.

## Frontend

- Los logos PNG pesan varios megabytes para el tamaño en que se muestran; deben optimizarse.
- Las dependencias CDN no incluyen atributos SRI.
- El núcleo geoespacial tiene pruebas con `node:test`, pero las integraciones Plotly/Leaflet todavía
  se validan mediante navegador y no forman parte del workflow de GitHub Actions.
- `terrain-data.js` sigue exponiendo un global porque es una salida generada. Migrarlo a módulo
  requeriría coordinar el script Python y la carga inicial.

## Resuelto con las herramientas de análisis

- `actualMinElevation` y `actualMaxElevation` ya se usan: definen el rango del deslizador de cota.
- El visor dejó de ser solo de consulta: mide, simula inundación, deriva drenaje y carga capas.

## Resuelto en v2.3.0

- `app.js` dejó de concentrar dominio, Plotly, Leaflet, SVG y eventos en una única IIFE.
- Los colores usados por JavaScript se centralizaron en `dist/js/config.js`.
- La búsqueda espacial, el muestreo del perfil y la triangulación ahora son funciones puras probadas.
- La wiki dejó de describir la antigua interfaz por pestañas y documenta la vista dividida actual.
