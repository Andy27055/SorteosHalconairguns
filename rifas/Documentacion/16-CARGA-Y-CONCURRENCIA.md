# Preparación conservadora para concurrencia

Revisión del 12/11/2026. Se mantiene la estética, la grilla de actualización cada cinco segundos, los plazos de reserva y el flujo de compra, transferencia, revisión, Mercado Pago y correos.

## Cambios

- Catálogo, detalle público y disponibilidad comparten lecturas durante un segundo por proceso. Las solicitudes simultáneas comparten también una consulta en curso. Máximo 200 entradas; errores no se guardan. Una escritura HTTP exitosa invalida las lecturas del proceso. Los cambios de otro proceso o del mantenimiento se reflejan al vencer ese segundo.
- La consulta pública ya no ejecuta transacciones de limpieza global. Filtra las reservas vencidas directamente al leer. El mantenimiento existente y las operaciones definitivas siguen liberándolas en PostgreSQL. UNDER_REVIEW y NEEDS_ATTENTION mantienen sus números aunque su fecha de reserva haya pasado.
- Reservar nunca utiliza la caché. Se conserva la transacción Serializable y la restricción única de rifa+número.
- Visitantes y clientes comparten una cola breve por rifa y cliente de base de datos, antes de entrar en la transacción. Evita conflictos artificiales entre números diferentes. Se descarta al vaciarse; máximo 1.000 intentos pendientes por rifa y proceso, con respuesta 503 si se supera. Otras rifas pueden avanzar. No ofrece prioridad mundial entre procesos; PostgreSQL sigue impidiendo duplicados.
- Los cuatro intentos de transacción existentes incorporan una espera aleatoria creciente. Se reconocen tanto P2034 como TransactionWriteConflict del adaptador pg al confirmar; antes este último podía aparecer como error 500. Se mantiene el plazo de transacción de diez segundos y se permiten cinco segundos para obtener una conexión.
- Los límites de operaciones autenticadas se aplican por cuenta. Los de acceso combinan red e identidad; los visitantes usan su cookie privada y el cupo de 20 números pendientes es por navegador. Se conserva una protección general de 3.000 solicitudes por red/ventana para acceso y reservas de visitantes. Compartir IP ya no consume el pequeño cupo de otro comprador. Borrar cookies puede eludir el cupo por navegador: el límite de red aporta protección adicional, sin pretender identificar a una persona.
- Sólo cuatro cargas de comprobante simultáneas por proceso antes de recibir los archivos. La quinta recibe 503, Retry-After y un mensaje para volver a enviar. El archivo seleccionado permanece en el formulario. Se mantienen los formatos, 5 MB por archivo, almacenamiento privado y retención de tres meses. El tope limita los buffers de recepción; no representa el consumo total de memoria del proceso.

No se agregaron servicios, dependencias ni migraciones; tampoco se cambiaron datos ni secretos de las cuentas reales.

## Configuración inicial

`backend/.env.example` documenta dos opciones nuevas. No hace falta agregarlas a `.env` para conservar los valores predeterminados:

```dotenv
DB_POOL_MAX=10
RECEIPT_MAX_CONCURRENT=4
```

No aumentar conexiones automáticamente según la cantidad de visitantes. Dimensionar con métricas del alojamiento. Para Neon usar la conexión agrupada en la aplicación y una conexión directa para migraciones/respaldos cuando corresponda; aún falta configurar y probar ese entorno.

La caché, las colas y los límites son locales a cada proceso. La primera instalación prevista utiliza un proceso siempre activo con volumen privado persistente para comprobantes. Varias réplicas necesitan revisar los límites compartidos y el almacenamiento de archivos. No se introduce Redis ni almacenamiento externo antes de elegir el alojamiento.

## Verificaciones

- 72 pruebas de backend, 83 de integración PostgreSQL y 45 del frontend correctas; ambos builds correctos.
- Se comprueba que las lecturas omiten vencidas sin escribir, conservan revisiones pendientes, invalidan la caché tras reservar y no exponen datos privados.
- La batería existente vuelve a comprobar compras, pagos tardíos, revisión, rechazos, bajas, Excel, permisos, ganadores y correos con transportes simulados.
- El frontend no se modificó.

## Prueba local de carga

Desde `rifas`, con PostgreSQL local activo:

```powershell
npm.cmd run test:load -w backend
```

El script crea un esquema aleatorio `halcon_load_…`, aplica las migraciones y genera 809 cuentas ficticias con JWT. Levanta exclusivamente una API de pruebas en un puerto aleatorio. No inicia index.ts, correos, cierres programados ni Mercado Pago real. Desconecta y elimina únicamente su esquema al finalizar. Rechaza bases remotas para evitar ejecutar esta carga accidentalmente en producción. El informe no contiene credenciales.

Simula 809 usuarios con un generador de hasta 128 conexiones HTTP reutilizables: las solicitudes restantes esperan en el cliente. Es una medición de usuarios virtuales, no una certificación de 809 solicitudes HTTP ejecutadas simultáneamente. Incluye:

1. Entrada: 2.427 solicitudes entre catálogo, detalle y disponibilidad.
2. Consultas periódicas: 2.427 solicitudes de disponibilidad.
3. 809 intentos sobre un mismo número: exactamente un 201 y 808 conflictos esperados 409.
4. 100 intentos sobre números distintos: 100 reservas aceptadas.

El escenario de 128 conexiones pasó sin errores HTTP inesperados: un solo titular del número disputado, 101 reservas finales y ningún correo de compra. Las 2.427 lecturas iniciales requirieron nueve consultas PostgreSQL; las 2.427 consultas periódicas, doce. En esta medición local, el percentil 95 de lectura inicial fue 736 ms; el de disponibilidad periódica, 9 ms; el de las 100 reservas distintas, 1.485 ms. Los 809 intentos sobre el mismo número tardaron 6,2 segundos en resolverse, con el conflicto esperado para quienes llegaron después. Los detalles quedan en `load-test-results-128.json` (ignorado por Git).

Para variar el generador:

```powershell
$env:LOAD_CONNECTIONS='809'
npm.cmd run test:load -w backend
Remove-Item Env:LOAD_CONNECTIONS
```

La entrada instantánea con 809 conexiones **no pasó en esta computadora**: registró ECONNREFUSED al abrir las conexiones. La consulta periódica posterior sí respondió las 2.427 solicitudes y las 100 compras de números distintos se aceptaron. Se conserva el informe fallido `load-test-results-809.json`; no se atribuye su causa a Neon ni se considera acreditada la capacidad del alojamiento.

## Pendiente antes del lanzamiento

Repetir la prueba contra un entorno aislado del alojamiento y Neon elegidos, desde un generador externo. Medir ingreso brusco, navegación sostenida, registros/inicios de sesión reales con bcrypt, reservas mixtas, vencimientos, cargas de archivos y procesamiento simulado de pagos. La prueba local usa sesiones preemitidas y no mide el costo de bcrypt, envío SMTP, red real, recepción de archivos masivos, CDN ni latencia de Neon. Sus resultados no garantizan capacidad de producción.

Los datos y compras reales se conservaron. La aplicación habitual no se inició durante estas pruebas y no se enviaron correos reales.
