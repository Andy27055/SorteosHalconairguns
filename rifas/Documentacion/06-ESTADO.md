# Estado de implementación frente al diagnóstico anterior

El archivo `ANALISIS_APUNTES_Y_FALTANTES.md` es el diagnóstico previo de ambos proyectos. La implementación se unificó en esta carpeta; los originales se conservan en `legacy/` y el proyecto pequeño original no se modifica.

## Implementado

- React/TypeScript/Vite, UI con Bootstrap/React Bootstrap, layouts, Router, formularios controlados con Zod en registro, AuthContext, useFetch y páginas funcionales.
- Express/TypeScript, servicios de compras, pagos y comprobantes, persistencia Prisma/PostgreSQL y errores centralizados.
- CRUD API de premios, rifas y usuarios (baja lógica), administración, matriz de permisos y contrato.
- Esquema relacional, migraciones versionadas, restricciones e índices únicos, seed controlado y herramienta de importación de JSON.
- JWT con roles persistidos, revocación, cookies HTTP-only, origen validado, bcrypt, límites de autenticación y cabeceras de seguridad.
- Reserva indivisible de números con concurrencia controlada, importes históricos y compras durables.
- Integración técnica de Checkout Pro y Webhooks, referencias estables, verificación de firma, estado/importe/moneda/entorno y conciliación.
- Transferencia alternativa, comprobante privado, aprobación/rechazo motivado y eliminación del archivo a tres meses.
- Seguimiento de compras, revisión administrativa, auditoría, protección de borradores y minimización de disponibilidad pública.
- Sorteo único auditado entre números pagados, con bloqueo de pendientes y resultado público.
- Nuevo diseño y logos consistentes; botones accesibles para números y modales con administración de foco.
- Docker de desarrollo/producción, migraciones, variables de ejemplo, documentación, requests HTTP y configuración de CI preparada.

Los puntos específicos de A se incorporan en los flujos nuevos de B; no se amplía el Apps Script anterior. Por eso el backend externo de Apps Script no se considera verificado ni parte de la aplicación unificada.

## Verificado en esta sesión

- Build de TypeScript y Vite.
- Pruebas unitarias/HTTP de backend y pruebas React.
- PostgreSQL real: esquema temporal, migraciones, exclusividad concurrente, transacciones, precios históricos, archivos y limpieza, pagos simulados e integridad.
- Navegador Edge: catálogo, login administrativo, rehidratación, navegación, selección y tamaños escritorio/móvil; capturas locales.
- Auditoría npm sin vulnerabilidades reportadas al instalar las correcciones.

Los resultados finales de ejecución se resumen en la respuesta y se pueden reproducir con los comandos del README. No se hizo un cobro real, no se llamó al proveedor con credenciales del vendedor y no se desplegó infraestructura.

## Pendiente de datos o acciones externas

- Credenciales de Mercado Pago, firma Webhook y URL HTTPS; compra sandbox del vendedor y prueba de Webhook de su cuenta.
- Titular y alias o CBU/CVU para habilitar transferencia. Se dejan deshabilitados ambos medios hasta configurarlos.
- Condiciones particulares y datos comerciales, premio real, entrega y validación del alcance por el organizador.
- Selección/contratación de hosting con almacenamiento privado persistente, Neon y publicación. `render.yaml` es un ejemplo, no infraestructura creada.
- Verificar copias/restore y retención también en los respaldos de producción.
- Migrar historial sólo después de respaldar y revisar la simulación. No se importaron automáticamente ventas ni usuarios reales del JSON.
- Trello, planificación del equipo, participación, PR y revisiones cruzadas, avisos de entrega y presentación. La documentación preparada no sustituye esas evidencias.

## Límites deliberados y ampliaciones

- Recuperación por email requiere un servicio de correo; por ahora hay cambio autenticado y reset local seguro.
- Reembolsos requieren la operación externa y su registro; no hay botón que devuelva fondos automáticamente.
- El proveedor de pagos se prueba con un gateway simulado hasta configurar su cuenta.
- El mantenimiento físico de archivos requiere proceso activo o tarea programada sobre el mismo volumen; las descargas sí se bloquean al vencer aunque la limpieza se retrase.
- La primera migración de datos acepta el formato `users/raffles/tickets` revisado. No adivina la conversión de formatos anteriores ni corrige importes históricos inexistentes.
- La matriz documenta límites de listado/paginación. Para grandes volúmenes se debe ampliar búsqueda/exportación y almacenamiento/rate limiting compartido.
- Formulario de registro validado por Zod en cliente; todos los endpoints de escritura validan en backend. Otros formularios combinan restricciones HTML y validación de servidor.

La lista original no se marca íntegramente como completada: incluye comprobaciones externas, recomendaciones condicionales y tareas organizativas que no se pueden acreditar escribiendo código.
