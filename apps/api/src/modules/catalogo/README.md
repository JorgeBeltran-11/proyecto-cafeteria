# Módulo `catalogo`

- **Spec**: `specs/003-menu-dinamico/` (menús dinámicos modificables en tiempo de ejecución).
- **Código**: todo el código del módulo va en esta carpeta (`apps/api/src/modules/catalogo/`): `catalogo.module.ts`, controladores, servicios y sus tests `*.spec.ts`. Registra `CatalogoModule` en `apps/api/src/app.module.ts`.
- **Datos**: el módulo solo accede a su propio esquema (sus modelos de Prisma). Los demás módulos usan su API pública, nunca sus tablas.
- **Commits**: alcance `catalogo`, p. ej. `feat(catalogo): crear productos del menú`.

Carpeta creada vacía en la spec 001; aún no contiene lógica.
