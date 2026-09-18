# Despliegue

## Workflow

[`.github/workflows/deploy-pages.yml`](../../.github/workflows/deploy-pages.yml) — "Publicar en
GitHub Pages", 37 líneas, un solo job.

- **Dispara** en cada `push` a `main` y a mano con `workflow_dispatch`.
- **Permisos**: `contents: read`, `pages: write`, `id-token: write` (despliegue con OIDC, sin token
  de acceso personal).
- **Concurrencia**: grupo `pages` con `cancel-in-progress: true` — un push nuevo cancela el
  despliegue anterior en curso.
- **Pasos**: `checkout@v4` → `configure-pages@v5` → `upload-pages-artifact@v3` con `path: dist` →
  `deploy-pages@v4`.

No hay compilación, ni pruebas, ni instalación de dependencias: el artefacto es el contenido de
`dist/` tal como está versionado. Eso significa que **lo que se publica es exactamente lo que se
commitea**, incluido `terrain-data.js`.

## Detalles del sitio

- `dist/.nojekyll` evita el procesamiento de Jekyll (necesario para que se sirvan rutas y archivos
  que Jekyll ignoraría).
- Todas las rutas internas son relativas (`./app.js`, `./assets/…`), así que el sitio funciona
  igual en un subdirectorio o en un dominio propio.
- URL publicada: <https://jose.caicedo.dev/modelamientoTerreno/>.

## Flujo de trabajo para actualizar datos

1. Ajustar `COORDS`, `step` u otros parámetros en `scripts/build_terrain_data.py`.
2. Regenerar la textura satelital si cambió la malla (paso externo).
3. `python scripts/build_terrain_data.py`.
4. Commitear el `dist/terrain-data.js` resultante y empujar a `main`; el workflow publica solo.

Ver [Canal de datos](canal-de-datos.md).
