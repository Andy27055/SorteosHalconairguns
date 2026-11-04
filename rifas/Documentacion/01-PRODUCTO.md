# Visión y alcance

## Problema y propuesta

Unificar el formulario de inscripción y el sistema de rifas para que los participantes puedan elegir números, reservarlos sin duplicados, pagar y consultar su confirmación. El organizador administra premios, rifas, participantes y comprobantes sin editar archivos de datos.

## Actores

- Visitante: consulta catálogo, disponibilidad, condiciones y resultados.
- Participante: se registra, reserva, paga, envía comprobantes y consulta sus propias compras.
- Administrador: gestiona catálogo y permisos, verifica transferencias, concilia pagos y realiza el sorteo.
- Mercado Pago: checkout y confirmación de estados, mediante consultas del backend y Webhooks firmados.
- Operador del servidor: configura credenciales, almacenamiento, cuentas iniciales, backups y mantenimiento.

## Alcance incluido

Registro y login; perfiles; roles; catálogo de rifas; premios; reservas de varios números; compra con importe histórico; integración de enlaces Checkout Pro; transferencia con archivo privado; revisión manual; vencimientos; eliminación del archivo a tres meses; auditoría; resultado único por rifa; pruebas, migraciones, seed y archivos de despliegue.

## Límites y decisiones

- No se procesan ni almacenan datos de tarjetas: el pago sucede en Mercado Pago.
- No se inventan datos bancarios ni se habilitan cobros sin configuración del organizador.
- No hay devolución bancaria automática: se concilia con el proveedor y se registra la resolución.
- No hay recuperación por email sin un proveedor de correo. Hay cambio de contraseña autenticado y reset local seguro por el operador.
- La documentación de condiciones explica el funcionamiento. Las condiciones particulares, entrega del premio y datos comerciales deben ser completados por el organizador.
- No se publicaron sitios ni se contrataron servicios. El seed local usa una rifa marcada como demostración.

## Glosario

| Término | Significado |
|---|---|
| Rifa | Convocatoria con premio, cantidad de números, precio, estado y resultado |
| Premio | Descripción del elemento asociado a una o varias rifas |
| Reserva | Asignación temporal de números vinculada a una compra |
| Compra / orden | Registro durable de usuario, números, importe histórico y estado |
| Asignación | Exclusividad de un número en una rifa para una compra |
| Preferencia | Configuración de checkout creada en Mercado Pago |
| Comprobante | Archivo enviado por el participante; no acredita por sí mismo el ingreso de fondos |
| Revisión | Verificación manual de una transferencia con decisión y observación |
| Conciliación | Resolución de un pago tardío o inconsistente sin quitar números de otras compras |
| Retención | Plazo de disponibilidad del archivo, independiente del historial de compra |
| Auditoría | Registro de actor, acción, entidad, fecha y detalle de una operación |

## Riesgos y verificación

Concurrencia: índice único y transacciones serializables. Pago tardío: estado de atención y conciliación. Pérdida de archivos: volumen persistente y backups acordes a retención. Caída del proveedor: error recuperable y preferencia con referencia durable. Datos externos ausentes: medios de pago deshabilitados hasta configurarlos.
