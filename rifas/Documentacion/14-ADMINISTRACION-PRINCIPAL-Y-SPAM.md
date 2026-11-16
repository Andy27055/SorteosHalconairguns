# Administración principal, funcional y avisos de spam

## Crear y eliminar cuentas (15/11/2026)

Desde **Administración → Participantes**, la cuenta principal de desarrollo tiene **CREAR CUENTA** y **ELIMINAR CUENTA**. Puede crear clientes o administradores funcionales, con nombre, apellido, usuario, correo, contraseña inicial de al menos diez caracteres y DNI opcional. El correo de verificación es opcional; permite al titular verificar su dirección y establecer su propia contraseña. La interfaz no ofrece crear otra cuenta principal. El alta y la eliminación quedan registradas en Actividad.

Para eliminar, se muestra una vista previa con los datos de la cuenta, cantidad de compras históricas, gestiones pendientes y números gratis sin usar. Se exige escribir exactamente `CONFIRMAR`. Sólo se elimina si no tiene reservas, pagos o revisiones pendientes, reembolsos pendientes, compras pagadas en rifas DRAFT/ACTIVE/CLOSING ni beneficios gratuitos no revocados con saldo. En esos casos el diálogo ofrece desactivar; si ya está desactivada, debe resolver los pendientes antes de eliminar. Desactivar conserva cuenta, compras y participaciones, e invalida sus sesiones.

Eliminar sí borra la cuenta y sus solicitudes de verificación. No borra órdenes, números, asignaciones, importes, comprobantes, correos históricos, resultados, beneficios consumidos/revocados ni usos de beneficios. Conserva las identidades registradas al comprar y completa las compras antiguas sin identidad con los datos disponibles del perfil. Desvincula las órdenes y beneficios históricos del acceso eliminado. Los compradores y Excel siguen mostrándolos; recrear el mismo correo o usuario no vincula la nueva cuenta con compras anteriores. Las acciones de un administrador eliminado conservan su nombre en la actividad. La cuenta principal no puede eliminarse ni desactivarse.

Se revalida todo al confirmar, en transacción serializable con reintentos, para proteger compras o premios que aparezcan después de la vista previa. La migración `202611150001_account_deletion_history` sólo permite que un beneficio histórico quede sin cuenta; mantiene su registro, origen y usos. Se aplicó localmente como migración número catorce. No se eliminó ni creó ninguna cuenta real para validar. Los funcionales conservan sus permisos anteriores, sin eliminación definitiva ni promoción a administradores.

La sesión local continúa en web 5173 / API 3011. El archivo .env mantiene su configuración; los envíos y tareas automáticas siguen pausados en el proceso actual. Marcar verificación al crear una cuenta deja una solicitud en cola mientras los trabajadores estén pausados.

Revisión del 12/11/2026. Estado posterior a la guía 13.

## Cuentas solicitadas

| Cuenta | Usuario | Tipo |
|---|---|---|
| halconairguns@gmail.com | halcon-dev | Principal / desarrollo |
| osvaljgomez@gmail.com | osvaldo-gomez | Funcional |
| jlgorosito43@gmail.com | jose-gorosito | Funcional |

Se reemplazó la identidad personal de Andy por la cuenta principal en el mismo registro, conservando su historial y contraseña. El correo y usuario anteriores ya no permiten ingresar; se verificó que devuelven 401. Se limpiaron los datos personales de perfil, se revocaron las sesiones y se invalidaron los enlaces de verificación anteriores. Las credenciales vigentes están únicamente en `backend/.admin-accounts.local.json`, ignorado por Git. Las contraseñas de José y Osvaldo se conservan.

La nueva dirección quedó sin verificar, con una solicitud pendiente. No se considera verificada por haber sido elegida como administradora. El comando `npm run mail:test -w backend` ahora apunta exclusivamente al correo de la cuenta principal y nunca al correo personal anterior. No se ejecutó ese comando ni se enviaron nuevos correos reales en esta revisión.

`provision-admins.ts` utiliza las tres identidades actuales y sus tipos; no vuelve a crear la cuenta personal. `replace-personal-admin.ts` documenta y permite repetir la sustitución sin borrar relaciones históricas.

La cuenta heredada de demostración `admin@halcon.local` conserva su historial y no fue eliminada en esta sustitución. La migración la clasifica como funcional, sin facultad para otorgar permisos administrativos. Revisar las cuentas de demostración antes del despliegue.

## Permisos

El rol de acceso sigue siendo USER o ADMIN. `User.adminType` distingue PRIMARY y FUNCTIONAL; los clientes tienen null. El registro público y los cambios de perfil no aceptan este campo.

- Ambos tipos de administrador gestionan rifas, premios, compradores, comprobantes, reembolsos y consultas privadas de perfiles e historial.
- Los funcionales pueden desactivar o reactivar clientes, pero no promoverlos a administradores ni modificar el acceso de otro administrador.
- Sólo el principal puede otorgar y retirar permisos funcionales o desactivar otro administrador funcional.
- La cuenta principal conserva su acceso: las rutas no permiten degradarla ni desactivarla.
- Existe un índice único parcial que permite un solo principal activo. El payload de cambio de permisos no permite crear otro principal.

Las restricciones se aplican en el backend dentro de las transacciones, además de los botones de la interfaz. Las respuestas de autenticación y perfiles incluyen adminType. El panel Participantes y el perfil administrativo muestran el tipo en lenguaje natural.

## Spam

El usuario confirmó que la prueba anterior llegó a spam. Se incorporó un aviso persistente para revisar spam o correo no deseado y marcar el mensaje como «No es spam»:

- Formulario de registro.
- Perfil con correo pendiente de verificar.
- Página de verificación cuando falta el enlace.
- Detalle de compras pagadas, en revisión, rechazadas o con devolución.

El aviso no afirma que un correo ya fue entregado ni garantiza que los siguientes lleguen a la bandeja principal.

## Estado local y validación

Octava migración aplicada: `202611120002_admin_types`. Builds de frontend y backend correctos. 57 pruebas de backend, 45 de frontend y 66 con PostgreSQL aislado correctas. Doce pruebas de Edge correctas, incluidas la visibilidad del aviso y la diferencia de controles entre principal y funcional.

Se verificaron los tres inicios de sesión reales sin mostrar contraseñas ni tokens. Se verificó la retirada del acceso personal anterior. No se enviaron mensajes ni se procesaron los ocho avisos antiguos de compras.

La aplicación local se reinició con `SMTP_ENABLED=false` sólo en el entorno del proceso para mantener pausados los envíos antiguos. El archivo `backend/.env` conserva SMTP configurado y habilitado. No iniciar un proceso general de correo sin revisar esos pendientes. Web: http://localhost:5173; API: http://localhost:3011.
