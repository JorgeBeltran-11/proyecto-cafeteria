# Research: Carrito de compras

Decisiones técnicas de la spec 004. Cada una indica la alternativa descartada.

## R1. Dependencias de otros módulos mediante puertos (clases abstractas)

**Decisión**: el carrito declara lo que necesita como **clases abstractas** de NestJS (`CatalogoParaCarrito`, `CalculadorDescuentos`) y las recibe por inyección. El módulo dueño (catálogo, promociones) las implementa y las registra con `{ provide: CatalogoParaCarrito, useExisting: SuServicio }`.

**Por qué**: en NestJS una clase abstracta sirve a la vez de tipo y de token de inyección, sin `Symbol` ni `@Inject`. Así el carrito no importa nada de los otros módulos (constitución V) y las piezas provisionales se sustituyen cambiando una línea del módulo.

**Descartado**: importar `CatalogoService` directamente (acopla y bloquea hasta que exista); leer las tablas del catálogo (viola la constitución V).

## R2. Dinero en centavos enteros

**Decisión**: todos los importes son `number` enteros en centavos (`precioUnitarioCentavos`, `totalCentavos`…). La web solo los formatea para mostrarlos.

**Por qué**: la constitución VI prohíbe la coma flotante para dinero. Con enteros, `3 × 150 = 450` siempre es exacto. Los descuentos que lleguen del puerto se recortan a `[0, subtotal de la línea]` y se redondean a entero.

## R3. Persistencia en SQLite con reemplazo de líneas en una transacción

**Decisión**: tablas `Carrito` (una por cliente, `clienteId` único) y `LineaCarrito` (única por carrito y producto). Guardar el carrito = una transacción que actualiza `actualizadoEn`, borra las líneas y crea las nuevas.

**Por qué**: el carrito tiene pocas líneas (máx. 50 unidades); reemplazarlas es simple y atómico, y evita estados a medias. Guardarlo en la base de datos y no en la memoria de la API hace que sea el mismo en todos los dispositivos (FR-003).

**Descartado**: Redis (`promtp.md`), diferido por la spec 001. Si dos dispositivos modifican a la vez, gana la última escritura; es aceptable para un carrito (US2-2 pide ver "el estado más reciente").

## R4. Caducidad de 30 días al leer

**Decisión**: al leer el carrito, si `actualizadoEn` tiene más de 30 días (configurable con `CARRITO_DIAS_INACTIVIDAD`), se vacía y se devuelve vacío.

**Por qué**: cumple FR-003 sin tareas programadas ni colas, que no existen en el stack actual. Un carrito caducado que nadie vuelve a abrir no molesta a nadie; si hiciera falta borrarlo físicamente (LOPDP), basta un script con la misma regla.

## R5. Detección de cambios de precio con el "precio visto"

**Decisión**: cada línea guarda `precioVistoCentavos`, el precio que el cliente vio al añadirla. Si el catálogo devuelve otro precio, el carrito calcula con el **precio nuevo** y genera un aviso `cambio_de_precio` con el anterior y el nuevo. El aviso **bloquea la confirmación** hasta que el cliente lo acepta (`POST /carrito/aceptar-precios`, que copia el precio actual a `precioVistoCentavos`).

**Por qué**: US3-2 pide mostrar los dos precios y el total actualizado, y SC-003 exige que lo cobrado coincida con lo mostrado salvo aviso visible. Exigir aceptarlo garantiza que el cliente lo vio.

## R6. Validación de entrada manual

**Decisión**: funciones de validación propias (`validacion.ts`) para los cuerpos y parámetros: `productoId` con el formato `^[A-Za-z0-9_-]{1,64}$`, cantidades enteras dentro de rango.

**Por qué**: son dos campos; añadir `class-validator` y `class-transformer` (dos dependencias y un `ValidationPipe` global) es más de lo que aporta, y la constitución V pide no añadir dependencias sin justificar.

## R7. Varios dispositivos: sondeo cada 4 s y al recuperar el foco

**Decisión**: la web vuelve a pedir el carrito al recuperar el foco o la visibilidad, y cada 4 s mientras la pestaña está visible.

**Por qué**: cumple SC-002 (< 5 s) sin WebSockets ni Redis pub/sub (diferidos). El coste es una petición pequeña cada 4 s por pestaña abierta.

## R8. Deshacer la eliminación en la web

**Decisión**: al quitar una línea, la web guarda el producto y la cantidad y muestra un botón "Deshacer" que la vuelve a añadir con `POST /carrito/lineas`.

**Por qué**: FR-002 solo pide deshacer la última eliminación; no hace falta historial en el servidor. Si entretanto cambió el precio, el aviso de R5 lo muestra.

## R9. Qué productos se pueden añadir

**Decisión**:

| Estado del producto | ¿Se puede añadir? | Si ya está en el carrito |
|---|---|---|
| Disponible | Sí | Normal |
| Fuera de horario | Sí | Aviso `fuera_de_horario`, bloquea confirmar |
| Agotado | No (409) | Aviso `agotado`, bloquea confirmar |
| Retirado o inexistente | No (409) | Aviso `retirado`, bloquea confirmar |

**Por qué**: preparar el carrito del desayuno la noche anterior es razonable; añadir algo agotado no. Coincide con los casos límite de la spec.

## R10. Límites: recortar y explicar

**Decisión**: si la cantidad pedida supera el máximo (mínimo entre existencias y 20 por producto, y 50 unidades por carrito), se **recorta** y la respuesta incluye `ajuste` con la cantidad pedida, la aplicada y el motivo. Solo es un error (422) si no cabe ni una unidad. Cantidad 0 = quitar; negativa o no entera = 400.

**Por qué**: es lo que pide el caso límite ("se limita a las existencias y se explica por qué"). Si las existencias bajan después, el carrito no se modifica solo: muestra el aviso `supera_existencias`, que bloquea confirmar hasta que el cliente ajusta la cantidad.

## R11. Sesión provisional

**Decisión**: hasta la spec 002, un guard lee la cabecera `X-Cliente-Id`. Sin ella responde 401. Con `NODE_ENV=production` responde siempre 401, para que nunca llegue a producción.

**Por qué**: permite desarrollar y probar el carrito (incluso "en dos dispositivos", usando el mismo id en dos navegadores) sin la spec 002. El controlador obtiene el cliente con el decorador `@ClienteActual()`, que es lo único que la spec 002 tiene que respetar (ver [contracts/dependencias.md](./contracts/dependencias.md)).
