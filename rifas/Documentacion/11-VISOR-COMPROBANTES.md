# Vista previa de comprobantes y accesos oficiales — 08/11/2026

En **Administración → Compras y comprobantes**, el botón de descarga directa se reemplazó por **Ver comprobante**. Abre una ventana con el archivo privado, datos de la compra, importe y destino de transferencia. Los botones externos de aprobar o rechazar abren esa misma ventana con la decisión seleccionada.

Dentro de la ventana se puede ver una imagen o un PDF, cambiar de página y ampliar el PDF, descargar el archivo si se necesita y aprobar/rechazar con la observación para el participante. La revisión conserva la validación administrativa del backend. Si el archivo está vencido o no puede cargarse, se informa el error y no se habilitan descarga ni confirmación.

El participante también dispone de **Ver comprobante** dentro de su compra, con descarga en la ventana y sin controles administrativos.

Los archivos se obtienen por el endpoint autenticado existente `/api/receipts/:id`; no se crearon enlaces públicos ni servicios externos de visualización. PDF.js dibuja las páginas en el navegador, con sus componentes y decodificadores servidos por la propia aplicación. Las imágenes y solicitudes pendientes se liberan al cerrar la ventana. La retención de tres meses continúa vigente.

Los iconos contiguos de la cabecera abren en una pestaña nueva el [canal de YouTube](https://www.youtube.com/@Jose_Osvaldo) y la [tienda oficial](https://halcon-airguns.com.ar). Tienen nombres accesibles y áreas de toque de 44 px. Se mantiene el diseño negro y dorado; el encabezado puede distribuirse en más de una fila en teléfonos pequeños.

La dependencia del visor requiere **Node 22.13 o posterior**. Vite incluye el worker, fuentes y decodificadores en el build; los comprobantes nunca se copian allí. La política CSP permite el worker local y WebAssembly para los decodificadores, conservando la restricción de scripts al propio origen. Los directorios de archivos privados se excluyen de Git también bajo la subcarpeta `rifas`.

Se verificaron componentes, autenticación de la solicitud del archivo, carga de imágenes y PDFs reales de dos páginas, cambio de página, ampliación, descarga opcional, aprobación/rechazo simulados, permisos del comprador y archivos vencidos. Las pruebas de navegador usan respuestas controladas; no aprueban pagos reales.

La compilación completa fue correcta. Pasaron 43 pruebas de backend, 33 de frontend y 18 de navegador; estas últimas se ejecutaron contra la compilación servida por Express, con su política CSP activa. La revisión de dependencias de producción no reportó vulnerabilidades. No se repitió la suite PostgreSQL porque esta revisión no modifica las entidades ni la lógica de acreditación. La aplicación queda disponible en `http://localhost:3011`.
