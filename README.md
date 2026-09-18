# Modelo 3D de elevación — Gestiagro

Visor web interactivo del DEM recortado al polígono de estudio y su zona de influencia de 500 m.

Incluye:

- Elevación coloreada e imagen satelital aplicada al modelo 3D.
- Exageración vertical ajustable.
- Curvas de nivel cada 10 m.
- Rotación, inclinación y acercamiento interactivos.
- Vista simultánea 3D y satelital con seguimiento de coordenadas sincronizado.
- Perfil topográfico A–B calculado sobre el DEM.

El contenido publicado se encuentra en `dist/` y se despliega automáticamente con GitHub Pages.

## Ver en línea

[Abrir el modelo 3D](https://jose.caicedo.dev/modelamientoTerreno/)

## Documentación

- [Wiki del proyecto](docs/wiki/index.md) — qué está implementado y cómo funciona.
- [Arquitectura frontend](docs/wiki/arquitectura-frontend.md) — módulos y responsabilidades.
- [Reglas del repositorio](AGENTS.md) — contexto, arquitectura y verificación obligatorios.
- [LLM Wiki](docs/llm-wiki.md) — patrón de referencia con el que se mantiene la wiki.

## Verificación

```powershell
node --test tests\terrain-model.test.mjs
```
