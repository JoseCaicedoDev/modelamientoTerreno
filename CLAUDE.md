# Guía del repositorio

Visor web estático del modelo 3D de elevación del área Manolo. Sin backend, sin gestor de
paquetes, sin build: `dist/` se edita a mano y GitHub Pages lo publica tal cual.

## Antes de trabajar

Lee [`docs/wiki/index.md`](docs/wiki/index.md). La wiki describe lo que está implementado y evita
releer todo el código en cada sesión.

## Estructura

| Ruta | Qué es |
| --- | --- |
| `dist/` | El sitio publicado: `index.html`, `app.js`, `styles.css`, `terrain-data.js`, `assets/` |
| `scripts/build_terrain_data.py` | Canal de datos manual que genera `dist/terrain-data.js` |
| `docs/wiki/` | Base de conocimiento del proyecto |
| `docs/llm-wiki.md` | El patrón con el que se mantiene la wiki |
| `.github/workflows/` | Publicación en GitHub Pages |

## Convenciones

- Todo el texto de la interfaz, los comentarios y la documentación van **en español**.
- Los datos crudos (`../ALOS_PALSAR/`) viven fuera del repositorio y son inmutables.
- `dist/terrain-data.js` es una salida generada: no se edita a mano, se regenera con el script y se
  commitea el resultado.
- La paleta de marca vive en `:root` de `dist/styles.css`; la escena Plotly la duplica en `app.js`
  (cambiar ambas a la vez).

## Mantenimiento de la wiki

Al terminar un cambio, actualiza las páginas que toca:

1. La página del área afectada (visor, canal de datos, interfaz, despliegue…).
2. [`docs/wiki/bitacora.md`](docs/wiki/bitacora.md), con una entrada del commit.
3. [`docs/wiki/pendientes.md`](docs/wiki/pendientes.md), si resolviste o descubriste algo.
4. La fecha y el commit de la cabecera de [`docs/wiki/index.md`](docs/wiki/index.md).

Cada página describe código real y enlaza con `archivo:línea`; si una afirmación no se puede
verificar en el repositorio, no va en la wiki.
