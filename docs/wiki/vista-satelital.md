# Vista satelital

Segunda vista del visor, en 2D, construida con Leaflet 1.9.4.
Código: `initializeSatelliteMap` y `setViewMode` en
[`app.js:202-274`](../../dist/app.js#L202-L274).

## Inicialización perezosa

El mapa **no se crea al cargar la página**: se construye la primera vez que se pulsa "Satélite"
y a partir de ahí se reutiliza (`if (satelliteMap || !window.L || !data.boundary …) return`). Al
mostrarlo se llama `invalidateSize()` dentro de un `requestAnimationFrame`, porque el contenedor
estaba `hidden` y Leaflet necesita medirlo ya visible.

## Capas

| Capa | Estilo | Origen |
| --- | --- | --- |
| Teselas base | `maxZoom: 19` | Esri **World Imagery** (`server.arcgisonline.com/.../World_Imagery/MapServer/tile/{z}/{y}/{x}`) |
| Zona de influencia | línea `#0396a6` de 2 px, discontinua `8 7`, relleno 8 % | `data.buffer` |
| Área de estudio | línea `#00cba9` de 3 px, relleno 12 % | `data.boundary` |

Controles añadidos: zoom arriba a la derecha y escala métrica (`imperial: false`) abajo a la
izquierda. La atribución de Esri se mantiene activa, como exige el servicio.

El encuadre inicial es `fitBounds` sobre el polígono del buffer con 34 px de margen — nunca se fija
un centro o zoom a mano, así que el mapa sigue automáticamente cualquier cambio del área.

## Diferencias con la coloración "Satélite" del 3D

Son cosas distintas y conviene no confundirlas:

- **Vista Satélite** (este documento): mapa 2D, teselas en vivo de Esri, permite acercarse hasta
  z19, requiere conexión.
- **Coloración Satélite** del modelo 3D: la textura *ya horneada* en `terrain-data.js`, un color por
  celda de 25 m, drapeada sobre el relieve. Funciona sin conexión y no gana detalle al acercarse.
  Ver [Visor 3D](visor-3d.md).

## Cambios de interfaz al activarla

`setViewMode('satellite')` oculta el contenedor de Plotly, muestra el mapa y su leyenda, añade la
clase `satellite-active` al visor, oculta todos los controles `.terrain-only` (coloración,
exageración, curvas, restablecer), y cambia el aviso táctil a "Arrastra para mover".
