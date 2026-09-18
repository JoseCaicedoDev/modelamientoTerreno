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
      │                       │
      ├──────────────► adapters/terrain-plot.js ──► Plotly
      └──────────────► adapters/satellite-map.js ─► Leaflet + Proj4
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
| [`dist/js/adapters/terrain-plot.js`](../../dist/js/adapters/terrain-plot.js) | Trazas, escena y operaciones Plotly |
| [`dist/js/adapters/satellite-map.js`](../../dist/js/adapters/satellite-map.js) | Capas Leaflet, marcador sincronizado y captura del trazado A–B |
| [`dist/js/ui/profile-chart.js`](../../dist/js/ui/profile-chart.js) | Representación SVG y estadísticas del perfil topográfico |

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
