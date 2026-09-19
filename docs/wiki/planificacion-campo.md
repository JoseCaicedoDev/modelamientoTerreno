# Planificación de fotocontrol y red de apoyo

Herramienta de prefactibilidad para preparar el reconocimiento de campo. Propone ubicaciones de
GCP, checkpoints y puntos auxiliares, construye una red básica de conexiones y permite corregir la
solución directamente sobre el mapa. No procesa fotografías, ajusta observaciones ni controla un
dron.

## Flujo

El botón **Plan de campo** abre un panel dividido en cuatro pasos numerados —definir el trabajo,
generar la propuesta, revisar y ajustar, y llevar el plan a campo— que siguen el flujo
`cargar → proponer → corregir → exportar`:

1. El polígono de estudio es la geometría inicial. Puede sustituirse por un área o un eje de
   corredor dibujado por el usuario.
2. Se seleccionan método principal, alternativa y cantidades de GCP y checkpoints.
3. Pueden dibujarse exclusiones, accesos y controles existentes; estos últimos también se importan
   desde CSV con coordenadas Este/Norte y elevación opcional. Estos datos opcionales viven en un
   `<details>` del paso 1 cuyo resumen indica cuántos hay cargados.
4. **Generar propuesta** distribuye los puntos y crea las conexiones.
5. Los puntos propuestos son arrastrables. También pueden fijarse, eliminarse o añadirse como GCP,
   checkpoint o auxiliar. La lista se agrupa por rol; cada fila centra su punto en la imagen
   satelital al pulsarla y se resalta cuando se hace clic en el marcador correspondiente del mapa.
6. El proyecto se guarda en `localStorage` o se descarga como `.gestiagro.json`.

La URL `?herramienta=planificacion&propuesta=si` abre la herramienta y genera la propuesta inicial;
se usa para estados reproducibles y pruebas visuales.

## Propuesta de puntos

[`domain/planning.js`](../../dist/js/domain/planning.js) recorre las celdas válidas de la malla y
descarta las que quedan fuera del área/corredor o dentro de una exclusión.

- **Área:** busca posiciones interiores próximas a esquinas, lados y centro, y completa por máxima
  separación para evitar concentraciones.
- **Corredor:** interpola posiciones a lo largo del eje y desplaza los candidatos alternadamente a
  cada lado.
- **Checkpoints:** se seleccionan después de los GCP, por lo que nunca reutilizan el mismo punto.
- **Accesos:** si existen, favorecen candidatos próximos y generan advertencias cuando un punto
  queda a más de la distancia configurada.
- **Edición:** mover o fijar un punto lo incorpora a `fixedPoints`, de modo que una regeneración
  completa respeta la decisión manual.

Cuando no existe control conocido se proponen dos auxiliares, pero el panel marca el plan con un
error: esos puntos no constituyen datum y deben amarrarse en campo. Cuando el control está lejos,
se añaden hasta cuatro auxiliares intermedios.

## Red e intervisibilidad

La red se construye incrementalmente desde los controles existentes; cada nuevo punto enlaza con
la parte ya conectada. GNSS usa una conexión mínima y estación total o el método combinado añaden
una segunda relación para evitar ramales ciegos.

En el método combinado, las conexiones de más de 700 m empiezan como GNSS y las cortas como
estación total. El usuario puede cambiar cada observación a GNSS, estación total o nivelación.

Para estación total, `analyzeVisibility` muestrea el perfil del DEM entre extremos y compara cada
cota con la recta entre la altura del instrumento y la del objetivo. Una visual obstruida aparece
roja y discontinua. Es una comprobación geométrica indicativa: el DEM actual no contiene
necesariamente edificios, vegetación u obstáculos temporales.

## Capas y edición en Leaflet

[`adapters/satellite-map.js`](../../dist/js/adapters/satellite-map.js) mantiene el grupo
`planificacion`, separado de perfiles, mediciones y capas KML. Dibuja:

| Elemento | Apariencia |
| --- | --- |
| Control existente | punto verde, no arrastrable |
| GCP | punto naranja arrastrable |
| Checkpoint | punto violeta arrastrable |
| Auxiliar | punto azul claro arrastrable |
| Conexión válida | línea azul clara |
| Visual bloqueada | línea roja discontinua |
| Exclusión | polígono rojo |
| Acceso | línea amarilla |

## Pines en el modelo 3D

Cada punto del plan se dibuja además como un pin sobre el relieve: un mástil de 12 m desde la cota
del terreno y una cabeza con el color de su rol y su código. Lo resuelve `setPlanningPins` en
[`adapters/terrain-plot.js`](../../dist/js/adapters/terrain-plot.js), que el planificador alimenta
a través del callback `onPlanChange`; así la propuesta puede juzgarse contra la forma del terreno
—lomas, quiebres y depresiones— y no solo contra la imagen satelital. Los pines siguen cualquier
edición de la lista o del mapa y se apagan al cerrar la herramienta.

## Persistencia y entregables

El paso 4 separa los entregables en *Para la comisión de campo* (informe imprimible, KMZ, KML) y
*Para la oficina* (puntos CSV, PENZD, observaciones CSV); las descargas permanecen ocultas hasta que
existe una propuesta. [`domain/planning-export.js`](../../dist/js/domain/planning-export.js) genera:

- puntos CSV con estado `PROPUESTO` o `CONTROL EXISTENTE`;
- puntos PENZD;
- conexiones CSV con método, distancia, visibilidad y despeje;
- KML y KMZ sin dependencias externas;
- proyecto JSON portable;
- informe HTML imprimible con esquema vectorial, tablas y lista de campo. El diálogo de impresión
  del navegador permite guardarlo como PDF.

Todos los formatos rotulan las ubicaciones calculadas como propuestas. El informe advierte que
acceso, seguridad, estabilidad, obstáculos y precisión se confirman en campo.

## Pruebas

[`tests/planning.test.mjs`](../../tests/planning.test.mjs) cubre área regular, exclusiones, corredor
alternado, cresta que bloquea una visual, movimiento y eliminación de puntos, coherencia de las
exportaciones KML/KMZ/CSV/PENZD/informe y reapertura del proyecto portable.

## Lenguaje del panel

El dominio conserva sus etiquetas cortas y la interfaz las traduce en
[`ui/planning-controller.js`](../../dist/js/ui/planning-controller.js):

| Valor del dominio | Texto en pantalla |
| --- | --- |
| `No evaluado` | Acceso por verificar |
| `Próximo a acceso` | Cerca de un acceso |
| `Revisar acceso` | Lejos del acceso dibujado |

Las advertencias anteponen una etiqueta según su severidad —*Corregir*, *Revisar* o *Nota*— y las
observaciones indican si la visual está libre u obstruida por el terreno. Los mensajes de éxito
(propuesta generada, proyecto guardado o cargado) usan `.planning-message.is-ok` en verde, en lugar
del rojo reservado a los errores.
