# Módulo `carrito`

- **Spec**: `specs/004-carrito-compras/` (carrito de compras por cliente). Responsable: David León.
- **Rutas**: `GET/DELETE /carrito`, `POST /carrito/lineas`, `PUT/DELETE /carrito/lineas/:productoId`, `POST /carrito/aceptar-precios`. Contrato en `specs/004-carrito-compras/contracts/carrito.openapi.yaml`.
- **Datos**: tablas `Carrito` y `LineaCarrito`, solo de este módulo. Los clientes y productos se consultan mediante puertos, nunca leyendo sus tablas.
- **Commits**: alcance `carrito`, p. ej. `feat(carrito): añadir productos al carrito`.

## Estructura

| Carpeta / archivo | Qué contiene |
|---|---|
| `dominio/reglas.ts` | Reglas puras: totales en centavos, límites, avisos y caducidad. Sin dependencias de NestJS ni Prisma |
| `puertos/` | Lo que el carrito necesita de otros módulos (catálogo, sesión, descuentos) |
| `repositorio/` | Persistencia: Prisma en la app y memoria en los tests |
| `provisional/` | Piezas temporales hasta que existan otras specs (ver abajo) |
| `carrito.service.ts` | Casos de uso; lo exporta el módulo para pedidos e identidad |
| `carrito.controller.ts` | API HTTP |

## Pendientes de otras specs

Todo lo provisional está marcado con `PENDIENTE(spec-00X)`:

```bash
grep -rn "PENDIENTE(spec-" apps/
```

| Pendiente | Qué hacer cuando la otra spec esté en `main` |
|---|---|
| **spec-003** (catálogo, Julio) | ✅ Integrado: el carrito importa `CatalogoModule` y la web añade desde la carta publicada |
| **spec-002** (identidad, Leonardo) | Sustituir `SesionProvisionalGuard` por el guard de identidad (debe dejar `request.clienteId`) y borrar `provisional/sesion-provisional.guard.ts`. En la web, quitar el campo "Cliente de prueba" y la cabecera `X-Cliente-Id`. Identidad llama a `CarritoService.eliminarDeCliente` al borrar una cuenta |
| **spec-005** (promociones) | Sustituir `SinDescuentos` por el calculador real y generar el aviso `fin_de_promocion` |
| **spec-006** (pedidos) | Pedidos usa `CarritoService.ver` (no confirmar si `sePuedeConfirmar` es `false`) y `vaciar` |
| **spec-008** (administración) | Los límites salen hoy de `CARRITO_MAX_UNIDADES_POR_PRODUCTO`, `CARRITO_MAX_UNIDADES_POR_CARRITO` y `CARRITO_DIAS_INACTIVIDAD` |

Detalle de cada contrato: `specs/004-carrito-compras/contracts/dependencias.md`.

## Tests

```bash
pnpm --filter api exec jest modules/carrito                    # reglas, servicio y HTTP (sin BD)
pnpm --filter api exec jest --config test/jest-e2e.json carrito # HTTP con SQLite real
```
