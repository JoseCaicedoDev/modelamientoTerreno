# Interfaz y marca

## Estructura de la página

[`dist/index.html`](../../dist/index.html) — 96 líneas, en español (`lang="es"`), con una sola
región `main.app-shell` en rejilla de dos filas: cabecera y visor.

- **`.topbar`** — logo Gestiagro, nombre, descriptor, insignia "MANOLO", título, rótulo del CRS y
  un resumen de tres cifras (elevación, resolución nominal, intervalo de curvas).
- **`.viewer`** — contiene `#terrain-plot` y `#satellite-map` (uno oculto en todo momento), el
  panel `.controls`, la leyenda del mapa, el pie de atribución, el aviso táctil, el cargador y el
  mensaje de error.

Los scripts se cargan al final en orden estricto: Plotly → Leaflet → `terrain-data.js` → `app.js`.
`app.js` depende de que los tres anteriores ya hayan definido sus globales.

## Accesibilidad

Presente: `aria-label` en las regiones y grupos, `aria-pressed` en los botones de estado,
`role="img"` en el lienzo 3D con descripción, `aria-live="polite"` en el cargador, `<output>`
enlazado al deslizador, foco visible con `outline` de 2 px, y respeto de
`prefers-reduced-motion`.

Límite conocido: la escena 3D en sí no es navegable por teclado — es una limitación de Plotly, no
del código del proyecto.

## Sistema visual

Tokens en `:root` de [`dist/styles.css`](../../dist/styles.css):

| Token | Valor | Uso |
| --- | --- | --- |
| `--brand-dark` | `#015059` | Inicio del degradado, `theme-color` |
| `--brand` | `#0396a6` | Botón activo, línea del buffer |
| `--brand-light` | `#00cba9` | Acentos, valores, línea del lindero |
| `--primary-500` | `#03c0d0` | Foco y `accent-color` del deslizador |
| `--gray-100` … `--gray-950` | escala Slate | Texto y fondos |
| `--panel` / `--panel-border` | `rgba(15,23,42,.92)` / `rgba(148,163,184,.28)` | Paneles flotantes |
| `--brand-gradient` | 135°, de `--brand-dark` a `--brand-light` | Cabecera |

Tipografía **Montserrat** (300–800) desde Google Fonts, con `system-ui` de respaldo. Tema oscuro
fijo (`color-scheme: dark`); no hay modo claro. Los colores de la escena Plotly están duplicados en
`app.js` como literales y **no** leen estos tokens.

## Diseño responsivo

`100dvh` con `overflow: hidden` — la página nunca desplaza; el visor siempre ocupa la ventana.

| Corte | Qué cambia |
| --- | --- |
| ≤900 px | Cabecera más baja, logo más pequeño, sin descriptor ni cifras de resumen |
| ≤600 px | Se oculta el logo, tipografías reducidas, sin pie de atribución |
| **≤760 px** | **Los controles dejan de flotar y pasan a una barra inferior** (ver abajo) |
| ≤760 px y ≤560 px de alto | Barra inferior compacta, para móvil apaisado |
| ≥761 px | Se oculta el aviso táctil |

### Barra de controles en móvil

Por debajo de 760 px, `.viewer` se convierte en una rejilla de dos filas
(`minmax(0, 1fr) auto`): el mapa ocupa la primera y `.controls` la segunda, ya no como panel
flotante sino como **barra fija al pie**, a ancho completo y con
`padding-bottom` que respeta `env(safe-area-inset-bottom)`.

Dentro de la barra, los grupos se reparten en dos columnas: *Vista* y *Coloración* arriba,
la exageración vertical y los botones de utilidad a ancho completo debajo. Los botones suben a
42 px de alto para el dedo y se oculta el rótulo "VISUALIZACIÓN". En la vista satelital, al
ocultarse los controles `.terrain-only`, la barra se reduce a la fila de *Vista*.

El cambio obliga a reubicar dos elementos que estaban posicionados en absoluto sobre el visor:
la leyenda del mapa pasa arriba a la izquierda, y el aviso táctil deja de ser absoluto para ser
un elemento de la celda del mapa (`align-self: end`), de modo que nunca queda bajo la barra.

No hace falta tocar `app.js`: Plotly ya está en modo `responsive` y el mapa recalcula su tamaño
en `resize`.

## Activos

`dist/assets/` contiene los dos logos Gestiagro (color y blanco) y `satellite-texture.jpg`.
Los PNG pesan **1,2 MB y 1,6 MB** sin optimizar para mostrarse a 110 px. Ver [Pendientes](pendientes.md).
