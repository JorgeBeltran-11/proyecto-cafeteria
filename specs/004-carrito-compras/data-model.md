# Data Model: Carrito de compras

## Tablas (Prisma, propiedad del módulo `carrito`)

```prisma
model Carrito {
  id            String         @id @default(cuid())
  clienteId     String         @unique
  actualizadoEn DateTime
  lineas        LineaCarrito[]
}

model LineaCarrito {
  id                  String   @id @default(cuid())
  carritoId           String
  productoId          String
  cantidad            Int
  precioVistoCentavos Int
  anadidaEn           DateTime
  carrito             Carrito  @relation(fields: [carritoId], references: [id], onDelete: Cascade)

  @@unique([carritoId, productoId])
}
```

- `clienteId` y `productoId` son ids de otros módulos (identidad y catálogo). **No hay claves foráneas** hacia sus tablas: cada módulo es dueño de su esquema (constitución V).
- `precioVistoCentavos`: precio que vio el cliente al añadir la línea o al aceptar el último cambio (research R5).
- `anadidaEn`: ordena las líneas en el orden en que se añadieron.
- Las tablas no guardan nombres ni datos personales: el nombre del producto se pide al catálogo en cada lectura.

## Tipos compartidos (`@cafeteria/shared`)

| Tipo | Campos |
|---|---|
| `CarritoVista` | `lineas`, `totalUnidades`, `subtotalCentavos`, `descuentoCentavos`, `totalCentavos`, `avisos`, `sePuedeConfirmar`, `limites` (`porProducto`, `porCarrito`), `actualizadoEn` (ISO o `null`), `ajuste?` |
| `LineaCarritoVista` | `productoId`, `nombre`, `cantidad`, `precioUnitarioCentavos`, `subtotalCentavos`, `descuentoCentavos`, `totalCentavos`, `maximoPermitido` |
| `AvisoCarrito` | `tipo`, `productoId`, `mensaje`, `bloqueaConfirmacion`, `precioAnteriorCentavos?`, `precioNuevoCentavos?` |
| `AjusteCantidad` | `productoId`, `solicitada`, `aplicada`, `motivo` |

`TipoAvisoCarrito`: `agotado`, `retirado`, `fuera_de_horario`, `cambio_de_precio`, `supera_existencias`, `fin_de_promocion` (reservado para la spec 005).

## Reglas de cálculo (funciones puras en `dominio/reglas.ts`)

Por línea:

- `precioUnitario` = precio **actual** del catálogo (si el producto no existe, el precio visto, solo para mostrarlo).
- `subtotal` = `precioUnitario × cantidad`.
- `descuento` = lo que devuelve el puerto de descuentos, redondeado y recortado a `[0, subtotal]`.
- `total` = `subtotal − descuento`.
- `maximoPermitido` = `min(limitePorProducto, existencias)` si el producto se puede añadir; si no, 0.

Del carrito:

- `subtotal`, `descuento` y `total` = sumas de las líneas.
- `sePuedeConfirmar` = hay al menos una línea **y** ningún aviso tiene `bloqueaConfirmacion`.

Avisos (uno por producto y causa):

| Condición | Tipo | Bloquea |
|---|---|---|
| El producto no está en el catálogo o está retirado | `retirado` | Sí |
| Agotado | `agotado` | Sí |
| Fuera de horario | `fuera_de_horario` | Sí |
| `cantidad > existencias` | `supera_existencias` | Sí |
| Precio actual ≠ precio visto | `cambio_de_precio` | Sí, hasta aceptarlo |

Caducidad: si `ahora − actualizadoEn > díasInactividad`, el carrito se vacía al leerlo.

## Estados que ve la web

`cargando` → `listo` (con o sin líneas) · `error` (API caída o sin sesión, con mensaje y botón "Reintentar").
