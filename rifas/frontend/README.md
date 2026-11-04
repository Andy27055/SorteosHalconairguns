# Frontend Halcón Airguns

Desde la raíz: `npm run dev -w frontend`; Vite en localhost:5173. API por proxy configurable con `API_PROXY_TARGET` en `.env` y `VITE_API_URL=/api`.

`npm run build -w frontend` compila TypeScript y genera `dist/`; `npm test -w frontend` ejecuta pruebas React y validación. `npm run test:watch -w frontend` mantiene Vitest activo.

Páginas: catálogo, registro, login, rifa/grilla, compras, detalle/pago/comprobante, perfil, administración y condiciones. Componentes, layouts, hooks y tipos separados. Bootstrap/React Bootstrap, Router, Zod y AuthContext. El bearer sólo vive en memoria y la sesión puede recuperarse con cookie HTTP-only. No se guardan credenciales en localStorage.

El logo se centraliza en `public/logo.png`; favicon, cabecera, hero, tarjetas, formularios y pie usan el mismo archivo. Cambiarlo reemplaza la identidad de toda la app activa.
