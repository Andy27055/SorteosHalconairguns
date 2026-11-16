# Números gratis con una rifa asignada

Regla vigente desde el 15/11/2026. El usuario cambió la decisión anterior que permitía usar beneficios en cualquier rifa posterior.

## Premio ganado automáticamente

El número gratis ganado vale únicamente para la **siguiente rifa**: la primera que se active después de confirmar el premio. Crear un borrador no inicia una rifa ni consume ese lugar. Si todavía no se abrió la siguiente, el beneficio queda pendiente. Crear una activa o dar de alta un borrador vincula los beneficios automáticos pendientes de manera transaccional; abrir rifas posteriores no cambia el destino.

El ganador elige los números disponibles dentro de esa rifa y canjea mediante el flujo existente, sin pago ni comprobante. Si no utiliza el beneficio y esa rifa cierra normalmente, el saldo histórico se conserva pero no puede gastarse en otra. Reintentar el cierre no duplica premios. Varios premios del mismo titular pueden sumar números gratuitos para la misma rifa.

## Entrega manual

En Administración → Participantes → OTORGAR NÚMEROS GRATIS, el administrador debe elegir una rifa **ya cargada**, entre borradores y activas. No se ofrecen las opciones generales «actuales y futuras» o «sólo futuras». Se conservan cantidad 1–100, motivo opcional, destinatario activo e idempotencia por requestId.

Los borradores pueden seleccionarse aunque se hayan creado antes de la entrega. El usuario verá el título asignado y podrá canjear cuando se active. Las activas deben mantener ventas abiertas. Se rechazan rifas canceladas, finalizadas, pendientes de resultado, con menos de diez números o con resultado previo. El servidor vuelve a validar el destino al otorgar y exige coincidencia exacta al canjear; no basta con ocultar opciones en el navegador.

## Historial, beneficios anteriores y cancelaciones

Se utiliza targetRaffleId, ya existente; no hace falta una migración nueva. scope y validFrom anteriores se conservan como historial, pero ya no habilitan canjes generales. No se reescriben compras, números, saldos ni canjes anteriores.

Las entregas manuales anteriores sin destino aparecen como pendientes en el mismo diálogo administrativo. Se selecciona «Asignar N números pendientes» y una rifa. Esto vincula el saldo restante sin acreditarlo de nuevo ni alterar los usos registrados. La misma opción permite elegir un reemplazo cuando una rifa manual asignada fue cancelada. Una entrega que ya tiene un destino vigente no puede trasladarse arbitrariamente a otra.

Una baja de participación gratuita restituye el saldo para la misma rifa. Si se cancela la rifa de destino, los premios automáticos se restituyen y esperan la siguiente apertura como reemplazo; los manuales conservan el destino cancelado hasta que administración les asigne un reemplazo. No se genera una devolución de dinero por un canje gratuito. La cancelación de la rifa de origen o la baja de la compra ganadora sigue revocando los premios automáticos pendientes de uso.

## Interfaz y API

Mis números indica el origen del beneficio y **Válido sólo para [rifa]**. Un borrador muestra espera de activación; una rifa cerrada avisa que no pasa a otra. availableRaffles conserva compatibilidad con la selección y contiene como máximo una rifa elegible, coincidente con targetRaffle. Correos, condiciones y etiquetas de premios describen la siguiente rifa y el destino único.

- POST `/api/admin/users/:id/free-tickets`: quantity, targetRaffleId obligatorio, reason opcional, requestId UUID. El mismo requestId no permite cambiar de destinatario, cantidad, motivo o rifa ni generar una segunda acreditación.
- GET `/api/admin/users/:id/free-tickets`: consulta administrativa de los beneficios del titular para gestionar los pendientes.
- POST `/api/admin/users/:id/free-tickets/:benefitId/target`: targetRaffleId. Sólo asigna beneficios manuales con saldo y sin destino o con destino cancelado. Repetir la asignación al mismo destino no duplica saldo. Respeta titularidad, cuenta activa y permisos administrativos.
- GET `/api/free-tickets`: sólo los beneficios de la cuenta autenticada, con targetRaffle, origen y disponibilidad.
- POST `/api/orders/:id/free-tickets`: exige reserva propia, rifa asignada, ventas abiertas, números vigentes, identidad completa y saldo suficiente. Confirma por $0 en una transacción, con las protecciones existentes de concurrencia e idempotencia.

## Validación y ejecución

Pruebas cubren primera apertura, borrador creado previamente, rechazo en rifas anteriores y posteriores, canjes simultáneos, ausencia de traslado al dejar cerrar la siguiente, restitución, manuales para borrador/activa, permisos, destino obligatorio, destinos cerrados, reintentos y asignación de saldos anteriores sin duplicación ni modificación de canjes históricos. Se revisan cartera, selección y entrega manual a 390 y 320 px.

No se cambió .env, no se enviaron correos reales ni se otorgaron beneficios a cuentas reales para validar. No se ejecutó el backend real ni sus trabajadores. Sólo se inició PostgreSQL para esquemas aislados y un frontend temporal en loopback 5181 con API simulada para las pruebas de navegador; se cierran al terminar para respetar el estado apagado anterior. No hubo commit, push ni despliegue.

Resultado: 99 pruebas backend, 64 frontend, 111 PostgreSQL y 12 navegador correctas (286); ambos builds correctos. Cartera móvil con rifa borrador asignada inspeccionada a 320 px. La consulta agregada de datos reales no encontró beneficios pendientes sin destino, ni automáticos ni manuales.
