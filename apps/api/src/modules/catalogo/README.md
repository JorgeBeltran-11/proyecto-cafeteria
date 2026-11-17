# Módulo `catalogo`

- **Spec**: `specs/003-menu-dinamico/` (menús dinámicos modificables en tiempo de ejecución). Responsable: Julio Maldonado.
- **Rutas**: tienda `GET /catalogo/menu` y `GET /catalogo/alergenos`; administración `/catalogo/admin/productos` y `/catalogo/admin/menus` (publicar, retirar, versiones, restaurar, vista previa); personal `GET/PUT /catalogo/disponibilidad`. Contrato en `specs/003-menu-dinamico/contracts/catalogo-api.md`.
- **Datos**: tablas `Producto`, `Menu`, `VersionMenu` y `CambioCatalogo`, solo de este módulo. Los demás módulos usan `CatalogoService` o el puerto `CatalogoParaCarrito`, nunca estas tablas.
- **Commits**: alcance `catalogo`, p. ej. `feat(catalogo): publicar menús con versiones`.

## Estructura

| Carpeta / archivo | Qué contiene |
|---|---|
| `dominio/horario.ts` | Franjas horarias en UTC−5: en horario, próxima apertura y texto legible |
| `dominio/publicacion.ts` | Qué impide publicar (FR-004), instantánea de la versión y resumen de cambios (FR-005) |
| `dominio/carta.ts` | Carta pública: disponibilidad con texto, filtro de alérgenos y productos repetidos |
| `dominio/alergenos.ts` | Lista cerrada de alérgenos |
| `catalogo.service.ts` | Casos de uso con Prisma; implementa `CatalogoParaCarrito` y `descontarExistencias` |
| `catalogo-*.controller.ts`, `disponibilidad.controller.ts` | API HTTP por tipo de usuario |
| `validacion.ts` | Validación de la entrada con mensajes que dicen cómo corregir |
| `datos-demo.ts` | Menú de ejemplo con `CATALOGO_DATOS_DEMO=true` (solo desarrollo) |
| `puertos/roles.ts`, `provisional/` | Roles provisionales hasta la spec 002 |

## Cómo funciona

- El administrador edita un **borrador**. **Publicar** crea una versión inmutable (`VersionMenu`) con autor, fecha y resumen de cambios; la tienda muestra siempre la última versión publicada. **Restaurar** vuelve a publicar una versión antigua como versión nueva.
- **Disponibilidad** (agotado, existencias, retirado) es estado vivo del producto: la cambia el personal y se ve al instante, sin crear versiones.
- Cada `PUT` y cada publicación llevan la `revision` leída; si otra persona guardó antes, responde `409` (FR-011).
- Todos los cambios quedan en `CambioCatalogo` (FR-012).

## Pendientes de otras specs

```bash
grep -rn "PENDIENTE(spec-" apps/
```

| Pendiente | Qué hacer |
|---|---|
| **spec-002** (identidad, Leonardo) | Sustituir `RolesProvisionalGuard` por el guard de identidad (debe dejar `request.usuario = { id, rol }`) y borrar `provisional/`. En la web, quitar las cabeceras `X-Rol`/`X-Usuario-Id` de `app/menu/api.ts` |
| **spec-004** (carrito, David) | El carrito importa `CatalogoModule` y deja su `CatalogoProvisional` (contracts/dependencias.md §2) |
| **spec-006** (pedidos) | Llamar a `CatalogoService.descontarExistencias` al confirmar y copiar precio y descripción en el pedido |
| **spec-008** (administración) | Panel de administración sobre `/catalogo/admin/...` y consulta de `CambioCatalogo` |

## Tests

```bash
pnpm --filter api exec jest modules/catalogo                    # reglas puras y validación
pnpm --filter api exec jest --config test/jest-e2e.json catalogo # HTTP con SQLite real
```
