# Backlog y criterios de aceptación

Las prioridades y tamaños siguientes son una propuesta de organización del trabajo entregado. No representan estimaciones consensuadas ni actividad registrada en Trello. M = mediana, S = pequeña, L = grande.

| ID / épica | Historia | Prioridad / tamaño | Aceptación Dado / Cuando / Entonces | Referencias |
|---|---|---|---|---|
| HU01 / Cuenta | Como visitante quiero registrarme e ingresar para gestionar mis compras | Must / M | Dado un registro válido, cuando lo envío, entonces se crea USER y una sesión; no puedo elegir ADMIN | RF02, RN06 |
| HU02 / Catálogo | Como visitante quiero ver rifas y premios para elegir una oportunidad | Must / S | Dado un borrador, cuando consulto catálogo/detalle público, entonces no lo veo | RF01 |
| HU03 / Reserva | Como participante quiero reservar números para que nadie más los tome durante el pago | Must / L | Dado un número libre, cuando dos usuarios lo reservan al mismo tiempo, entonces sólo uno lo obtiene | RF04, RN01–03 |
| HU04 / Checkout | Como participante quiero abrir Mercado Pago y consultar la confirmación | Must / L | Dada una compra, cuando reintento el checkout, entonces recupero la preferencia; volver de MP no confirma por sí solo | RF05, RN05/10/11 |
| HU05 / Transferencia | Como participante quiero enviar un comprobante para que acrediten mi transferencia | Must / M | Dada una transferencia iniciada, cuando envío un PDF/JPG/PNG válido, entonces queda bajo revisión y con fecha de eliminación | RF06, RN04/08/09 |
| HU06 / Revisión | Como administrador quiero aprobar o rechazar después de verificar la cuenta | Must / M | Dado un comprobante vigente, cuando apruebo, entonces la compra queda PAID; si rechazo, se liberan números y queda observación | RF06/07, RN04 |
| HU07 / Privacidad | Como participante quiero que sólo yo y el administrador veamos mis comprobantes | Must / M | Dado el archivo de otra compra, cuando intento descargarlo, entonces recibo 403; al vencer recibo 410 | RN07/09 |
| HU08 / Retención | Como organizador quiero eliminar archivos viejos sin perder las ventas | Must / M | Dado un archivo que cumplió tres meses, cuando corre mantenimiento, entonces se elimina sólo el archivo y queda historial | RF09, RN09 |
| HU09 / Catálogo admin | Como administrador quiero crear/editar premios y rifas | Must / M | Dada una rifa con historial, cuando intento eliminarla, entonces la API lo impide | RF03, RN12 |
| HU10 / Permisos | Como administrador quiero controlar el acceso del equipo sin perder la cuenta principal | Must / M | Dado el último administrador, cuando intento retirarlo, entonces la operación se bloquea | RF03, RN13 |
| HU11 / Resultados | Como organizador quiero realizar un sorteo único y dejar resultado público | Should / M | Dados números PAID y sin pendientes, cuando confirmo el sorteo, entonces se registra un único ganador y no puede repetirse | RF08, RN14/15 |
| HU12 / Operación | Como operador quiero instalar, probar y respaldar la app de forma reproducible | Must / L | Dado un entorno nuevo, cuando aplico migraciones, seed y build, entonces el sitio arranca con configuración explícita | README, CI, Docker |

Dependencias: HU03 requiere HU01/02; HU04/05 dependen de HU03; HU06/07/08 dependen de HU05; HU11 depende de estados de pago y permisos; HU12 atraviesa todo el producto.

## Tareas externas que quedan abiertas

- [ ] Elegir responsable y estimación del equipo para cada historia y validar aceptación con el organizador.
- [ ] Crear/actualizar Trello, accesos docentes y To Do / Doing / Review / Done.
- [ ] Hacer PR y revisiones cruzadas reales por integrante y registrar decisiones.
- [ ] Cargar credenciales y datos del organizador, verificar sandbox y probar cobro/devolución con su cuenta.
- [ ] Revisar y completar reglas particulares, condiciones, premio real y entrega.
- [ ] Publicar, verificar URLs y avisar la entrega por el canal del grupo.
- [ ] Preparar presentación y ensayar demo con participación de todos.
