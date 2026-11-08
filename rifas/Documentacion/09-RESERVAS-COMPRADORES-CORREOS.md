# Reserva antes de ingresar, compradores y correo

Actualización: 07/11/2026. Continúan pendientes los datos bancarios y de Mercado Pago indicados en [continuidad](08-CONTINUIDAD.md); no se reemplazaron con datos ficticios.

## Recorrido del participante

1. El visitante selecciona hasta 20 números y toca Continuar. El servidor los aparta realmente durante **10 minutos**, antes de mostrar el ingreso o registro. Otro participante no puede reservarlos durante ese plazo.
2. Una cookie HTTP-only identifica la reserva del navegador; el servidor conserva únicamente su hash. La pantalla de acceso muestra números y tiempo restante. Cambiar entre ingreso y registro o recargar conserva la reserva. No depende de guardar números en localStorage.
3. Al autenticarse se asocia **la misma compra** a la cuenta, con cinco minutos para elegir el medio de pago. Reintentar la asociación no duplica la compra. Si venció, se informa y se permite volver a la rifa; no se promete disponibilidad indefinida.
4. Antes de pagar se requieren email, nombre, apellido y DNI de 7 u 8 dígitos. Las cuentas anteriores deben completar los campos faltantes. El domicilio sigue siendo opcional. Los datos se copian a la compra al iniciar el medio de pago, para conservar lo que se informó en esa operación aunque luego cambie el perfil.

Las reservas se crean con transacciones serializables y asignaciones únicas. Repetir la misma solicitud no extiende su vencimiento. Se limitan los intentos y la cantidad de números anónimos pendientes por conexión, además del límite de reservas pendientes de una cuenta. El vencimiento libera números mediante las consultas y el mantenimiento periódico existentes.

## Listado y Excel

En **Administración → Compradores**, seleccionar la rifa y pulsar **Descargar Excel**. Se muestran exclusivamente compras con estado `PAID`: Mercado Pago verificado, transferencia aprobada o conciliación administrativa de asignación. Las reservas, pagos pendientes, comprobantes sin aprobar y compras devueltas no cuentan como ventas.

El archivo es un `.xlsx` real y contiene **Email, Apellido, Nombre, DNI, Números comprados**. Agrupa compras de la misma cuenta cuando sus datos de comprador coinciden. Si los datos cambian entre operaciones conserva grupos separados. DNI y números se exportan como texto, conservando ceros iniciales; los valores no se convierten en fórmulas de Excel. Listas extensas se distribuyen en filas para evitar el límite de texto de una celda.

Las compras históricas sin una copia de identidad usan los datos disponibles del perfil y se señalan como incompletas cuando corresponde. No se inventa un apellido a partir del nombre completo ni un DNI. Las nuevas operaciones requieren los datos antes del pago. La descarga requiere rol administrador y queda registrada en auditoría; estos datos no se publican en la rifa.

## Confirmación por correo

La confirmación de pago crea un registro `PurchaseEmail` en la **misma transacción** que marca la compra pagada, tanto para Mercado Pago como para la aprobación manual de transferencia. El registro es único por compra y congela destinatario y resumen de compra. No se envía confirmación al reservar o simplemente subir un comprobante.

Un proceso del servidor revisa la cola al iniciar y cada 30 segundos. El correo incluye rifa, premio, números, total acreditado, referencia y enlace privado a la compra. No incluye el DNI. Las fallas del correo no deshacen el pago: se reintenta con demora creciente y queda `FAILED` tras ocho intentos. La toma de trabajo evita envíos paralelos normales y recupera trabajos interrumpidos. Un timeout después de que el proveedor haya aceptado el correo puede producir una repetición al reintentar; SMTP no permite garantizar entrega exactamente una vez. Se mantiene un Message-ID estable por compra.

**El envío real queda deshabilitado hasta configurar un servicio SMTP.** Los trabajos pendientes se conservan y se procesarán al habilitarlo; revisar la cola antes de activar el servicio. Las pruebas usan un emisor simulado y no envían correos reales. Una compra anterior a esta migración no genera correos retroactivos automáticamente.

Variables privadas del backend (también incluidas en `.env.example` y Compose):

| Variable | Configuración |
|---|---|
| `SMTP_ENABLED` | `false` inicialmente; activar explícitamente con `true` |
| `SMTP_HOST` | Servidor del proveedor |
| `SMTP_PORT` | Normalmente 587 con STARTTLS o 465 con TLS directo |
| `SMTP_SECURE` | `false` para STARTTLS, `true` para TLS directo, según proveedor |
| `SMTP_USER` / `SMTP_PASS` | Credenciales o contraseña de aplicación del proveedor |
| `SMTP_FROM` | Dirección remitente autorizada, sin nombre decorativo |
| `FRONTEND_URL` | URL pública de la aplicación, usada en el enlace de compra |

En producción se exige TLS en conexiones no directas. El dominio remitente debe estar autorizado por el proveedor; verificar una entrega a una cuenta de prueba al configurar el servicio. Las claves no van en el frontend, Git ni el chat. Referencia: [configuración SMTP de Nodemailer](https://nodemailer.com/smtp).

El administrador puede consultar estados en el listado de compradores y en `GET /api/admin/emails/status`. `POST /api/admin/emails/:id/retry` permite reactivar un trabajo `FAILED` después de corregir la configuración.

## Migración y validación

Aplicar `npm run db:migrate` antes de iniciar esta versión. La migración agrega identidad separada, reservas anónimas y cola de correo; no elimina las cuentas o compras existentes.

`npm test`, `npm run test:db -w backend`, `npm run build` y las pruebas Playwright cubren validación, reservas con competencia real, asociación tras ingreso/registro, identidad histórica, confirmaciones idempotentes, aprobación de transferencia, Excel restringido a administradores, concurrencia y fallas del emisor simulado. Las pruebas de base de datos utilizan un esquema aislado que se elimina al terminar.

Resultado local: **43 pruebas de backend, 26 de frontend, 31 de integración PostgreSQL y 11 de navegador correctas**, además de la compilación completa. Playwright verificó la portada y selección a 320/390/430 px, los dos recorridos de autenticación desde el teléfono y la descarga administrativa. Capturas: `playwright-artifacts/guest-hold-mobile.png`, `guest-login-mobile.png`, `guest-register-mobile.png` y `buyers-admin.png`.

Las cuatro migraciones están aplicadas en la base local. La versión compilada se reinició en `http://localhost:3011`; `/api/health` respondió `ok`. No se enviaron correos ni se realizaron cobros reales. `npm audit --omit=dev` no reportó vulnerabilidades en las dependencias instaladas de producción al verificar esta revisión.
