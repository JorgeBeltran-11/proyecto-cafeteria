---

description: "Lista de tareas de la spec 003 — Menú dinámico"
---

# Tasks: Menú dinámico

**Input**: Documentos de diseño en `specs/003-menu-dinamico/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: obligatorios (constitución VI): reglas puras con TDD y tests HTTP con SQLite real.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario (US1–US4)
- **PENDIENTE(spec-00X)**: depende de otra spec; hoy se cubre con una pieza provisional

---

## Phase 1: Setup

- [X] T001 Crear la rama `feature/spec-3` desde `main` y apuntar `.specify/feature.json` a `specs/003-menu-dinamico`
- [X] T002 Acotar la spec al alcance del equipo y documentar dependencias en `spec.md` y `contracts/dependencias.md`

## Phase 2: Foundational (bloquea todas las historias)

- [X] T003 [P] Tipos del catálogo en `packages/shared/src/catalogo.ts`, exportados desde `index.ts`
- [X] T004 [P] Modelos `Producto`, `Menu`, `VersionMenu` y `CambioCatalogo` en `schema.prisma` y migración `migrations/2_catalogo/migration.sql`
- [X] T005 [P] Alérgenos (`dominio/alergenos.ts`), contenido de versión (`dominio/contenido.ts`) y errores (`dominio/errores.ts`, `catalogo.errores.ts`)
- [X] T006 PENDIENTE(spec-002) Decoradores `@Roles()` y `@UsuarioActual()` (`puertos/roles.ts`) y `RolesProvisionalGuard` (cabeceras `X-Rol`, `X-Usuario-Id`; 401 en producción)
- [X] T007 Validación de entrada en `validacion.ts` con tests en `validacion.spec.ts`

**Checkpoint**: `pnpm lint && pnpm build` pasan con el esquema nuevo.

## Phase 3: User Story 1 — Consultar el menú (P1) 🎯 MVP

- [X] T008 [US1] Tests de horario en `dominio/horario.spec.ts`: dentro/fuera de franja, día de la semana en UTC−5, próxima apertura (hoy, mañana, otro día), texto del horario
- [X] T009 [US1] `dominio/horario.ts` hasta que pasen los tests de T008
- [X] T010 [US1] Tests de la carta en `dominio/carta.spec.ts`: agotado con texto, fuera de horario, filtro de alérgenos, categorías vacías ocultas, producto repetido en dos menús, retirados ocultos
- [X] T011 [US1] `dominio/carta.ts` hasta que pasen los tests de T010
- [X] T012 [US1] `CatalogoService.carta()` y `GET /catalogo/menu`, `GET /catalogo/alergenos` (`catalogo-publico.controller.ts`)
- [X] T013 [US1] Página `apps/web/app/menu/` con navegación por categorías, filtro de alérgenos y disponibilidad con texto

## Phase 4: User Story 2 — Crear y publicar un menú (P1)

- [X] T014 [US2] Tests de publicación en `dominio/publicacion.spec.ts`: problemas que bloquean (sin alt, sin alérgenos, retirado, inexistente, vacío) y resumen de cambios
- [X] T015 [US2] `dominio/publicacion.ts` hasta que pasen los tests de T014
- [X] T016 [US2] CRUD de productos y menús, vista previa y publicación en `CatalogoService` y `catalogo-admin.controller.ts`
- [X] T017 [US2] Test HTTP en `apps/api/test/catalogo.e2e-spec.ts`: el borrador no se ve, la publicación bloqueada dice qué falta, tras publicar aparece en la tienda

## Phase 5: User Story 3 — Modificar sin afectar pedidos (P1)

- [X] T018 [US3] Versiones inmutables, historial y restauración (`versiones`, `restaurar`) con auditoría en `CambioCatalogo`
- [X] T019 [US3] Conflicto de edición concurrente con `revision` → 409 (FR-011)
- [X] T020 [US3] Tests HTTP: cambio de precio crea versión 2 y la tienda lo muestra, la versión 1 conserva el precio, restaurar vuelve al precio anterior, conflicto 409

## Phase 6: User Story 4 — Disponibilidad del día (P2)

- [X] T021 [US4] `GET/PUT /catalogo/disponibilidad` (`disponibilidad.controller.ts`) para `personal` y `admin`; `403` al personal en rutas de administración
- [X] T022 [US4] `descontarExistencias` con actualización condicional; agotado al llegar a 0; tests HTTP/servicio
- [X] T023 [US4] Página `apps/web/app/personal/disponibilidad/` con anuncios `aria-live`

## Phase 7: Integración y cierre

- [X] T024 Implementar `CatalogoParaCarrito` en `CatalogoService` y exportarlo; test del adaptador
- [X] T025 [P] Datos de ejemplo (`datos-demo.ts`, `CATALOGO_DATOS_DEMO`) e imágenes en `apps/web/public/menu/`
- [X] T026 [P] README del módulo, README raíz (tabla de variables) y `quickstart.md`
- [ ] T027 `pnpm lint && pnpm test && pnpm build` en verde
- [ ] T028 PENDIENTE(spec-004) Cambiar el carrito al catálogo real (PR aparte, con David)
- [ ] T029 PENDIENTE(spec-002) Sustituir `RolesProvisionalGuard` por el guard de identidad
- [ ] T030 PENDIENTE(spec-008) Panel de administración del menú sobre esta API
