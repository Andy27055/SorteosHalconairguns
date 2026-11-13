# Demostración temporal desde la PC

Preparada el 12/11/2026 por elección del usuario. No se migró la base a Neon ni se desplegó en Render. Se conserva PostgreSQL local, las cuentas actuales, los comprobantes privados y el SMTP ya configurado.

## Abrir desde los teléfonos

Usar la dirección que muestra `npm.cmd run demo` o consultar `.demo/session.json`. El hostname cambia en cada inicio.

1. Abrir el enlace HTTPS desde el navegador del teléfono, con Wi-Fi o datos móviles.
2. La página abre directamente: no pide código de Cloudflare ni clave de demostración, por solicitud expresa del usuario.
3. Para administrar se inicia sesión con la cuenta existente de Halcón, Osvaldo o José. Los campos de contraseña incluyen un botón para mostrar u ocultar lo escrito.
4. Se pueden explicar selección, reserva, transferencia, comprobantes, revisión y Excel con los flujos existentes. Las acciones realizadas se guardan en la base local y las notificaciones normales usan el SMTP real. No es una base descartable: identificar claramente las compras de demostración y usar comprobantes ficticios cuando corresponda.

Los correos del sitio pueden llegar a spam. Cloudflare sólo proporciona el túnel HTTPS y no solicita autenticación adicional. Quien conozca el enlace puede ver el catálogo público; el acceso a datos personales y administración sigue sujeto a las cuentas y permisos de la aplicación.

Inicialmente se utilizó protección por correo de Cloudflare. Tras reportarse un rechazo no JSON al iniciar sesión, se encontró un [reporte abierto compatible con el síntoma](https://github.com/cloudflare/cloudflared/issues/1752): las sesiones protegidas de Quick Tunnels pueden vencer pocos segundos después del PIN. No se pudo medir la sesión exacta del teléfono del usuario. Primero se reemplazó por una puerta propia de demostración; posteriormente el usuario pidió explícitamente quitar también ese paso y utilizar únicamente el acceso normal del sitio. La revisión automática aceptó el cambio después de revisar la petición y las protecciones existentes de datos y administración.

El modo con clave queda disponible sólo como opción mediante `DEMO_REQUIRE_CODE=true` al iniciar el comando. En ese modo genera 144 bits aleatorios en `.demo/acceso.txt`, cookie Secure/HttpOnly de cuatro horas y límite de intentos. En el modo predeterminado actual no se genera archivo de clave y `DEMO_ACCESS_CODE` se pasa vacío al proceso, sin modificar `.env`. La autenticación, los roles, la propiedad de compras y los archivos privados se verifican en ambos modos.

## Iniciar de nuevo

Desde `rifas`, con Docker Desktop abierto:

```powershell
docker compose -p halcon-airguns up -d db
npm.cmd run demo
```

El comando compila frontend y backend, crea el túnel y sirve el build de React y la API juntos en `127.0.0.1:3012`, con el acceso normal de la aplicación. No publica Vite ni el puerto de PostgreSQL y no requiere abrir puertos del router.

`scripts/demo.mjs` usa `cloudflared` descargado en `.demo/cloudflared.exe`. La versión instalada es 2026.11.0, obtenida desde la publicación oficial de Cloudflare y verificada contra su SHA-256 publicado. `.demo` se excluye de Git y de Docker; sus registros y el archivo de sesión no deben publicarse. Para otra instalación, obtener `cloudflared` desde [las descargas oficiales](https://developers.cloudflare.com/tunnel/downloads/) y colocarlo en esa ruta, o definir `CLOUDFLARED_PATH`.

Si el puerto está ocupado, cerrar la otra demo antes de reiniciar; no ejecutar dos servidores de demostración sobre la misma base simultáneamente. `DEMO_PORT` permite elegir otro puerto si es necesario.

## Configuración durante la demo

- No se modifica `backend/.env` ni el `.env` principal. Los valores de la demo se pasan sólo al proceso del servidor.
- HTTPS externo, cookies Secure y las URLs de CORS/correos corresponden al hostname temporal. Se genera un secreto de sesión nuevo para la demo; al reiniciar, se vuelve a iniciar sesión.
- La aplicación conserva su autenticación y permisos; sólo si se inicia con `DEMO_REQUIRE_CODE=true` se genera y habilita una clave adicional mediante `DEMO_ACCESS_CODE` en ese proceso.
- Mercado Pago queda deshabilitado en el proceso de demostración. Todavía faltan sus credenciales; las transferencias siguen disponibles.
- El servidor habitual conserva su comportamiento de escucha. El nuevo `HOST` permite limitar exclusivamente la demo a `127.0.0.1`; su valor predeterminado es `0.0.0.0`, apropiado para Render.
- Los enlaces de correo generados durante la demo dependen del túnel y dejan de ser accesibles cuando se cierre. Los enlaces posteriores a un nuevo inicio usan la nueva dirección.

## Cerrar

En la terminal de la demo, pulsar Ctrl+C: el iniciador detiene su servidor y cloudflared, y elimina los archivos de sesión y clave. El enlace deja de funcionar. Después, si ya no se usará el proyecto:

```powershell
docker compose -p halcon-airguns stop db
```

La PC, Docker y el iniciador deben permanecer encendidos para que puedan entrar desde los teléfonos. Si Windows entra en suspensión o se corta Internet, se pierde el acceso temporal.

## Alcance y siguiente despliegue

Quick Tunnels está orientado a pruebas, no ofrece garantía de disponibilidad y limita a 200 solicitudes en curso. Esta demostración no acredita la capacidad del futuro alojamiento para los 809 miembros del grupo. [Referencia oficial de Cloudflare](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

Comprar un dominio permite usar una dirección propia, pero sigue haciendo falta el alojamiento de la aplicación. Render proporciona una dirección `onrender.com` y permite agregar luego el dominio comprado. [Dominios en Render](https://render.com/docs/custom-domains).

Para conservar el flujo actual en Render se necesita contemplar persistencia de comprobantes y correo: el servicio gratuito pierde archivos locales al reiniciar y bloquea los puertos SMTP 465/587; un disco persistente se adjunta a un servicio de pago. No se contrató ningún plan. [Límites del servicio gratuito](https://render.com/docs/free), [discos persistentes](https://render.com/docs/disks).

Para migrar a Neon más adelante, primero respaldar PostgreSQL y los archivos privados, crear un destino separado, restaurar y comprobar compras, migraciones y archivos. Configurar después el servicio, las URLs y el correo del entorno. Los conectores Neon y Render se descubrieron como disponibles, pero no se confirmó su conexión en esta sesión.

## Validación realizada

Ambos builds correctos; 75 pruebas de backend y 49 de frontend correctas. Se verifica la puerta privada, el bloqueo de rutas de página/archivo/API, la clave incorrecta, la firma de cookie y el límite de intentos. Los botones de contraseña conservan el valor y no envían el formulario. Los rechazos del túnel en texto o HTML nunca se interpretan como un inicio de sesión válido y muestran un mensaje específico.

Se agregó una prueba real optativa de navegador contra el enlace HTTPS de la demo (`DEMO_SMOKE=1`, `e2e/demo-access.spec.ts`): acceso directo o con clave según el modo de sesión, bloqueo anónimo de perfiles/compras/administración/comprobantes, inicio de sesión, panel administrativo, recarga y cookies Secure/HttpOnly en anchos de 390 y 320 píxeles. No crea compras ni envía correos; los ingresos generan el registro normal de actividad de la cuenta del desarrollador.
