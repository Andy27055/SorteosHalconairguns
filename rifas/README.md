# Halcón Airguns — aplicación unificada

React + TypeScript + Vite, Express + JWT, PostgreSQL + Prisma, Mercado Pago Checkout Pro y transferencia con comprobante privado y revisión administrativa. El diseño usa el logo original, negro y dorado, en escritorio y celular.

## Estado local

La instalación de esta sesión usa PostgreSQL en Docker, puerto **5434**, y la aplicación compilada en **http://localhost:3011** para no interferir con otro servidor que ya ocupaba 3001. La configuración está en `.env` y `backend/.env`, excluidos de Git. La cuenta inicial local es `halcon-admin`; su contraseña aleatoria está en `ADMIN_PASSWORD` de `backend/.env`. No se publica ni se imprime en la consola. La rifa inicial está identificada como **demostración**, sin cobros habilitados.

```powershell
docker compose -p halcon-airguns up -d db
npm start
```

Abrir http://localhost:3011. Para modificar el frontend con recarga automática: `npm run dev` y abrir http://localhost:5173. El proxy local usa `frontend/.env`.

## Instalación desde cero

Requisitos: Node 22.12 o posterior y Docker Desktop con el motor Linux activo.

1. Ejecutar `npm ci` desde esta carpeta. Si npm bloquea scripts de dependencias, revisar y autorizar únicamente Prisma, sus motores y esbuild (`npm install-scripts ls`).
2. Copiar `.env.example` a `.env`, definir una contraseña de PostgreSQL y `JWT_SECRET` aleatorios.
3. Copiar `backend/.env.example` a `backend/.env`. Hacer coincidir `DATABASE_URL` con usuario, contraseña, puerto y base del Compose. Elegir `ADMIN_USERNAME`, `ADMIN_EMAIL` y una contraseña nueva de al menos diez caracteres para crear al administrador.
4. `docker compose -p halcon-airguns up -d db`.
5. `npm run build`, `npm run db:migrate`, `npm run db:seed`.
6. Retirar `ADMIN_PASSWORD` del entorno después de crear la cuenta. El seed es idempotente: no cambia contraseñas ni promueve cuentas de participantes por coincidencia de nombre.
7. `npm run dev` para desarrollo; `npm start` para servir la compilación de frontend junto a la API.

`SEED_DEMO=true` crea una rifa de demostración; no representa un premio real. El usuario de prueba opcional requiere `DEMO_EMAIL` y `DEMO_PASSWORD`, sin claves fijas versionadas.

## Mercado Pago

El backend crea una preferencia y devuelve el enlace del checkout. La compra conserva una referencia estable, sus números y el importe al reservar. El navegador no marca una compra como pagada por los parámetros de retorno: consulta el estado registrado en servidor.

Completar en el entorno del backend:

| Variable | Uso |
|---|---|
| `MP_ACCESS_TOKEN` | Credencial privada del vendedor; nunca se envía al frontend |
| `MP_WEBHOOK_SECRET` | Firma secreta de Webhooks de esa integración |
| `MP_SANDBOX` | `true` para probar; `false` para producción con credenciales correspondientes |
| `PUBLIC_API_URL` | URL pública HTTPS del backend, sin barra final |
| `FRONTEND_URL` | URL del frontend, sin barra final; en despliegue unificado coincide con la del servicio |

Configurar en Mercado Pago el evento **Pagos / payment** hacia `https://TU_SERVICIO/api/payments/webhook`. Se valida HMAC de `x-signature`, `x-request-id` y `data.id`, se consulta el pago al proveedor y se cotejan referencia, importe, moneda y entorno. Fallas de procesamiento devuelven error para permitir reintentos; además existe consulta manual de conciliación.

Un pago que llega cuando se perdió la reserva queda `NEEDS_ATTENTION`, sin quitar números a otra persona. El administrador puede conciliar una asignación disponible después de verificar la acreditación. Si corresponde devolución, debe realizarla en el proveedor y registrar el resultado mediante el endpoint de conciliación; **la aplicación no ejecuta reembolsos bancarios automáticamente**.

La integración está implementada y probada con un proveedor simulado; faltan credenciales del vendedor, URL HTTPS y una compra de prueba real para verificar la cuenta. Sin esos datos Mercado Pago aparece deshabilitado.

Referencias: [Checkout Pro con Preferences](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro-preferences/overview), [Webhooks oficiales](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/additional-content/notifications/webhooks).

## Transferencias y comprobantes

Completar `TRANSFER_HOLDER` y al menos `TRANSFER_ALIAS` o `TRANSFER_CBU` en el backend. Esos datos son públicos para poder transferir; no se debe inventar una cuenta ni habilitar el medio con datos de ejemplo.

1. El participante reserva números y elige transferencia.
2. Tiene 24 horas para subir PDF, JPG o PNG de hasta 5 MB. Se comprueba el contenido básico del archivo, no sólo su extensión.
3. El archivo se guarda fuera de los recursos públicos, con nombre aleatorio, y sólo lo descargan su propietario o un administrador autenticado.
4. La compra queda `UNDER_REVIEW`; enviar un comprobante no confirma el pago. El administrador verifica la cuenta bancaria y aprueba o rechaza con una observación.
5. La aprobación conserva los números y su importe. El rechazo libera los números y deja el historial.

**Retención:** tres meses calendario desde `uploadedAt`, ajustando al último día válido del mes. El archivo deja de poder descargarse al vencer. El servidor elimina archivos vencidos al iniciar y en su mantenimiento periódico de un minuto; conserva compra, hash, fechas y decisión de revisión. Si está apagado, elimina al reanudarse. Para una ejecución independiente: `npm run receipts:purge`, o tarea programada que ejecute ese comando con el mismo entorno y volumen. Backups del volumen deben excluir archivos vencidos y tener una política de retención coherente; restaurar un backup debe ir seguido de la limpieza.

`RECEIPT_STORAGE_PATH` debe apuntar a almacenamiento **privado y persistente** en producción. No usar la carpeta pública ni el disco efímero de un hosting. Una revisión pendiente cuyo archivo venció no puede aprobarse desde el flujo normal; debe conciliarse con el participante y la acreditación.

## Testing y verificaciones

```powershell
npm test
npm run test:db -w backend
npm run test:e2e
npm run build
npm audit
```

- `npm test`: validadores, seguridad de firmas, retención, permisos HTTP sin DB y componentes/formularios React. Las pruebas de DB se omiten salvo habilitación expresa.
- `test:db`: requiere PostgreSQL accesible mediante `TEST_DATABASE_URL` o `DATABASE_URL`. Crea un esquema `halcon_test_<uuid>`, aplica migraciones y lo elimina al finalizar. Prueba concurrencia real, transacciones, reservas, importes históricos, comprobantes, limpieza y pagos simulados. No borra ni modifica el esquema de la aplicación.
- `test:e2e`: requiere la aplicación iniciada, Edge instalado, `backend/.env` local con el administrador de prueba y la rifa demo. URL por `E2E_BASE_URL` (default http://localhost:3011). Comprueba catálogo, selección por teclado/roles, login, restauración de sesión, navegación y vistas móviles. No efectúa pagos reales. Capturas en `playwright-artifacts/` (ignoradas).
- Los mocks de Mercado Pago no acreditan compatibilidad con la cuenta del vendedor: completar una compra sandbox y comprobar Webhook antes de habilitar cobros.

## Datos anteriores y recuperación

Las fuentes originales están en `legacy/`; el formulario original en `SorteoHalconAirguns` se conserva. El JSON `data/db.json` anterior no se mueve ni se modifica y no se sirve al navegador.

```powershell
# Primero simular, usando una ruta absoluta del JSON de la versión anterior:
npm run db:import -w backend -- "RUTA_ABSOLUTA_AL_DB_JSON"
# Después de revisar el resumen y respaldar las bases:
npm run db:import -w backend -- "RUTA_ABSOLUTA_AL_DB_JSON" --apply
```

La importación es transaccional e idempotente y no asigna privilegios por nombre. Usuarios antiguos conservan el hash de contraseña y deben actualizar su email provisional. Las reservas pendientes antiguas se importan vencidas, no como pagos confirmados. Las ventas conservan sus referencias; como el JSON no guardaba el importe histórico, se anota que el precio fue tomado de la rifa y debe cotejarse con el proveedor. Si hay datos incoherentes o compras de más de 20 números, se detiene sin modificar el origen. Se admite el formato `users/raffles/tickets` de la versión revisada; el formato anterior de una sola `config` requiere conversión previa explícita.

Restablecimiento por el operador del servidor: `node reset-password.js USUARIO`. Solicita la nueva contraseña de forma oculta y revoca sesiones. El participante puede cambiar su propia contraseña en Perfil; no se implementó recuperación por email sin un servicio de correo configurado.

Respaldar PostgreSQL con `pg_dump` o snapshots del proveedor; probar restauración en una base separada. Mantener el almacenamiento privado de archivos coherente con las fechas de retención y ejecutar limpieza tras restaurar. No copiar credenciales al README, Git ni al chat.

## Deploy

Se recomienda **un origen público**: Express sirve el build React y `/api`; PostgreSQL puede alojarse en Neon. Así las cookies HTTP-only y la rehidratación funcionan sin depender de cookies de terceros.

1. Conectar el repositorio al hosting y elegir contexto Docker de esta carpeta y `backend/Dockerfile.prod`.
2. Configurar `DATABASE_URL` de Neon, `NODE_ENV=production`, `JWT_SECRET` aleatorio, `FRONTEND_URL` y `PUBLIC_API_URL` HTTPS. `PORT` lo puede inyectar el hosting.
3. Montar volumen persistente en `/app/data/receipts` y definir `RECEIPT_STORAGE_PATH` con esa ruta. El `render.yaml` de ejemplo usa un servicio con disco y plan de pago; revisarlo antes de crear infraestructura. No se desplegó ni se contrató ningún servicio.
4. El contenedor compila en dos etapas y ejecuta `prisma migrate deploy` antes de arrancar. Ejecutar el seed de administrador desde un entorno controlado apuntando a esa base.
5. Configurar credenciales de Mercado Pago y datos de transferencia, probar con cuentas de prueba y verificar permisos, compra, comprobante, descarga y limpieza.
6. Verificar `/api/health`, recarga de rutas internas, copias de seguridad y persistencia de archivos tras reiniciar. Activar auto-deploy sólo después de revisar el código en Git.
7. Registrar las URLs y usuarios de evaluación en el canal del grupo, sin publicar contraseñas en el repositorio.

Para separar un Static Site y la API se necesita configurar `VITE_API_URL`, CORS y una estrategia de autenticación compatible con ambos dominios (preferentemente un proxy bajo el mismo sitio). El despliegue unificado incluido evita ese requisito. Referencia: [discos persistentes de Render](https://render.com/docs/disks).

## Documentación

[Índice de documentación](Documentacion/README.md): alcance, dominio, reglas, backlog, wireframes, contrato API, matriz de permisos y estado de la implementación frente al análisis original. Las acciones externas de equipo (Trello, PR, reviews, avisos y presentación) requieren evidencia real y no se simulan.
