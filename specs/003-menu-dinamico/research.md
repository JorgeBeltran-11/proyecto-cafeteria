# Research: Menú dinámico

Decisiones técnicas de la spec 003. Cada una indica la alternativa descartada.

## R1. Borrador editable + versiones inmutables

**Decisión**: cada `Menu` tiene un **borrador** (nombre, horario y categorías con ids de producto) que el administrador edita libremente. Publicar copia el borrador y los datos actuales de sus productos (nombre, descripción, precio, imagen, alérgenos) en una fila nueva de `VersionMenu` con número correlativo, autor, fecha y resumen de cambios. Una versión nunca se modifica.

**Por qué**: US3 exige que cambiar un precio cree una versión nueva sin alterar lo anterior, y que se pueda restaurar una versión previa. Al guardar una **instantánea** completa, la tienda muestra exactamente lo publicado aunque después se edite el producto, y un pedido (spec 006) puede citar la versión que vio el cliente.

**Descartado**: editar el menú publicado en el sitio (rompe US3-2); versionar cada producto por separado (más tablas y la tienda tendría que combinar versiones).

## R2. Restaurar = publicar de nuevo una versión anterior

**Decisión**: `POST /catalogo/admin/menus/:id/versiones/:numero/restaurar` crea una versión **nueva** (n + 1) con el contenido de la versión `numero` y `restauradaDe = numero`, y deja el borrador igual que ese contenido.

**Por qué**: el historial sigue siendo de solo anexado (FR-005) y queda constancia de quién restauró y cuándo (US3-3, US3-4).

**Descartado**: mover un puntero a la versión antigua; se pierde quién hizo la restauración y la secuencia deja de ser lineal.

## R3. Ediciones concurrentes con número de revisión

**Decisión**: `Menu` y `Producto` tienen `revision` (entero). Cada `PUT` y la publicación reciben la `revision` que el administrador leyó. La actualización es `UPDATE … WHERE id = ? AND revision = ?` e incrementa la revisión; si no se actualiza ninguna fila, la API responde `409 Conflict` con un mensaje que indica recargar.

**Por qué**: FR-011 pide que el segundo en guardar sea avisado y no sobrescriba en silencio. Es bloqueo optimista, sin bloqueos en la base de datos.

**Descartado**: cabeceras `ETag`/`If-Match`; equivalen, pero un campo en el cuerpo es más fácil de usar desde `curl` y desde el futuro panel.

## R4. Precio de la tienda = precio de la versión publicada; disponibilidad = estado vivo

**Decisión**: precio, nombre, descripción, imagen y alérgenos que ve el cliente salen de la versión publicada. `agotado`, `existencias` y `retirado` se leen del `Producto` en cada consulta.

**Por qué**: un cambio de precio solo debe llegar a la tienda al publicar (US2, US3), mientras que un "agotado" del personal debe verse en segundos sin crear versiones (US4-1, FR-009).

## R5. Lo que recibe el carrito

**Decisión**: `obtenerProductos(ids, ahora)` busca cada id en las versiones publicadas de los menús en estado `publicado`. Si aparece en varios, usa la versión publicada más reciente para nombre y precio, y `enHorario` es `true` si **alguno** de esos menús está en horario. Si no aparece en ninguno, o el producto está retirado, el estado es `retirado`. `agotado` también se da si las existencias controladas llegan a 0.

**Por qué**: el carrito necesita el mismo precio que muestra la tienda (spec 004, FR-005) y la información para generar sus avisos.

## R6. Horarios en hora local fija (UTC−5)

**Decisión**: un horario es una lista de franjas `{ dias: [1..7], desde: "HH:MM", hasta: "HH:MM" }` con `desde < hasta` (sin franjas que crucen la medianoche) o `null` (siempre disponible). Se evalúa en UTC−5, la hora de Ecuador continental, que no tiene horario de verano. La próxima apertura se busca en los 7 días siguientes.

**Por qué**: hay una sola cafetería y una sola zona (Assumptions). Una franja nocturna se expresa con dos franjas. El carrito provisional de la spec 004 ya usa la misma zona.

**Descartado**: `Intl`/librería de zonas horarias: innecesario con una zona sin cambios de hora.

## R7. Servicio con Prisma directo y tests con SQLite real

**Decisión**: `CatalogoService` usa `PrismaService` sin repositorio intermedio. La lógica con reglas está en funciones puras (`dominio/`) con tests unitarios; el servicio se prueba con tests HTTP sobre la SQLite temporal de `test/global-setup.ts`.

**Por qué**: lo que hay que probar del servicio es justo la persistencia (revisiones condicionales, transacciones al publicar, existencias que no bajan de cero). Un repositorio en memoria no probaría eso. Constitución V: "ante la duda, la opción más simple".

## R8. JSON en columnas de texto

**Decisión**: el borrador, el horario, el contenido de las versiones, los alérgenos y el detalle de auditoría se guardan como JSON en columnas `TEXT`, validados al leer y al escribir.

**Por qué**: SQLite no tiene listas y estos datos se leen y escriben siempre enteros. Al pasar a PostgreSQL se pueden convertir a `jsonb` con una migración.

## R9. Roles provisionales por cabeceras

**Decisión**: `RolesProvisionalGuard` lee `X-Rol` (`admin` o `personal`) y `X-Usuario-Id`, y comprueba el rol pedido por `@Roles(...)`. Sin cabeceras → 401; rol no permitido → 403; con `NODE_ENV=production` siempre 401.

**Por qué**: mismo enfoque que el carrito con `X-Cliente-Id` (spec 004). El contrato con la spec 002 es que su guard deje `request.usuario = { id, rol }` (ver contracts/dependencias.md §1).

## R10. Datos de ejemplo al arrancar en desarrollo

**Decisión**: si `CATALOGO_DATOS_DEMO=true`, `NODE_ENV` no es `production` y no hay ningún menú, la API crea al arrancar cinco productos y dos menús publicados (carta principal y desayunos con horario). Los ids coinciden con el catálogo provisional del carrito (`cafe-americano`, `capuchino`, `croissant`, `jugo-naranja`, `desayuno-andino`).

**Por qué**: permite probar la tienda nada más clonar, y que el carrito cambie al catálogo real sin cambiar sus datos de prueba.

**Descartado**: `prisma db seed` (necesita `ts-node` o `tsx`, una dependencia nueva).

## R11. Imágenes

**Decisión**: el producto guarda una URL de imagen (`https://…` o una ruta absoluta del sitio, `/menu/cafe.svg`) y su texto alternativo. La web usa `<img>` con `alt`. Los datos de ejemplo usan SVG en `apps/web/public/menu/`.

**Por qué**: subir archivos y servirlos (almacenamiento, CDN) está fuera del alcance; FR-002 solo exige imagen con texto alternativo. Se rechazan otros esquemas (`javascript:`, `data:`) por seguridad.
