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

## Pendiente: finalización por lotería — pausa del usuario, 08/11/2026

El usuario pidió esperar hasta obtener la información faltante y apagar los servicios. **No continuar modificando la finalización ni la numeración hasta que retome este trabajo.** En esta etapa sólo se investigaron fuentes y se leyeron archivos; no se sustituyó el mecanismo de sorteo ni se migraron números.

Decisiones ya indicadas para cuando se retome:

- Reemplazar el sorteo aleatorio por **Finalizar rifa**, consultando un resultado oficial de lotería, identificando al comprador ganador y guardando evidencia del resultado.
- **100 números como valor predeterminado, siempre editable** para permitir rifas de más o menos números. No fijar la cantidad en 100.
- En las rifas de 100 números, mostrar **00 a 99**. Revisar y acordar el tratamiento de números ya reservados/comprados antes de migrar; no renumerar silenciosamente operaciones existentes.
- El usuario no tiene definida la regla si el número ganador no fue vendido. Esa decisión queda pendiente; no elegir otro ganador ni inventar una regla.
- Falta confirmar juego/jurisdicción, turno y premio de referencia. No se confirmó que sea Quiniela de la Ciudad, Nocturna, primer premio; fue una pregunta, no una decisión del usuario. También debe quedar explícita la fecha de referencia y el tratamiento de otras cantidades de números.

La investigación preliminar encontró resultados en el sitio oficial de LOTBA: `https://quiniela.loteriadelaciudad.gob.ar/?page=home`. Su página carga `includes/resultados-data.php?sorteo=NUMERO`, con fecha, modalidad, jurisdicciones, posiciones y enlaces al extracto. Se verificó el formato mediante lectura, sin ejecutar el código remoto ni finalizar rifas. Es una fuente del sitio web, no se verificó un contrato de API pública estable. Revisar la fuente que corresponda cuando el usuario confirme el juego.

El trabajo anterior quedó guardado localmente: pagos, comprobantes, compradores, bajas, avisos y aprobación con observación opcional. La base tiene seis migraciones aplicadas; SMTP y credenciales de Mercado Pago continúan pendientes. Para retomar la aplicación: iniciar Docker Desktop, ejecutar `docker compose -p halcon-airguns up -d db` y luego `npm start` desde `Halcon airguns rifas/rifas`; URL local `http://localhost:3011`.
