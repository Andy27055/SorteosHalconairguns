# Última Nocturna, mínimo de números, entrega manual y filtros

Actualización del 14/11/2026. Sustituye la regla anterior de esperar la Nocturna del mismo día o conservar la fecha prevista cuando todavía no se había seleccionado un resultado.

La selección de última Nocturna publicada descrita aquí fue sustituida el 15/11 a pedido del usuario: se vuelve a esperar la Nocturna del día del cierre. Ver [regla actual](15-CANCELACION-Y-CIERRE-AUTOMATICO.md). Esta sección se conserva como historial de la implementación anterior, no como instrucción vigente.

La vigencia de números gratis y el formulario de entrega manual cambiaron el 15/11: los premios ganados son para la siguiente rifa y la entrega manual exige una rifa concreta, borrador o activa. Las opciones generales de vigencia de la sección histórica de esta guía fueron sustituidas; ver [regla actual](21-NUMEROS-GRATIS-CON-RIFA-ASIGNADA.md). Las reglas de Nocturna, mínimo diez y filtros se mantienen.

## Cierre con la última Nocturna publicada

Al solicitar el cierre de una rifa activa, manual o programado, se cierran primero las ventas. Se busca la última Quiniela de la Provincia de Buenos Aires, Nocturna, publicada al momento de ese cierre efectivo. Antes de las 21:00 se busca desde el día anterior; después se intenta la del día y se retrocede si todavía no hay extracto publicado. Se omiten domingos y se revisan como máximo catorce días. Una ausencia comprobada de extracto permite buscar una fecha anterior; un fallo de conexión, formato, integridad o fecha deja la rifa pendiente y no autoriza a saltar arbitrariamente a un resultado más viejo.

Se contrastó el horario con el [cronograma oficial](https://loteria.gba.gob.ar/juegos-tradicionales): Nocturna de lunes a sábado, a las 21:00. Los resultados se verifican contra la [página oficial](https://loteria.gba.gob.ar/resultados) y los extractos provinciales por fecha. No se consultan resultados de Ciudad ni de otra jurisdicción.

La primera selección verificada guarda resultDate y el extracto inmutable en LotteryDraw. Los reintentos y cierres concurrentes conservan esa selección. Si todavía no pudo elegirse un extracto, se mantiene closingAt como límite para no usar un sorteo posterior al cierre. Cierres anteriores con resultDate ya fijado conservan su evidencia histórica. Una rifa cuyo servidor estaba apagado solicita el cierre al reiniciarse y utiliza la última edición disponible en ese cierre efectivo.

Se mantienen los puestos en orden y las cifras según la cantidad de números. FINISHED requiere todos los pagos resueltos y cada número premiado con participación confirmada. Un número no vendido o fuera del rango sigue dejando el cierre pendiente: continúa sin haber regla de reemplazo. Los borradores no se finalizan.

La fecha mostrada al ganador y guardada en la página es la del extracto realmente utilizado. El enlace diario sigue sujeto a su día de validez; no se publica un enlace diario que podría mostrar otra fecha.

Validación real de sólo lectura del 14/11: se recuperó la Nocturna del 13/11/2026, sorteo 12914, con veinte posiciones verificadas. No se finalizó ninguna rifa real ni se envió correo durante esa comprobación.

## Mínimo de diez números

Nuevas rifas y ediciones requieren entre 10 y 10.000 números; 100 continúa como valor predeterminado. Diez números se muestran del 0 al 9 y usan la última cifra. Cien: 00–99, dos cifras. Mil: 000–999, tres. Diez mil: 0000–9999, cuatro. Se usa la longitud de totalTickets−1, con mínimo de una cifra.

Para cantidades intermedias se mantiene la regla de rango: si el resultado no pertenece al rango vendido, no se aplica módulo ni se inventa un reemplazo. La cantidad se refiere a números ofrecidos, no exige diez compradores distintos.

Las rifas anteriores de prueba con menos de diez números conservan sus compras e historial, pero no se publican en el catálogo ni admiten nuevas reservas, alta o finalización. Se pueden eliminar/cancelar desde administración. No se alteran sus números ni se fuerzan cambios sobre compras existentes.

## Entrega manual de números gratis

En Administración → Participantes → **OTORGAR NÚMEROS GRATIS**, el administrador principal o funcional elige una cuenta activa, cantidad de 1 a 100, motivo opcional y vigencia:

- **Rifas abiertas actuales y futuras:** puede utilizarse en rifas ya abiertas al otorgarlo y en las que se abran después.
- **Sólo futuras:** puede utilizarse únicamente en rifas cuya primera apertura sea posterior a la entrega.

El usuario confirmó expresamente que deben ofrecerse ambas opciones. Las entregas manuales no requieren una rifa de origen ni elegir un ganador ficticio. Se muestran en Mis números como «Entregado por administración», con motivo y vigencia. El saldo persiste y se canjea mediante el flujo existente: selección de números disponibles, reserva, identidad y participación confirmada por $0. El beneficio no reserva números por sí mismo.

POST `/api/admin/users/:id/free-tickets` requiere administrador y recibe quantity, scope FUTURE/CURRENT_AND_FUTURE, reason opcional y requestId UUID. La solicitud es idempotente para un mismo administrador y requestId; repetirla no acredita de nuevo. No se puede reutilizar con datos diferentes. No permite otorgar a cuentas desactivadas. El evento FREE_TICKETS_GRANTED_MANUALLY se guarda con actor, destinatario, cantidad, vigencia y motivo, visible en el historial administrativo y en el del titular. No se cambian roles ni permisos.

Migración 13: `202611140004_manual_free_tickets`. FreeTicketBenefit permite origen AwardPrize nulo para entregas manuales y agrega grantedBy, reason, grantKey único, scope y validFrom. Una restricción exige origen de premio o autor/solicitud de entrega manual. Se conserva la fecha de validez de los beneficios anteriores copiando createdAt, sin modificar cantidades, saldos, compras ni canjes. La cancelación de una rifa no revoca beneficios manuales independientes; un canje anulado restituye su saldo con la misma vigencia.

Respaldo privado previo: `.demo/backups/halcon-before-manual-benefits-20261114.dump`, validado con 116 entradas en el manifiesto. .env no se modifica ni se imprime. El correo de confirmación del canje mantiene el flujo existente; la entrega manual se comunica en la cuenta y el historial.

## Filtros del catálogo

El contador mantiene la estética negra y dorada y ahora abre un desplegable con Activas primero, Compras cerradas primero, Sólo activas y Sólo compras cerradas. El orden predeterminado muestra abiertas primero. Compras cerradas abarca pendientes de resultado, finalizadas y activas cuya venta ya venció. Las rifas finalizadas pueden verse directamente mediante estos filtros, conservando el anuncio del último ganador. Una única rifa abierta conserva su tarjeta destacada. Se comprobaron el menú y el listado a 390 y 320 px sin desbordamiento horizontal.

## Pruebas y ejecución

Pruebas unitarias cubren búsqueda de la última Nocturna, límites de fecha, domingos, extractos ausentes, fallos de fuente, mínimo de números, formulario, entrega manual e idempotencia y filtros. PostgreSQL aislado cubre ambas vigencias, canje en abiertas/futuras, permisos, saldo, eventos, diez números con ganador por una cifra y las regresiones de compras, cierre y premios. El navegador verifica filtros y entrega manual en móvil, canjes gratuitos, alta de borradores, cancelación con Excel y cierre anticipado.

Se conserva la sesión local en web 5173 y API 3011, con SMTP y trabajadores pausados como en la prueba anterior. No se acredita un beneficio a ninguna cuenta real ni se cierra una rifa real para validar. No hay commit, push ni despliegue.

Resultado: 99 pruebas backend, 63 frontend, 110 PostgreSQL y 13 navegador correctas (285). Ambos builds correctos. Capturas de filtros y cartera manual a 320 px revisadas. Web, salud API y catálogo público HTTP 200.
