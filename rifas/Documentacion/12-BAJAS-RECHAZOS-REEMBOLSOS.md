# Compradores, bajas, rechazos y reembolsos — 08/11/2026

El usuario confirmó que el ingreso al listado de compradores ocurre **al aprobar el pago**, mediante la revisión administrativa de transferencia o la confirmación verificada de Mercado Pago. Elegir números ya los aparta durante la reserva; aprobar mantiene su asignación como venta confirmada y genera el correo de compra. No se consideran compradores las personas que sólo completan sus datos o envían un archivo.

## Baja desde Compradores

En **Administración → Compradores**, seleccionar la rifa y pulsar **Dar de baja** en la fila correspondiente. Se abre una ventana pequeña con nombre, apellido, email, DNI, números, total y detalle de las compras incluidas. El administrador debe escribir exactamente **CONFIRMAR** para habilitar la acción. La misma verificación se exige en el backend; un participante no puede usar estos endpoints.

La baja cambia las compras incluidas a `REFUND_PENDING`, las retira del listado y del Excel y libera sus números antes del sorteo. Se conservan la compra, los datos históricos, el comprobante según su retención y la auditoría. Si la rifa ya fue sorteada, conserva sus asignaciones históricas y el resultado; una rifa finalizada no admite ventas nuevas.

Una versión del conjunto de compras protege la confirmación: si cambia entre abrir la ventana y confirmar, se rechaza la baja y se debe actualizar el listado. Una identidad distinta del mismo usuario no se incorpora a la operación sin haber aparecido en el resumen. Las transacciones serializables y la asignación única protegen las reservas y las bajas simultáneas.

El aviso al cliente confirma la baja y deja el reembolso **en gestión**, con un plazo estimado de **24 a 72 horas hábiles**, según la política solicitada. Se genera un correo por compra. La baja **no transfiere dinero** ni ejecuta automáticamente una devolución bancaria o de Mercado Pago.

La sección **Reembolsos pendientes** permite registrar la devolución después de realizarla por el medio original. Exige referencia, importe y nuevamente **CONFIRMAR**. Entonces queda `REFUNDED` y se genera otra confirmación. El cliente puede consultar ambos estados desde su compra.

## Rechazo de una compra

La ventana del comprobante conserva la previsualización y el detalle de la compra. La observación es **opcional al aprobar** y **obligatoria al rechazar**, con un mínimo de cinco caracteres para el rechazo. Al elegir rechazo aparece una caja con la identidad del comprador, la rifa, números y referencia, además de tres motivos rápidos. Los mensajes se pueden editar antes de confirmar:

| Motivo | Mensaje y efecto |
|---|---|
| Monto incorrecto | Explica que el importe no coincide y el reembolso del monto efectivamente acreditado se gestionará en 24 a 48 horas. Registra una devolución pendiente; el importe recibido se verifica al registrar su devolución, no se inventa a partir del precio de la compra. |
| Datos incorrectos | Explica que el destino no coincide con el informado, que Halcón Airguns no se hace responsable de una transferencia a otra cuenta y que se deben revisar alias y titular antes de transferir nuevamente. No promete un reembolso de fondos no recibidos. |
| Pago no realizado | Explica que no hubo acreditación pese al comprobante y los datos correctos, e indica revisar el descuento del saldo y consultar al banco. No genera una devolución inexistente. |

El administrador también puede escribir un motivo propio. Rechazar deja la compra `REJECTED`, libera sus números y genera el correo con el comentario registrado. Aprobar conserva los números, agrega al comprador y genera la confirmación de compra; se puede confirmar con la observación vacía. La API aplica las mismas reglas que el formulario.

## Correos y protección de estados

La cola admite eventos separados: `PURCHASE_CONFIRMED`, `PURCHASE_REJECTED`, `REFUND_REQUESTED` y `REFUND_COMPLETED`. Cada tipo es único por compra. Los eventos y el cambio de estado se guardan en la misma transacción; los reintentos SMTP no vuelven a aprobar, rechazar o dar de baja compras. Las plantillas escapan el contenido de comentarios y no incluyen el DNI.

Los trabajos pendientes cuyo estado quedó obsoleto se omiten para no enviar confirmaciones contradictorias. Una confirmación repetida de Mercado Pago no reactiva una compra dada de baja, ni retira los números que otra persona ya reservó. La devolución del proveedor puede cerrar un reembolso pendiente si corresponde al pago original.

**El envío real sigue pendiente de configurar y activar SMTP.** Mientras tanto, las notificaciones se conservan en cola. Las pruebas usan emisores y pagos simulados; no enviaron correos ni realizaron devoluciones reales. Los plazos descritos son la política indicada por el organizador, no una fecha bancaria calculada por la aplicación.

## API y migración

Todos estos endpoints requieren rol administrador:

| Método y ruta | Body / respuesta |
|---|---|
| `GET /api/admin/raffles/:id/buyers` | Listado PAID, compras incluidas y versión del conjunto |
| `POST /api/admin/raffles/:id/buyers/remove` | `anchorOrderId`, `version`, `confirmation: "CONFIRMAR"` |
| `GET /api/admin/raffles/:id/refunds` | Reembolsos solicitados que todavía no se completaron |
| `POST /api/admin/orders/:id/refund-complete` | `reference`, `amountCents`, `confirmation: "CONFIRMAR"` |
| `POST /api/admin/orders/:id/review` | `decision`, `note`, `reasonCode` opcional (`INCORRECT_AMOUNT`, `INCORRECT_DETAILS`, `PAYMENT_NOT_MADE`, `OTHER`) |

La sexta migración, `202611080002_buyer_refunds_notifications`, agrega los campos de reembolso y los tipos de correo. Convierte los correos anteriores en eventos de confirmación conservando sus IDs, destinatarios, cargas y estados. Aplicar las migraciones antes de iniciar esta versión. La base local ya está actualizada.

## Validación local

Compilación de frontend y backend correcta. Pasaron **45 pruebas de backend, 39 de frontend, 46 de integración PostgreSQL y 25 recorridos de navegador**. Los siete recorridos nuevos verifican baja en escritorio y teléfono, confirmación escrita, liberación de números, ingreso al listado al aprobar, tres motivos de rechazo y registro del reembolso realizado. Las pruebas PostgreSQL también verifican permisos, conflicto por datos modificados, bajas concurrentes, importes reales de devolución, conservación del sorteo y protección ante Webhooks repetidos.

La aplicación compilada quedó en `http://localhost:3011`; el estado de salud respondió `ok`. Se verificó que SMTP sigue deshabilitado. Las pruebas de base de datos se ejecutaron en esquemas aislados que se eliminaron al terminar; los correos y pagos se simularon y no se dieron de baja compras reales para probar.

En la corrección posterior se habilitó aprobar sin observación, conservando el motivo obligatorio al rechazar. Se verificó la aprobación HTTP sin enviar `note`, la validación condicional, el cambio entre decisiones en el formulario y la compilación completa. Pasaron 47 pruebas de backend, 40 de frontend y 46 de PostgreSQL; se comprobaron en navegador la aprobación sin comentario y el rechazo con motivo.
