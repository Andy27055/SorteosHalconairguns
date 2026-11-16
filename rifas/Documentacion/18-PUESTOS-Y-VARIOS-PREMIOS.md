# Puestos premiados y varios premios por rifa

Implementado el 14/11/2026. El usuario confirmó que el primer puesto de la rifa toma las últimas cifras del primer resultado de la Quiniela de la Provincia de Buenos Aires, Nocturna; el segundo puesto toma las del segundo resultado, y así sucesivamente.

## Flujo de configuración

En Administración → Rifas → Nueva rifa se utiliza un asistente:

1. **Datos:** título, descripción, precio, cantidad de números, cantidad de puestos premiados y fecha prevista opcional. Cien números sigue siendo el valor predeterminado modificable. Las cifras se calculan automáticamente; no se eligen en un selector.
2. **Premios por puesto:** uno o varios premios del catálogo en cada puesto, con cantidad de unidades por premio. Un premio puede reutilizarse en varios puestos. «Crear premio» abre un editor dentro del puesto y guarda/asigna el premio sin abandonar el asistente.
3. **Revisión:** resumen de datos, puestos, premios, cantidades y reglas. Se elige Borrador o Activa y se confirma la creación o edición.

Se puede volver al paso anterior sin perder los datos. La rifa se guarda al confirmar el último paso. Los premios nuevos creados dentro del asistente se guardan en el catálogo de forma independiente y permanecen allí si después se cancela la creación de la rifa.

Se configuran entre 1 y 20 **puestos**, correspondientes a los veinte resultados oficiales. La cantidad de personas diferentes ganadoras puede ser menor: una misma persona puede ganar varios puestos con uno o varios números. Si se repiten las últimas cifras en distintas posiciones oficiales, el mismo número puede recibir los premios de todas esas posiciones. No se descartan ganadores repetidos.

El usuario aclaró la regla de cifras el 14/11: mínimo 10 números → una cifra (0–9), 100 → dos (00–99), 1.000 → tres (000–999), 10.000 → cuatro (0000–9999). Se usa `max(1, longitud(totalTickets - 1))`. El resultado 1237 corresponde a 7, 37, 237 o 1237, respectivamente. La numeración comienza en cero. Para cantidades intermedias se usa la misma regla: 150 números son 000–149; si sale 237, el cierre queda pendiente por estar fuera del rango. No se aplica módulo ni se inventa un reemplazo.

Dentro de un puesto no se agrega dos veces el mismo artículo: para varias unidades se usa su cantidad, de 1 a 100. Los puestos deben ser consecutivos desde el primero y cada uno debe tener al menos un premio.

## Reglas guardadas e historial

RaffleAward guarda el puesto y su eventual número ganador, resultado oficial de cuatro cifras, compra ganadora y nombre público enmascarado. AwardPrize guarda los premios de cada puesto, su cantidad y una copia de nombre/descripción. El vínculo al catálogo permite reutilizar artículos; editar el catálogo no cambia silenciosamente los premios ya ofrecidos en una rifa.

El backend impide cambiar puestos, premios o cantidades desde la primera reserva o compra. El asistente los muestra bloqueados cuando la rifa tiene movimientos. Se mantienen las restricciones existentes de fecha, numeración y cifras. Los demás cambios que ya permitía el panel conservan sus controles anteriores.

No se remapeó la numeración de rifas antiguas. Los campos históricos del primer premio y ganador se conservan para compatibilidad. Las rifas creadas con la API anterior, sin arreglo de puestos, siguen teniendo un primer puesto y un premio.

## Determinación de ganadores

El lector diario y el histórico conservan los veinte resultados oficiales en orden. Se reutiliza la evidencia de LotteryDraw que ya estaba guardada; si es una evidencia anterior sin el arreglo explícito, se recuperan los veinte números del HTML o del extracto histórico conservado. No se inventan puestos si la evidencia está incompleta.

Al cerrar, para cada puesto se toman las últimas cifras calculadas según la cantidad de números y se exige que ese número pertenezca a una compra PAID de la misma rifa. Las rifas anteriores con una regla nula o incompatible quedan pendientes para revisión; no se reescriben sus compras ni se asigna una regla silenciosamente. Se admiten varias posiciones para la misma compra o persona. Todos los premios y el estado FINISHED se confirman en una transacción. Los cierres concurrentes y los reintentos no duplican resultados ni correos.

Si falta un número vendido, una asignación pagada, la revisión de un pago o un resultado verificable, la rifa sigue CLOSING. No se publican ni notifican ganadores parciales y no se elige un reemplazo: la regla para números no vendidos continúa pendiente, como había solicitado el usuario.

La nueva indicación del 15/11 vuelve a la Nocturna del día del cierre efectivo, según fecha argentina. Se fija esa fecha al cerrar y, si falta el resultado, se espera esa edición sin buscar días anteriores. Ver [regla vigente de cierre](15-CANCELACION-Y-CIERRE-AUTOMATICO.md).

## Página y correos

El catálogo resume los premios por puesto y el detalle los muestra completos. El anuncio final muestra cada puesto, número, nombre enmascarado, premios, cantidades y resultado oficial utilizado. La misma persona puede aparecer varias veces. El enlace oficial diario continúa visible sólo durante el día del resultado.

Cada compra ganadora recibe un solo aviso que detalla todos los puestos y premios ganados por esa compra. Si una persona gana mediante distintas compras, puede recibir un aviso por cada compra. Los administradores activos reciben el conjunto de resultados con los datos privados necesarios para contactar ganadores. Los endpoints públicos y las compras del titular omiten los identificadores de las compras ganadoras y no publican correos, DNI ni nombres completos de otros participantes.

## Contrato API

POST/PUT `/api/admin/raffles` acepta el campo opcional `awards`:

```json
{
  "title": "Rifa con varios premios",
  "prizeId": "rifle",
  "ticketPriceCents": 150000,
  "totalTickets": 100,
  "lotteryDigits": 2,
  "status": "ACTIVE",
  "awards": [
    {"rank": 1, "prizes": [{"prizeId": "rifle", "quantity": 1}, {"prizeId": "mira", "quantity": 2}]},
    {"rank": 2, "prizes": [{"prizeId": "rifle", "quantity": 1}]}
  ]
}
```

`prizeId` se conserva por compatibilidad y debe corresponder a uno de los premios del primer puesto. `lotteryDigits` es opcional: el servidor lo deriva de `totalTickets`; si se proporciona, debe coincidir con esa cantidad. Las respuestas de rifas y compras incluyen `awards` con los premios y sus copias descriptivas. El listado administrativo agrega `hasOrders` para bloquear reglas en la interfaz. Las autorizaciones siguen siendo las mismas para administradores principales y funcionales.

## Migración y respaldo

La migración transaccional `202611140001_multiple_awards` es la décima de la base local. Crea las dos tablas y convierte cada rifa existente en un primer puesto, copiando su premio y los datos de ganador ya registrados.

Antes de aplicarla se verificó un respaldo pg_dump en `.demo/backups/halcon-before-multiple-awards-20261114.dump`, excluido de Git y Docker. Se compararon cantidades y huellas de las tablas de usuarios, rifas, compras, asignaciones, comprobantes, correos y resultados oficiales antes/después: no se modificaron sus datos. No se enviaron correos ni se confirmaron ganadores reales durante la implementación.

## Validación

Pruebas de backend, frontend y PostgreSQL cubren varios premios por puesto, reutilización, cantidades, conservación de rifas anteriores, copias del catálogo, ganador repetido, compras distintas del mismo titular, protección de datos, número no vendido, congelamiento de reglas e idempotencia del cierre. La prueba de navegador recorre el asistente y el resultado en anchos de 390 y 320 píxeles, y vuelve a comprobar las pantallas de cierre e historial existentes. Las capturas quedan en playwright-artifacts.

Resultado final: 82 pruebas de backend, 52 de frontend, 92 de PostgreSQL y 14 de navegador correctas (240 en total). Ambos builds correctos. Se inspeccionaron las capturas de configuración, revisión y ganadores a 320 píxeles.

No se contrató alojamiento ni se abrió un túnel público. Para la revisión se utilizó únicamente un preview local del build con API simulada; el servidor real de compras, correos y cierres programados no se inició.

Revisión posterior de cifras automáticas: 90 pruebas backend, 54 frontend, 96 PostgreSQL y 6 navegador correctas (246), con ambos builds correctos. Se verificaron cierres con resultado 1237 para 100/1.000/10.000 números, terminación con ceros, resultado fuera de rango y conservación de la selección al paginar en móvil. El usuario pidió probar en local: web 5173 y API 3011 quedaron iniciadas con SMTP y tareas programadas pausados por variables de esta sesión, sin modificar .env. Ver continuidad para el estado vigente de ejecución.
