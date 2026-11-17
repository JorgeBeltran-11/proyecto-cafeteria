# Contrato de dependencias del catálogo

Qué ofrece el catálogo a otros módulos y qué necesita de ellos. Lo provisional está en `apps/api/src/modules/catalogo/provisional/` y marcado con `PENDIENTE(spec-00X)`:

```bash
grep -rn "PENDIENTE(spec-" apps/
```

---

## 1. Identidad → catálogo (spec 002, Leonardo Mendieta) · PENDIENTE

El catálogo necesita saber **quién** hace cada petición de administración o de personal, y con **qué rol**. Archivo: `apps/api/src/modules/catalogo/puertos/roles.ts`.

```ts
export type RolCatalogo = 'admin' | 'personal';
export interface UsuarioCatalogo { id: string; rol: RolCatalogo }
export interface PeticionConUsuario extends Request { usuario?: UsuarioCatalogo }

@Roles('admin')                   // o @Roles('admin', 'personal')
@UseGuards(RolesProvisionalGuard) // PENDIENTE(spec-002)
miRuta(@UsuarioActual() usuario: UsuarioCatalogo) { … }
```

**Contrato:** el guard de la spec 002, con sesión válida, deja `request.usuario = { id, rol }` y comprueba el rol pedido por `@Roles` (metadato `ROLES_CATALOGO`): 401 sin sesión, 403 con otro rol. Los clientes no tienen acceso a estas rutas.

**Qué cambia aquí cuando esté listo:** en los controladores, sustituir `RolesProvisionalGuard` por el guard de identidad y borrar `provisional/roles-provisional.guard.ts`. La pantalla del personal deja de enviar `X-Rol` y `X-Usuario-Id`.

---

## 2. Catálogo → carrito (spec 004, David León) · OFRECIDO

El catálogo implementa el puerto que definió el carrito (`apps/api/src/modules/carrito/puertos/catalogo.puerto.ts`) y lo exporta:

```ts
// catalogo.module.ts
providers: [CatalogoService, { provide: CatalogoParaCarrito, useExisting: CatalogoService }],
exports: [CatalogoService, CatalogoParaCarrito],
```

Reglas de `obtenerProductos(ids, ahora)` en research R5. Los ids son los mismos que muestra la tienda.

**Lo que tiene que hacer el carrito** (siguiente PR, coordinado con David): importar `CatalogoModule` en `CarritoModule`, quitar `CatalogoProvisional` y su controlador, y en la web añadir productos desde `/menu`. Con `CATALOGO_DATOS_DEMO=true` los ids de prueba del carrito existen en el catálogo real.

---

## 3. Catálogo → pedidos (spec 006) · SIN RESPONSABLE

`CatalogoModule` exporta `CatalogoService`, con:

- `obtenerProductos(ids, ahora)`: lo mismo que usa el carrito, para validar el pedido.
- `descontarExistencias(productoId, cantidad, usuarioId)`: llamar **dentro del flujo de confirmación** del pedido. Lanza `ErrorCatalogo('sin_existencias')` si no alcanzan; al llegar a 0 el producto pasa a agotado (US4-2).

El pedido debe **copiar** nombre, descripción y precio al crearse (SC-004): las versiones publicadas son inmutables, así que ese dato siempre se puede rastrear.

---

## 4. Administración (spec 008) · SIN RESPONSABLE

- El panel de administración usará la API `/catalogo/admin/...` ([catalogo-api.md](./catalogo-api.md)).
- La auditoría del catálogo está en la tabla `CambioCatalogo`; la spec 008 puede exponerla con un método público del servicio.
