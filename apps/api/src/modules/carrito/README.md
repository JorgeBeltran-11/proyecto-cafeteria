# Módulo `carrito`

- **Spec**: `specs/004-carrito-compras/` (carrito de compras por cliente).
- **Código**: todo el código del módulo va en esta carpeta (`apps/api/src/modules/carrito/`): `carrito.module.ts`, controladores, servicios y sus tests `*.spec.ts`. Registra `CarritoModule` en `apps/api/src/app.module.ts`.
- **Datos**: el módulo solo accede a su propio esquema (sus modelos de Prisma). Los clientes y productos se consultan a través de los módulos `identidad` y `catalogo`, nunca leyendo sus tablas.
- **Commits**: alcance `carrito`, p. ej. `feat(carrito): añadir productos al carrito`.

Carpeta creada vacía en la spec 001; aún no contiene lógica.
