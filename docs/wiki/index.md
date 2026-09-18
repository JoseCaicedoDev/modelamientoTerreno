# Wiki del proyecto — Modelo 3D de elevación "Manolo"

Base de conocimiento de lo que está implementado en este repositorio. Cada página describe una
pieza real del código; si el código cambia, la página correspondiente se actualiza.

Actualizada el 2026-09-18 · simulación de nivel de agua · Sistema v2.3.0

## Páginas

| Página | Cubre |
| --- | --- |
| [Visión general](vision-general.md) | Qué es el proyecto, arquitectura completa, decisiones de fondo |
| [Arquitectura frontend](arquitectura-frontend.md) | Módulos, dependencias, límites de responsabilidad y pruebas |
| [Área de estudio](area-de-estudio.md) | Polígono, zona de influencia de 200 m, CRS y extensión |
| [Canal de datos](canal-de-datos.md) | `scripts/build_terrain_data.py` — de los GeoTIFF a `terrain-data.js` |
| [Formato de terrain-data.js](formato-terrain-data.md) | Claves del payload, tipos, rangos y significado |
| [Visor 3D](visor-3d.md) | `dist/app.js` — superficie Plotly, malla satelital, cámara, controles |
| [Herramientas de análisis](herramientas-analisis.md) | Perfil, medición y demás herramientas interactivas |
| [Vista satelital](vista-satelital.md) | Mapa Leaflet, teselas Esri, capas del polígono |
| [Interfaz y marca](interfaz-y-marca.md) | `index.html`, `styles.css`, sistema visual Gestiagro |
| [Despliegue](despliegue.md) | GitHub Pages y el workflow de publicación |
| [Pendientes y discrepancias](pendientes.md) | Inconsistencias detectadas y trabajo no hecho |
| [Bitácora](bitacora.md) | Qué se implementó en cada commit |

## Referencias

- [LLM Wiki](../llm-wiki.md) — el patrón con el que se mantiene esta wiki.
