# Backend Halcón Airguns

Express TypeScript con Prisma/PostgreSQL, JWT y roles. `src/app.ts` construye la app sin abrir puertos para probarla; `src/index.ts` conecta DB, inicia mantenimiento y escucha. `routes.ts` valida y aplica permisos; servicios de órdenes, pagos y comprobantes ejecutan las reglas y transacciones. Prisma concentra persistencia.

Copiar `.env.example` a `.env`. Desde la raíz: `npm run build -w backend`, `npm run db:migrate`, `npm run db:seed`, `npm start`. Desarrollo con `npm run dev -w backend`.

Pruebas sin DB: `npm test -w backend`. PostgreSQL: `npm run test:db -w backend`, con esquema temporal aislado. No se llaman APIs reales de pago. Watch: `npm run test:watch -w backend`.

Migraciones versionadas en `prisma/migrations`. Borrados de relaciones de negocio son `Restrict` para preservar compras y referencias. Reserva, vencimiento, revisión y confirmación son transacciones serializables con reintentos de conflicto; la combinación rifa/número tiene índice único. Precios se guardan por compra en centavos enteros.

JWT HS256 con issuer/audience, ocho horas, cookie HTTP-only y revocación por `tokenVersion`. Se permite Bearer para clientes de API; las escrituras con cookie validan origen. Roles se guardan en User; el registro público nunca elige ADMIN. Contraseñas bcrypt y límites de intentos, cabeceras Helmet, errores controlados y validación Zod.

Comprobantes privados fuera del build público, descarga con autorización, firma básica de tipo y máximo 5 MB. Purga: `npm run receipts:purge` desde la raíz; misma DB y almacenamiento que el servidor. Se retienen metadatos, nunca se borran compras al limpiar archivos.

Ver [contrato API y permisos](../Documentacion/05-API-Y-PERMISOS.md), [README principal](../README.md) y `api.http`. Los procesos anteriores en `legacy/` no se deben ejecutar.
