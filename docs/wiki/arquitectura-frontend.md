# Arquitectura frontend

El frontend es una aplicación estática sin compilación ni framework. Usa módulos ES nativos: el
navegador carga [`dist/app.js`](../../dist/app.js) como raíz de composición y este importa módulos
especializados desde `dist/js/`.

## Dependencias entre capas

```text
terrain-data.js
      │
      ▼
domain/terrain.js ◄──────── app.js ────────► ui/profile-chart.js
domain/grid.js              │               ui/tool-controller.js
domain/geometry.js          │               ui/result-panel.js
      │                     │
      ├──────────────► adapters/terrain-plot.js ───► Plotly
      └──────────────► adapters/satellite-map.js ──► Leaflet + Proj4
                                │
                                └──► adapters/raster-overlay.js ──► Canvas + Leaflet
```

La dependencia apunta hacia el núcleo: los cálculos del terreno no conocen el DOM, Plotly,
Leaflet ni Proj4. Los adaptadores traducen entre ese núcleo y las bibliotecas externas. `app.js`
conecta eventos y actualiza el estado visible de los controles.

## Módulos

| Módulo | Responsabilidad |
| --- | --- |
| [`dist/app.js`](../../dist/app.js) | Composición, eventos de interfaz, sincronización entre vistas y ciclo de vida |
| [`dist/js/config.js`](../../dist/js/config.js) | Colores, cámara, CRS y formatos compartidos |
| [`dist/js/domain/terrain.js`](../../dist/js/domain/terrain.js) | Punto DEM más cercano, muestreo lineal y construcción de la malla satelital |
| [`dist/js/domain/grid.js`](../../dist/js/domain/grid.js) | Malla del DEM como arreglo plano: índice ↔ coordenada, vecinos D8, orden por elevación |
| [`dist/js/domain/geometry.js`](../../dist/js/domain/geometry.js) | Longitudes, áreas, punto en polígono, factor de drapeado y triangulación en abanico |
| [`dist/js/domain/measure.js`](../../dist/js/domain/measure.js) | Medición de recorridos y polígonos: longitud drapeada, área proyectada y área real |
| [`dist/js/domain/flood.js`](../../dist/js/domain/flood.js) | Inundación por cota: área, volumen y máscara, con modo conectado |
| [`dist/js/adapters/terrain-plot.js`](../../dist/js/adapters/terrain-plot.js) | Trazas, escena y operaciones Plotly |
| [`dist/js/adapters/satellite-map.js`](../../dist/js/adapters/satellite-map.js) | Capas Leaflet, marcador sincronizado, dibujo genérico y capas del usuario |
| [`dist/js/adapters/raster-overlay.js`](../../dist/js/adapters/raster-overlay.js) | Capa canvas propia para pintar rásteres derivados de la malla |
| [`dist/js/ui/profile-chart.js`](../../dist/js/ui/profile-chart.js) | Representación SVG y estadísticas del perfil topográfico |
| [`dist/js/ui/tool-controller.js`](../../dist/js/ui/tool-controller.js) | Herramienta activa exclusiva y estado de sus botones |
| [`dist/js/ui/result-panel.js`](../../dist/js/ui/result-panel.js) | Mostrar, ocultar y llenar los paneles de resultados |

## Infraestructura compartida por las herramientas

- **Dibujo genérico**: `satellite-map.js` expone `beginDrawing({ modo, maxVertices, snap, … })` con
  modos `linea`, `polilinea` y `poligono`. El perfil topográfico es un caso particular
  (`beginProfile`) de dos vértices ajustados a la celda; la medición usa `snap: false` para
  conservar el punto exacto del clic. Cada herramienta dibuja en su propio grupo de capas, de modo
  que limpiar una no borra las de otra.
- **Herramienta activa**: `tool-controller.js` garantiza que solo una herramienta interactiva esté
  activa, apaga la anterior y sincroniza `active` y `aria-pressed` de los botones. `Escape` las
  desactiva todas.
- **Trazas 3D**: `terrain-plot.js` exporta `TRAZA` con los índices estables
  (`superficie`, `satelital`, `cursor`, `cauces`, `agua`). Todas se reservan en el `newPlot`
  inicial y se muestran con `restyle`; nunca se añaden ni se eliminan trazas en caliente.
- **Rásteres derivados**: `raster-overlay.js` pinta sobre un canvas propio en lugar de
  `L.imageOverlay`, que obligaría a codificar un PNG en cada cambio. Construye una vez una tabla
  píxel → celda interpolando una rejilla de control de 5×5 puntos proyectados con Proj4; después
  cada repintado es una copia de colores.

## Límites de responsabilidad

- `terrain.js` recibe y devuelve objetos y arreglos simples; puede ejecutarse en Node sin navegador.
- Los adaptadores encapsulan el estado mutable de cada biblioteca y exponen una API pequeña creada
  por funciones factoría.
- `profile-chart.js` solo dibuja un perfil ya calculado; no conoce el mapa ni busca elevaciones.
- `app.js` no construye trazas, capas Leaflet o nodos SVG internos del gráfico.
- `window.TERRAIN_DATA`, Plotly, Leaflet y Proj4 siguen siendo globales porque se cargan por CDN o
  mediante un script generado; se inyectan en las factorías para mantener explícita la frontera.

## Pruebas

[`tests/terrain-model.test.mjs`](../../tests/terrain-model.test.mjs) usa `node:test` y cubre la
búsqueda espacial, el muestreo del perfil y la triangulación. Se ejecuta sin instalar paquetes:

```powershell
node --test tests\terrain-model.test.mjs
```

Las integraciones con Plotly y Leaflet se verifican en navegador porque dependen de WebGL, DOM y
eventos de puntero.

## Regla para cambios futuros

[`AGENTS.md`](../../AGENTS.md) exige leer la wiki antes de modificar el repositorio, preservar estas
fronteras y actualizar la documentación dentro del mismo cambio. El sitio debe continuar siendo
publicable directamente en GitHub Pages, sin paso de construcción.
