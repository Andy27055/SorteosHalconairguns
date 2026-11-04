# Comparación de Apuntes con los dos proyectos Halcón Airguns

Fecha: 31/10/2026.

> Diagnóstico anterior a la implementación. Para el estado posterior de la aplicación unificada consultar [Documentacion/06-ESTADO.md](Documentacion/06-ESTADO.md). Las casillas siguientes conservan la revisión original.

## Alcance y criterio

- **Proyecto A:** `C:/Users/Andy2/OneDrive/Documentos/SorteoHalconAirguns`. Archivos: `index.html`, `script.js` y `logo.png`. Formulario de inscripción conectado a Google Apps Script.
- **Proyecto B:** esta carpeta `rifas`. Express, sesiones, registro/login, catálogo y administración de rifas, reservas y Mercado Pago. Persistencia en `data/db.json`.
- **Referencia:** los 26 PDF locales de `Apuntes/`, desde C01 hasta C23. No hay un PDF C22 en la carpeta; C21 identifica C22 como examen. No lo cuento como desarrollo pendiente.
- **Método:** revisión estática de archivos, contraste con consignas grupales y checklists de entrega; comprobación de sintaxis de los seis archivos JavaScript externos y de referencias locales de recursos HTML.
- **Límites:** no ejecuté el servidor, no hice pagos, no envié inscripciones, no inspeccioné datos personales de `db.json` y no consulté cuentas externas. Un archivo ausente en estas carpetas puede existir en otro repositorio o servicio.
- **Falta** significa que no aparece en el código o la documentación revisados. **Parcial** significa que hay una implementación que no cubre lo pedido. **No verificable** significa que requiere código o evidencia externa.
- Los requisitos de React, JWT, Prisma, Docker, etc. se marcan como pendientes **para ajustarse a la cursada**. Su ausencia no significa, por sí sola, que un formulario simple o una aplicación con sesiones no pueda funcionar.
- No considero obligatorio aplicar cada ejemplo de los PDF: una app de rifas no necesita funcionalidades de librería. `useContext` es opcional en C12; React Hook Form es recomendado en C10. CI figura como deuda técnica en C23.

## 1. Comparación con las entregas de la materia

| Requisito | Proyecto A | Proyecto B | Referencia |
|---|---|---|---|
| Visión, alcance, actores, objetivos y límites del producto | Falta documentación local | Falta documentación local | C03, AG-C03.2 |
| Glosario, modelo de dominio, requisitos y reglas de negocio | Falta | Falta documentación; hay estructuras en JS | C04, AG-C04 |
| Backlog con épicas, historias, prioridades, estimaciones y aceptación | No verificable en Trello; falta documento local | Igual | C04/C05 |
| Al menos 3 wireframes principales | Falta evidencia local | Falta evidencia local | C06, AG-C06 |
| Vite + React + TypeScript en `frontend/` | Falta | Falta; usa HTML/JS directo | C08, AG-C08 |
| Componentes con props tipadas, estado y organización por carpetas | Falta | Falta; funciones y variables globales | C08/C09/C12 |
| Librería UI integrada | Falta | Falta; tiene CSS propio | C08/C12 |
| Layout común, React Router y 3 páginas principales funcionales | Falta; una página | Parcial: tiene varias páginas HTML, sin Router ni layout de componentes | C09; C12 p. 10 |
| Formularios controlados y Zod, errores por campo | Falta | Parcial: formularios HTML y controles manuales | C10; C12 p. 10 |
| Hooks, useEffect y useFetch con data/loading/error | Falta | Falta implementación React; sí hay fetch real | C11/C12 |
| Backend TypeScript organizado en capas | Falta código del servidor | Parcial: Express existe, concentrado en `server.js` JavaScript | C14/C15/C19 |
| API REST con al menos 3 CRUD completos | No verificable en Apps Script; falta implementación local | Parcial: rifas tiene altas, consultas, edición y baja; usuarios y tickets no aportan otros 2 CRUD completos | C19 p. 35 |
| PostgreSQL en Docker y Prisma | Falta | Falta; usa JSON | C16/C19 |
| Mínimo 3 entidades, relaciones, migraciones y seed | No verificable en servidor externo | Parcial: users/raffles/tickets son estructuras, sin esquema relacional ni migraciones | C16/C17 |
| Zod en body y params; middleware central de errores | Falta | Falta; validación manual parcial | C17/C19 |
| Registro/login y permisos por endpoint | Falta | Parcial: bcrypt y middlewares de sesión existen; falta matriz y roles persistidos | C18/C19 |
| JWT y token en escrituras según el contrato de la cursada | Falta | Falta; la app usa cookies de sesión | C18/C19/C20 |
| AuthContext, useAuth, rehidratación y rutas por rol | Falta | Parcial: consulta `/api/me` y redirige con JS, sin React ni página sin permiso | C20, AG-C20 |
| Capa única de API, tipos y variables de front/back | Parcial: URL central en `script.js`, fijada en código | Parcial: fetch repartidos; rutas relativas y `.env.example` en servidor | C19 |
| Dockerfile, Compose y entorno reproducible | Falta | Falta | C13/C14 |
| Vitest en front/back, scripts y al menos 5 tests verdes | Falta | Falta | C21, AG-C21 |
| Build de producción y Dockerfile.prod | Falta | Falta | C23 p. 24 |
| Deploy verificable en Render + Neon | No verificable; la URL de Apps Script no acredita esta entrega | No verificable; falta preparación local indicada en la guía | C23 p. 28 |
| README de instalación, frontend, backend, testing y deploy | Falta | Falta | C12/C19/C21/C23 |
| Participación por integrante, PR, revisiones y seguimiento | No verificable | No verificable; sí se comprobó que tiene archivos versionados en el repositorio padre `Codigos` | C01/C07 y actividades grupales |

## 2. Lista común: documentación y gestión

No encontré estos documentos en las dos carpetas analizadas. Verificar si ya existen en el repositorio académico antes de duplicarlos.

- [ ] D01. Redactar visión y alcance: cliente, problema, usuarios, objetivos, funcionalidades incluidas y excluidas, restricciones y riesgos. C03.
- [ ] D02. Crear glosario: rifa, número, reserva, compra, pago, vencimiento, participante, administrador y resultado. C04.
- [ ] D03. Documentar entidades, atributos e identificadores y su diagrama de relaciones. C04/C13/C16.
- [ ] D04. Enumerar requisitos funcionales y reglas de negocio con identificadores y trazabilidad. C04.
- [ ] D05. Completar diagramas de actividad/secuencia pertinentes al flujo reserva → pago → confirmación y sus errores. C04.
- [ ] D06. Construir backlog: épicas, features e historias, prioridad, estimación, dependencias y criterios Dado/Cuando/Entonces; validar calidad e INVEST. C04/C05.
- [ ] D07. Incorporar al menos tres wireframes de pantallas principales y enlazarlos a las historias. C06.
- [ ] D08. Documentar operaciones por pantalla y entidad. C13.
- [ ] D09. Documentar endpoints: método, ruta, operación, body, respuesta, éxito y errores. C15.
- [ ] D10. Escribir matriz de permisos por rol y endpoint y agregar la columna «Qué hace la UI». C18/C20.
- [ ] D11. Organizar `Documentación/` y su README índice: análisis, dominio, backlog, UX/UI y API. C04–C20.
- [ ] D12. Incorporar README de instalación y uso, notas de entrega de frontend/backend, pruebas y despliegue. C12/C19/C21/C23.
- [ ] D13. Verificar Trello: integrantes y acceso docente, To Do/Doing/Review/Done, responsables, estimaciones y objetivos. No verificable localmente. C07.
- [ ] D14. Verificar planificación, revisión, retrospectivas y actualización del backlog y tablero. No verificable localmente. C07 y actividades posteriores.
- [ ] D15. Verificar ramas por integrante, PR y revisiones cruzadas y participación de todo el grupo. No inferir cumplimiento solamente por la existencia de Git. C08 en adelante.
- [ ] D16. Verificar avisos de entrega en los canales e hilos indicados por la materia. No verificable localmente. No se envió ningún mensaje.

## 3. Lista común: implementación para cumplir la cursada

- [ ] T01. Crear `frontend/` con Vite, React y TypeScript; definir scripts de desarrollo y build. C08.
- [ ] T02. Separar componentes, páginas, layouts, hooks, tipos, validadores y acceso a API. C09/C12/C19.
- [ ] T03. Incorporar una librería UI elegida por el equipo. Mantener la identidad visual actual es compatible con este trabajo. C08/C12.
- [ ] T04. Implementar layout reutilizable, navegación con React Router, página inexistente y al menos tres páginas principales del dominio. C09/C12.
- [ ] T05. Tipar props, datos, respuestas, estados y operaciones; usar estado de React y efectos para la carga. C08/C11/C19.
- [ ] T06. Implementar formulario controlado con Zod, errores junto a cada campo y navegación tras el alta. React Hook Form es recomendado, no obligatorio. C10.
- [ ] T07. Implementar hook de consulta con estados de datos, carga y error y recuperación ante fallas. Los mocks corresponden a la entrega inicial; para integración final debe usar la API real. C11/C19.
- [ ] T08. Implementar AuthContext/useAuth, recuperación de sesión, rutas por login/rol, controles condicionales y pantalla sin permiso. C20.
- [ ] T09. Centralizar llamadas, URL base, autenticación y tratamiento de 401/403. Definir tipos compartidos o alineados con el contrato. C19/C20.
- [ ] T10. Crear `backend/` TypeScript con rutas, controladores, servicios y acceso a datos separados; separar la app del arranque para facilitar pruebas. C14/C15/C21.
- [ ] T11. Completar al menos tres CRUD del dominio según el alcance acordado; escoger entidades apropiadas. No habilitar cambios arbitrarios en pagos confirmados para sumar un CRUD. C19.
- [ ] T12. Incorporar PostgreSQL y Prisma con al menos tres entidades, claves únicas, relaciones y restricciones. C16/C17.
- [ ] T13. Versionar migraciones; incluir al menos una relación 1:N y N:M si el dominio la necesita; decidir y justificar `onDelete`. C17.
- [ ] T14. Crear seed reproducible con datos de demostración y usuarios de cada rol, contraseñas hasheadas y ejecución idempotente. C16/C18/C23.
- [ ] T15. Validar body y params con Zod, responder con códigos HTTP coherentes e implementar errorHandler con mapeo de errores de persistencia. C17/C19.
- [ ] T16. Adaptar autenticación al contrato JWT de las actividades, con roles persistidos y authenticate/authorize conforme a la matriz. Las sesiones actuales de B son una alternativa técnica, pero no evidencian el ejercicio JWT. C18–C20.
- [ ] T17. Crear `api.http` con casos exitosos y 400/401/403/404/409 aplicables. C15/C17/C18/C19.
- [ ] T18. Incorporar Dockerfile de desarrollo, `.dockerignore`, Compose para API/DB y documentación para levantar el entorno. C13/C14.
- [ ] T19. Completar `.env.example` de frontend/backend para la arquitectura elegida: URL API, origen permitido, conexión DB, puerto y secreto de autenticación; mantener secretos reales fuera de Git. B ya tiene ejemplo de variables para su arquitectura actual. C19/C23.
- [ ] T20. Configurar CORS con origen por variable al separar frontend y backend. En B actual se sirven desde el mismo origen; no es un fallo por sí mismo no usar CORS. C19/C23.
- [ ] T21. Configurar Vitest en frontend/backend y scripts `test`/`test:watch`; implementar al menos cinco pruebas verdes en total, con pruebas en ambos lados. C21 no dice cinco por cada lado.
- [ ] T22. Cubrir validadores, comportamiento de UI, matriz de permisos y el caso Dado/Cuando/Entonces elegido por el grupo; separar pruebas que requieren DB y documentar preparación y cobertura. C21.
- [ ] T23. Crear builds limpios de frontend/backend, `tsconfig.build.json` y Dockerfile.prod con migraciones al inicio; excluir tests del build de backend. C23.
- [ ] T24. Preparar y verificar deploy Render + Neon: DB → API → frontend → CORS → seed; documentar servicios y variables sin secretos. No se verificaron cuentas ni servicios existentes. C23.
- [ ] T25. Comprobar en URLs públicas login, CRUD completo, permisos y recarga de ruta interna; configurar rewrite de SPA cuando se migre a Router. C23.
- [ ] T26. Publicar en README las URLs y procedimientos de instalación, migración y seed; entregar usuarios de prueba por el canal del grupo y verificar auto-deploy desde main. C23.
- [ ] T27. Preparar presentación, reparto de intervenciones, demo ensayada y equipo listo; verificar app el día de la presentación. C23 pp. 32–33.

## 4. Proyecto A: faltantes funcionales y de robustez

Estas tareas son específicas del formulario actual y pueden resolverse antes de una migración académica.

- [ ] A01. Incluir el código de Apps Script o un enlace versionado revisable. Sin él no se pueden validar almacenamiento, reglas, permisos ni control de números duplicados.
- [ ] A02. Verificar en el servidor que comprobar disponibilidad y reservar sea una operación indivisible; definir qué ocurre ante dos pedidos simultáneos.
- [ ] A03. Recargar disponibilidad después del alta y después de un conflicto. `script.js:41` sólo hace `reset()` y conserva opciones ya ocupadas.
- [ ] A04. Agregar estado «sin números disponibles» y diferenciarlo de error de carga; permitir reintentar la consulta.
- [ ] A05. Comprobar estado HTTP y estructura de respuestas antes de usar `data.numeros`; distinguir error de validación, conflicto y error del servidor. `script.js:4–19` y `38–44`.
- [ ] A06. Agregar tiempo límite de solicitudes y comportamiento de recuperación; evitar que «Enviando...» quede indefinidamente ante una respuesta que no llega.
- [ ] A07. Validar trim, longitudes y formato de DNI/número en cliente y servidor; no admitir entradas sólo con espacios. `index.html`, formulario.
- [ ] A08. Evitar inscripciones duplicadas ante reintentos: una caída de la respuesta puede ocurrir después de que el servidor haya guardado; definir identificador de operación o consulta de confirmación.
- [ ] A09. Permitir recuperar o comprobar una inscripción de manera apropiada al alcance, sin exponer datos de terceros.
- [ ] A10. Documentar el contrato GET/POST y parametrizar la URL para los distintos entornos; hoy está fija en `script.js:1`.
- [ ] A11. Mejorar semántica y accesibilidad: `main`, título principal, anuncios con `aria-live`, autocompletado y teclado numérico para DNI. Verificar contraste visual en navegador.
- [ ] A12. Definir e informar finalidad de DNI/domicilio y qué datos son realmente necesarios; documentar acceso, conservación y eliminación. Es una mejora de producto, no una conclusión legal.
- [ ] A13. Si el alcance incluye gestión de rifas o números, implementar su administración. No aparece en esta carpeta; no asumir que tampoco existe fuera de ella.
- [ ] A14. Si este proyecto debe vender números, implementar compra/pago/confirmación. Hoy sólo inscribe participantes: no hay código local de pagos.

## 5. Proyecto B: correcciones prioritarias

### P0: permisos, datos y pagos

- [ ] B01. **Asignar administrador mediante un rol protegido, no mediante nombre de usuario.** `requireAdmin` compara con `ADMIN_USER` (`server.js:108–111`) y el registro público no reserva ese nombre (`115–129`). Si esa cuenta no existe, quien la registre obtiene los permisos. No se inspeccionó si la cuenta ya está creada.
- [ ] B02. **Eliminar inserciones de texto de usuarios como HTML.** `public/app.js:78`, `public/raffle.js:37` y el listado de tickets/usuarios en `public/admin.js` interpolan nombres sin escape. El backend no limita esos nombres a texto seguro. Usar nodos/textContent y eventos separados; revisar también títulos y descripciones. Hay un flujo de XSS almacenado que puede llegar al panel del administrador.
- [ ] B03. **Evitar sobrescribir la base con una copia vieja.** En registro se lee la DB antes de `await bcrypt.hash` y se guarda después (`server.js:121–127`); en creación de pago se lee antes de `await mpPreference.create` y se guarda después (`226–273`). Una modificación intermedia puede perderse. Migrar a transacciones/operaciones condicionales; la reserva síncrona actual en un solo proceso no demuestra ausencia de este otro problema.
- [ ] B04. **Vincular pagos a órdenes persistentes y reconciliables.** Hoy la referencia de pago vive en tickets pendientes; al expirar, cancelarse o volver a reservarse se borra/reemplaza. Un pago aprobado posterior puede no encontrar sus tickets (`server.js:72–79`, `268–273`, `309–310`, `335–348`). Conservar orden, detalle, referencia y estado incluso si cambia la disponibilidad.
- [ ] B05. **Hacer idempotente la creación de pagos.** Un reintento genera otra preferencia y sobrescribe `externalRef` de la misma reserva; un pago de la preferencia previa puede quedar sin asociación. Bloquear duplicación o reutilizar la orden y reconciliar todos los intentos.
- [ ] B06. **Definir recuperación durable del webhook.** Se devuelve 200 antes de procesar y los errores sólo se registran (`server.js:286–331`). Si falla la consulta o escritura posterior, falta un trabajo persistente/reintento interno o conciliación que garantice completar la operación.
- [ ] B07. **Verificar autenticidad e integridad del flujo de pagos.** No aparece verificación de firma del webhook. Aunque se consulta el pago a Mercado Pago, también falta cotejo explícito de importe, moneda y asociación con una orden esperada. Implementar con la documentación del proveedor al corregirlo; esta revisión no verificó especificaciones externas.
- [ ] B08. **Aplicar reglas al crear el pago.** `/api/payment/create` comprueba que la rifa exista, pero no que siga activa (`server.js:224–237`). Revalidar estado y reserva después de esperas externas y antes de confirmar.
- [ ] B09. **Impedir liberar tickets pagados sin operación de negocio y rastro.** La ruta administrativa borra cualquier ticket sin comprobar `paid` ni tramitar devolución (`server.js:469–480`). Exigir política explícita, auditoría y conciliación.
- [ ] B10. **Mantener precio e importe histórico de la compra.** Se puede cambiar precio de rifa y la recaudación se recalcula con el precio actual (`server.js:417`, `449`). Guardar monto real por orden/ticket; no revalorizar ventas históricas.
- [ ] B11. **Definir cómo interactúan edición/baja/finalización con reservas y pagos en curso.** Borrar una rifa con reservas pendientes o cambiar precios durante un pago puede desasociar operaciones o desajustar importes. Proteger transiciones y preservar historial.
- [ ] B12. **Reducir los datos de endpoints públicos.** `/api/raffles/:id/tickets` devuelve los objetos completos de tickets, incluyendo propietarios y metadatos de pago cuando existen (`server.js:173–177`). Exponer disponibilidad mínima y separar «mis tickets» y administración con autorización.
- [ ] B13. **Aplicar visibilidad de borradores en detalle y tickets.** El listado oculta `draft` al público, pero las rutas de detalle/tickets no hacen la misma comprobación (`server.js:155`, `166–177`). Decidir si «Próximamente» debe ser público y hacer consistente el contrato.

### P1: validación, sesiones y errores

- [ ] B14. Validar tipos, trim, longitudes y límites en servidor. `parseInt` acepta parcialmente valores; precios y cantidades pueden quedar inválidos, negativos o fuera de límite en creación. El límite HTML no protege la API. `server.js:183–191`, `375–390`.
- [ ] B15. Reforzar política de contraseñas y limitar intentos de registro/login; hoy sólo hay mínimo de cuatro caracteres y no aparecen límites de intentos. `server.js:115–140`.
- [ ] B16. Regenerar la sesión después de autenticar, destruirla con manejo de error y limpiar cookie al salir; definir persistencia de sesiones y expiración. Actualmente usa el almacén predeterminado de express-session.
- [ ] B17. Configurar secreto obligatorio para producción y atributos de cookie explícitos según el entorno (`secure`, `sameSite`, proxy HTTPS). No hay `.env` local en B; el código permite un secreto por defecto. No se verificó configuración externa de producción.
- [ ] B18. Definir protección CSRF/verificación de origen para operaciones con cookies. No aparece un mecanismo explícito en el código revisado. Evaluar junto con la configuración de cookies.
- [ ] B19. Retirar la contraseña fija y su impresión desde `reset-password.js`; pedirla sin mostrarla o usar un flujo seguro y auditable. El script tiene una credencial de ejemplo embebida.
- [ ] B20. Agregar manejo central de errores y de promesas rechazadas en rutas async, así como fallas de lectura, JSON corrupto y escritura; devolver errores controlados sin perder datos.
- [ ] B21. Crear almacenamiento vacío en instalaciones nuevas o verificarlo antes de escribir. `loadDB()` crea el archivo, pero no la carpeta `data`; ésta existe localmente y no figura entre los archivos versionados comprobados.
- [ ] B22. Envolver solicitudes de login/registro/carga/reserva/administración en manejo de error y `finally`; recuperar controles bloqueados. `saveRaffle` puede dejar «Guardando...» si falla fetch (`public/admin.js:112–140`).
- [ ] B23. Manejar expiración de sesión/401 de forma central, redirigir a login y conservar el contexto; mostrar 403 como falta de permiso en lugar de redirigir todo al inicio.
- [ ] B24. Validar configuración al arrancar: credenciales de pago, secreto, URL pública y modo de prueba/producción. Evitar que un token ausente se presente como modo de producción por la sola prueba de prefijo (`server.js:13–18`).
- [ ] B25. Incorporar copias de seguridad y restauración verificable para los datos y registro de acciones sensibles. Hoy hay escrituras completas directas al JSON y logs en consola.

### P1/P2: interfaz y cierre funcional

- [ ] B26. Corregir el resultado de pago: `success.html:121–126` separa por `_`, pero el servidor genera `username|raffleId|nums|timestamp` (`server.js:240`). Soportar compra de varios números y conservar la rifa a la que volver.
- [ ] B27. Mostrar confirmación de pago consultando al backend. `success.html` afirma «PAGO CONFIRMADO» al abrirse sin verificar estado; `failure.html` afirma liberación y ausencia de cobro sin consultarlo. El retorno del navegador no es evidencia de liquidación.
- [ ] B28. Actualizar disponibilidad y compras al volver del checkout y mientras otros usuarios operan: no aparece polling/SSE/WebSocket para recargar la grilla; los intervalos existentes son temporizadores de reservas.
- [ ] B29. Revisar temporizadores al renovar una reserva: `startCountdown` conserva el contador existente aunque cambie `expiresAt` (`public/raffle.js:105–107`). Mostrar el vencimiento que realmente tiene el servidor y evitar avisos prematuros.
- [ ] B30. Restaurar completamente el botón y su importe al fallar el pago. En el error de red sólo vuelve a habilitarse y conserva «Creando pago...» (`public/raffle.js:219–221`).
- [ ] B31. Prevenir envíos repetidos y concurrencia de la misma acción en login, registro, reservas y creación de pago; complementar con garantías del servidor.
- [ ] B32. Incorporar accesibilidad: labels asociados en formularios, números como botones operables por teclado, modales con rol/foco/Escape y avisos de estado anunciados. Actualmente los números son `div` con `onclick` (`public/raffle.js:145–166`).
- [ ] B33. Definir límites de grilla/paginación para muchas entradas y comprobar usabilidad móvil. La API no garantiza un máximo y el cliente crea un nodo por número.
- [ ] B34. Si está dentro del alcance, implementar o documentar el mecanismo de sorteo, fecha, elegibilidad, selección y publicación del ganador. Existe estado `finished`, pero no encontré ejecución ni registro de resultado.
- [ ] B35. Si está dentro del alcance, incorporar recuperación de cuenta para participantes; el script local de reset no es una función de autoservicio.
- [ ] B36. Definir comprobante, historial de órdenes/pagos y atención ante cobro aprobado sin ticket o devolución. Hay «mis tickets», pero no un historial persistente de intentos y conciliación.
- [ ] B37. Documentar finalidad y manejo de datos y condiciones de participación, reserva, pago, vencimiento y devolución. Esto es definición de producto pendiente, sin atribuir obligaciones legales no verificadas.

## 6. Casos de prueba que faltan

Lista concreta para convertir en pruebas; no se ejecutaron contra servicios reales.

- [ ] V01. Dos usuarios intentan reservar el mismo número: un solo propietario y conflicto controlado para el otro.
- [ ] V02. Un registro concurrente con una reserva/edición no sobrescribe datos; registro simultáneo no duplica usuarios.
- [ ] V03. Crear preferencia mientras ocurre otra modificación no pierde usuarios, rifas ni tickets.
- [ ] V04. Reintentar inscripción o pago no crea operaciones duplicadas ni pierde la referencia de un pago válido.
- [ ] V05. Webhook duplicado es idempotente; fallo transitorio de procesamiento se recupera.
- [ ] V06. Pago aprobado después del vencimiento, cancelación o nueva reserva se concilia sin perjudicar al comprador ni duplicar titularidad.
- [ ] V07. Pago de importe/moneda/asociación incorrectos no confirma tickets; notificación inválida no se acepta como confirmación.
- [ ] V08. Endpoints de administración responden 401/403 según rol; registro público no otorga privilegios por el nombre.
- [ ] V09. Entradas con HTML se muestran como texto en home, rifa y panel; entradas de tipos inesperados se rechazan.
- [ ] V10. No se divulgan propietarios ni datos de pago desde endpoints públicos; borradores respetan la matriz.
- [ ] V11. Errores HTTP, caída de conexión y vencimiento de sesión muestran mensajes y permiten recuperar la operación.
- [ ] V12. Datos vacíos, espacios, DNI inválido, precio no positivo, cantidad no entera y fuera de límite producen errores claros.
- [ ] V13. Alta correcta/conflicto refrescan números; listado vacío se diferencia de error en A.
- [ ] V14. Resultado de pago muestra todos los números correctos y espera confirmación real del servidor.
- [ ] V15. Cambiar precio no modifica recaudación histórica; baja/cancelación no destruye trazabilidad de pagos.
- [ ] V16. Formularios, grilla y modales funcionan con teclado; avisos son accesibles; vistas funcionan en celular.
- [ ] V17. Instalación limpia, seed repetido, reinicio, migraciones, restauración y recarga de ruta pública funcionan según documentación.

## 7. Evidencia externa pendiente y prioridades

No se puede afirmar sólo desde estas carpetas que no existan tablero, PR, infraestructura, entregas ni documentación en otro lugar. Falta aportar o verificar esas evidencias. Tampoco corresponde sumar automáticamente como requisito recuperación de cuenta, pagos o sorteo automático si el alcance acordado los excluye: los puntos condicionales deben validarse contra ese alcance.

Orden sugerido:

1. Resolver B01–B13 y verificar el backend de A antes de manejar reservas/pagos reales.
2. Acordar alcance y backlog y completar validación, errores y pruebas de los flujos críticos.
3. Adaptar frontend/backend a las tecnologías y entregables de la materia, sin rehacer funcionalidades ya presentes.
4. Completar documentación, despliegue y verificación pública y preparar la entrega/presentación.

Según C23, la Entrega 4 está indicada para el **15/11/2026**. Es la fecha del material local, sin confirmación de cambios posteriores en el aula o Discord.

## 8. Referencias principales

- [C03 — Desarrollo de Software y JavaScript](Apuntes/UTN%20DS26%20-%20C03%20-%20%20Desarrollo%20de%20Software%20%2B%20JavaScript.pdf), pp. 43–45: repositorio, visión y alcance.
- [C04 — Procedimiento para Armado de Backlog](Apuntes/UTN%20DS26%20-%20C04%20-%20Procedimiento%20para%20Armado%20de%20Backlog.pdf): fases, historias y calidad.
- [C12 — React y useContext](Apuntes/UTN%20DS26%20-%20C12%20-%20React%20-%20useContext.pdf), p. 10: checklist frontend.
- [C19 — Integración Front–Back](Apuntes/UTN%20DS26%20-%20C19%20-%20Integraci%C3%B3n%20Front%20-%20Back.pdf), pp. 35–36 y 41: checklist backend e integración.
- [C20 — Autorización Frontend](Apuntes/UTN%20DS26%20-%20C20%20-%20Autorizaci%C3%B3n%20Frontend.pdf), p. 43: actividad de permisos en UI.
- [C21 — Introducción al Testing](Apuntes/UTN%20DS26%20-%20C21%20-%20Introducci%C3%B3n%20al%20Testing.pdf), p. 55: scripts y mínimo de pruebas.
- [C23 — Deploy y Entornos](Apuntes/UTN%20DS26%20-%20C23%20-%20Deploy%20y%20Entornos.pdf), pp. 24, 28, 32–33 y 38: preparación, entrega final y presentación.
- [C23 — Guía para Deploy](Apuntes/UTN%20DS26%20-%20C23%20-%20Gu%C3%ADa%20para%20Deploy.pdf): procedimiento y archivos de producción.

La sintaxis de los seis JavaScript externos revisados es válida y no se detectaron referencias HTML locales a archivos inexistentes. Eso no acredita que funcionen la API, el navegador, Apps Script o Mercado Pago. No se modificó código funcional ni se ejecutaron operaciones de negocio.
