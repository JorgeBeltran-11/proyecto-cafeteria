---

description: "Lista de tareas de la spec 004 — Carrito de compras"
---

# Tasks: Carrito de compras

**Input**: Documentos de diseño en `specs/004-carrito-compras/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: obligatorios (constitución VI): reglas de dinero y límites con TDD, servicio con repositorio en memoria, HTTP sin base de datos y HTTP con SQLite real.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario (US1, US2, US3)
- **PENDIENTE(spec-00X)**: tarea que depende de otra spec; hoy se cubre con una pieza provisional

---

## Phase 1: Setup

- [X] T001 Crear la rama `feature/spec-4` desde `main` y apuntar `.specify/feature.json` a `specs/004-carrito-compras`
- [X] T002 Acotar la spec al alcance del equipo y documentar dependencias en `spec.md` y `contracts/dependencias.md`

## Phase 2: Foundational (bloquea todas las historias)

- [ ] T003 [P] Tipos `CarritoVista`, `LineaCarritoVista`, `AvisoCarrito`, `AjusteCantidad` y `TipoAvisoCarrito` en `packages/shared/src/carrito.ts`, exportados desde `index.ts`
- [ ] T004 [P] Modelos `Carrito` y `LineaCarrito` en `apps/api/prisma/schema.prisma` y migración `apps/api/prisma/migrations/1_carrito/migration.sql`
- [ ] T005 Puertos `CatalogoParaCarrito` (`puertos/catalogo.puerto.ts`), `CalculadorDescuentos` (`puertos/descuentos.puerto.ts`) y decorador `@ClienteActual()` (`puertos/sesion.ts`)
- [ ] T006 [P] Repositorio: interfaz, implementación Prisma y en memoria en `repositorio/`

**Checkpoint**: `pnpm lint && pnpm build` pasan con el esquema nuevo.

## Phase 3: User Story 1 — Armar el carrito (P1) 🎯 MVP

- [ ] T007 [US1] Tests de las reglas en `dominio/reglas.spec.ts`: totales en centavos, descuentos recortados, límite por producto (existencias y máximo), límite por carrito, cantidades inválidas
- [ ] T008 [US1] Reglas puras en `dominio/reglas.ts` hasta que pasen los tests de T007
- [ ] T009 [US1] `CarritoService` (`ver`, `anadir`, `cambiarCantidad`, `quitar`, `vaciar`) con tests en `carrito.service.spec.ts`
- [ ] T010 [US1] Validación de entrada en `validacion.ts` y errores de dominio → HTTP en `carrito.errores.ts`
- [ ] T011 [US1] `CarritoController` (`/carrito`) y `CarritoModule`, registrado en `app.module.ts`; tests HTTP en `carrito.controller.spec.ts`
- [ ] T012 [US1] PENDIENTE(spec-003) `CatalogoProvisional` y su controlador `/catalogo-provisional/productos`
- [ ] T013 [US1] PENDIENTE(spec-005) `SinDescuentos`
- [ ] T014 [US1] PENDIENTE(spec-002) `SesionProvisionalGuard` (cabecera `X-Cliente-Id`, 401 en producción)
- [ ] T015 [US1] Página `apps/web/app/carrito/` con añadir, cambiar cantidad, quitar, deshacer y vaciar, y anuncios `aria-live` (contracts/vista-carrito.md)

**Checkpoint**: US1 se prueba con el quickstart, pasos 2 y 3.

## Phase 4: User Story 2 — Mismo carrito en otro dispositivo (P1)

- [ ] T016 [US2] Caducidad de 30 días al leer (`estaCaducado` en `reglas.ts`, aplicada en `CarritoService.ver`) con tests
- [ ] T017 [US2] Test HTTP con SQLite real en `apps/api/test/carrito.e2e-spec.ts`: el carrito persiste entre peticiones y cada cliente ve solo el suyo
- [ ] T018 [US2] Web: volver a pedir el carrito al recuperar el foco y cada 4 s mientras está visible

## Phase 5: User Story 3 — Avisos antes de pagar (P2)

- [ ] T019 [US3] Avisos `agotado`, `retirado`, `fuera_de_horario`, `supera_existencias` y `cambio_de_precio` en `reglas.ts`, con tests
- [ ] T020 [US3] `POST /carrito/aceptar-precios`
- [ ] T021 [US3] Web: lista de avisos, botón "Aceptar precios nuevos" y anuncio solo de los avisos nuevos
- [ ] T022 [US3] PENDIENTE(spec-005) Generar el aviso `fin_de_promocion`

## Phase 6: Polish

- [ ] T023 README del módulo con los pendientes y actualización del README raíz
- [ ] T024 Prueba manual con VoiceOver o NVDA según `contracts/vista-carrito.md`
- [ ] T025 PENDIENTE(spec-003) Sustituir `CatalogoProvisional` por el catálogo real (ver `contracts/dependencias.md` §1)
- [ ] T026 PENDIENTE(spec-002) Sustituir `SesionProvisionalGuard` por el guard de identidad y llamar a `eliminarDeCliente` al borrar una cuenta (§2)

## Dependencies

- T003–T006 antes de cualquier historia.
- T007 → T008 → T009 → T011.
- T025 y T026 dependen de que las specs 003 y 002 estén integradas en `main`.
