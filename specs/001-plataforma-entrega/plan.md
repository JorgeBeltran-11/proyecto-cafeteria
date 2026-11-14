# Implementation Plan: Stack tecnológico base

**Branch**: `feature/spec-1` (spec `001-plataforma-entrega`) | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/001-plataforma-entrega/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Montar el esqueleto mínimo y funcional del proyecto: un monorepo **pnpm workspaces** con `apps/api` (NestJS + Prisma + SQLite), `apps/web` (Next.js) y `packages/shared` (tipos). La API expone `GET /health`, que comprueba la base de datos con una consulta acotada a 500 ms y responde 200 o 503; la web muestra ese estado en una página de inicio accesible. La calidad mínima la garantizan Jest (tests de `/health` con SQLite real y con la base de datos simulada caída), Husky + commitlint en local y un workflow de GitHub Actions por PR (install → lint → test → build). Todo lo que exige infraestructura (Docker, PostgreSQL, Redis, RabbitMQ, Vercel, Render, SonarQube, Grafana, Testcontainers) queda **diferido** y justificado abajo: es un trabajo universitario con entrega el lunes 2026-11-16 y alcance mínimo.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 22 LTS (fijado en `.nvmrc` y `engines`); pnpm 10 (fijado en `packageManager`)
**Primary Dependencies**: NestJS 11 (`@nestjs/config`), Prisma 6, Next.js 16 + React 19, ESLint 9 (flat config) + typescript-eslint, Husky 9, commitlint (`config-conventional`)
**Storage**: SQLite en archivo local (`apps/api/prisma/dev.db`, ignorado por git) vía Prisma; migración inicial versionada
**Testing**: Jest + ts-jest + `@nestjs/testing` + supertest en `apps/api`
**Target Platform**: desarrollo local en Windows/macOS/Linux; CI en `ubuntu-latest` (GitHub Actions). Sin despliegue en esta spec
**Project Type**: aplicación web (monorepo con frontend + backend + paquete compartido)
**Performance Goals**: `GET /health` < 1 s en local en todos los casos (SC-003); pipeline de PR < 10 min (SC-004)
**Constraints**: sin Docker, sin Python, sin servicios externos en tests; WCAG AAA en la página de inicio; ningún detalle interno en el 503
**Scale/Scope**: equipo de 2–4 personas; 1 endpoint, 1 página, 3 carpetas de módulo vacías

No quedan puntos `NEEDS CLARIFICATION`: todos se resuelven en [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Leyenda: ✅ cumple · ⏸ diferido (justificado en *Complexity Tracking*) · N/A no aplica a esta spec.

- [x] **I. Accesibilidad AAA:** ✅ la página de inicio declara `lang="es"`, contraste ≥ 7:1, estado en texto (no solo color) en una región `role="status"` / `aria-live="polite"`, botón "Reintentar" operable por teclado con foco visible y ≥ 44×44 px, sin animaciones. ⏸ La verificación automática con **axe** en el pipeline se difiere (se sustituye por revisión manual con lector de pantalla y lista de comprobación en [contracts/home-page.md](./contracts/home-page.md)).
- [x] **II. Seguridad:** ✅ secretos fuera del repo (`.env` ignorado, `.env.example` sin secretos), el 503 no expone rutas, trazas ni la `DATABASE_URL`, CORS limitado al origen de la web. N/A autorización por rol y datos de tarjeta (no hay usuarios ni pagos). ⏸ Escaneo de secretos y de dependencias en el pipeline diferido.
- [x] **III. LOPDP:** N/A — esta spec no trata datos personales (no hay tablas de dominio).
- [x] **IV. Escalabilidad y consistencia:** ✅ la API no guarda estado en memoria entre peticiones. N/A outbox, idempotencia y precios (no hay pedidos ni pagos). ⏸ Redis y RabbitMQ diferidos; SQLite (un archivo) impide escalar horizontalmente la API hasta pasar a PostgreSQL.
- [x] **V. Límites de dominio:** ✅ carpetas `identidad`, `catalogo` y `carrito` creadas como futuros módulos NestJS; no se añade ninguna dependencia sin justificar (se evita `@nestjs/terminus`, ver research R5). ⏸ La regla de lint que verifica los límites entre módulos se difiere hasta que exista código en ellos (spec 002).
- [x] **VI. Calidad:** ✅ tests Jest de `/health` (200 con SQLite real, 503 con la base de datos caída, 503 por timeout) que corren en local y CI sin servicios externos. ⏸ **SonarQube** (Quality Gate y cobertura ≥ 80 %), tests de integración con **Testcontainers** y E2E con **Playwright** diferidos. N/A TDD de precios/pedidos/pagos.
- [x] **VII. Reversibilidad:** ✅ Conventional Commits con alcance validados por Husky + commitlint; plan de commits atómicos y verdes (ver *Orden de commits*); migración inicial versionada de Prisma. ⏸ Validación de commits y build commit a commit en el pipeline diferidas. N/A feature flags y expand/contract (no hay funcionalidad parcial ni migraciones con datos).
- [x] **Plataforma:** ✅ TypeScript en todo el código, sin Python. ⏸ **Vercel**, **Render** (`render.yaml`), **PostgreSQL** (Render Postgres) y "solo el pipeline despliega" diferidos: esta spec no despliega nada. El cambio temporal a SQLite se registra en `docs/adr/0001-sqlite-temporal.md`, como pide la sección *Restricciones tecnológicas* de la constitución.

**Resultado de la puerta (antes de Phase 0)**: PASA con desviaciones justificadas en *Complexity Tracking*.

**Re-evaluación después de Phase 1**: PASA. El diseño (contrato de `/health`, página de inicio, esquema de Prisma sin modelos) no introduce nuevas desviaciones. La comprobación de salud consulta la tabla `_prisma_migrations` para que una base de datos sin preparar dé 503 (research R4), lo que mantiene el caso límite de la spec.

## Project Structure

### Documentation (this feature)

```text
specs/001-plataforma-entrega/
├── plan.md              # Este archivo
├── research.md          # Phase 0: decisiones técnicas
├── data-model.md        # Phase 1: tipo HealthResponse y esquema Prisma
├── quickstart.md        # Phase 1: validación de punta a punta
├── contracts/
│   ├── health.openapi.yaml   # Contrato HTTP de GET /health
│   └── home-page.md          # Contrato de UI y accesibilidad de la página de inicio
├── checklists/          # (ya existía)
└── tasks.md             # Phase 2 (/speckit-tasks, no lo genera este comando)
```

### Source Code (repository root)

```text
.
├── package.json              # scripts raíz (dev, lint, test, build), packageManager, engines, onlyBuiltDependencies
├── pnpm-workspace.yaml       # apps/*, packages/*
├── pnpm-lock.yaml
├── .nvmrc                    # 22
├── .gitignore                # node_modules, dist, .next, .env, *.db, *.db-journal
├── eslint.config.mjs         # config base compartida (flat config)
├── tsconfig.base.json
├── commitlint.config.ts
├── .husky/commit-msg         # pnpm exec commitlint --edit "$1"
├── .github/workflows/ci.yml  # install → lint → test → build en cada PR
├── docs/adr/0001-sqlite-temporal.md
├── README.md
├── apps/
│   ├── api/
│   │   ├── .env.example      # DATABASE_URL, PORT, WEB_ORIGIN
│   │   ├── prisma/
│   │   │   ├── schema.prisma # provider sqlite, sin modelos
│   │   │   └── migrations/0_init/migration.sql
│   │   ├── src/
│   │   │   ├── main.ts       # bootstrap, CORS, validación de DATABASE_URL
│   │   │   ├── app.module.ts
│   │   │   ├── prisma/prisma.service.ts
│   │   │   ├── health/
│   │   │   │   ├── health.controller.ts
│   │   │   │   ├── health.service.ts
│   │   │   │   └── health.module.ts
│   │   │   └── modules/
│   │   │       ├── identidad/README.md   # spec 002
│   │   │       ├── catalogo/README.md    # spec 003
│   │   │       └── carrito/README.md     # spec 004
│   │   ├── test/
│   │   │   ├── health.e2e-spec.ts
│   │   │   ├── jest-e2e.config.ts
│   │   │   └── global-setup.ts           # crea test.db y aplica migraciones
│   │   ├── jest.config.ts
│   │   └── package.json
│   └── web/
│       ├── .env.example      # NEXT_PUBLIC_API_URL, PORT
│       ├── app/
│       │   ├── layout.tsx    # <html lang="es">
│       │   ├── page.tsx
│       │   ├── health-status.tsx   # componente cliente con role="status"
│       │   └── globals.css   # tokens de color con contraste ≥ 7:1
│       ├── next.config.ts
│       └── package.json
└── packages/
    └── shared/
        ├── src/index.ts      # HealthResponse, ComponentStatus
        ├── tsconfig.json
        └── package.json      # build con tsc a dist/, prepare en install
```

**Structure Decision**: monorepo con dos aplicaciones (`apps/api`, `apps/web`) y un paquete de tipos (`packages/shared`), tal como fija FR-001. Los módulos de dominio viven en `apps/api/src/modules/<modulo>` para que cada spec futura añada su `*.module.ts` sin mover nada.

## Orden de commits (atómicos y verdes)

1. `chore(repo): configurar pnpm workspaces, Node y TypeScript base`
2. `chore(repo): añadir Husky y commitlint` (a partir de aquí los commits se validan)
3. `feat(shared): definir el tipo HealthResponse`
4. `feat(api): crear la API NestJS con Prisma y SQLite`
5. `feat(api): añadir GET /health con tests`
6. `docs(api): añadir carpetas de los módulos identidad, catalogo y carrito`
7. `feat(web): crear la página de inicio con el estado de la API`
8. `ci(repo): añadir workflow de GitHub Actions para PR`
9. `docs(repo): README, .env.example y ADR de SQLite`

Cada commit debe pasar `pnpm lint && pnpm test && pnpm build` por sí solo.

## Complexity Tracking

> Desviaciones de la constitución v1.0.0. Contexto común: trabajo universitario con entrega el **lunes 2026-11-16**, equipo pequeño y alcance mínimo acordado en la spec. Todas son **temporales** y se retoman en las fases siguientes del `ROADMAP.md`.

| Violation (diferida) | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **PostgreSQL** → SQLite (Plataforma, IV) | Que el proyecto arranque solo con Node.js y pnpm, sin Docker ni servidor de base de datos, en todos los equipos (SC-001). Se registra en el ADR 0001 y el README documenta el paso a PostgreSQL (FR-007). | Postgres local exige instalarlo o usar Docker en cada equipo; Render Postgres exige cuenta y red, y no se despliega nada en esta spec. Prisma hace que el cambio posterior sea de `provider` + `DATABASE_URL` + regenerar migraciones. |
| **Vercel** (frontend) y **Render** (`render.yaml`, backend); "solo el pipeline despliega" | La spec solo pide ejecución local y CI; no hay nada que publicar. | Configurar cuentas, entornos, secretos y despliegue con aprobación manual no aporta a la entrega y añade puntos de fallo ajenos al código. |
| **SonarQube** y su Quality Gate (VI) | El Quality Gate requiere un servidor SonarQube o una organización en SonarCloud y su token; fuera del tiempo disponible. Lint + tests en el pipeline cubren la calidad mínima. | No hay alternativa más simple que cumpla la regla: el gate es obligatorio por la constitución, por eso se difiere de forma explícita en lugar de imitarlo a medias. |
| **Testcontainers** (integración con Postgres, Redis y RabbitMQ reales) (VI) | Requiere Docker en local y en CI, y hoy no hay Postgres, Redis ni RabbitMQ que probar. Los tests de `/health` usan SQLite real en un archivo temporal, que es una integración real con la base de datos actual. | Simular Testcontainers sin Docker no es posible; añadir Docker contradice la restricción "sin Docker" de la spec. |
| **Grafana** (métricas DORA y del equipo) | Necesita una instancia de Grafana, fuentes de datos y un pipeline de despliegue que todavía no existe (sin despliegues no hay métricas DORA). | Un dashboard sin datos de despliegue no mide nada útil. |
| **E2E con Playwright** y **axe** en el pipeline (I, VI) | Fuera del alcance mínimo; la única página es estática y se verifica a mano con lector de pantalla y la lista de [contracts/home-page.md](./contracts/home-page.md). | Instalar navegadores en CI alarga el pipeline y el tiempo de entrega sin cubrir flujos críticos (aún no existen). |
| **Validación de commits y build commit a commit en el pipeline** (VII) | commitlint ya corre en local con Husky (FR-019); verificar cada commit en CI se difiere junto con release-please. | Husky en local cubre el caso habitual; un `--no-verify` queda a cargo del revisor del PR. |
| **Lint de límites entre módulos** (V), **Redis/RabbitMQ** (IV), **escaneos de seguridad** (II) | Las carpetas de módulo están vacías y no hay mensajería ni dependencias de riesgo todavía. | Configurar reglas y servicios sin código que los use es complejidad sin beneficio (V: "ante la duda, la opción más simple"). |
