# Validación local — 31/10/2026

## Resultado

| Verificación | Resultado |
|---|---|
| Build backend TypeScript / Prisma | Correcto |
| Build frontend TypeScript / Vite | Correcto |
| Unitarias y permisos HTTP sin DB | 37 pruebas correctas |
| Componentes y formularios React | 8 pruebas correctas |
| Integración PostgreSQL real, esquema temporal | 15 pruebas correctas |
| Edge escritorio/móvil | 3 pruebas correctas |
| Total de casos distintos | 63 |
| Auditoría npm | 0 vulnerabilidades reportadas |
| Imagen Docker Linux de producción | Construida correctamente |
| Arranque de imagen, migraciones y `/api/health` | Correcto; sin migraciones pendientes |
| HTTP de `/`, `/compras` y `/logo.png` en imagen | 200 en los tres |
| Simulación de importación de JSON anterior | Formato válido: 3 usuarios, 2 rifas y 1 compra; sin escrituras |
| Exclusión de configuración privada | `.env`, `backend/.env`, `frontend/.env` y configuración temporal ignorados por Git |

Las pruebas incluyen reserva concurrente, indivisibilidad, importe histórico, expiración, carga/descarga privada, revisión administrativa, eliminación de archivos sin borrar compras, Webhooks repetidos, importes incorrectos, pagos tardíos, registro con nombre admin sin privilegios y bloqueo de conciliación de un pago inconsistente.

El flujo de transferencia se probó por HTTP con datos ficticios dentro de un esquema aislado. El proveedor de Mercado Pago se sustituyó por un gateway simulado en las pruebas; no se ejecutaron cobros reales.

Capturas locales: `playwright-artifacts/home-desktop.png`, `home-mobile.png` y `admin-desktop.png`. Se regeneran y se limpian al ejecutar Playwright y no se versionan.

Se conservan el JSON anterior y las fuentes originales. No se importó automáticamente su historial ni se acreditaron pagos por la importación. No se publicó en hosting ni se realizaron acciones en canales del equipo. Los procesos y contenedores temporales de verificación se detienen; el volumen de PostgreSQL se conserva.
