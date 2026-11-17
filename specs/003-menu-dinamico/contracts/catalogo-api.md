# API HTTP del catálogo

Base: `http://localhost:3001`. Cuerpos JSON. Errores con la forma de NestJS: `{ statusCode, message, error }`; `message` dice cómo corregirlo. Todas las respuestas llevan `Cache-Control: no-store` (FR-006).

Roles provisionales (PENDIENTE spec-002): cabeceras `X-Rol: admin | personal` y `X-Usuario-Id: <id>`. Sin ellas → `401`; rol insuficiente → `403`; en producción siempre `401`.

## Tienda (sin sesión)

| Método y ruta | Respuesta | Notas |
|---|---|---|
| `GET /catalogo/menu?excluir=gluten,leche` | `200 CartaPublica` | `excluir` opcional; un código desconocido → `400` |
| `GET /catalogo/alergenos` | `200 AlergenoVista[]` | Lista cerrada |

## Administración (`X-Rol: admin`)

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /catalogo/admin/productos` | | `200 ProductoAdmin[]` |
| `GET /catalogo/admin/productos/:id` | | `200 ProductoAdmin` · `404` |
| `POST /catalogo/admin/productos` | `{ id, nombre, descripcion?, precioCentavos, imagenUrl?, imagenAlt?, alergenos?, existencias? }` | `201 ProductoAdmin` · `409` si el id existe |
| `PUT /catalogo/admin/productos/:id` | `{ revision, …campos a cambiar, retirado? }` | `200 ProductoAdmin` · `409` revisión vieja |
| `GET /catalogo/admin/menus` | | `200 MenuAdmin[]` |
| `POST /catalogo/admin/menus` | `{ nombre, horario?, categorias? }` | `201 MenuAdmin` (estado `borrador`) |
| `GET /catalogo/admin/menus/:id` | | `200 MenuAdmin` · `404` |
| `PUT /catalogo/admin/menus/:id` | `{ revision, nombre?, horario?, categorias? }` | `200 MenuAdmin` · `409` |
| `GET /catalogo/admin/menus/:id/vista-previa` | | `200 MenuPublico` (el borrador como lo vería el cliente, US2-4) |
| `POST /catalogo/admin/menus/:id/publicar` | `{ revision }` | `200 MenuAdmin` · `409` · `422` con los problemas (FR-004) |
| `POST /catalogo/admin/menus/:id/retirar` | | `200 MenuAdmin` |
| `GET /catalogo/admin/menus/:id/versiones` | | `200 VersionMenuResumen[]` (de la más reciente a la más antigua) |
| `POST /catalogo/admin/menus/:id/versiones/:numero/restaurar` | | `200 MenuAdmin` · `404` |

`categorias`: `[{ nombre, productoIds: string[] }]`. `horario`: `null` o `[{ dias: [1..7], desde: "HH:MM", hasta: "HH:MM" }]`.

## Personal (`X-Rol: personal` o `admin`)

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /catalogo/disponibilidad` | | `200 DisponibilidadVista[]` |
| `PUT /catalogo/disponibilidad/:productoId` | `{ agotado?, existencias? }` | `200 DisponibilidadVista` |

El personal que llama a `PUT /catalogo/admin/productos/:id` recibe `403` (US4-3).
