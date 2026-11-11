# Pagos y preparación del despliegue — 08/11/2026

## Transferencias habilitadas localmente

Se configuraron los datos entregados por el usuario en `.env` y `backend/.env`, que están excluidos de Git:

| Cuenta | Alias | Titular informado |
|---|---|---|
| Principal | `Jose.halcon` | Jose Luis Gorosito |
| Alternativa | `Osvaldo.halcon` | Osvaldo Javier Gomez |

Estos datos se muestran para recibir transferencias; su titularidad no fue consultada en una entidad bancaria. El participante debe cotejar el titular que muestre su banco antes de confirmar.

El cliente reserva, completa nombre, apellido, email y DNI, elige una cuenta y pulsa **Elegir transferencia**. La compra guarda una copia del destino elegido. Tiene 24 horas para adjuntar PDF, JPG o PNG de hasta 5 MB desde la misma pantalla. Queda **En revisión** y el administrador verifica la acreditación en la cuenta indicada antes de aprobar. Aprobar incorpora los números al listado de compradores y genera la confirmación por correo. El archivo es privado y se elimina a los tres meses calendario; se conservan compra y decisión.

`POST /api/orders/:id/transfer` recibe `{ "accountId": "primary" }` o `{ "accountId": "secondary" }`. Sin body conserva compatibilidad con el cliente anterior y usa la primera cuenta habilitada. Reintentar no cambia el destino ni renueva el plazo; intentar elegir otra cuenta para una compra ya iniciada devuelve conflicto. No se reparte una compra entre ambas cuentas.

La migración `202611080001_transfer_accounts` agrega los campos de destino a la compra. Las cinco migraciones están aplicadas en la base local. Compras anteriores sin destino guardado muestran la cuenta principal configurada; para esas operaciones revisar el comprobante y confirmar dónde se recibió el dinero.

## Mercado Pago: qué está implementado y qué falta

La API usa **Checkout Pro vía Preferences API**. El backend crea el enlace con los números, importe histórico y referencia de compra. Al recibir el Webhook valida la firma y consulta el pago directamente al proveedor. Sólo confirma coincidencia de referencia, ARS, importe y entorno; no acepta como prueba los parámetros con los que vuelve el navegador. Reutiliza enlaces existentes, registra conflictos y permite consultar el pago desde la compra o administración. Una falla del correo no deshace el pago.

**Un alias no es una credencial de API.** Para activar este checkout se requiere el Access Token de una aplicación de la cuenta vendedora, la firma secreta de Webhooks y una URL pública HTTPS. La cuenta asociada al token recibe los cobros de Mercado Pago; elegir uno de los alias bancarios no cambia esa cuenta. Cobrar por API para dos vendedores requeriría otra configuración o un flujo de autorización de vendedores, fuera de la elección de transferencia incorporada aquí.

No se generaron credenciales ni se hicieron cobros reales. El medio sigue deshabilitado mientras falte su configuración. Referencias oficiales: [Preferences API](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/create-payment-preference), [credenciales](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-content/credentials), [Webhooks](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-content/notifications/webhooks).

## Pasos para activar Mercado Pago

1. El titular de la cuenta que cobrará ingresa en Mercado Pago Developers → **Tus integraciones**, crea o selecciona una aplicación y elige Checkout Pro. Este proyecto usa la variante **Preferences API**; no mezclar sus eventos con los de Orders API. [Crear aplicación](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/create-application).
2. Seleccionar el entorno **Prueba** y copiar el **Access Token de prueba**. No deducir el entorno sólo por el prefijo: los tokens de prueba de aplicaciones nuevas también pueden empezar con `APP_USR`. Usar el selector de la plataforma. El token se carga exclusivamente en el backend. Este flujo abre un enlace externo y no requiere agregar Public Key al frontend.
3. Disponer de un sitio de prueba público HTTPS que pueda recibir notificaciones. `localhost` no es accesible desde Mercado Pago. Puede ser el servicio de staging del hosting antes de conectar el dominio definitivo.
4. En Webhooks de la aplicación, configurar la URL `https://TU-SITIO/api/payments/webhook`, seleccionar **Pagos / payment** y guardar. Copiar la **firma secreta** generada para esa aplicación y el entorno correspondiente. El endpoint comprueba `x-signature`, `x-request-id` y `data.id`.
5. Completar las cinco variables de la tabla siguiente en `backend/.env` para ejecución local. En hosting se cargan en **Environment / Secrets**; no subir `.env` al repositorio. En Docker Compose local los valores se toman del `.env` de la raíz de `rifas`.
6. Reiniciar la API. Reservar números con una cuenta de cliente y abrir **Ir a pagar**. Probar aprobado, rechazado y pendiente con las herramientas oficiales de prueba. Cotejar la compra, el registro de Webhooks y los números asignados. [Pruebas de Preferences](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases).
7. Con la cuenta habilitada para cobrar la actividad del sitio y las pruebas completas, cargar el **Access Token de producción**, configurar el Webhook de producción, pasar `MP_SANDBOX=false` y usar la URL definitiva. Reiniciar y verificar el circuito de acreditación. No hace falta cambiar el código de los endpoints.

Ubicaciones en el archivo local actual (las líneas pueden moverse al editarlo):

| Variable | Línea en `backend/.env` | Valor requerido |
|---|---:|---|
| `FRONTEND_URL` | 3 | `https://TU-SITIO`, sin barra final |
| `PUBLIC_API_URL` | 4 | `https://TU-SITIO`, sin `/api` ni barra final |
| `MP_ACCESS_TOKEN` | 8 | Token privado del entorno elegido |
| `MP_WEBHOOK_SECRET` | 9 | Firma secreta de Webhooks |
| `MP_SANDBOX` | 10 | `true` para prueba; `false` para producción |

Los alias y titulares están en líneas 12/13 y 24/25 del entorno local. Los ejemplos versionados para una instalación nueva están en `backend/.env.example`; allí la segunda cuenta está en líneas 16/17. Las credenciales privadas no deben compartirse por el chat.

Ubicación del código para revisión:

| Archivo | Punto de entrada |
|---|---|
| `backend/src/config.ts:16` | Lectura del Access Token y configuración del proveedor |
| `backend/src/services/payments.ts:47` | Generación/reutilización del enlace |
| `backend/src/services/payments.ts:80` | Validación y aplicación del pago a la compra |
| `backend/src/routes.ts:111` | `POST /api/orders/:id/checkout` |
| `backend/src/routes.ts:138` | `POST /api/payments/webhook` |
| `backend/src/services/receipts.ts:24` | Carga privada de comprobantes |
| `backend/src/services/receipts.ts:59` | Eliminación de archivos vencidos |

## Servicios recomendados para este proyecto

La aplicación ya usa PostgreSQL y Prisma. Conviene conservar PostgreSQL para las reservas transaccionales, las restricciones que evitan vender un número dos veces y el historial de pagos.

| Servicio | Cuándo lo elegiría | Consideración para este proyecto |
|---|---|---|
| **Render Postgres** | Primera opción si también se aloja la aplicación en Render | Una sola plataforma para aplicación y DB; elegir una instancia paga y configurar recuperación/backups. [Documentación](https://render.com/docs/postgresql). |
| **Neon** | Alternativa para separar la DB del hosting y ajustar gasto al uso | PostgreSQL administrado con plan gratuito para probar y planes por consumo. Configurar la URL de conexión con SSL y revisar límites/recuperación según plan. [Planes y precios](https://neon.com/pricing). |
| **Supabase** | Si más adelante se quiere incorporar almacenamiento de objetos u otros servicios | PostgreSQL administrado; Pro desde USD 25/mes según tarifa consultada. Este código conserva su autenticación propia y sus archivos locales: adoptar Supabase Storage requeriría un adaptador, no sólo cambiar `DATABASE_URL`. [Precios](https://supabase.com/pricing). |

Mi recomendación inicial es **un servicio web pago de Render que sirva frontend y API, más Render Postgres y un disco persistente privado para comprobantes**. Es una elección por compatibilidad con el código actual y el despliegue Docker ya preparado, no una medición comparativa de rendimiento. Neon es una buena alternativa para la DB si se prefiere su modelo de consumo.

El directorio de comprobantes **debe persistir entre despliegues**. Montar el disco en `/app/data` y definir `RECEIPT_STORAGE_PATH=/app/data/receipts`. El disco se contrata aparte del cómputo; su tamaño y la DB dependen del volumen de uso. El servicio web gratuito de Render usa disco efímero y se suspende por inactividad; no sirve para conservar estos archivos ni ejecutar continuamente las tareas de mantenimiento. [Discos](https://render.com/docs/disks), [límites del plan gratuito](https://render.com/docs/free).

## Dominio

- **NIC Argentina** para un `.com.ar`: apropiado para una marca que opera en Argentina. Buscar, por ejemplo, `halconairguns.com.ar` o `rifashalcon.com.ar`; son propuestas de nombre, **no se verificó su disponibilidad**. Registrar a nombre del titular del proyecto. [Registro oficial](https://nic.ar/es/ayuda/instructivos/registro-de-dominio).
- **Cloudflare Registrar** para un `.com`: registro y renovación al costo de registro, sin margen del registrador. Puede administrar DNS; revisar el precio de renovación del dominio elegido. [Servicio oficial](https://developers.cloudflare.com/registrar/).
- Conectar el dominio al servicio web; Render proporciona y renueva el certificado TLS. Después actualizar las dos URLs de la aplicación y el Webhook de Mercado Pago. [Dominios y HTTPS en Render](https://render.com/docs/custom-domains).

## Orden del primer despliegue

1. Crear PostgreSQL de producción y configurar su `DATABASE_URL`; mantener las pruebas separadas de esa base.
2. Crear el servicio Docker desde `backend/Dockerfile.prod`, con contexto de build en la carpeta `rifas` que contiene los dos workspaces. Configurar `NODE_ENV=production`, `JWT_SECRET` aleatorio, URLs HTTPS y el disco privado persistente.
3. Cargar ambos titulares y alias mediante las variables `TRANSFER_*`; el entorno local no se transfiere al hosting. Cargar las credenciales de Mercado Pago cuando estén disponibles. Mantener `SMTP_ENABLED=false` hasta configurar el remitente.
4. Ejecutar las migraciones (el contenedor lo hace al iniciar). Crear la cuenta administradora mediante el seed controlado, sin dejar su contraseña en el entorno permanente. No recrear datos demo en producción.
5. Confirmar `/api/health`, acceso de administrador/cliente, selección de cuentas, carga y descarga privada de comprobantes y persistencia al reiniciar. Verificar también una restauración de la DB y la limpieza tras restaurar archivos.
6. Completar las pruebas del proveedor y conectar el dominio. Los costos dependen del plan, disco, DB y consumo; revisar la tarifa de cada servicio antes de contratar. No se contrataron ni publicaron servicios durante esta revisión.

## Validación de esta revisión

Compilación de ambos workspaces correcta. Pasaron 43 pruebas de backend, 28 de frontend, 34 de integración PostgreSQL y 13 de navegador (**118 en total**). Las pruebas incluyen elección de la segunda cuenta, destino histórico tras cambiar configuración, rechazo de cambio de cuenta después de iniciar, carga privada y revisión de PDF, importes/entornos inválidos de Mercado Pago y protección de una compra acreditada frente a otro intento rechazado. Se verificaron teléfonos de 320 y 390 px, sin desbordamiento horizontal. Los pagos y correos de las pruebas son simulados.

Las cinco migraciones están aplicadas; la aplicación compilada se inició en `http://localhost:3011`. La configuración pública local devuelve las dos cuentas y transferencia habilitada. Mercado Pago continúa deshabilitado hasta configurar credenciales válidas y probar la cuenta vendedora. El servidor de desarrollo usado por Playwright se detuvo al terminar.
