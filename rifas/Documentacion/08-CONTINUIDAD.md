# Continuidad — 07/11/2026

## Decisiones del usuario

- La primera pantalla del cliente debe mostrar el panel de rifas. Habitualmente habrá una sola rifa activa; conservar el soporte de varias.
- Mantener la estética negra y dorada y el logo actual. Priorizar teléfonos, botones cómodos y acceso directo a la reserva.
- Después de la portada, avanzar en comprobantes y enlaces de pago.
- Apartar números mientras un visitante ingresa o crea una cuenta, y continuar con la misma compra. Listado de compradores por rifa con Excel sólo para administradores y confirmación por correo tras el pago: ver [implementación y configuración](09-RESERVAS-COMPRADORES-CORREOS.md).
- **Actualización 08/11:** el usuario entregó los alias y titulares de dos cuentas; ya están configurados localmente. Las credenciales de Mercado Pago siguen pendientes. No inventar credenciales ni habilitar el proveedor con valores ficticios.

## Implementación de esta revisión

- Portada con catálogo primero y tarjeta destacada cuando hay una sola activa; resultados anteriores desplegables.
- Números con áreas de toque mayores y barra inferior de selección/continuación en el teléfono.
- Comprobante con selección de foto/PDF, acceso a cámara, vista previa, reemplazo y validación de formato/tamaño antes de subir.
- Datos de transferencia y enlace ya generado con botón para copiar. Los enlaces se validan antes de abrirse.
- Los medios de pago conservan su habilitación por configuración; el backend mantiene las comprobaciones y revisión manual existentes.

## Próximo paso cuando lleguen los datos

Los titulares y alias principal y alternativo ya se cargaron en `backend/.env` y `.env` el 08/11. Para despliegue deben cargarse otra vez como variables del hosting; no se suben los archivos privados. Para Mercado Pago: `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, entorno y URL pública HTTPS; verificar la cuenta con una compra sandbox y su Webhook. La configuración privada no va en `frontend/.env` ni en Git.

La carpeta actual es `Halcon airguns rifas/rifas`; la ubicación anterior con `Codigos/rifas` ya no existe.

## Cierre de sesión de trabajo — 07/11/2026

El usuario pidió guardar y apagar los servicios para continuar mañana. El código y la documentación quedaron guardados localmente, sin publicar cambios. La última revisión agrega reserva anónima de diez minutos con continuidad tras ingreso/registro, identidad del comprador, listado por rifa, descarga Excel y cola de confirmaciones por correo. Detalles y configuración en [la revisión de compras](09-RESERVAS-COMPRADORES-CORREOS.md).

Verificación final de esa revisión: compilación correcta y 111 pruebas aprobadas (43 backend, 26 frontend, 31 PostgreSQL y 11 navegador). Las cuatro migraciones están aplicadas. El envío SMTP sigue deshabilitado hasta configurar el remitente; también siguen pendientes los datos de transferencia y de Mercado Pago.

Para retomar desde esta carpeta, iniciar Docker Desktop si está cerrado, ejecutar `docker compose -p halcon-airguns up -d db` y luego `npm start`. La aplicación compilada se sirve en `http://localhost:3011`. No hace falta volver a crear usuarios ni ejecutar el seed. Los datos de PostgreSQL se conservan en su volumen.

## Validación de esta revisión

- Builds de frontend y backend correctos.
- 24 pruebas de frontend y 38 de backend sin base de datos, correctas.
- 8 pruebas de navegador con respuestas de API controladas: portada en escritorio, teléfonos de 320/390/430 px, áreas de toque de al menos 44 px, varias rifas y resultados, envío de comprobante, recuperación ante error del proveedor y retorno al catálogo después del login.
- Capturas en `playwright-artifacts/catalog-desktop.png`, `catalog-mobile.png` y `receipt-mobile.png`.
- No se hicieron cobros, no se habilitaron medios con datos ficticios en la configuración real y no se modificó el historial de compras. Las pruebas de integración PostgreSQL existentes no se repitieron en esta revisión de la interfaz.

## Revisión de pagos — 08/11/2026

Se habilitó la transferencia con elección de dos cuentas y carga de comprobante privado, conservando el destino de cada compra. Se aplicó la quinta migración. La guía [10-PAGOS-Y-DESPLIEGUE](10-PAGOS-Y-DESPLIEGUE.md) contiene los pasos de Mercado Pago, líneas del entorno local y recomendaciones de PostgreSQL, hosting, almacenamiento y dominio. Mercado Pago no se activa sólo con alias; SMTP continúa pendiente de configuración.

## Revisión de comprobantes y accesos — 08/11/2026

El administrador puede abrir un comprobante en un pop-up, revisar imágenes o PDFs, descargar desde la ventana y aprobar/rechazar con una observación. El cliente también puede abrir su archivo. Se agregaron iconos contiguos de YouTube y tienda oficial en la cabecera. Ver [visor y validación](11-VISOR-COMPROBANTES.md). PDF.js requiere Node 22.13 o posterior; el build incluye los recursos del visor para servirlos localmente.

## Bajas y notificaciones — 08/11/2026

El usuario confirmó que se agrega al comprador al aprobar el pago. Se incorporaron la baja desde Compradores con datos completos y palabra CONFIRMAR, liberación de números antes del sorteo, reembolso pendiente y registro posterior de devolución realizada. El rechazo incluye tres mensajes rápidos editables y correo con el motivo. La cola ahora distingue aprobación, rechazo, baja/reembolso en gestión y devolución completada; SMTP sigue pendiente de configuración. Sexta migración aplicada; ver [flujo y límites](12-BAJAS-RECHAZOS-REEMBOLSOS.md).

Corrección posterior del usuario: la observación debe ser opcional para aprobar un comprobante y obligatoria únicamente para rechazar. La interfaz, la API y el servicio de revisión aplican esta regla; el rechazo conserva el mínimo de cinco caracteres.

## Historial: finalización por lotería — pausa del usuario, 08/11/2026 (retomada el 12/11)

El usuario pidió esperar hasta obtener la información faltante y apagar los servicios. Esta pausa terminó el 12/11, al confirmar Provincia, Nocturna, primer premio y últimas dos cifras. El siguiente registro describe el estado histórico anterior; ver la revisión actual al final.

Decisiones ya indicadas para cuando se retome:

- Reemplazar el sorteo aleatorio por **Finalizar rifa**, consultando un resultado oficial de lotería, identificando al comprador ganador y guardando evidencia del resultado.
- **100 números como valor predeterminado, siempre editable** para permitir rifas de más o menos números. No fijar la cantidad en 100.
- En las rifas de 100 números, mostrar **00 a 99**. Revisar y acordar el tratamiento de números ya reservados/comprados antes de migrar; no renumerar silenciosamente operaciones existentes.
- El usuario no tiene definida la regla si el número ganador no fue vendido. Esa decisión queda pendiente; no elegir otro ganador ni inventar una regla.
- Falta confirmar juego/jurisdicción, turno y premio de referencia. No se confirmó que sea Quiniela de la Ciudad, Nocturna, primer premio; fue una pregunta, no una decisión del usuario. También debe quedar explícita la fecha de referencia y el tratamiento de otras cantidades de números.

La investigación preliminar encontró resultados en el sitio oficial de LOTBA: `https://quiniela.loteriadelaciudad.gob.ar/?page=home`. Su página carga `includes/resultados-data.php?sorteo=NUMERO`, con fecha, modalidad, jurisdicciones, posiciones y enlaces al extracto. Se verificó el formato mediante lectura, sin ejecutar el código remoto ni finalizar rifas. Es una fuente del sitio web, no se verificó un contrato de API pública estable. Revisar la fuente que corresponda cuando el usuario confirme el juego.

El trabajo anterior quedó guardado localmente: pagos, comprobantes, compradores, bajas, avisos y aprobación con observación opcional. La base tiene seis migraciones aplicadas; SMTP y credenciales de Mercado Pago continúan pendientes. Para retomar la aplicación: iniciar Docker Desktop, ejecutar `docker compose -p halcon-airguns up -d db` y luego `npm start` desde `Halcon airguns rifas/rifas`; URL local `http://localhost:3011`.


## Reanudación del 12/11/2026

Se crearon las tres cuentas ADMIN solicitadas. Credenciales nuevas en backend/.admin-accounts.local.json (ignorado). Sólo Andy tiene confirmación de correo preparada: SMTP aún sin usuario, clave ni remitente. El usuario pidió configurarlo ahora y recibió instrucciones para backend/.env, líneas 28–34; no imprimir secretos. Comando de prueba exclusivo para Andy: npm.cmd run mail:test -w backend.

Se reemplazó el sorteo aleatorio por Finalizar rifa, con Provincia Nocturna a la cabeza, fecha verificada, evidencia y correo al ganador en cola. Portada con último ganador y enlace diario que desaparece a medianoche argentina. Las nuevas rifas parten de 00; la cantidad sigue editable. Las dos rifas anteriores conservan su numeración por tener compras. Cierre de fechas pasadas y política de número no vendido quedan pendientes, sin elegir otro ganador.

Actividad administrativa con texto legible y rol al momento del evento; historial privado en perfil propio y consulta administrativa desde Participantes. Migración 7 aplicada. Ver [guía actual, pruebas y límites](13-LOTERIA-CUENTAS-ACTIVIDAD.md).

La app local se ejecuta con npm.cmd run dev (web http://localhost:5173 y API http://localhost:3011); Docker DB activo. Configuración SMTP pendiente de respuesta del usuario; Mercado Pago continúa sin credenciales. Sin despliegue ni correos reales enviados durante esta revisión.


### SMTP configurado y prueba real aceptada (12/11/2026, 14:51 Argentina)

El usuario completó backend/.env. Se habilitó SMTP_ENABLED y se quitaron los espacios de separación de la clave de aplicación de Gmail. No imprimir secretos. El comando mail:test autenticó SMTP y envió exclusivamente la confirmación a Andy; Gmail aceptó el mensaje y el registro quedó SENT. El destinatario aún debe abrir y confirmar el enlace; no marcar emailVerifiedAt manualmente. Web localhost:5173 y API localhost:3011 disponibles.

No se reinició el proceso general de correos: conserva su configuración anterior deshabilitada. Hay 8 avisos antiguos de compras pendientes, 6 vinculados a demostraciones. No enviarlos como parte de otra prueba de verificación. Revisar su destino antes de activar el trabajador general. El archivo de entorno ya tiene SMTP habilitado para próximos reinicios.


### Cuenta principal y avisos de spam (12/11/2026)

Se reemplazó la identidad personal por halconairguns@gmail.com, usuario halcon-dev, tipo PRIMARY. Se conservó su contraseña elegida por el usuario (archivo privado local), se revocaron sesiones y enlaces viejos y se retiró el correo/usuario personal anterior como acceso. No recrear la cuenta personal. Osvaldo y José son FUNCTIONAL con sus contraseñas conservadas. Sólo PRIMARY gestiona permisos de administradores. Se encoló verificación para la nueva dirección; no se envió otro correo en esta revisión. mail:test ya apunta al correo principal.

Aviso de spam incorporado en registro, perfil, verificación sin enlace y estados de compra con avisos por correo. Migración 8 aplicada. Builds correctos, 57 pruebas de backend, 45 de frontend, 66 con PostgreSQL y 12 de navegador correctas.

Aplicación local iniciada con SMTP_ENABLED=false sólo en el proceso para no disparar los 8 avisos antiguos; backend/.env mantiene SMTP configurado y habilitado. La cuenta de demostración heredada admin@halcon.local conserva sus compras y quedó funcional. Ver [estado actual y permisos](14-ADMINISTRACION-PRINCIPAL-Y-SPAM.md).


### Cancelaciones y cierres automáticos (12/11/2026)

Todos los administradores pueden solicitar cierre y eliminar/cancelar rifas en cualquier estado comercial. Eliminar usa cancelación lógica, motivo opcional, Excel antes de confirmar, copia privada del listado y devoluciones pendientes para compras pagadas. Aviso de cancelación por correo sin duplicar destinatarios. La copia de compradores se omite en endpoints públicos y también en compras del titular.

Cierre anticipado fija la Nocturna del día y avisa a compradores; el cierre con fecha prevista lo solicita una tarea cada minuto y al iniciar. Resultado pendiente usa CLOSING, no vende más y espera publicación/revisión. Se agregó recuperación histórica oficial por fecha con PDF.js y caché durable LotteryDraw. Ganador y todos los admins reciben avisos al confirmarse. No se define regla alternativa para número no vendido.

Migración 9 aplicada. Builds y pruebas correctos: 63 backend, 45 frontend, 82 PostgreSQL, 17 navegador. Ver [guía vigente](15-CANCELACION-Y-CIERRE-AUTOMATICO.md).

Importante para continuidad: ahora SMTP está habilitado en el proceso local, además del archivo .env. Los 8 avisos antiguos de pruebas se revisaron y marcaron SKIPPED (LEGACY_DEMO_NOTIFICATION); sus datos siguen guardados. Se preservó el aviso nuevo a la cuenta principal y Gmail aceptó su confirmación de compra y verificación. No volver a encolar los avisos antiguos. npm run dev activo en web 5173 / API 3011. La rifa vieja de 1.000 números pasó a CLOSING por fecha vencida y queda pendiente de regla de cifras; no tiene ganador.


### Cierre de sesión solicitado por el usuario (12/11/2026)

Todos los cambios quedaron guardados en disco; no se realizó commit, push ni despliegue. Se detuvo npm run dev (web y API) y se detuvieron los contenedores del proyecto halcon-airguns, conservando la base de datos y los volúmenes.

Para retomar: iniciar Docker Desktop si hace falta, ejecutar docker compose -p halcon-airguns up -d db y npm.cmd run dev desde rifas. Web http://localhost:5173, API http://localhost:3011. SMTP real está habilitado y los cierres programados se retoman al iniciar. No reencolar los ocho avisos de demostración omitidos. La rifa heredada de 1.000 números sigue con ventas cerradas y pendiente de regla de cifras.

### Preparación conservadora de concurrencia (12/11/2026)

Se aplicaron caché pública de un segundo con consultas compartidas, lecturas sin limpieza global, cola de reservas por rifa compartida entre visitantes y cuentas, reintentos compatibles con conflictos del adaptador pg, límites por cuenta/navegador y tope de cuatro cargas de comprobantes. La estética, frecuencia de la grilla, reglas y plazos comerciales se conservan. No se cambió .env, no se agregaron dependencias ni migraciones y no se modificaron compras reales.

Validación: 72 pruebas de backend, 83 PostgreSQL, 45 frontend y ambos builds correctos. Prueba local de 809 usuarios virtuales con 128 conexiones pasó: 2.427 lecturas iniciales, 2.427 periódicas, un titular entre 809 intentos del mismo número y 100 reservas distintas aceptadas. Intento instantáneo de 809 conexiones falló con ECONNREFUSED; informe fallido preservado. No garantizar capacidad de producción sin repetir la medición externa contra alojamiento/Neon de pruebas, incluidos bcrypt y archivos. Ver [detalle e informes](16-CARGA-Y-CONCURRENCIA.md).

Sólo se inició PostgreSQL para usar esquemas descartables. La aplicación habitual, SMTP y cierres automáticos no se iniciaron. Los procesos HTTP de prueba terminaron y sus esquemas se eliminaron; PostgreSQL se detiene al terminar para conservar el estado previo. No se hizo commit, push ni despliegue.

### Demo desde teléfonos iniciada posteriormente (12/11/2026)

El usuario eligió enlace temporal desde la PC para mostrar el sitio a Osvaldo y José. Se inició PostgreSQL y `node scripts/demo.mjs`: servidor en 127.0.0.1:3012, build React con /api relativo y Quick Tunnel HTTPS. La revisión automática rechazó la primera propuesta sin restricciones; se corrigió con --allowed-mail para halconairguns@gmail.com, osvaljgomez@gmail.com y jlgorosito43@gmail.com. Sólo esos correos pueden superar el código de acceso de Cloudflare y luego se aplican las cuentas/permisos del sitio. Las rutas de página y API anónimas redirigen a Cloudflare Access.

Demo activa al terminar. La dirección vigente y los PID están en `.demo/session.json` (ignorado); registros del túnel en `.demo/tunnel.log`. Sesión de ejecución de esta conversación: 96718. Ctrl+C en el iniciador cierra API y túnel; luego detener db si se pide apagar todo. HOST se agregó a la configuración con valor predeterminado 0.0.0.0; la demo lo limita a loopback. No se cambió .env. SMTP real queda activo y las acciones de la demo se guardan en la base actual; Mercado Pago queda deshabilitado sólo en ese proceso. Se verificaron 5 usuarios, 3 rifas y 19 compras antes de arrancar.

Neon y Render no se conectaron ni se utilizaron. No se migró, contrató, desplegó ni publicó en Git. La compra futura del dominio no elimina la necesidad de alojamiento. Ver [guía de demo](17-DEMO-DESDE-PC.md).

### Corrección de ingreso y botón de contraseña (12/11/2026)

El usuario reportó rechazo no JSON después del acceso de Cloudflare. El backend local respondía JSON correctamente; se encontró el reporte abierto cloudflare/cloudflared#1752 compatible con vencimiento prematuro de la sesión protegida. No se confirmó el tiempo exacto del teléfono. Se reemplazó --allowed-mail por una puerta propia de demo antes de todo contenido y API: clave aleatoria de 144 bits en `.demo/acceso.txt`, cookie firmada Secure/HttpOnly de cuatro horas, diez intentos por IP cada diez minutos. La demo sigue siendo privada y cada administrador utiliza además su cuenta. La revisión automática aceptó este esquema tras revisar su protección. Nunca abrir el túnel contra un servidor sin DEMO_ACCESS_CODE.

La demo anterior se cerró y el nuevo enlace/PID están en `.demo/session.json`. Sesión de ejecución actual: 22194. Se mantiene PostgreSQL, SMTP y el puerto 3012 loopback; no se cambió .env. La clave y los registros se excluyen de Git/Docker. El usuario debe copiar la clave desde su archivo y compartirla únicamente con Osvaldo y José.

Se agregó PasswordInput a ingreso, registro, perfil y verificación; botón de ojo accesible de 44 px, oculto inicialmente y sin cambiar el valor. Los errores no JSON ahora se rechazan explícitamente y se distingue el acceso a la demo de un error de contraseña. Ambos builds y pruebas correctos: 75 backend y 49 frontend. Ver guía 17 para la prueba móvil optativa sobre HTTPS.

La prueba HTTPS real terminó correctamente en ambos anchos (390 y 320 px): bloqueo anónimo, acceso con clave, botón de ojo, login de la cuenta principal, panel admin y recarga conservando la sesión. Las dos cookies son Secure/HttpOnly. Se inspeccionó la captura móvil. El enlace actual quedó activo en `.demo/session.json`; se abrió `.demo/acceso.txt` en el editor para que el usuario copie la clave sin imprimirla en el chat ni en registros.

### Acceso directo solicitado por el usuario (12/11/2026)

El usuario pidió quitar la pantalla adicional para las pruebas con Osvaldo y José. La demo inicia ahora directamente en el catálogo/ingreso normal, con DEMO_ACCESS_CODE vacío. Cloudflare mantiene sólo el túnel HTTPS. La revisión automática aceptó el cambio al comprobar la autorización explícita y que los endpoints privados conservan sesión, rol y propiedad. Las 17 pruebas de permisos pasan. El modo de clave adicional queda opcional con DEMO_REQUIRE_CODE=true; no usarlo por defecto si el usuario no lo solicita.

Se detuvo la sesión anterior 22194 y la demo actual está en la sesión 68420. La dirección y los PID vigentes están en `.demo/session.json`, protection=application-auth. `.demo/acceso.txt` ya no se genera. Se mantienen SMTP, PostgreSQL, el puerto 3012 loopback y las cuentas actuales. El catálogo está accesible a quien tenga el enlace; perfiles, compras, compradores, comprobantes y administración exigen los permisos normales. Esta instrucción sustituye las indicaciones previas de mantener obligatoriamente DEMO_ACCESS_CODE en la demo.

### Confirmación para cerrar sesión

Se reemplazó Salir por Cerrar sesión. Un modal pequeño pregunta si se desea cerrar la sesión, con Sí, estoy seguro y Cancelar. Cancelar no llama a la API; confirmar hace una sola llamada y deshabilita los controles mientras espera. Un error queda visible dentro del modal. Build frontend correcto; comprobado con respuestas simuladas a 390 y 320 px, sin desbordes ni cierre de sesiones reales. El build actualizado ya se sirve en el mismo enlace de demo; basta recargar el navegador.

### Recaudación confirmada por rifa

Por solicitud del usuario se retiró la recaudación general de las tarjetas superiores del panel y se muestra el importe propio de cada rifa en Administración → Rifas, también en el archivo de canceladas. La tarjeta superior ahora muestra Participantes. GET /api/admin/raffles incorpora revenueCents: suma de amountCents de órdenes PAID agrupadas por raffleId; conserva importes históricos y excluye reservas, pendientes, rechazos y devoluciones. Los totales son privados para administradores y no se agregan a los endpoints públicos. Se conservó /admin/stats compatible para clientes anteriores. La lista de rifas consulta cada 15 segundos mientras esa pestaña está seleccionada y se refresca tras las acciones locales.

Verificación: 84 pruebas PostgreSQL y 49 frontend correctas, ambos builds correctos. Nueva prueba financiera con dos rifas, importes históricos y todos los estados excluidos; rifa sin pagos devuelve cero. Se comparó la API real con la suma de PostgreSQL sin imprimir importes y se comprobó interfaz a 390/320 px sin desbordes. No se modificaron compras reales.

Se reinició la demo para cargar el backend: sesión actual 18660, puerto 3012, dirección vigente y PID en `.demo/session.json`. Conserva acceso directo (application-auth) y requiere volver a iniciar sesión tras el reinicio. No detener estos procesos hasta que el usuario pida cerrar la demo.

### Cierre final solicitado por el usuario

Se guardaron los cambios y se cerró la demo (iniciador, API y túnel), dejando el enlace temporal fuera de servicio. Se verificó que sus PID ya no existen y que los puertos 3012, 3011 y 5173 rechazan conexiones. PostgreSQL quedó exited y no hay contenedores activos; se solicitó además el cierre de Docker Desktop. Se eliminó el registro temporal de sesión ya inactiva. Las compras, usuarios, comprobantes y volúmenes se conservan. No se hizo commit, push ni despliegue.

Al retomar: abrir Docker Desktop, ejecutar docker compose -p halcon-airguns up -d db y npm.cmd run demo desde rifas si se necesita acceso desde teléfonos, o npm.cmd run dev para uso local. La demo inicia directamente en el sitio (sin clave extra), genera un enlace nuevo y exige las cuentas habituales para comprar/administrar. SMTP real y cierres automáticos se reanudan al iniciar el servidor. Los últimos cambios incluyen confirmación de cierre de sesión, redirección a /ingresar y recaudación privada por rifa. Última verificación: ambos builds correctos, 84 pruebas PostgreSQL y 49 frontend correctas.
