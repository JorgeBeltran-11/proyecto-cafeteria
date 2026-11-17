# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

Spec 001 (stack base) implementada: monorepo **pnpm workspaces** con `apps/api` (NestJS 11 + Prisma 6 + SQLite, puerto 3001), `apps/web` (Next.js 16 + React 19, puerto 3000) y `packages/shared` (`@cafeteria/shared`, tipos comunes como `HealthResponse`; se consume compilado desde `dist/`). La única funcionalidad es `GET /health` y la página de inicio que muestra su estado. Detalle para personas en `README.md`.

## Comandos

Node 22 LTS (`.nvmrc`) y pnpm vía Corepack (versión exacta en `packageManager`). Se ejecutan desde la raíz:

```bash
pnpm install          # dependencias + build de @cafeteria/shared + prisma generate + Husky
pnpm db:setup         # prisma migrate deploy → apps/api/prisma/dev.db (requiere apps/api/.env)
pnpm dev              # API (3001) y web (3000) en paralelo
pnpm lint             # eslint + tsc --noEmit en todos los paquetes
pnpm test             # Jest de la API: unitarios (src/**/*.spec.ts) y HTTP (test/*.e2e-spec.ts)
pnpm build            # shared → api (prisma generate + nest build) → web (next build)
```

- Un solo test unitario: `pnpm --filter api exec jest src/health/health.service.spec.ts`; filtrar por nombre: añadir `-t "texto del it"`.
- Un solo test HTTP: `pnpm --filter api exec jest --config test/jest-e2e.json health`. `test/global-setup.ts` crea una SQLite temporal y aplica las migraciones, así que no necesita `.env` ni `dev.db`.
- Un paquete concreto: `pnpm --filter api <script>`, `pnpm --filter web <script>`, `pnpm --filter @cafeteria/shared build`. Si cambias `packages/shared`, recompílalo antes de que `api`/`web` vean el cambio.
- Prisma: `pnpm --filter api exec prisma migrate dev --name <nombre>` para crear una migración.
- Configuración: `apps/api/.env` (desde `.env.example`: `DATABASE_URL`, `PORT`, `WEB_ORIGIN`) y `apps/web/.env.local` (`NEXT_PUBLIC_API_URL`).
- Commits: Husky + commitlint (`commitlint.config.ts`) exigen `tipo(alcance): descripción` con alcance de la lista `scope-enum`; probar un mensaje con `"feat(api): x" | pnpm exec commitlint`.
- CI: `.github/workflows/ci.yml` ejecuta en cada PR `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm test` → `pnpm build`.
- `apps/web` usa Next.js 16, que cambia APIs respecto a versiones anteriores: consulta `apps/web/AGENTS.md` y `node_modules/next/dist/docs/` antes de escribir código de la web. El lint de React prohíbe `setState` síncrono dentro de `useEffect` (`react-hooks/set-state-in-effect`).

## Documentos clave

- `.specify/memory/constitution.md`: **constitución del proyecto** (principios I–VII no negociables). Prevalece sobre cualquier otro documento. Flujo Spec Kit: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`; los specs viven en `specs/NNN-nombre/` y la spec activa la fija `.specify/feature.json` (`feature_directory`). Las ramas del equipo se llaman `feature/spec-N`; `check-prerequisites.sh` (usado por `/speckit-implement`) las rechaza por nombre aunque `feature.json` sea correcto, así que en ese caso usa el directorio de `feature.json`.
- `promtp.md` (el nombre del archivo tiene esa errata): la especificación del producto. Es la fuente de verdad de los requisitos (RF-xx, RNF-xx), del stack y de la arquitectura objetivo (monolito modular en NestJS con outbox + cola, Redis, PostgreSQL); léela antes de diseñar o implementar.
- `ROADMAP.md`: plan por fases (0–7) con criterios de "listo", decisiones pendientes y riesgos. Consulta en qué fase está el proyecto antes de empezar trabajo nuevo.
- `.claude/skills/`: skills de diseño de UI instalados con `npx skills add` (registrados en `skills-lock.json`): `frontend-design` (Anthropic) y `design-taste-frontend` (taste-skill). Úsalos al construir o rediseñar la UI, sin sacrificar el requisito WCAG AAA (contraste ≥ 7:1, movimiento reducible).

## Producto: "Proyecto cafetería"

Aplicación web para gestionar una cafetería online.

Requisitos funcionales:
- Gestión de clientes.
- Compra de varios productos del menú, con un carrito de compras por cliente.
- Formas de pago: efectivo, transferencia y tarjeta de crédito.
- Menús dinámicos: se pueden modificar y actualizar en tiempo de ejecución, no son contenido fijo.
- Promociones y descuentos aplicados a distintos menús en ventanas de tiempo concretas (p. ej. festividades), es decir, reglas de precio acotadas por fechas.

Requisitos no funcionales que condicionan la arquitectura:
- Usabilidad, principios de UX y accesibilidad **WCAG AAA** (no solo AA).
- Alto volumen de pedidos concurrentes; el sistema debe escalar horizontalmente.
- Seguridad fuerte (incluye el manejo de pagos con tarjeta).
- Cumplimiento de la ley de protección de datos (datos personales de clientes).

## Commits y despliegue

- Commits **atómicos y reversibles** con Conventional Commits y el módulo como alcance (`feat(pedidos): ...`): un cambio lógico por commit, y cada commit debe compilar y pasar los tests por sí solo. Las migraciones siguen el patrón expand/contract (detalle en `promtp.md` §7).
- Frontend (`apps/web`) en **Vercel**, backend (API + workers) en **Render** vía `render.yaml`. Solo el pipeline de GitHub Actions despliega; el despliegue automático por Git está desactivado.
- El Quality Gate de **SonarQube** es obligatorio en cada PR; las métricas del pipeline y del equipo van a **Grafana** (§8–9).

## Restricción de stack

**No usar Python** en ninguna parte del stack (requisito explícito del usuario).

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:
`specs/003-menu-dinamico/plan.md`
<!-- SPECKIT END -->
