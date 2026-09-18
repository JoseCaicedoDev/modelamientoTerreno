# Reglas del repositorio

Estas instrucciones son obligatorias para cualquier agente que trabaje en este repositorio.

## Contexto antes de cambiar código

1. Antes de analizar, diseñar o modificar el proyecto, leer completos:
   - [`docs/llm-wiki.md`](docs/llm-wiki.md)
   - [`docs/wiki/index.md`](docs/wiki/index.md)
2. Leer después las páginas de `docs/wiki/` relacionadas con el área que se va a modificar.
3. Contrastar la wiki con el código. Si difieren, el código es la evidencia del comportamiento actual
   y la wiki debe corregirse dentro del mismo cambio.

## Mantenimiento obligatorio de la wiki

Todo cambio funcional, visual, arquitectónico, de datos o de despliegue debe actualizar en el mismo
commit:

1. Las páginas temáticas afectadas de `docs/wiki/`.
2. `docs/wiki/bitacora.md`, con una entrada fechada y un resumen verificable.
3. `docs/wiki/pendientes.md`, cuando se resuelva o descubra trabajo pendiente.
4. La fecha y referencia de versión en `docs/wiki/index.md`.

No documentar comportamiento supuesto. Cada afirmación técnica debe poder comprobarse en archivos
del repositorio. Preferir enlaces a archivos y símbolos estables; actualizar referencias de línea
cuando sean útiles y hayan cambiado.

## Arquitectura y calidad

- Mantener `dist/app.js` como raíz de composición y orquestador, sin lógica de dominio ni detalles
  extensos de Plotly, Leaflet o SVG.
- Separar responsabilidades en módulos ES dentro de `dist/js/`: dominio puro, adaptadores de las
  bibliotecas y componentes de interfaz.
- Evitar estado global nuevo. El estado mutable pertenece al módulo que lo administra y se expone
  mediante una API pequeña y explícita.
- Favorecer funciones pequeñas con nombres orientados a intención, retornos tempranos y constantes
  compartidas en lugar de literales duplicados.
- Mantener la lógica geoespacial y de muestreo independiente del DOM para que pueda probarse sin
  navegador.
- No editar `dist/terrain-data.js` a mano; se regenera con `scripts/build_terrain_data.py`.
- No introducir framework, empaquetador ni dependencia de ejecución sin una decisión explícita del
  propietario. El sitio debe seguir funcionando como archivos estáticos en GitHub Pages.
- Todo texto visible, comentarios y documentación se escribe en español.

## Verificación

- Ejecutar comprobación sintáctica sobre cada módulo JavaScript modificado.
- Probar en navegador las rutas afectadas y, para cambios de interfaz, revisar al menos escritorio y
  móvil.
- Antes de entregar, ejecutar `git diff --check` y confirmar que no se incluyeron cambios ajenos.
