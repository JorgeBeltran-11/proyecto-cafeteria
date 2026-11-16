# Contrato de dependencias del carrito

Qué necesita el carrito de los otros módulos y qué les ofrece. Está pensado para revisarlo con los responsables de las specs 002 y 003. **Si algo no les encaja, se cambia aquí antes de programarlo.**

En el código, todo lo provisional está en `apps/api/src/modules/carrito/provisional/` y marcado con `PENDIENTE(spec-00X)`. Para encontrarlo:

```bash
grep -rn "PENDIENTE(spec-" apps/
```

---

## 1. Catálogo → carrito (spec 003, Julio Maldonado) · PENDIENTE

El carrito necesita leer algunos datos de varios productos a la vez. Archivo: `apps/api/src/modules/carrito/puertos/catalogo.puerto.ts`.

```ts
export type EstadoProducto = 'disponible' | 'agotado' | 'retirado';

export interface ProductoParaCarrito {
  id: string;
  nombre: string;
  /** Precio vigente en centavos (entero). Nunca decimales. */
  precioCentavos: number;
  estado: EstadoProducto;
  /** Unidades disponibles; null si el producto no controla existencias. */
  existencias: number | null;
  /** true si el menú del producto está disponible en el momento `ahora`. */
  enHorario: boolean;
}

export abstract class CatalogoParaCarrito {
  /** Devuelve los productos encontrados; los ids que no existan simplemente no aparecen. */
  abstract obtenerProductos(
    ids: readonly string[],
    ahora: Date,
  ): Promise<ProductoParaCarrito[]>;
}
```

**Qué tiene que hacer la spec 003:**

1. Implementar `CatalogoParaCarrito` en un servicio de su módulo (o un adaptador pequeño) y exportarlo:
   ```ts
   // catalogo.module.ts
   providers: [CatalogoService, { provide: CatalogoParaCarrito, useExisting: CatalogoService }],
   exports: [CatalogoParaCarrito],
   ```
2. Usar el mismo `id` de producto que verá la web en el menú.
3. Guardar los precios en centavos enteros (constitución VI).

**Qué cambia en el carrito cuando esté listo:** en `carrito.module.ts`, importar `CatalogoModule` y quitar la línea `{ provide: CatalogoParaCarrito, useExisting: CatalogoProvisional }`, junto con `provisional/catalogo-provisional*.ts`. La web deja de usar `/catalogo-provisional/productos` y añade productos desde el menú real.

---

## 2. Sesión → carrito (spec 002, Leonardo Mendieta) · PENDIENTE

El carrito necesita saber **qué cliente** hace cada petición. Archivo: `apps/api/src/modules/carrito/puertos/sesion.ts`.

El controlador del carrito usa:

```ts
@UseGuards(SesionProvisionalGuard) // PENDIENTE(spec-002): cambiar por el guard de identidad
export class CarritoController {
  @Get()
  ver(@ClienteActual() clienteId: string) { … }
}
```

`@ClienteActual()` lee `request.clienteId`. **Contrato:** el guard de la spec 002, si la sesión es válida y el rol es `cliente`, deja el id del cliente en `request.clienteId` (string); si no, responde 401 (sin sesión) o 403 (otro rol).

**Qué tiene que hacer la spec 002:** exportar ese guard (o decir qué propiedad de `request` usa, y se adapta `@ClienteActual()`).

**Qué cambia en el carrito:** sustituir `SesionProvisionalGuard` por el guard de identidad en `carrito.controller.ts` y borrar `provisional/sesion-provisional.guard.ts`. La web deja de enviar la cabecera `X-Cliente-Id` y envía las credenciales de la sesión (`credentials: 'include'` si es una cookie).

**Lo que el carrito ofrece a la spec 002:** cuando un cliente elimine su cuenta (LOPDP), llamar a `CarritoService.eliminarDeCliente(clienteId)`, que borra su carrito. `CarritoModule` exporta `CarritoService`.

---

## 3. Promociones → carrito (spec 005) · SIN RESPONSABLE

Archivo: `apps/api/src/modules/carrito/puertos/descuentos.puerto.ts`.

```ts
export interface LineaParaDescuento {
  productoId: string;
  cantidad: number;
  precioUnitarioCentavos: number;
}

export interface DescuentoDeLinea {
  productoId: string;
  /** Descuento total de la línea, en centavos (entero ≥ 0). */
  descuentoCentavos: number;
  /** Nombre de la promoción, para mostrarlo. */
  promocion?: string;
}

export abstract class CalculadorDescuentos {
  abstract calcular(
    lineas: readonly LineaParaDescuento[],
    ahora: Date,
    clienteId: string,
  ): Promise<DescuentoDeLinea[]>;
}
```

Implementación provisional: `SinDescuentos`, que devuelve `[]` (descuento 0). El carrito recorta cualquier descuento a `[0, subtotal]`. El aviso `fin_de_promocion` ya existe en los tipos, pero no se genera hasta esta spec.

---

## 4. Carrito → pedidos (spec 006) · SIN RESPONSABLE

El carrito no confirma pedidos. Lo que ofrece:

- `CarritoService.ver(clienteId)` → `CarritoVista`, con `sePuedeConfirmar` y los avisos que lo impiden. **El pedido no debe crearse si `sePuedeConfirmar` es `false`** (FR-007, SC-004).
- `CarritoService.vaciar(clienteId)` para vaciarlo una vez creado el pedido.

---

## 5. Límites configurables (spec 008) · SIN RESPONSABLE

Mientras no exista la administración, los límites salen de variables de entorno de la API (con estos valores por defecto):

| Variable | Defecto |
|---|---|
| `CARRITO_MAX_UNIDADES_POR_PRODUCTO` | 20 |
| `CARRITO_MAX_UNIDADES_POR_CARRITO` | 50 |
| `CARRITO_DIAS_INACTIVIDAD` | 30 |
