---

description: "Lista de tareas de la spec 001 — Stack tecnológico base"
---

# Tasks: Stack tecnológico base

**Input**: Documentos de diseño en `specs/001-plataforma-entrega/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: obligatorios (constitución VI y FR-017): tests Jest de `GET /health`, unitarios y HTTP con SQLite real. La página de inicio se verifica a mano con [contracts/home-page.md](./contracts/home-page.md).

**Organization**: tareas agrupadas por historia de usuario. Rutas relativas a la raíz del repositorio. Cada fase termina en un **Checkpoint** que se puede probar.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia de usuario a la que pertenece (US1, US2, US3)

## Convenciones

- Versiones: Node 22 LTS, pnpm 10, TypeScript 5, NestJS 11, Prisma 6, Next.js 16 + React 19, ESLint 9, Husky 9, commitlint (research R1–R13). Fijar versiones exactas al instalar.
- **Sin Python** en ningún archivo ni script (FR-003).
- Nombres de paquetes: `@cafeteria/shared`, `api`, `web`.
- Cada commit debe pasar `pnpm lint && pnpm test && pnpm build` (ver *Commits sugeridos*).

---

## Phase 1: Setup (infraestructura compartida)

**Purpose**: monorepo pnpm vacío pero válido.

- [X] T001 Crear la base del monorepo: `package.json` raíz (`"private": true`, `packageManager: "pnpm@10.<x>.<y>"` exacto, `engines.node: ">=22 <23"`, `pnpm.onlyBuiltDependencies: ["prisma", "@prisma/client", "@prisma/engines"]`, scripts `dev` = `pnpm -r --parallel --filter api --filter web dev`, `lint` = `pnpm -r lint && pnpm -r typecheck`, `test` = `pnpm -r test`, `build` = `pnpm -r build`, `db:setup` = `pnpm --filter api db:setup`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `.nvmrc` (`22`) y `tsconfig.base.json` (`strict`, `ES2022`, `skipLibCheck`, `declaration`)
- [X] T002 [P] Crear `.gitignore` (`node_modules/`, `dist/`, `.next/`, `coverage/`, `.env`, `.env.local`, `*.db`, `*.db-journal`, `*.tsbuildinfo`) y `.gitattributes` (`* text=auto eol=lf`)
- [X] T003 [P] Instalar en la raíz `typescript`, `eslint`, `@eslint/js` y `typescript-eslint` como devDependencies y crear `eslint.config.mjs` con la config recomendada de `typescript-eslint`, ignorando `dist/`, `.next/` y `coverage/`

**Checkpoint**: `pnpm install` termina sin errores y genera `pnpm-lock.yaml`.

---

## Phase 2: Foundational (prerrequisitos bloqueantes)

**Purpose**: tipo compartido, API NestJS con Prisma + SQLite y app Next.js vacía. Bloquea a todas las historias.

- [ ] T004 Crear `packages/shared`: `package.json` (`name: "@cafeteria/shared"`, `main`/`types`/`exports` a `dist/`, scripts `build` y `prepare` = `tsc -p tsconfig.json`, `typecheck` = `tsc --noEmit`, `lint` = `eslint .`, `test` = `echo "sin tests"`), `tsconfig.json` (extiende `../../tsconfig.base.json`, `rootDir: src`, `outDir: dist`) y `src/index.ts` con `ComponentStatus` y `HealthResponse` (`status`, `api`, `database`, `checkedAt`) exactamente como en `data-model.md`
- [ ] T005 [P] Generar `apps/api` con `pnpm dlx @nestjs/cli new api --directory apps/api --package-manager pnpm --skip-git --skip-install`; borrar `app.controller.ts`, `app.service.ts` y sus tests; en `apps/api/package.json` fijar `name: "api"`, añadir `@nestjs/config`, `@prisma/client`, `@cafeteria/shared@workspace:*`, devDependencies `prisma`, `supertest`, `@types/supertest`, y scripts `lint` = `eslint .`, `typecheck` = `tsc --noEmit`, `test` = `jest && jest --config test/jest-e2e.json`, `build` = `prisma generate && nest build`, `postinstall` = `prisma generate`, `db:setup` = `prisma migrate deploy`; `apps/api/tsconfig.json` extiende `../../tsconfig.base.json` conservando los decoradores
- [ ] T006 Configurar Prisma en `apps/api`: `prisma/schema.prisma` (`provider = "sqlite"`, `url = env("DATABASE_URL")`, sin modelos), migración inicial `prisma/migrations/0_init/migration.sql` (solo un comentario) con `prisma/migrations/migration_lock.toml` (`provider = "sqlite"`), y `src/prisma/prisma.service.ts` + `src/prisma/prisma.module.ts` (módulo global; `$connect()` en `onModuleInit` dentro de try/catch para que la API arranque aunque la BD falle; `$disconnect()` en `onModuleDestroy`)
- [ ] T007 Crear `apps/api/src/app.module.ts` (`ConfigModule.forRoot({ isGlobal: true })`, `PrismaModule`), `apps/api/src/main.ts` (si falta `DATABASE_URL`, terminar con `Falta DATABASE_URL: copia apps/api/.env.example a apps/api/.env`; `enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' })`; escuchar en `process.env.PORT ?? 3001`) y `apps/api/.env.example` (`DATABASE_URL="file:./dev.db"`, `PORT=3001`, `WEB_ORIGIN=http://localhost:3000`, con un comentario por variable y sin secretos)
- [ ] T008 [P] Generar `apps/web` con `pnpm dlx create-next-app@16 apps/web --ts --app --eslint --no-tailwind --no-src-dir --import-alias "@/*" --use-pnpm --skip-install --disable-git`; en `apps/web/package.json` fijar `name: "web"`, añadir `@cafeteria/shared@workspace:*` y scripts `dev` = `next dev`, `lint` = `eslint .`, `typecheck` = `tsc --noEmit`, `test` = `echo "sin tests"`; crear `apps/web/.env.example` con `NEXT_PUBLIC_API_URL=http://localhost:3001` y la nota de que el puerto se cambia con la variable de entorno `PORT` al arrancar

**Checkpoint**: `pnpm install` compila `@cafeteria/shared` y genera el cliente Prisma; `pnpm lint` y `pnpm build` pasan; con `apps/api/.env` creado, `pnpm db:setup` crea `apps/api/prisma/dev.db` y `pnpm --filter api dev` arranca la API.

---

## Phase 3: User Story 1 - Levantar el proyecto en local sin instalar nada extra (Priority: P1) 🎯 MVP

**Goal**: `GET /health` responde 200/503 según la BD y la página de inicio muestra el estado en los tres casos.

**Independent Test**: con solo Node.js y pnpm, seguir el README: `curl -i localhost:3001/health` devuelve 200; con `dev.db` borrado, 503; la página muestra "API en línea · Base de datos conectada", "Base de datos no disponible" o "API no disponible" (quickstart §1–3).

### Tests for User Story 1 (MANDATORY - Constitution VI) ⚠️

> Escribir primero y comprobar que FALLAN antes de implementar.

- [ ] T009 [P] [US1] Test unitario en `apps/api/src/health/health.service.spec.ts` con `PrismaService` simulado: `$queryRaw` resuelve → `status`, `api` y `database` en `'ok'`; rechaza → `database: 'error'`; nunca resuelve → `database: 'error'` en menos de 1 s; `checkedAt` es ISO 8601
- [ ] T010 [P] [US1] Test HTTP con SQLite real: `apps/api/test/global-setup.ts` (crea un directorio temporal, fija `DATABASE_URL=file:<tmp>/test.db` y ejecuta `prisma migrate deploy` con `execSync`), `apps/api/test/jest-e2e.json` (`testRegex: .e2e-spec.ts$`, `ts-jest`, `globalSetup`) y `apps/api/test/health.e2e-spec.ts` con supertest: (a) BD migrada → 200 conforme a `contracts/health.openapi.yaml`; (b) `PrismaService` sobrescrito para que falle → 503 con `database: 'error'`; (c) el 503 no contiene `file:`, `DATABASE_URL`, `stack` ni rutas; (d) respuesta en menos de 1 s

### Implementation for User Story 1

- [ ] T011 [US1] Implementar el endpoint en `apps/api/src/health/`: `health.service.ts` (`check(): Promise<HealthResponse>` con `Promise.race` entre `$queryRaw\`SELECT 1 FROM _prisma_migrations LIMIT 1\`` y un timeout de 500 ms, `clearTimeout`, `Logger.warn` en error), `health.controller.ts` (`@Get('health')`, 503 con `@Res({ passthrough: true })` si `status === 'error'`) y `health.module.ts`, registrado en `apps/api/src/app.module.ts`; usar `import type { HealthResponse } from '@cafeteria/shared'`
- [ ] T012 [P] [US1] Estilos y layout accesibles: `apps/web/app/globals.css` (sustituir los de ejemplo; texto `#1a1a1a` sobre `#ffffff`, verde `#0b5d1e`, rojo `#8a1111`, botón ≥ 44×44 px con `:focus-visible` de 3 px, `prefers-reduced-motion: reduce` sin transiciones) y `apps/web/app/layout.tsx` (`<html lang="es">`, título "Proyecto cafetería", sin fuentes ni contenido de ejemplo)
- [ ] T013 [US1] Crear el componente cliente `apps/web/app/health-status.tsx` (`'use client'`; estados `cargando | todo-ok | bd-caida | api-caida` de `data-model.md`; `fetch` a `${NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/health` con `cache: 'no-store'` y `AbortController` de 3 s; valida la forma con `import type { HealthResponse } from '@cafeteria/shared'`; textos exactos de `contracts/home-page.md` dentro de `<div role="status" aria-live="polite">`; botón "Reintentar") y reescribir `apps/web/app/page.tsx` (`<main>`, `<h1>Proyecto cafetería</h1>`, `<HealthStatus />`), borrando `page.module.css` y los recursos de ejemplo de `apps/web/public/`
- [ ] T014 [US1] Escribir en `README.md`: requisitos previos (Node 22 y Corepack/pnpm), instalación (`corepack enable`, `pnpm install`), configuración (copiar `apps/api/.env.example` y `apps/web/.env.example`, comandos para bash y PowerShell), preparar la BD (`pnpm db:setup`), arrancar (`pnpm dev`, puertos 3000/3001 y cómo cambiarlos) y solución de problemas (`.env` ausente, BD sin preparar → 503, puerto ocupado)

**Checkpoint**: `pnpm test` pasa (T009 y T010 en verde); quickstart §1–3 funciona: 200, 503 con `dev.db` borrado y los tres estados de la página, con teclado y lector de pantalla según `contracts/home-page.md`.

---

## Phase 4: User Story 2 - Integrar un cambio con controles automáticos (Priority: P1)

**Goal**: commits validados en local por Husky + commitlint y pipeline de PR (install → lint → test → build).

**Independent Test**: `git commit --allow-empty -m "cambios varios"` se rechaza y `-m "feat(api): añadir endpoint de salud"` se acepta; un PR muestra el check CI en verde, y en rojo con el paso fallido si se rompe un test (quickstart §4 y §6).

- [ ] T015 [P] [US2] Configurar Husky + commitlint: instalar en la raíz `husky`, `@commitlint/cli`, `@commitlint/config-conventional`, `@commitlint/types`; añadir `"prepare": "husky"` en `package.json`; crear `commitlint.config.ts` (extiende `config-conventional`, `scope-empty: [2, 'never']`, `scope-enum: [2, 'always', ['repo', 'ci', 'deps', 'docs', 'api', 'web', 'shared', 'plataforma', 'identidad', 'catalogo', 'carrito']]`) y `.husky/commit-msg` (`pnpm exec commitlint --edit "$1"`, fin de línea LF)
- [ ] T016 [P] [US2] Crear `.github/workflows/ci.yml`: `on: pull_request` y `push` a `main`; `concurrency` por rama con `cancel-in-progress`; job en `ubuntu-latest` con `timeout-minutes: 10`; pasos `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` (`node-version-file: .nvmrc`, `cache: pnpm`) y los pasos con nombre `Install` (`pnpm install --frozen-lockfile`), `Lint` (`pnpm lint`), `Test` (`pnpm test`) y `Build` (`pnpm build`); sin filtros `paths`
- [ ] T017 [US2] Añadir a `README.md` las secciones "Formato de commits" (tipos, alcances permitidos, ejemplos válidos e inválidos) y "Calidad" (`pnpm lint`, `pnpm test`, `pnpm build` y qué ejecuta el pipeline)

**Checkpoint**: tras `pnpm install`, el commit "cambios varios" se rechaza y "feat(api): añadir endpoint de salud" se acepta; un PR contra `main` muestra el check CI en verde en menos de 10 min, y en rojo en el paso **Test** si en una rama de prueba se cambia la aserción `200` de `apps/api/test/health.e2e-spec.ts` por `201`.

---

## Phase 5: User Story 3 - Continuar con los módulos de las siguientes specs (Priority: P2)

**Goal**: carpetas de módulo listas y tipo de `/health` compartido entre web y API.

**Independent Test**: existen las tres carpetas de módulo; cambiar la forma de `HealthResponse` hace fallar `pnpm lint` en `api` y en `web` (quickstart §5).

- [ ] T018 [P] [US3] Crear las carpetas de módulo sin lógica, cada una con un `README.md` (Git no guarda carpetas vacías) que indica el módulo, su spec y que solo accede a su propio esquema: `apps/api/src/modules/identidad/README.md` (spec `002-identidad-clientes`), `apps/api/src/modules/catalogo/README.md` (spec `003-menu-dinamico`) y `apps/api/src/modules/carrito/README.md` (spec `004-carrito-compras`)

**Checkpoint**: las tres carpetas existen en un clon limpio; renombrar temporalmente `checkedAt` a `checked_at` en `packages/shared/src/index.ts` y ejecutar `pnpm --filter @cafeteria/shared build && pnpm lint` falla en `api` y en `web` (revertir después).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T019 [P] Completar `README.md` con "Paso a PostgreSQL" (FR-007: cambiar `provider` en `apps/api/prisma/schema.prisma` y `DATABASE_URL`, borrar `apps/api/prisma/migrations/`, regenerar con `prisma migrate dev --name init` y revisar la consulta de `/health`; solo documentación), "Estructura del repositorio" y la nota de configurar a mano la protección de `main` en GitHub
- [ ] T020 Validar desde un clon limpio (sin `node_modules`, `.env` ni `dev.db`) siguiendo `specs/001-plataforma-entrega/quickstart.md` de principio a fin y cronometrar (SC-001 < 15 min); comprobar que `git ls-files` no incluye archivos `.py`, `.env` ni `*.db`

**Checkpoint**: todos los criterios SC-001 a SC-006 de `spec.md` verificados.

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; bloquea todas las historias. T006 y T007 dependen de T005.
- **US1 (Phase 3)**: depende de Foundational. T009–T010 antes que T011; T013 depende de T012 solo por los estilos.
- **US2 (Phase 4)**: depende de Foundational. T015 se puede adelantar justo después de Setup para que todos los commits siguientes se validen. La prueba en rojo del checkpoint necesita T010.
- **US3 (Phase 5)**: depende de Foundational; su checkpoint necesita T011 y T013.
- **Polish (Phase 6)**: después de las historias.

### Parallel Opportunities

- Setup: T002 y T003 en paralelo tras T001.
- Foundational: T004, T005 y T008 en paralelo.
- US1: T009 y T010 en paralelo; T012 en paralelo con la API (T011).
- US2: T015 y T016 en paralelo.
- Con 3 personas: una en la API (T005–T007, T009–T011), otra en la web (T008, T012–T013) y otra en US2 + US3.

## Parallel Example: User Story 1

```bash
Task: "T009 Test unitario de HealthService en apps/api/src/health/health.service.spec.ts"
Task: "T010 Test HTTP con SQLite real en apps/api/test/health.e2e-spec.ts"
Task: "T012 Estilos y layout accesibles en apps/web/app/globals.css y layout.tsx"
```

---

## Commits sugeridos

| # | Commit | Tareas |
|---|--------|--------|
| 1 | `chore(repo): configurar pnpm workspaces, Node y TypeScript base` | T001–T003 |
| 2 | `chore(repo): añadir Husky y commitlint` | T015 |
| 3 | `feat(shared): definir el tipo HealthResponse` | T004 |
| 4 | `feat(api): crear la API NestJS con Prisma y SQLite` | T005–T007 |
| 5 | `feat(api): añadir GET /health con tests` | T009–T011 |
| 6 | `docs(api): añadir carpetas de los módulos identidad, catalogo y carrito` | T018 |
| 7 | `feat(web): crear la página de inicio con el estado de la API` | T008, T012–T013 |
| 8 | `ci(repo): añadir workflow de GitHub Actions para PR` | T016 |
| 9 | `docs(repo): añadir README` | T014, T017, T019 |

T020 es de verificación y no genera commit.

## Implementation Strategy

1. **MVP**: Phase 1 + Phase 2 (con T015 adelantado) + Phase 3 → parar y validar con quickstart §1–3.
2. US2 → PR con CI en verde.
3. US3 → carpetas de módulo.
4. Polish → README completo y validación desde un clon limpio.
