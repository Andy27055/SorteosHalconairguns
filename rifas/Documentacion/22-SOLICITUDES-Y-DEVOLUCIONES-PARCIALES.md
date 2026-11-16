# Solicitudes del cliente y devolución por número

Revisión del 15/11/2026.

## Flujo

Desde **Mis números**, el titular puede pulsar **SOLICITAR DEVOLUCIÓN** y elegir uno o varios números de una compra, conservando el resto. La opción también aparece al abrir el detalle de su compra. Requiere pago confirmado (`PAID` y fecha de acreditación), medio TRANSFER o MERCADO_PAGO y rifa ACTIVE con plazo de participación abierto, sin resultado ni devolución ya iniciada. Las participaciones gratuitas no generan devolución de dinero. Un administrador que consulta compras de otro usuario no ve el botón del titular.

El formulario muestra el importe calculado a partir del precio unitario histórico pagado, multiplicado por la cantidad elegida. Usa centavos enteros y no el precio actual de la rifa. El motivo del cliente es opcional. No envía un importe editable al servidor. El backend vuelve a calcularlo y valida titularidad, pago, rifa, números propios y sus asignaciones confirmadas.

Enviar crea una solicitud **PENDING**. La compra conserva PAID, todos sus números siguen participando y ocupados y la recaudación no cambia. Hay como máximo una solicitud pendiente por compra. Se admite reintentar el mismo requestId sin duplicar la solicitud; no permite reutilizarlo con otros datos.

## Aprobación administrativa

En **Administración → Devoluciones → Solicitudes por aprobar**, tanto PRIMARY como FUNCTIONAL ven comprador, correo y DNI históricos, rifa, números, importe calculado y motivo. Al revisar:

- **Aprobar**: observación opcional. Revalida rifa activa, plazo, compra, asignaciones y precio. Libera sólo los números seleccionados, autoriza el importe calculado y deja la devolución en gestión. No mueve dinero. El panel pasa a «Aprobadas, pendientes de devolver» para realizar y registrar la operación.
- **Rechazar**: motivo obligatorio de al menos cinco caracteres. Conserva participación, números, importe y asignaciones. El cliente ve la respuesta y puede presentar una nueva solicitud mientras siga cumpliendo las condiciones.

Si la rifa cerró antes de revisar, no se puede aprobar la solicitud; el administrador puede rechazarla explicándolo. Mientras no se apruebe, los números participan incluso si la rifa llega a finalizar. Una cancelación o baja administrativa reemplaza la solicitud pendiente por la gestión de devolución correspondiente y la marca CANCELLED, conservándola como historial. No se genera otra obligación de pago por esa solicitud.

Después de realizar la devolución por banco o proveedor, el administrador registra importe y referencia mediante el formulario existente con la palabra CONFIRMAR. La cuenta desactivada del comprador no bloquea esta aprobación ni el registro de la devolución. El cliente puede consultar recepción, decisión y estado del reembolso desde su compra.

## Devoluciones parciales e historial

Si se devuelven algunos números, la compra original conserva PAID con los números restantes y su valor. Se crea una parte vinculada mediante parentOrderId en REFUND_PENDING, con los números devueltos y el importe autorizado. originalNumbers/originalAmountCents preservan el alcance e importe del pago original. El comprobante sigue vinculado a la compra original, accesible desde la parte. Se copian las identidades y cuentas de transferencia históricas. Si se devuelven todos los números restantes, se reutiliza la compra como devolución, sin crear una parte duplicada.

Ejemplo: tres números de $100,25; el cliente pide devolver 07 y 09. Antes de aprobar, los tres participan y la compra suma $300,75. Al aprobar, 08 conserva su participación por $100,25 y 07/09 quedan en una devolución autorizada por **$200,50**. El recibo y la compra original de $300,75 siguen en el historial. Se puede solicitar más tarde devolver el resto, sin superar el importe original.

Compradores y Excel contienen sólo los números que conservan PAID y participación; la recaudación por rifa usa su importe neto. Las asignaciones liberadas se pueden vender de nuevo. Registrar el reembolso no toca las reservas posteriores de otros compradores. Las transacciones serializables y el índice parcial impiden solicitudes pendientes o aprobaciones duplicadas.

La conciliación de Mercado Pago valida el importe original del pago tras una separación parcial, en lugar del saldo de participación restante. Una aprobación repetida no recompra números ni genera NEEDS_ATTENTION por esa separación. Una devolución total confirmada por el proveedor liquida las partes pendientes del mismo pago sin duplicar movimientos. La integración no inicia reembolsos bancarios o de Mercado Pago desde este flujo.

## Correos y actividad

La recepción, aprobación y rechazo generan notificaciones por solicitud, con números e importe seleccionados y destinatario histórico. Los mensajes se escapan y tienen claves únicas por solicitud. El trabajador omite estados obsoletos. La devolución efectivamente registrada utiliza la confirmación existente de reembolso completado. Las colas sólo se envían con SMTP y trabajadores habilitados; la sesión local mantiene ambos pausados.

Actividad muestra solicitud del titular y aprobación/rechazo administrativos. El contexto de esas acciones usa los números del evento, aunque la compra ya conserve un subconjunto diferente. Solicitudes y partes quedan relacionadas con las órdenes y se conservan al eliminar una cuenta histórica. Una solicitud pendiente también bloquea el borrado de la cuenta; desactivarla sigue permitido.

## API y persistencia

| Ruta | Permiso y contrato |
|---|---|
| POST /api/orders/:id/refund-requests | Titular activo; numbers, reason opcional de 0–500 caracteres, requestId UUID. Devuelve 201. Importe calculado exclusivamente por servidor. |
| GET /api/orders y /api/orders/:id | Titular o acceso administrativo correspondiente; incluyen refundRequests, refundParts, parentOrderId y los datos originales cuando hubo separación. La selección privada de solicitudes omite requestKey. |
| GET /api/admin/refund-requests?status=PENDING&page=1 | ADMIN; estados PENDING, APPROVED, REJECTED y CANCELLED. Paginación de 25. |
| POST /api/admin/refund-requests/:id/review | ADMIN; decision approve/reject, note opcional al aprobar y obligatorio al rechazar. Decisión repetida: 409. |
| POST /api/admin/orders/:id/refund-complete | ADMIN; devolución ya autorizada, importe, referencia y CONFIRMAR; contrato anterior conservado. |

GET /api/admin/stats agrega pendingRefundRequests. La tarjeta Devoluciones muestra la suma de solicitudes sin revisar y devoluciones autorizadas pendientes. No implica cantidad de compradores únicos.

Migración **202611150002_customer_refund_requests**, número quince aplicada localmente: relaciones de partes de Order, datos del pago original, RefundRequest con un índice único parcial de una PENDING por orden y tres clases de correo. No convierte ni altera estados de compras existentes.

## Validación

26 escenarios PostgreSQL aislados cubren permisos, propiedad, pago, estados/plazos de rifa, números, cálculo histórico, idempotencia, concurrencia, aprobación parcial/total, rechazo, reventa, cancelación, conciliación y correo simulado. Pasada completa con 163 pruebas PostgreSQL correctas; 95 pruebas backend sin base y 72 frontend correctas. Recorridos de Edge a 390/320 px comprueban solicitud desde Mis números, importe, aprobación/rechazo, registro bancario simulado, historial y disponibilidad del resto. Se preservan recorridos anteriores de comprobantes y reservas. No se generó ninguna solicitud ni devolución real para validar, ni se envió correo real.
