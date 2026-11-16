# Premio de números gratis con rifa asignada

Implementado el 14/11/2026. Regla actualizada el 15/11: ver [destino único vigente](21-NUMEROS-GRATIS-CON-RIFA-ASIGNADA.md).

## Configuración y uso

En Administración → Premios → Nuevo premio se elige **Tipo de premio → Número gratis para la siguiente rifa**. También puede crearse desde el paso Premios por puesto del asistente de rifas. El nombre es libre; lo que habilita el beneficio es el tipo, no el texto del nombre. La cantidad de unidades del premio determina cuántos números gratis recibe el ganador. Puede combinarse con productos, repetirse en varios puestos y ser ganado varias veces por una misma cuenta.

Al confirmar todos los ganadores con la Nocturna bonaerense, se acreditan automáticamente los beneficios a las cuentas titulares de las compras ganadoras. El correo de ganador incluye la cantidad y las instrucciones para canjear. Reintentar un cierre no duplica beneficios.

En Mis números aparece **Tus números gratis**, con la rifa concreta asignada. El ganador elige sus números disponibles cuando esté activa. Se conservan la grilla, reservas temporales y controles de identidad habituales. En la compra aparece **Usar números gratis**; el canje confirma inmediatamente la participación por $0, sin Mercado Pago, transferencia, comprobante ni aprobación manual. Se guardan nombre, apellido, email y DNI; figura en compradores y en Excel. La participación se considera confirmada para el cierre y no suma recaudación.

Si desea comprar números adicionales, el usuario los reserva y paga por separado. No se mezclan canje parcial y dinero en una misma compra. Puede canjear su saldo en varias reservas de hasta veinte números cada una.

También se permite [entregar números gratis manualmente](21-NUMEROS-GRATIS-CON-RIFA-ASIGNADA.md) desde Administración → Participantes, sin rifa de origen, con cantidad, motivo opcional y una rifa obligatoria elegida entre borradores y activas. Se muestra en la cartera como entrega de administración y conserva saldo, historial y protecciones de canje.

## Vigencia en la rifa asignada

La decisión del 15/11 sustituye la anterior de cualquier rifa posterior: un premio ganado se vincula a la siguiente que se active después de confirmarlo. Si todavía no se abrió, queda pendiente. Crear un borrador no cuenta como apertura. Las entregas manuales tienen la rifa concreta elegida por administración, incluso si todavía es borrador.

Un beneficio sólo puede canjearse en su destino. Si esa rifa cierra normalmente sin utilizarlo, el saldo histórico se conserva pero no puede gastarse en otra. Las bajas restituyen para el mismo destino. Una cancelación permite reemplazo: los automáticos esperan la próxima apertura y los manuales requieren asignación administrativa a otra rifa cargada. No se genera una devolución de dinero por participaciones gratuitas.

Cancelar la rifa de origen o dar de baja la compra ganadora revoca sus beneficios pendientes de uso. Las participaciones ya canjeadas en otra rifa conservan su registro.

## Integridad y privacidad

- Prize y AwardPrize guardan el tipo ITEM/FREE_TICKET. AwardPrize conserva una copia del tipo y demás datos ofrecidos: editar el catálogo no cambia silenciosamente premios de rifas existentes. Los premios anteriores se conservan como ITEM; no se infiere su tipo por el nombre.
- FreeTicketBenefit guarda titular, premio de origen, fecha, cantidad, saldo, revocación y targetRaffleId. El destino se exige al canjear. FreeTicketUse registra cantidades usadas por compra y su restitución. Un premio de un puesto genera un único beneficio. Los campos scope/validFrom anteriores se conservan como historial y no habilitan canjes generales.
- El canje exige autenticación, propiedad de la reserva, identidad completa, saldo suficiente, rifa activa, venta abierta y asignaciones vigentes. El saldo y la confirmación se modifican en una transacción Serializable, con la cola de reservas existente. Repetir la misma solicitud devuelve la participación ya confirmada sin consumir nuevamente.
- Se mantiene Order.status=PAID para la participación confirmada y se distingue PaymentMethod=FREE_TICKET con precio e importe cero. La restricción de base permite cero exclusivamente para este método; las compras pagadas siguen exigiendo precio positivo. No se acepta un precio o método proporcionado por el navegador para generar beneficios.
- El listado de beneficios es privado y sólo devuelve los del usuario autenticado. Los anuncios públicos no incluyen titulares de beneficios ni datos de compras privadas. El historial personal describe el canje en lenguaje legible.

## API y migraciones

GET `/api/free-tickets`: beneficios de la cuenta, saldo, origen, fecha, targetRaffle y disponibilidad; `availableRaffles` contiene como máximo el destino asignado si admite canje.

POST `/api/orders/:id/free-tickets`: canje de toda una reserva propia existente. No recibe importes ni cantidades a acreditar; se calculan desde la reserva y el saldo autorizado.

POST/PUT `/api/admin/prizes` acepta `kind: "ITEM" | "FREE_TICKET"`, con ITEM predeterminado por compatibilidad. Los endpoints de rifas conservan su contrato; la cantidad se configura en `awards[].prizes[].quantity`.

Migraciones 11 y 12 aplicadas: `202611140002_free_ticket_prizes` y `202611140003_free_ticket_amount`. Agregan tipos y tablas, fecha de apertura y restricción de importe. No se alteran importes, estados ni números de compras anteriores. Antes de migrar se generó y verificó un respaldo privado en `.demo/backups/halcon-before-free-tickets-20261114.dump` (101 entradas en el manifiesto).

## Validación y ejecución

Pruebas PostgreSQL cubren generación única, tipo congelado, apertura de borrador, destino correcto, privacidad, titularidad, canje sin cobro, correo, Excel/listado y recaudación cero, doble solicitud, concurrencia, saldo insuficiente, datos incompletos, vencimiento, baja, restitución y revocación. Los correos se prueban con un remitente simulado, sin SMTP real. Navegador recorre Mis números → elegir 07 → canjear → participación gratuita confirmada a 320 y 390 px, sin solicitudes de pago. Se conservan las pruebas previas de varios puestos y numeración.

El estado actual de los servicios se registra en continuidad; no asumir que estén iniciados. La cuenta remitente configurada en .env no se modifica. No se crea un ganador real ni se otorgan beneficios a cuentas reales para las pruebas. No hay commit, push ni despliegue.

Validación inicial: 90 pruebas backend, 60 frontend, 102 PostgreSQL aislado y 8 de navegador correctas (260), ambos builds correctos. Capturas en playwright-artifacts.

Validación histórica del 14/11 para la regla entonces vigente: 90 backend, 60 frontend, 103 PostgreSQL y dos canjes móviles (255), ambos builds correctos. Las pruebas de uso en cualquier posterior fueron sustituidas el 15/11 por las de destino único descritas en la guía 21.
