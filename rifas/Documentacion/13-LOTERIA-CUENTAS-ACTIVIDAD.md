# Cuentas, verificación de correo, Nocturna e historiales

Revisión del 12/11/2026. Sustituye las referencias anteriores a sorteos aleatorios y a numeración nueva desde 1.

## Cuentas solicitadas

Se crearon inicialmente como ADMIN las cuentas de Osvaldo, José y Andy. Posteriormente el usuario pidió reemplazar la cuenta personal por `halconairguns@gmail.com` como principal, con Osvaldo y José como funcionales. El estado vigente se documenta en [Administración principal y avisos](14-ADMINISTRACION-PRINCIPAL-Y-SPAM.md).

Las contraseñas vigentes están en `backend/.admin-accounts.local.json`, excluido de Git. Se generaron inicialmente al azar y luego se reemplazaron por las elegidas explícitamente por el usuario el 12/11/2026. Se verificó el acceso de las tres cuentas y se revocaron sus sesiones anteriores. No copiar ese archivo al repositorio ni al frontend. Se preservan las contraseñas de cuentas ya existentes si se vuelve a ejecutar `npm run admins:provision -w backend`.

Sólo Andy recibió la prueba real de confirmación de correo, aceptada por Gmail el 12/11/2026 a las 14:51 (Argentina). El usuario completó SMTP y se activó SMTP_ENABLED, quitando los espacios de separación de la contraseña de aplicación. La verificación del enlace queda pendiente de la acción del destinatario. La invitación permite confirmar el email y elegir una contraseña propia. No se trata de una integración de acceso con Google.

## Configurar Gmail para la prueba

Archivo local: `backend/.env`, líneas 28–34 al momento de esta revisión:

```dotenv
SMTP_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=cuenta_remitente@gmail.com
SMTP_PASS=contraseña_de_aplicación_sin_espacios
SMTP_FROM=cuenta_remitente@gmail.com
```

Usar la misma cuenta en SMTP_USER y SMTP_FROM. Activar la verificación en dos pasos en esa cuenta y generar una contraseña de aplicación en https://myaccount.google.com/apppasswords. No usar ni compartir la contraseña normal de Gmail. Instrucciones de Google: https://support.google.com/accounts/answer/185833?hl=es y parámetros SMTP: https://support.google.com/mail/answer/7104828.

Con el archivo guardado, ejecutar desde `rifas`:

```powershell
npm.cmd run mail:test -w backend
```

Ese comando verifica la conexión SMTP y procesa exclusivamente la confirmación para Andy. No envía correos a los otros dos administradores ni procesa los avisos de compras. Informa si SMTP aceptó el mensaje; no acredita que llegó a la bandeja de entrada. Revisar spam.

El enlace usa FRONTEND_URL (`backend/.env`, línea 3). Actualmente es `http://localhost:5173`: abrir el correo en esta computadora con la web local encendida. Antes de desplegar, reemplazarlo por el dominio HTTPS real. Reiniciar el servidor para que el trabajador automático de correo use la nueva configuración. Al activarlo también procesa las notificaciones de compras pendientes; revisar las compras de demostración antes de habilitarlo en producción.

La verificación requiere POST y confirmación explícita, no modifica la cuenta por visitar un GET. El token firmado vence en 24 horas, se consume una sola vez y se invalida si cambia el correo. Cambiar la contraseña mediante ese enlace revoca las sesiones existentes. Los tokens se derivan mediante HMAC del secreto del servidor; no se guardan enlaces ni tokens completos en la base. La cola reintenta fallos y evita solicitudes pendientes duplicadas.

## Finalizar rifa

Regla confirmada por el usuario: **Quiniela de la Provincia de Buenos Aires, Nocturna, primer premio a la cabeza; últimas dos cifras para 100 números**.

Fuente consultada directamente: https://loteria.gba.gob.ar/resultados. La página oficial indica Nocturna a las 21:00 y veinte números de cuatro cifras. Se lee HTML; no hay un contrato de API pública verificado. No se ejecuta código remoto. Si cambia el formato, falla la red, falta una posición o todavía aparecen guiones, el cierre no modifica la rifa.

El administrador define fecha y cifras antes de recibir reservas. Esos datos y la cantidad quedan bloqueados al existir historial de compras. La venta se cierra a la hora prevista o a las 21:00 de ese día en Argentina, lo que ocurra primero. Se permiten terminar las acreditaciones de reservas anteriores, pero el cierre exige resolver todos los pendientes.

`POST /api/admin/raffles/:id/finish` consulta el resultado, verifica su fecha argentina y toma las últimas cifras configuradas. Confirma exclusivamente una asignación con pago PAID. Guarda el número oficial completo, fecha, número de sorteo, momento de consulta, fragmento de la fuente y SHA-256. Ganador y correo se registran en una única transacción; dos cierres simultáneos no crean dos resultados.

Si el número no fue vendido, quedó impago o está fuera del rango, devuelve 409 y conserva la rifa activa, con las ventas ya cerradas por fecha. La regla de número no vendido sigue pendiente; no hay reemplazo ni sorteo alternativo.

**Límite actual:** la fuente diaria automática sólo se acepta cuando la fecha prevista coincide con el día actual en Argentina. Un cierre de una fecha pasada requiere una integración histórica verificable pendiente; nunca se sustituye por el resultado del día actual. No hay cierre automático por horario: el administrador usa Finalizar rifa.

El endpoint anterior `/draw` devuelve 410. No se usa aleatoriedad para elegir ganadores.

## Números y conservación del historial

Las nuevas rifas tienen `numberStart=0`, 100 números por defecto y cantidad editable de 1 a 10.000. Para 100 números la grilla es 00–99. Otras cantidades requieren seleccionar explícitamente las cifras correspondientes antes de activar, con espacio suficiente para cubrir el rango; no se calcula un módulo ni se elige otro número para forzar un ganador.

Las dos rifas de demostración existentes tienen compras. La migración conserva su numeración histórica desde 1: no se cambian tickets ya comprados, comprobantes ni correos. No aplicarles una conversión silenciosa de 100 a 00. Para probar la regla nueva completa, crear una rifa nueva con fecha y cifras definidas.

## Publicación y aviso al ganador

La portada muestra la última rifa finalizada con resultado oficial, número ganador, nombre con apellido abreviado, fecha de confirmación, fecha del resultado, primer premio y número de sorteo. No publica email, DNI, domicilio ni identificador de compra. La página de la rifa conserva el mismo resultado.

El enlace a la fuente diaria se entrega únicamente el día del resultado en Argentina; la interfaz también lo retira al cruzar medianoche si quedó abierta. El número y la fecha persisten. El correo del ganador se encola una sola vez (`RAFFLE_WINNER`), con resultado, premio y enlace privado a su compra; requiere SMTP habilitado para enviarse.

## Actividad y privacidad

- El panel Actividad muestra acciones realizadas como ADMIN, con nombre del administrador, descripción legible, contexto y fecha. Guarda el rol al producirse la acción, para que un cambio posterior de rol no reclasifique el historial.
- Mi perfil incluye el historial del titular: reservas, pagos, comprobantes, vencimientos, decisiones, devoluciones y cambios de cuenta disponibles en la auditoría.
- En Participantes, VER PERFIL E HISTORIAL permite a un administrador consultar los datos y movimientos del usuario seleccionado.
- `GET /api/profile/activity` exige sesión y devuelve exclusivamente el historial del titular. No recibe un userId libre.
- `GET /api/admin/users/:id/activity` exige ADMIN. Otro participante recibe 403.
- `GET /api/admin/audit?page=1` ahora devuelve `{items,page,total}`, con 50 elementos por página. Nunca entrega los detalles JSON crudos de auditoría al cliente.

## Validación

Build de ambos paquetes correcto; 57 pruebas de backend, 45 de frontend y 62 con PostgreSQL en esquemas aislados correctas. Once pruebas de Edge cubren anuncio e historial a 1280/320 px, numeración, nuevo cierre, verificación explícita y regresiones de aprobación, rechazo y reembolso. Las suites usan correo simulado. Posteriormente se verificó SMTP real y Gmail aceptó una confirmación exclusivamente para Andy; estado SENT, pendiente de confirmar la recepción y usar el enlace. Consulta real oficial del 12/11 realizada antes de la Nocturna: se comprobó que devuelve pendiente, sin cerrar ninguna rifa real.

Migración `202611120001_lottery_identity_activity` aplicada: siete migraciones en total. No hubo despliegue, cobros ni reembolsos reales. No se reinició el proceso local para activar el envío general después de configurar SMTP: quedan ocho avisos antiguos de compras pendientes, seis vinculados a demostraciones. Revisarlos antes de reiniciar el trabajador automático; la prueba sólo procesó la verificación de Andy. Web y API locales verificadas disponibles.
