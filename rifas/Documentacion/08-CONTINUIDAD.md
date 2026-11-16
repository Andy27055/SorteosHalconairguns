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

### Varios puestos y premios (14/11/2026)

El usuario confirmó la correspondencia ordinal de la Nocturna bonaerense: primer puesto de rifa con primer resultado oficial, segundo con segundo, etc. Se implementó asistente Datos → Premios por puesto → Revisión. De 1 a 20 puestos, varios premios/unidades por puesto, reutilización del catálogo y creación de premios dentro del asistente. La misma persona o número puede ganar varios puestos. No se exige que sean personas distintas. Los premios creados en línea permanecen en catálogo si luego se cancela el asistente.

Migración 10 aplicada: 202611140001_multiple_awards. Agrega RaffleAward y AwardPrize; cada rifa anterior conserva un primer puesto con su premio, datos de ganador y numeración. Nombres y descripciones de premios se guardan como copia. Se congelan puestos/premios/cantidades desde la primera reserva o compra, tanto en UI como en backend. Se conserva compatibilidad con API y campos históricos de ganador único.

El lector conserva los veinte números oficiales y recupera los de evidencias anteriores almacenadas. El cierre confirma todos los puestos de manera atómica; un número no vendido deja toda la rifa pendiente, sin reemplazos ni avisos parciales. Sigue sin existir una regla para ese caso. Correos por compra ganadora con todos sus puestos/premios; administradores reciben todos los ganadores. Público muestra nombres enmascarados y omite compras ganadoras, DNI y correos.

Respaldo privado validado en .demo/backups/halcon-before-multiple-awards-20261114.dump. Huellas y cantidades de User, Raffle, Order, Allocation, Receipt, PurchaseEmail, RaffleEmail y LotteryDraw coinciden antes/después de migrar. No se alteraron compras ni se enviaron correos reales. Pruebas finales: 82 backend + 52 frontend + 92 PostgreSQL + 14 navegador = 240 correctas; ambos builds correctos. Capturas revisadas a 320 px.

Sólo se utilizó PostgreSQL para migración/pruebas y un preview local de frontend en 5181 con API simulada. No se inició index.ts, ni trabajadores SMTP/cierres reales, ni túnel público. Al terminar se cierran las herramientas temporales para conservar el estado apagado anterior. Ver [documentación vigente de varios premios](18-PUESTOS-Y-VARIOS-PREMIOS.md). No hubo commit, push ni despliegue.

### Prueba local solicitada (14/11/2026)

El usuario pidió probar el nuevo asistente en local. Se inició Docker Desktop, PostgreSQL y npm run dev: web http://localhost:5173, API http://localhost:3011, ambos en loopback. Sesión activa 46782. Se comprobaron web, salud de API y proxy de Vite con HTTP 200.

La revisión automática rechazó el arranque normal porque reactivaba SMTP y cierres reales. Se agregó BACKGROUND_TASKS_ENABLED (true por defecto para conservar el funcionamiento habitual) y se inició únicamente esta sesión con BACKGROUND_TASKS_ENABLED=false, SMTP_ENABLED=false y HOST=127.0.0.1. No se modificó .env. En esta prueba no se inician correo, limpieza ni cierres programados; las operaciones manuales siguen usando la base actual. Los avisos que generen esas operaciones pueden quedar en cola para un inicio normal posterior. Build backend correcto después del cambio. No reiniciar en modo normal ni activar envío externo para esta prueba sin una instrucción que lo autorice.

### Aclaración de cifras automáticas (14/11/2026)

El usuario aclaró que las últimas dos cifras corresponden a rifas de cien números; para mil se usan tres y para diez mil las cuatro. Sustituye la indicación previa de usar siempre dos cifras. Se mantiene 100 como valor predeterminado editable y se calcula `max(2, longitud(totalTickets - 1))`, sin selector manual. Nuevas rifas desde cero: 00–99, 000–999, 0000–9999. Con resultado 1237 ganan 37, 237 y 1237, respectivamente. La regla se aplica a cada puesto oficial, en orden.

El backend deriva y valida las cifras al crear/editar; el cierre comprueba la regla guardada. Se mantiene el bloqueo de reglas desde la primera reserva. Una rifa anterior con cifras nulas o incompatibles requiere revisión y no se modifica automáticamente. Para cantidades intermedias, un resultado fuera del rango queda pendiente igual que un número sin vender: no hay módulo ni reemplazo automático.

Formulario, revisión, condiciones, grilla, selección, listado de compras y compradores reflejan el rango y los ceros iniciales. La reserva anónima consultada informa también la cantidad de números para mostrarla correctamente. El aviso de correo deshabilitado ya no sugiere que falte configurar la cuenta remitente.

Validación de esta revisión: 90 pruebas backend, 54 frontend, 96 PostgreSQL aislado y 6 navegador correctas (246). Ambos builds correctos; web y API responden HTTP 200. Navegador comprueba configuración, resultados y grilla de 1.000/10.000 números a 390/320 px, incluida selección al paginar. Captura de cuatro cifras a 320 px revisada. Los servicios locales siguen activos en la sesión 46782, con los trabajadores y SMTP pausados como arriba. No se modificó .env ni se abrió un túnel público.

### Premios de números gratis (14/11/2026)

Se agregó el tipo de premio FREE_TICKET, configurable en catálogo o desde el asistente, con unidades por puesto. El cierre acredita a la cuenta ganadora un beneficio único por premio, con saldo y registros de canje. Mis números muestra los beneficios y enlaza a la selección habitual; en la compra se canjea por $0 con identidad completa, sin pago ni comprobante. Figura en compradores/Excel, inmoviliza los números y participa en el cierre, sin sumar recaudación. Se envían notificaciones de premio, canje y baja mediante las colas existentes.

Interpretación comunicada de «próxima rifa»: primera que se abra después de confirmar el premio; no cuenta crear borradores ni una rifa ya abierta previamente. Se hizo una consulta opcional sobre esta preferencia y se avanzó con la interpretación indicada al no recibir respuesta. Beneficio válido únicamente para esa rifa. Una cancelación de destino restituye el saldo y lo deja para la siguiente apertura; la baja individual restituye para el mismo destino. Cancelar origen o eliminar la compra ganadora revoca beneficios sin usar. No se genera un reembolso de dinero por participaciones gratuitas. Números adicionales se pagan en otra reserva.

Migraciones 11 y 12 aplicadas con respaldo validado en .demo/backups/halcon-before-free-tickets-20261114.dump. Nuevas tablas FreeTicketBenefit y FreeTicketUse, tipo de premio congelado en AwardPrize, PaymentMethod FREE_TICKET y fecha de primera apertura. Se conserva PAID para participaciones confirmadas; importes cero sólo se permiten con el método FREE_TICKET. No se reinterpretan premios anteriores por su nombre ni se modifican compras históricas. Detalles en [números gratis](19-NUMEROS-GRATIS.md).

Validación: 90 backend + 60 frontend + 102 PostgreSQL + 8 navegador = 260 correctas; ambos builds correctos. Correos de canje y baja validados con remitente simulado, sin envío externo. Se mantienen web 5173 y API 3011; no se modificó .env, ni se abrió un túnel, ni se hizo commit o despliegue.

### Aclaración de vigencia de números gratis (14/11/2026)

El usuario respondió: «Puede usarlo en cualquier rifa posterior». Sustituye la interpretación inicial de destino único descrita arriba. Se eliminó la vinculación automática a la primera apertura. El saldo no vence al dejar pasar rifas y puede repartirse entre varias posteriores. Se verifica la fecha de acreditación frente a la primera apertura de la rifa; se excluyen el origen y las rifas ya abiertas previamente. La API devuelve availableRaffles y la cartera permite elegir cualquiera de las abiertas elegibles. Se actualizaron textos, condiciones y correos. Los targetRaffleId históricos se conservan pero se ignoran como restricción; no se alteran saldos, compras ni usos anteriores, ni se requiere otra migración.

Pruebas nuevas verifican dejar pasar una rifa cerrada, repartir dos números entre otras dos posteriores, ignorar una vinculación histórica y proteger el saldo ante canjes simultáneos en rifas diferentes. La restitución por cancelación o baja vuelve al saldo general para rifas posteriores. Ver [regla vigente](19-NUMEROS-GRATIS.md).

Validación posterior a la aclaración: 90 backend, 60 frontend, 103 PostgreSQL y 2 canjes móviles correctos (255 en esta revisión). Ambos builds correctos. Sin otra migración ni cambios de .env, saldos o compras reales.

### Acciones de borradores (14/11/2026)

El usuario pidió que los borradores no puedan finalizarse porque no empezaron. El listado reemplaza Finalizar rifa por DAR DE ALTA cuando el estado es DRAFT; conserva Editar y Eliminar. Nuevo POST /api/admin/raffles/:id/activate para ambos tipos de administrador: valida la configuración guardada, cambia sólo a ACTIVE, registra openedAt si no existía y actividad RAFFLE_ACTIVATED. No permite reactivar canceladas o rifas con resultado previo. El alta aparece inmediatamente en el catálogo.

LotteryService.requestClose rechaza DRAFT con 409 antes de consultar fuentes, cambiar reservas o enviar avisos. Eliminar borradores conserva el comportamiento de cancelación lógica y el historial. Pruebas PostgreSQL verifican el bloqueo sin efectos, altas por administrador principal/funcional, permisos, conservación de datos, catálogo y no reactivación; navegador verifica botones y alta en escritorio y móvil. No se modifica .env ni se activa, cancela o cierra una rifa real para las pruebas.

Validación de acciones de borradores: 39 pruebas PostgreSQL de ciclo de vida/premios y 7 de navegador correctas; ambos builds correctos. Se comprobaron escritorio de 1280 px, móvil de 320 px, cancelación con Excel previo y cierre anticipado de activas. Web 5173 y salud API 3011 responden HTTP 200.

### Última Nocturna, mínimo diez, entrega manual y filtros (14/11/2026)

El usuario pidió usar la última Nocturna bonaerense publicada al cerrar, no esperar la de esa noche. Sustituye la regla anterior de mismo día/fecha prevista para nuevos cierres. requestClose cierra ventas y fija closingAt; resolve busca hacia atrás desde la última edición posible (21:00 Argentina, lunes a sábado), verificando extractos oficiales y sin saltarse fallos de fuente. Se fija resultDate al seleccionar y no cambia en los reintentos. Si estuvo apagado, el cierre efectivo usa lo último disponible entonces; cierres antiguos ya fechados conservan evidencia. Una consulta real de sólo lectura recuperó 13/11/2026, sorteo 12914 y veinte posiciones. No se cerró ninguna rifa real. Siguen pendientes pagos por revisar, cifras antiguas incompatibles o números premiados sin vender; no se inventan ganadores.

Mínimo 10 y máximo 10.000 números, predeterminado 100. Diez usa 0–9 y una cifra; cien 00–99 y dos; mil tres; diez mil cuatro. Formulario/API/alta rechazan menos de diez. Las pruebas antiguas menores de diez se conservan en administración para cancelar, pero no se publican, reservan ni finalizan; no se cambian compras históricas.

Entrega manual en Administración → Participantes → OTORGAR NÚMEROS GRATIS, disponible para ambos tipos de admin. Cantidad 1–100, motivo opcional y dos vigencias expresamente confirmadas por el usuario: abiertas actuales/futuras o sólo futuras. Solicitud idempotente por actor y requestId, cuenta destinataria activa, registro administrativo y personal. La cartera admite origen manual nulo y muestra cantidad, motivo, vigencia y rifas elegibles; el canje por $0 conserva los controles existentes. No se asignó un beneficio a usuarios reales para validar.

Migración 13 aplicada: 202611140004_manual_free_tickets. Permite AwardPrize nulo con autor/solicitud manual, agrega validFrom/scope/reason/grantKey y conserva la vigencia de beneficios anteriores. Respaldo privado previo validado en .demo/backups/halcon-before-manual-benefits-20261114.dump, 116 entradas de manifiesto. .env y SMTP no se modificaron.

El contador de rifas es ahora un desplegable con la estética negra/dorada: Activas primero, Compras cerradas primero, Sólo activas y Sólo compras cerradas. Incluye finalizadas y pendientes, clasifica por estado/venta vencida y conserva la tarjeta destacada para una única abierta y el anuncio del último ganador. Sin desbordamiento a 320/390 px.

Validación: 99 backend, 63 frontend, 110 PostgreSQL aislado y 13 navegador correctas (285), ambos builds correctos. El último caso del asistente se ajustó para comprobar tanto el límite nativo del formulario como la validación JavaScript y luego se repitieron sus siete casos correctamente. Capturas de filtros y entrega manual revisadas a 320 px. Web 5173, salud API 3011 y catálogo público responden HTTP 200. Continúa la sesión local con correo y trabajadores pausados; sin túnel, commit, push ni despliegue. Ver [reglas y flujo vigentes](20-ULTIMA-NOCTURNA-Y-ENTREGA-MANUAL.md).

### Cierre solicitado por el usuario (14/11/2026)

El usuario pidió guardar y cerrar todo para seguir más tarde. Archivos y documentación guardados en disco, sin commit, push ni despliegue. Se cerró el árbol de procesos de npm/concurrently del proyecto, incluidos tsx/API y Vite. Se creó y verificó un respaldo final privado en .demo/backups/halcon-session-end-20261114-172716.dump (58.587 bytes, 117 entradas de manifiesto). Se detuvo docker compose -p halcon-airguns sin borrar contenedores ni volúmenes; después se cerró Docker Desktop porque no quedaban otros contenedores activos.

Verificación final: sin procesos Node del proyecto ni cloudflared, y sin escuchas en 3011, 5173, 5174, 5181, 3012 ni 5434. La base, comprobantes, configuraciones y compras se conservan. La sesión local queda APAGADA. Al retomar una prueba local, recordar que .env tiene correo real configurado: usar SMTP_ENABLED=false, BACKGROUND_TASKS_ENABLED=false y HOST=127.0.0.1 en la sesión si se desea conservar el modo de pruebas sin correos ni cierres automáticos; no cambiar el .env privado. Los últimos cambios y validaciones son los de la sección anterior y la guía 20.

### Cambio de regla de números gratis (15/11/2026)

El usuario cambió el uso general: un premio ganado vale siempre para la siguiente rifa; una entrega manual requiere elegir entre rifas cargadas, borradores o activas. Sustituye las decisiones de cualquier posterior y scopes generales registradas arriba. Se definió siguiente como primera activación después de confirmar el premio, comunicándolo durante el trabajo. Crear borradores no cuenta. Al crear una activa, activar por PUT o DAR DE ALTA se vinculan beneficios automáticos pendientes en la transacción. El destino no cambia si se deja cerrar esa rifa y se abren otras. La cantidad, los saldos y los usos anteriores se conservan.

La entrega manual exige targetRaffleId; el servidor valida destino en DRAFT o ACTIVE con venta abierta, mínimo diez y sin resultado previo. El selector lista las cargadas y excluye finalizadas/canceladas; un borrador se canjea al activarse, aunque se haya cargado antes de la entrega. Se conservan cantidad, motivo opcional e idempotencia. Los beneficios manuales anteriores sin destino, o cuyo destino fue cancelado, pueden asignarse a una rifa en el mismo diálogo sin duplicar la acreditación ni cambiar usos registrados. Se registran asignaciones en actividad. El canje filtra por destino exacto y ya no por scope/validFrom, conservados sólo como historial. No se requiere migración nueva.

Cancelación: un premio automático ligado al destino cancelado queda pendiente para la próxima apertura como reemplazo; un beneficio manual espera que administración elija un reemplazo cargado. Una baja individual restituye para la misma rifa. Cancelar el origen o retirar la compra ganadora mantiene la revocación de premios automáticos no usados. Cartera, condiciones, correos y etiquetas muestran destino único, espera del borrador y aviso de cierre sin traslado a otras rifas.

Validación: 99 backend + 64 frontend + 111 PostgreSQL + 12 navegador = 286 pruebas correctas; ambos builds correctos. Las pruebas verifican primera apertura, bloqueo en otras rifas, no traslado tras cierre, borrador/activa manual, idempotencia, permisos, destino obligatorio, asignación de saldo anterior y conservación de compras. Navegador prueba entrega manual, canje, catálogo y varios premios a 390/320 px. Captura de cartera con borrador asignado revisada a 320 px. Se consultaron sólo cantidades agregadas de beneficios reales sin destino: cero automáticos y cero manuales. No se asignaron ni canjearon beneficios reales, ni se cambió .env o se enviaron correos.

Sólo se levantó PostgreSQL para esquemas de prueba aislados y Vite temporal en loopback 5181 con API simulada. No se inició la API real ni sus trabajadores. Se cierran Vite, el contenedor de PostgreSQL y Docker Desktop al terminar para conservar el estado apagado anterior. No hay commit, push ni despliegue. Ver [regla vigente](21-NUMEROS-GRATIS-CON-RIFA-ASIGNADA.md).

### Prueba local iniciada a pedido del usuario (15/11/2026)

El usuario pidió probar la página. Se inició Docker Desktop y PostgreSQL, y se dejó npm run dev activo en la sesión 96436: web http://localhost:5173 y API http://localhost:3011, en loopback. Verificados HTTP 200 y contenido válido de página, salud de API, salud mediante proxy de Vite y catálogo real mediante ese proxy.

Sólo para este proceso se establecieron SMTP_ENABLED=false, BACKGROUND_TASKS_ENABLED=false, HOST=127.0.0.1, PORT=3011, FRONTEND_URL=http://localhost:5173, PUBLIC_API_URL=http://localhost:3011 y API_PROXY_TARGET=http://127.0.0.1:3011. No se modificó .env. La cuenta remitente sigue configurada; correo, limpieza y cierres automáticos están pausados. Las acciones manuales de la prueba usan la base local actual y pueden dejar avisos en cola. La sesión queda ENCENDIDA para que el usuario pruebe; no apagarla al terminar esta respuesta.

### Vuelta a Nocturna del día y bloqueo del domingo (15/11/2026)

El usuario pidió volver a la Nocturna del día y preguntó si el modo local impedía enviar correos. Se explicó que el correo sí puede salir desde local, pero la sesión actual lo tiene pausado mediante SMTP_ENABLED=false y BACKGROUND_TASKS_ENABLED=false. Su cuenta remitente y .env siguen configurados e intactos. No se habilita envío real ni se procesan colas por esta consulta.

El cierre fija resultDate al día argentino de closingAt desde el principio. Si falta la publicación espera esa edición, sin buscar días anteriores. Se retiraron el buscador latestNocturna y sus pruebas de fallback, que ya no corresponden a la regla. Los reintentos conservan el día del cierre, incluso tras reiniciar. Los cierres pendientes con fecha nula o del día anterior se normalizan al día de closingAt al resolver y registran RAFFLE_RESULT_DAY_FIXED; las rifas FINISHED conservan sus resultados. No hay migración ni reescritura masiva de datos. Se actualizaron diálogo, estado pendiente, condiciones y correos.

Se verificó el cronograma oficial: lunes a sábado a las 21:00. El usuario eligió explícitamente «Impedir finalizar ese día» para domingos. Nuevos cierres manuales y automáticos se rechazan antes de modificar estado, reservas o avisos. El listado muestra el motivo y deshabilita FINALIZAR RIFA para activas. Se conserva ACTUALIZAR RESULTADO para cierres anteriores y el resto de administración. Se evalúa la fecha argentina, no la UTC. Las pruebas comprueban sábado argentino con UTC domingo, domingo local y lunes.

Los escenarios de premios de PostgreSQL ahora controlan la fecha de prueba en un día hábil con reloj que avanza, para no depender del día real y seguir comprobando el orden de activación. Se cubren espera antes de publicación, fecha fija al reiniciar, normalización pendiente con auditoría y domingo sin efectos. La consulta agregada de la base real devolvió cero cierres pendientes, incluidos cero iniciados en domingo; no se resolvió ni modificó una rifa real para validar. La sesión local sigue encendida y los correos/trabajadores pausados.

Validación final: 95 pruebas backend, 64 frontend, 115 PostgreSQL y 8 navegador correctas (282); ambos builds correctos. El navegador usa lunes simulado para comprobar cierre y alta, y un caso explícito de domingo para verificar botón deshabilitado, aviso y administración disponible. Web 5173 y API mediante proxy responden HTTP 200. npm run dev continúa en la sesión 96436 con SMTP_ENABLED=false y BACKGROUND_TASKS_ENABLED=false; no apagar al terminar. La consulta del usuario sobre correos se respondió como diagnóstico; no autorizó reactivar envío real ni procesar pendientes.

### Contador administrativo de rifas (15/11/2026)

El usuario pidió que el conteo incluya sólo borradores y activas. GET /api/admin/stats calcula raffles con status IN (DRAFT, ACTIVE); excluye CLOSING, FINISHED y CANCELLED. No se borran rifas ni se altera su historial/listado. La tarjeta RIFAS conserva su diseño y su actualización periódica. Prueba PostgreSQL comprueba los cinco estados y que el contador baje al finalizar y cancelar: 25 pruebas del ciclo de vida correctas y build backend correcto. La sesión local permanece encendida con correo y tareas automáticas pausados.

### Gestión de cuentas desde desarrollo (15/11/2026)

El usuario pidió crear y eliminar cuentas y aclaró que sólo se permite borrar sin compras ni premios activos, conservando el historial en las rifas. PRIMARY tiene crear cliente/administrador funcional y eliminar con vista previa y palabra CONFIRMAR en Administración → Participantes. Si hay participaciones en rifas abiertas, reservas, pagos/revisiones, reembolsos pendientes o números gratis no revocados sin usar, sólo se ofrece desactivar. PRIMARY y cuenta propia están protegidos en el backend; los funcionales mantienen sus permisos anteriores.

El borrado conserva órdenes, identidad histórica, números/asignaciones, compradores y Excel, ganador, comprobantes, avisos, beneficios consumidos/revocados y sus usos. Sólo se borra el acceso y verificaciones; se desvinculan relaciones históricas después de congelar los datos disponibles. La actividad conserva la atribución de administradores eliminados. No se sobreescriben identidades de compra con datos posteriores del perfil. Recrear correo/usuario no recupera compras históricas. Revalidación y borrado son atómicos y protegen reservas simultáneas.

Aplicada migración catorce: 202611150001_account_deletion_history (userId nullable de beneficios históricos). Ninguna cuenta real fue creada, eliminada ni modificada para las pruebas. No se enviaron correos ni se modificó .env. La sesión 96436 queda ENCENDIDA para probar en http://localhost:5173; API 3011 y PostgreSQL 5434. SMTP y trabajadores siguen pausados mediante variables del proceso. Detalles en [gestión principal](14-ADMINISTRACION-PRINCIPAL-Y-SPAM.md) y [API](05-API-Y-PERMISOS.md).

Validación de cuentas: ambos builds correctos, 68 pruebas frontend y 135 PostgreSQL en una pasada completa. Tras agregar conservación de autoría, 40 pruebas de cuentas/identidad correctas, incluido el caso nuevo (20 de cuentas). Tres pruebas de Edge verifican creación, confirmación de borrado, protección del principal y permisos funcionales, con teléfonos de 390/320 px sin desborde. Captura eliminar-cuenta-320.png inspeccionada. Los ensayos usan esquemas aislados/API simulada. El lanzador tsx no inicia bajo el sandbox de esta sesión (uv_os_get_passwd); se usó node con Vitest directamente. Una pasada paralela tuvo un trabajador interrumpido; la pasada completa con --maxWorkers=1 finalizó sin errores. No se alteró la configuración de ejecución del producto para las pruebas.

### Cuentas de Andrés y navegación administrativa (15/11/2026)

A pedido del usuario se revisaron las dos cuentas Andres Gomez, usuarios halcon-admin y cliente. Tenían tres gestiones de devolución pendientes, por lo que se desactivaron e invalidaron sesiones, sin borrarlas, siguiendo su regla de no eliminar cuentas con pendientes. Se conservaron sus dieciséis compras y se registró USER_DEACTIVATED. No registrar devoluciones ficticias para permitir su eliminación.

El usuario indicó que sólo veía Ver comprobante, sin botón de devolución, y pidió menú de tarjetas y devoluciones separadas. Se reemplazó la barra por siete tarjetas accesibles (roles tab/tablist conservados). Nueva sección Devoluciones centraliza pendientes y realizadas de todas las rifas; el filtro incluye rechazos por monto incorrecto con refundRequestedAt. Se mantienen aprobación/rechazo de comprobantes y compradores por rifa. Reembolsos de rifas canceladas o cuentas desactivadas pueden registrarse sin reactivar ni modificar el acceso. El formulario explica importe, referencia y CONFIRMAR para habilitar el botón. La compra histórica utiliza su identidad congelada, sin sustituirla por el perfil actual. En listado general existe acceso VER EN DEVOLUCIONES. stats incluye pendingRefunds. No requiere migración.

Lectura del API real mediante Vite: HTTP 200, ocho pendientes y todos elegibles para mostrar acción. Todos son transferencias. No se marcó ningún reembolso real como realizado ni se transfirió dinero o enviaron correos. La sesión local sigue encendida en 5173 / API 3011, con SMTP y trabajadores pausados y .env intacto. El código, pruebas y documentación están guardados localmente; sin commit, publicación ni despliegue.

Validación: builds correctos, 69 pruebas frontend, 20 de cuentas y 25 de ciclo de rifas correctas; 13 de reembolso correctas tras ajustar la prueba de correo para validar destinatarios históricos de varios compradores. Doce recorridos de Edge verificados: tres de cuentas, siete de bajas/rechazos/reembolsos anteriores y dos nuevos de tarjetas/devoluciones. Los dos nuevos recorren pendiente, importe conocido/desconocido, referencia, CONFIRMAR, registro y consulta del historial a 390/320 px, sin desbordes. Capturas menu-administracion-320.png y devolucion-realizada-390.png inspeccionadas. No hay devoluciones reales ejecutadas por estas pruebas.

### Selección de números antes de los premios (15/11/2026)

El usuario pidió mostrar primero la selección de números al abrir una rifa, conservar el nombre arriba y trasladar premios al final. RafflePage mantiene enlace de regreso y título de la rifa al inicio, seguido por grilla/resumen. La descripción y premios por puesto quedan al final, después del resumen. Las rifas antiguas sin awards conservan su premio y descripción en ese bloque inferior. El aviso de saldo gratis se muestra dentro de Tu selección, sin adelantar contenido sobre la grilla. Estados cerrados, resultados, reserva de invitados y barra móvil conservan sus comportamientos.

Compilación frontend correcta y tres recorridos existentes de catálogo/selección móvil correctos a 320/390/430 px. Verificación visual adicional con cinco puestos confirma título antes de grilla, premios después del resumen, primer número visible al entrar, ausencia de desborde y selección operativa en teléfono. Capturas privadas en .demo/raffle-numbers-first-*.png. No se modificaron datos, backend, pagos ni envíos; la sesión local permanece encendida.

### Devolución solicitada por cliente con aprobación y números individuales (15/11/2026)

El usuario pidió solicitar desde Mis números sólo con pago aprobado y rifa activa, y que toda solicitud requiera aprobación administrativa. Confirmó elegir números individuales y cálculo automático. Implementado botón del titular en listado y detalle, selector de números, importe al precio histórico, motivo opcional y estado pendiente. Mientras no se apruebe, conserva PAID, números ocupados y participación. La sección Devoluciones inicia en Solicitudes por aprobar, con revisión de ambos tipos de administrador, aprobación con observación opcional y rechazo con motivo obligatorio. Aprobar libera sólo los números elegidos y autoriza el importe; el dinero se devuelve externamente y se registra luego con referencia/CONFIRMAR. Las compras gratuitas no originan devolución monetaria.

La compra parcial conserva números/importe restantes; parte de devolución vinculada y originalNumbers/originalAmountCents mantienen el pago y alcance originales. Comprobantes y datos históricos conservados; compradores/Excel/recaudación se calculan con participaciones restantes. Conciliación MP valida importe del pago original y puede liquidar partes pendientes si el proveedor confirma devolución total. Cancelar una rifa o dar de baja la compra reemplaza su solicitud pendiente, sin duplicar devolución. Solicitud pendiente impide eliminar la cuenta, pero no desactivarla. Recepción/decisión generan correos idempotentes por solicitud; no se envían con trabajadores pausados. Contexto de auditoría usa números del evento, no el subconjunto restante de la orden.

Migración quince aplicada: 202611150002_customer_refund_requests. No se modificaron compras o devoluciones reales para probar, ni .env, SMTP o trabajadores. API local y Vite siguen activos en 3011/5173. Detalles completos en [solicitudes y devolución parcial](22-SOLICITUDES-Y-DEVOLUCIONES-PARCIALES.md).

Validación: 163 pruebas de PostgreSQL aislado correctas (incluidas 26 nuevas), 95 backend, 72 frontend y builds correctos. La última revisión del contexto de actividad pasó 46 escenarios de solicitudes/identidad. Edge comprueba aprobación parcial a 390 px y rechazo a 320 px; también vuelven a pasar los dos recorridos del panel de devoluciones. Se inspeccionaron las capturas de selección e importe/revisión móvil. Al revisar recorridos antiguos de invitado se detectaron expectativas obsoletas de tres cifras para una rifa de cien números; se actualizaron a dos cifras, sin cambiar el producto. No registrar devoluciones ni solicitudes ficticias en la base local de uso.

### Cierre de la jornada — 15/11/2026

El usuario pidió guardar y cerrar todo. **Estado actual: APAGADO**, reemplaza las notas anteriores que indicaban dejar la sesión encendida. Código y documentación guardados en disco, sin commit, push ni despliegue.

Se detuvo npm run dev (sesión 96436), luego el contenedor halcon-airguns-db-1, conservando su volumen, y finalmente Docker Desktop con su comando de cierre. Verificación final: ningún listener en 3011, 5173, 5434 o 5181; ningún proceso del proyecto, Docker Desktop/backend o cloudflared activo. No se apagó Windows ni se cerró el IDE.

Respaldo privado de PostgreSQL antes de detenerlo: `.demo/backups/halcon-session-end-20261115-40f62966.dump`, formato custom, esquema público, **75.986 bytes**, manifiesto pg_restore comprobado con **117 entradas**. Incluye las quince migraciones y datos actuales de uso. El usuario pudo realizar acciones reales mientras probaba: conservar ese estado y revisar las solicitudes/devoluciones pendientes al retomar. No se aprobó ni completó ninguna devolución real mediante las herramientas para validar el desarrollo.

El archivo .env queda intacto, con el remitente configurado. El proceso anterior tenía SMTP_ENABLED=false y BACKGROUND_TASKS_ENABLED=false: al retomar, mantenerlos pausados hasta que se pida habilitar envíos y tareas. No ejecutar seed ni aprovisionamiento de cuentas, ni procesar automáticamente colas antiguas.

Para retomar en esta carpeta: iniciar Docker Desktop, ejecutar `docker compose -p halcon-airguns up -d db` y luego, en PowerShell:

```powershell
$env:SMTP_ENABLED='false'
$env:BACKGROUND_TASKS_ENABLED='false'
$env:HOST='127.0.0.1'
$env:PORT='3011'
$env:FRONTEND_URL='http://localhost:5173'
$env:PUBLIC_API_URL='http://localhost:3011'
$env:API_PROXY_TARGET='http://127.0.0.1:3011'
npm.cmd run dev
```

Última validación de navegador completada: los recorridos de ingreso y registro conservan 11/12 en una rifa de cien números, con expectativas de dos cifras actualizadas. Se mantienen correctos el nuevo flujo parcial, la aprobación/rechazo y los recorridos anteriores de comprobantes y reembolsos. La revisión final de whitespace no detectó errores. No publicar ni desplegar sin pedido del usuario.
