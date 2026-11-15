# Módulo `identidad`

- **Spec**: `specs/002-identidad-clientes/` (gestión de clientes).
- **Código**: todo el código del módulo va en esta carpeta (`apps/api/src/modules/identidad/`): `identidad.module.ts`, controladores, servicios y sus tests `*.spec.ts`. Registra `IdentidadModule` en `apps/api/src/app.module.ts`.
- **Datos**: el módulo solo accede a su propio esquema (sus modelos de Prisma). Los demás módulos usan su API pública, nunca sus tablas.
- **Commits**: alcance `identidad`, p. ej. `feat(identidad): registrar clientes`.

Carpeta creada vacía en la spec 001; aún no contiene lógica.
