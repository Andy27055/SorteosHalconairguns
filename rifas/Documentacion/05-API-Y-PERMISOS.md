# Contrato API y matriz de permisos

Base local instalada: `http://localhost:3011/api`. JSON para campos; carga multipart sólo en comprobantes. Bearer JWT o cookie HTTP-only; cookie en escrituras requiere Origin del sitio. Error uniforme `{ error, fields? }`; validación 400, sin sesión 401, otro rol/propietario 403, inexistente 404, conflicto 409, archivo vencido 410, configuración ausente 503 y proveedor no disponible 502. Registro y creación devuelven 201; consultas/actualizaciones correctas 200.

## Operaciones por pantalla

| Pantalla | Entidades | Operaciones |
|---|---|---|
| Catálogo | Raffle, Prize | Listar públicas, ver premio, precio, disponibilidad y resultado |
| Registro/login | User | Crear cuenta, autenticar, rehidratar sesión, salir |
| Rifa | Raffle, Allocation, Order | Ver detalle, consultar ocupados, reservar conjunto indivisible |
| Mis números | Order | Paginar historial propio, consultar estado |
| Compra | Order, Receipt | Checkout, transferencia, enviar/descargar comprobante, consultar pago, cancelar reserva elegible |
| Perfil | User | Consultar/modificar datos, cambiar contraseña |
| Administración | Raffle, Prize, User | Crear, consultar, actualizar, eliminar/desactivar según reglas |
| Revisiones | Order, Receipt | Descargar, aprobar/rechazar, conciliar asignación/devolución registrada |
| Sorteo | Raffle, Allocation | Seleccionar ganador entre PAID, finalizar una sola vez |
| Auditoría | AuditLog | Consultar últimas acciones y ejecutar limpieza de vencidos |

## Endpoints y permisos

P = público; U = participante autenticado, limitado a sus registros; A = administrador. En endpoints A: invitado 401, USER 403; la UI oculta el enlace y protege `/admin`. En endpoints U: invitado 401; registro de otro titular 403, salvo consulta administrativa autorizada. La protección del backend es independiente de la interfaz.

| Método y ruta | Body / entrada | Acceso | Respuesta / comportamiento de UI |
|---|---|---|---|
| GET `/health` | — | P | Estado y conectividad DB; 503/500 si falla |
| GET `/config` | — | P | Medios habilitados, cuentas `transferAccounts`, datos de transferencia y retención; nunca tokens |
| POST `/auth/register` | username, email, firstName, lastName, password; dni/address opcionales (fullName legacy admitido) | P | 201 user/token; rol siempre USER; errores por campo |
| POST `/auth/login` | login (usuario o email), password | P | user/token, cookie; 401 credenciales incorrectas |
| GET `/auth/me` | — | U/A | user; AuthContext restaura sesión o muestra login |
| POST `/auth/logout` | — | U/A | Revoca sesiones y limpia cookie |
| GET `/profile` | — | U/A | Perfil propio |
| PUT `/profile` | firstName, lastName, email, dni/address opcionales (fullName legacy admitido) | U/A | Actualiza datos propios |
| PUT `/profile/password` | currentPassword, password | U/A | Cambia contraseña y revoca sesiones |
| GET `/raffles` | — | P | Lista activas/finalizadas, premio, vendidos/disponibles |
| GET `/raffles/:id` | id | P | Detalle público; borrador 404 |
| GET `/raffles/:id/availability` | id | P | `{ number, status }[]`; sin propietario ni metadatos |
| GET `/guest-reservations` | cookie HTTP-only del navegador | P | Reserva temporal propia o null; sin datos personales |
| POST `/guest-reservations` | raffleId, numbers (1..20 únicos) | P | 201 reserva por diez minutos, cookie; limita intentos y números pendientes por conexión |
| DELETE `/guest-reservations` | cookie del navegador | P | Cancela sólo la reserva anónima sin reclamar |
| POST `/guest-reservations/claim` | cookie temporal y sesión | U/A | Asocia la misma compra al usuario; cinco minutos para elegir pago |
| GET `/orders` | page opcional, 20 por página | U/A | `{ items, total, page }` de compras propias |
| POST `/orders` | raffleId, numbers (1..20 únicos) | U/A | 201 compra; UI navega a su detalle |
| GET `/orders/:id` | id | U/A | Compra propia; A puede consultar cualquier compra |
| PUT `/orders/:id/buyer` | email, firstName, lastName, dni | U/A propietario | Completa perfil antes del pago; identidad se copia a la compra al iniciar el medio |
| DELETE `/orders/:id` | id | U/A propietario | Sólo reserva elegible; no borra historial |
| POST `/orders/:id/checkout` | — | U/A propietario | `{ checkoutUrl }`; conserva/reutiliza preferencia |
| POST `/orders/:id/transfer` | accountId opcional: primary/secondary | U/A propietario | Copia el destino a la compra e inicia 24 horas para cargar; medio y cuenta deben estar habilitados |
| POST `/orders/:id/receipt` | multipart `receipt`, un PDF/JPG/PNG ≤5 MB | U/A propietario | 201 metadatos; estado UNDER_REVIEW |
| POST `/orders/:id/reconcile` | — | U/A | Consulta MP; A puede hacerlo desde panel |
| GET `/receipts/:id` | id | U/A | Archivo adjunto privado; otro titular 403; vencido 410 |
| POST `/payments/webhook` | query `data.id`, body payment, headers firmados | Firma MP | 200 después de procesar; inválida 401, fallo 5xx |
| GET `/admin/stats` | — | A | Rifas sólo DRAFT/ACTIVE, participantes, pendientes y suma de importes PAID; excluye del contador CLOSING/FINISHED/CANCELLED |
| GET `/admin/prizes` | — | A | Lista premios |
| GET `/admin/prizes/:id` | id | A | Premio individual |
| POST `/admin/prizes` | name, description | A | 201 premio |
| PUT `/admin/prizes/:id` | name, description | A | Premio actualizado |
| DELETE `/admin/prizes/:id` | id | A | 409 si asociado a rifa |
| GET `/admin/raffles` | — | A | Lista incluyendo borradores |
| GET `/admin/raffles/:id` | id | A | Detalle administrativo |
| GET `/admin/raffles/:id/buyers` | id | A | Compradores PAID, datos históricos, números y estado del correo |
| POST `/admin/raffles/:id/buyers/remove` | anchorOrderId, version, confirmation: CONFIRMAR | A | Baja de las compras mostradas, números libres antes del sorteo y reembolso pendiente |
| GET `/admin/raffles/:id/refunds` | id de rifa | A | Devoluciones solicitadas sin completar |
| POST `/admin/orders/:id/refund-complete` | reference, amountCents, confirmation: CONFIRMAR | A | Registra una devolución realizada externamente y genera su aviso |
| GET `/admin/raffles/:id/buyers.xlsx` | id | A | Excel real con Email, Apellido, Nombre, DNI y Números comprados; descarga auditada |
| GET `/admin/emails/status` | — | A | Servicio habilitado, pendientes y fallidos |
| POST `/admin/emails/:id/retry` | id del trabajo | A | Reactiva sólo trabajos FAILED; requiere corregir la causa del fallo |
| POST `/admin/raffles` | title, description, prizeId, ticketPriceCents, totalTickets, status, drawAt | A | 201; crear DRAFT o ACTIVE |
| PUT `/admin/raffles/:id` | mismos campos | A | Validación de asignados, pendientes y resultado |
| DELETE `/admin/raffles/:id` | id | A | 409 si hay historial de compras |
| POST `/admin/raffles/:id/activate` | id | A | Da de alta un borrador válido: DRAFT → ACTIVE, conservando su configuración |
| POST `/admin/raffles/:id/finish` | id | A | Cierra una activa o actualiza el resultado pendiente; DRAFT devuelve 409 |
| POST `/admin/raffles/:id/draw` | id | A | Retirado: devuelve 410 |
| GET `/admin/orders` | status opcional, page; 25 por página | A | Compras con titular y metadatos de comprobantes |
| POST `/admin/orders/:id/review` | decision: approve/reject; note opcional al aprobar, 5..500 al rechazar; reasonCode opcional | A | Sólo UNDER_REVIEW con TRANSFER; motivo editable, aviso al cliente y devolución pendiente para monto incorrecto |
| POST `/admin/orders/:id/resolve` | decision: assign/refund_recorded, note (10..500) | A | Sólo NEEDS_ATTENTION; no realiza reembolso externo |
| GET `/admin/users` | — | A | Hasta 500 usuarios, sin hashes ni JWT |
| GET `/admin/users/:id` | id | A | Usuario sin credenciales |
| POST `/admin/users` | mismos datos de registro | A | 201 USER; posterior cambio de rol es separado |
| PUT `/admin/users/:id` | role: USER/ADMIN, active | A | Invalida sesiones; no quita propio/último administrador |
| DELETE `/admin/users/:id` | id | A | Baja lógica; conserva compras y auditoría |
| GET `/admin/audit` | page | A | Acciones administrativas legibles, 50 por página, {items,page,total} |
| POST `/admin/receipts/purge` | — | A | Elimina sólo archivos vencidos |

## Ejemplos y unidades

Precio: `ticketPriceCents: 500000` significa ARS 5.000,00. Fechas ISO 8601; el frontend presenta fechas en Argentina. En nuevas rifas, números enteros de 0 a totalTickets-1 (00–99 para 100). Las rifas previas conservan numberStart=1 para respetar sus compras; consultar numberStart en la API.

```json
{"raffleId":"demo-rifa","numbers":[1,23,45]}
```

```json
{"decision":"approve","note":"Acreditación verificada en la cuenta de destino."}
```

`api.http` incluye pedidos de prueba. Para calificar permisos ejecutar las pruebas HTTP sin DB y la suite PostgreSQL; no alcanza con ocultar botones. El listado de usuarios tiene límite de 500 sin paginado y la consulta de auditoría ahora pagina 50 acciones administrativas: para mayor escala se debe ampliar la navegación, no asumir que es un archivo histórico exportable.


### Verificación e historial (12/11/2026)

- POST /auth/verify-email: token firmado y password opcional; público con límite de intentos, token personal de un uso.
- POST /profile/verification: titular autenticado; encola enlace al email actual.
- GET /profile/activity?page=1: historial exclusivo del titular.
- GET /admin/users/:id/activity?page=1: sólo ADMIN.
- GET /admin/users/:id: incluye perfil sin credenciales, sólo ADMIN.
- La información pública de rifa omite winnerOrderId y el fragmento HTML de evidencia. El enlace diario oficial sólo se incluye el día del resultado en Argentina.

Detalles y límites: [Lotería, cuentas y actividad](13-LOTERIA-CUENTAS-ACTIVIDAD.md).


### Tipos de administrador (12/11/2026)

Las respuestas de usuario incluyen adminType: PRIMARY, FUNCTIONAL o null. En PUT /admin/users/:id, sólo PRIMARY puede promover a ADMIN o modificar el acceso de otro ADMIN. Las promociones crean administradores FUNCTIONAL; adminType no se toma del payload. DELETE /admin/users/:id permite a FUNCTIONAL desactivar clientes, pero sólo PRIMARY puede desactivar administradores funcionales. La cuenta PRIMARY no puede degradarse ni desactivarse. Ver [matriz actual](14-ADMINISTRACION-PRINCIPAL-Y-SPAM.md).


### Ciclo de rifas revisado (12/11/2026)

- DELETE /admin/raffles/:id acepta reason opcional (0–1000 caracteres). Ambos tipos de ADMIN pueden cancelar aun con compradores o resultado previo. Cancelación lógica, copia privada de compradores, avisos y reembolsos pendientes.
- GET /admin/raffles/:id/buyers.xlsx conserva el listado al cancelar y sirve para descargarlo antes de la acción.
- POST /admin/raffles/:id/finish permite cierre anticipado y devuelve CLOSING si falta publicar/verificar el resultado o resolver pagos. En FINISHED devuelve el mismo resultado; no repite sorteo.
- Rifas con fecha prevista se cierran automáticamente al vencer; los resultados y avisos se reintentan mientras el servicio está activo.
- GET /raffles omite canceladas; GET /raffles/:id informa su cancelación sin datos de otros compradores.
- GET /admin/emails/status y POST /admin/emails/:id/retry abarcan avisos de compras, rifas y verificación.

Ver [reglas vigentes y fuente histórica](15-CANCELACION-Y-CIERRE-AUTOMATICO.md).
# Recaudación por rifa (actualización)

La configuración de varios puestos y premios se documenta en [Puestos y varios premios](18-PUESTOS-Y-VARIOS-PREMIOS.md). POST/PUT de rifas acepta `awards`; las respuestas incluyen sus premios y los resultados por puesto. Los datos de compra ganadora se omiten en las rutas públicas. Las reglas y asignaciones de premios se congelan desde la primera reserva.

`GET /api/admin/raffles` conserva el arreglo de rifas y agrega `revenueCents` a cada elemento: total en centavos de las compras en estado `PAID` de esa rifa. Se usan los importes históricos de las compras, independientemente del precio actual del número. Devuelve cero si no hay pagos confirmados. Órdenes pendientes, rechazadas, dadas de baja o reembolsadas no se suman. Requiere administrador principal o funcional; el importe no se incorpora a las rutas públicas de rifas.

Premios de números gratis: `GET /api/free-tickets` devuelve sólo los beneficios de la cuenta autenticada. `POST /api/orders/:id/free-tickets` canjea una reserva propia con saldo suficiente, confirma su participación e inmoviliza las asignaciones por $0. No recibe importes ni beneficios a acreditar desde el cliente. El tipo `FREE_TICKET` se configura en los premios; ver [contrato y reglas de canje](19-NUMEROS-GRATIS.md). Las participaciones gratuitas aparecen en compradores y no aumentan `revenueCents`.

### Gestión de cuentas de desarrollo (15/11/2026)

- `POST /api/admin/users`: datos de registro más `role` USER/ADMIN (USER predeterminado) y `sendVerification` booleano (false predeterminado). Sólo PRIMARY puede crear ADMIN; se crea FUNCTIONAL aunque el payload intente indicar PRIMARY. FUNCTIONAL conserva el alta de clientes anterior. Devuelve 201 y datos públicos, sin contraseña ni hash. Una verificación solicitada se crea en la misma transacción.
- `GET /api/admin/users/:id/deletion-preview`: sólo PRIMARY; devuelve `user`, `orders`, `activeOrders`, `activeBenefits`, `canDelete`. Cuenta principal o propia: 409. Inexistente: 404.
- `DELETE /api/admin/users/:id/permanent`: sólo PRIMARY, JSON `{"confirmation":"CONFIRMAR"}`. Revalida pendientes dentro de la transacción. Devuelve 200 `{"ok":true,"deleted":true}`; pendientes o principal: 409, confirmación inválida: 400. Conserva historial en las rifas; no elimina órdenes ni datos financieros. Sesiones previas dejan de autenticar.
- `DELETE /api/admin/users/:id` conserva su función anterior de **desactivar**, sin borrar registros. El diálogo ofrece esta alternativa cuando la eliminación está bloqueada por pendientes.

Reglas completas y persistencia: [gestión de cuentas](14-ADMINISTRACION-PRINCIPAL-Y-SPAM.md).

### Devoluciones separadas (15/11/2026)

Solicitud del titular: POST /api/orders/:id/refund-requests, numbers, reason opcional y requestId UUID. Sólo PAID acreditado y rifa activa con plazo abierto. No libera números ni modifica participación antes de aprobar. ADMIN consulta GET /api/admin/refund-requests y decide POST /api/admin/refund-requests/:id/review (decision, note); rechazo exige motivo. Importe calculado por servidor con precio histórico. La aprobación parcial conserva el resto de la compra y crea una devolución vinculada, sin ejecutar movimiento de dinero. Contrato y persistencia completos: [devoluciones parciales](22-SOLICITUDES-Y-DEVOLUCIONES-PARCIALES.md).

`GET /api/admin/orders?status=REFUND_PENDING&page=1` incluye compras REFUND_PENDING y REJECTED con refundRequestedAt no nulo y refundCompletedAt nulo. Ordena por solicitud ascendente. `status=REFUNDED` devuelve historial de devoluciones por fecha de realización descendente. Mantiene paginación de 25 y permisos ADMIN; incluye rifas canceladas y compradores desactivados. Los filtros anteriores se conservan. `GET /api/admin/stats` agrega pendingRefunds con el mismo criterio del filtro de pendientes. La interfaz los utiliza en la tarjeta Devoluciones, independiente de Compras y comprobantes. El registro sigue en `POST /api/admin/orders/:id/refund-complete`; no llama a un banco ni ejecuta movimientos de dinero.

Entrega manual (15/11): `POST /api/admin/users/:id/free-tickets` requiere administrador, destinatario activo, quantity 1–100, targetRaffleId obligatorio, reason opcional y requestId UUID. El destino debe ser un borrador o activa con ventas abiertas. La solicitud es idempotente. `GET /api/free-tickets` incluye origen nulo en entregas manuales, motivo y targetRaffle; availableRaffles contiene como máximo ese destino. Un premio automático vale para la primera rifa que se active después de confirmarlo. Consultas administrativas y asignación de beneficios manuales pendientes: ver [regla vigente](21-NUMEROS-GRATIS-CON-RIFA-ASIGNADA.md). Nuevas rifas requieren 10–10.000 números; diez utilizan una cifra. El cierre espera la Nocturna del día argentino en que se solicita, con fecha fija en los reintentos.
