# Cancelación, cierre anticipado y finalización automática

Revisión del 12/11/2026. Sustituye los límites de cierre por fecha y de eliminación con compradores descritos en las guías anteriores.

## Administradores

Tanto PRIMARY como FUNCTIONAL pueden eliminar/cancelar y solicitar la finalización de rifas. La distinción entre tipos sólo restringe la gestión de permisos de cuentas; no estas operaciones.

## Eliminar una rifa

El diálogo de eliminación muestra la cantidad de compradores y números pagados, permite descargar el Excel antes de confirmar y ofrece un motivo opcional de hasta 1.000 caracteres. No requiere escribir un motivo para continuar.

`DELETE /api/admin/raffles/:id` acepta `{ "reason": "texto opcional" }` y también un cuerpo vacío. Puede usarse en borradores, rifas activas, pendientes de resultado y ya finalizadas. La repetición no duplica correos ni devoluciones.

La eliminación comercial es una cancelación lógica (CANCELLED): desaparece del catálogo y del listado principal de rifas, pero conserva las compras y el resultado histórico si existía. Los administradores pueden abrir el historial de rifas canceladas y descargar su Excel. La sección Compradores mantiene las rifas canceladas para gestionar sus devoluciones.

Se congela el listado de compradores pagados antes de cambiar sus estados. El Excel posterior conserva exactamente ese listado. Esa copia contiene datos privados y sólo se entrega por rutas administrativas; se omite también de las respuestas de compras del titular para no exponer datos de otros compradores.

Las compras PAID pasan a REFUND_PENDING con importe original, fecha y observación de cancelación. Se encola un aviso de cancelación por dirección de correo, agrupando las compras de la misma dirección y sus números. El mensaje informa que un administrador canceló la rifa, incluye el motivo sólo si existe y comunica gestión del reembolso en 24–72 horas hábiles. No afirma que el dinero ya se devolvió.

Las reservas sin pago y pagos pendientes se cancelan. Los comprobantes en revisión pasan a NEEDS_ATTENTION para comprobar si ingresó el dinero y registrar su devolución cuando corresponda. Un pago válido de Mercado Pago recibido después de cancelar pasa a REFUND_PENDING y no vuelve a asignar números.

No se ejecutan transferencias bancarias ni reembolsos de Mercado Pago desde la cancelación: el administrador realiza la devolución por el medio original y la registra en el flujo existente. No se cambia la conservación privada de comprobantes de tres meses.

## Finalizar ahora

`POST /api/admin/raffles/:id/finish` permite solicitar cierre desde DRAFT o ACTIVE, sin exigir que haya llegado la fecha prevista. Sobre CLOSING reintenta el resultado de la fecha ya fijada; sobre FINISHED conserva y devuelve el resultado existente. Una rifa CANCELLED no puede reactivarse mediante esta acción.

La solicitud cierra las ventas, fija closingAt y resultDate y pasa a CLOSING. Las reservas que seguían sin elegir pago se cancelan y se liberan sus asignaciones. Se conservan los intentos de pago, transferencias pendientes y comprobantes anteriores que necesitan resolución.

Si el cierre se adelanta a la fecha prevista, se usa la Nocturna bonaerense de ese mismo día en Argentina y se encola un aviso de cierre anticipado a todos los compradores confirmados. Si no había fecha prevista, el cierre manual también toma la Nocturna del día. Las compras anteriores que se acrediten durante CLOSING reciben el aviso anticipado correspondiente, sin repetirlo para un correo ya notificado.

En una rifa que ya había vencido se conserva la fecha originalmente prevista, evitando elegir el resultado del día de la intervención. Nunca se cambia de fecha al reintentar o reiniciar el servidor.

FINISHED sólo se registra cuando se puede verificar el resultado oficial, las compras pendientes están resueltas y el número tiene asignación PAID. Si falta la publicación, una regla de cifras, la resolución de un pago o el número no fue vendido, se conserva CLOSING con una explicación legible. Las ventas permanecen cerradas. La regla de número no vendido sigue sin definir; no se elige otro ganador.

## Fecha prevista y tarea automática

La fecha prevista es opcional al activar una rifa. Si se define, el servidor revisa vencimientos cada 60 segundos y al iniciar. Solicita el cierre al llegar la hora prevista o las 21:00 de ese día en Argentina, lo que ocurra primero, coherente con el cierre de ventas de la Nocturna. El editor muestra explícitamente hora argentina.

La tarea retoma los cierres pendientes y las fechas vencidas tras un reinicio. Requiere que el servicio esté ejecutándose: si el equipo o servidor está apagado, realiza el trabajo al reanudarse.

Una vez confirmado el ganador, una transacción guarda el resultado, encola su correo y prepara un aviso para cada administrador activo de ambos tipos. El aviso administrativo identifica al ganador, su email, número y el resultado oficial. No publica esos datos privados en la portada. Repetir la tarea o ejecutar dos trabajadores no vuelve a elegir ganador ni crea otro aviso por destinatario.

La portada y la página de la rifa distinguen las ventas cerradas de un resultado ya confirmado. La cancelación se informa en la compra y en la página directa de la rifa.

## Fuente oficial e históricos

Se consulta https://loteria.gba.gob.ar/resultados para la fecha actual. La consulta histórica usa el mismo servicio público que consume el selector de fecha del sitio oficial: `https://loteria.gba.gob.ar/api-loteria/extractos/AAAA-MM-DD`.

Del bloque Nocturna se selecciona exactamente `QuinielaNocturna.pdf`, sin confundirlo con el extracto de otras jurisdicciones ni con Quiniela Plus. PDF.js en el backend comprueba fecha, PROVINCIA, NOCTURNA, número de sorteo, cabeza coincidente y veinte posiciones. Se leen datos y texto; no se ejecutan scripts del PDF ni del sitio remoto. Los tamaños, tiempos de consulta y páginas están limitados.

Si el sitio cambia de formato o no puede verificarse un dato, el resultado queda pendiente. Se conserva un resultado verificado por fecha en LotteryDraw y se reutiliza después de la medianoche y de reinicios. Se guardan la evidencia extraída y el hash de la fuente. El enlace diario público mantiene la regla anterior: sólo se muestra el día de ese resultado, aunque el número y la fecha persisten.

Se validó una consulta histórica real del 11/11/2026: Nocturna de Provincia, sorteo 12912, primer premio 3966. No se usó esa consulta para finalizar ninguna rifa real.

## Correo y estado local

RaffleEmail es una cola durable para cancelación, adelanto y resultados administrativos. Agrupa por correo y rifa; tiene claves de evento únicas, bloqueo temporal para trabajadores concurrentes y reintentos con espera. Los avisos al ganador siguen usando PurchaseEmail. El estado y el reintento administrativo de correos abarcan las tres colas, incluida la verificación de cuenta. Un administrador que perdió su acceso no recibe el aviso privado del ganador.

Se revisaron los ocho avisos antiguos dirigidos a cuentas de demostración o al dominio local y quedaron SKIPPED con código LEGACY_DEMO_NOTIFICATION, sin borrar compras ni registros. Se conservó el aviso nuevo de compra para el correo principal. La aplicación se inició con SMTP real habilitado: Gmail aceptó el aviso nuevo de compra y la verificación de la dirección principal. No se enviaron esos avisos antiguos ni mensajes de pruebas de integración.

La rifa heredada de 1.000 números, cuya fecha prevista ya había pasado, quedó automáticamente CLOSING y pendiente de definir su cantidad de cifras. No se cambió su numeración, no se inventó una regla ni se eligió ganador. La otra rifa de demostración no tiene fecha y sigue activa hasta una acción administrativa.

## Validación y migración

Novena migración aplicada: `202611120003_raffle_lifecycle`. Se agregan CLOSING/CANCELLED, metadatos de cierre/cancelación, copia privada de compradores, RaffleEmail y LotteryDraw. PDF.js 6.5.438 se declara también como dependencia del backend; no se duplica su versión respecto al visor.

Builds de backend y frontend correctos. 63 pruebas de backend, 45 de frontend y 82 con PostgreSQL aislado correctas. Diecisiete pruebas de Edge cubren cancelación con Excel previo y motivo opcional, eliminación de una rifa ya finalizada, cierre anticipado desde un administrador funcional, presentación a 1280/320 px y regresiones de roles, comprobantes y reembolsos. Las suites usan correo simulado y no cancelan rifas reales.
