# Research: Stack tecnológico base (spec 001)

Fecha: 2026-11-14. Cada decisión sigue el formato Decision / Rationale / Alternatives considered. El stack lo fijó el usuario; aquí se resuelven los detalles que la spec deja abiertos.

## R1. Versiones fijadas de Node.js y pnpm (FR-004)

- **Decision**: Node.js **22 LTS** en `.nvmrc` y `engines.node: ">=22 <23"`; pnpm **10** en `packageManager: "pnpm@10.x.y"` (versión exacta al hacer el scaffolding), activado con Corepack. La CI lee ambas: `pnpm/action-setup` usa `packageManager` y `actions/setup-node` usa `node-version-file: .nvmrc`.
- **Rationale**: Node 22 es LTS con soporte hasta 2027 y compatible con Prisma 6, NestJS 11 y Next.js 16. Una sola fuente de verdad evita desajustes entre equipos y CI.
- **Alternatives considered**: Node 24 LTS (más reciente; se descarta para minimizar riesgo de compatibilidad con Prisma 6 a dos días de la entrega). Volta / asdf (otra herramienta que instalar).

## R2. Scripts de lifecycle con pnpm 10

- **Decision**: declarar en el `package.json` raíz `pnpm.onlyBuiltDependencies: ["prisma", "@prisma/client", "@prisma/engines"]`.
- **Rationale**: pnpm 10 no ejecuta por defecto los scripts `postinstall` de las dependencias; Prisma los necesita para descargar sus motores. Los scripts de los propios paquetes del workspace (Husky, `prepare` de `shared`, `postinstall` de `api`) sí se ejecutan.
- **Alternatives considered**: `pnpm approve-builds` (interactivo, cada desarrollador tendría que hacerlo); pnpm 9 (sin esta restricción, pero versión anterior).

## R3. Prisma y SQLite

- **Decision**: **Prisma 6.x**, `provider = "sqlite"`, `url = env("DATABASE_URL")` con `file:./dev.db` (relativo a `apps/api/prisma/`). Esquema **sin modelos de dominio** y una migración inicial `0_init` versionada. Scripts en `apps/api`: `postinstall: prisma generate`, `db:setup: prisma migrate deploy`. Root: `pnpm db:setup` → `pnpm --filter api db:setup`.
- **Rationale**: Prisma 6 funciona con SQLite sin adaptadores nativos adicionales, y el paso a PostgreSQL es cambiar `provider` y `DATABASE_URL` y regenerar las migraciones (FR-007). Una migración versionada desde el principio prepara el patrón expand/contract del principio VII.
- **Alternatives considered**: Prisma 7 (exige `prisma.config.ts` y un driver adapter como `better-sqlite3`, con compilación nativa: más riesgo en Windows). `prisma db push` (no deja historial de migraciones). TypeORM / Drizzle (el usuario fijó Prisma).

## R4. Comprobación de la base de datos en `/health` (FR-008, caso límite "BD sin preparar")

- **Decision**: la consulta es `SELECT 1 FROM _prisma_migrations LIMIT 1` con `prisma.$queryRaw`, envuelta en un timeout de **500 ms** (`Promise.race`). Error o timeout → `database: "error"` y HTTP 503.
- **Rationale**: SQLite crea el archivo vacío al conectarse, así que un `SELECT 1` daría 200 aunque nadie haya ejecutado `db:setup`. Consultar la tabla de migraciones sigue siendo trivial y hace que la base de datos sin preparar dé 503, como pide la spec. El timeout garantiza SC-003 (< 1 s).
- **Alternatives considered**: `SELECT 1` (falso positivo descrito); comprobar que el archivo existe en disco (no sirve al pasar a PostgreSQL).

## R5. Implementación del endpoint de salud

- **Decision**: `HealthModule` propio (controller + service) que usa `PrismaService`. El controller fija el código con `@Res({ passthrough: true })` o lanzando `ServiceUnavailableException` con el cuerpo `HealthResponse`. Los errores se registran con el `Logger` de Nest en el servidor, nunca en la respuesta (FR-010).
- **Rationale**: son ~40 líneas; el principio V pide justificar cada dependencia nueva.
- **Alternatives considered**: `@nestjs/terminus` (útil cuando hay muchos indicadores; hoy solo hay uno y su formato de respuesta no coincide con el tipo compartido).

## R6. Configuración y variables de entorno (FR-014, FR-023, caso límite ".env no existe")

- **Decision**: un `.env.example` **por aplicación**: `apps/api/.env.example` (`DATABASE_URL`, `PORT=3001`, `WEB_ORIGIN=http://localhost:3000`) y `apps/web/.env.example` (`NEXT_PUBLIC_API_URL=http://localhost:3001`, `PORT=3000`). La API usa `@nestjs/config`; si falta `DATABASE_URL`, el arranque falla con el mensaje "Falta DATABASE_URL: copia apps/api/.env.example a apps/api/.env". `PORT` y `WEB_ORIGIN` tienen valores por defecto.
- **Rationale**: Prisma CLI, NestJS y Next.js buscan el `.env` en la carpeta de su paquete; un único `.env` en la raíz obligaría a añadir `dotenv-cli` o rutas especiales en las tres herramientas. Es una precisión de la spec ("un `.env.example`"), no un cambio de alcance; el README lo explica.
- **Alternatives considered**: `.env` único en la raíz con `dotenv-cli` (dependencia extra y scripts más largos); `--env-file` de Node (no lo usan Prisma CLI ni Next).

## R7. Tipos compartidos (FR-011, US3-2)

- **Decision**: `packages/shared` (nombre `@cafeteria/shared`) se compila con `tsc` a `dist/` (`.js` + `.d.ts`) y expone `exports`/`types` apuntando a `dist`. Se compila en `prepare` (al hacer `pnpm install`) y en `build`. API y web lo consumen como `"@cafeteria/shared": "workspace:*"` con `import type`.
- **Rationale**: la API compila con `tsc` vía Nest CLI; importar `.ts` de fuera de `src` cambia la raíz de compilación y rompe la ruta de `dist/main.js`. Con `dist` precompilado, Jest (ts-jest), Nest y Next ven el mismo tipo y un cambio de forma rompe el typecheck de ambas apps.
- **Alternatives considered**: exportar `src/*.ts` directamente (funciona en Next con `transpilePackages`, pero no en Nest sin ajustes de `rootDir`); referencias de proyecto de TypeScript (`tsc -b`; más configuración para el mismo resultado).

## R8. Página de inicio y accesibilidad (FR-012–FR-015)

- **Decision**: Next.js 16 con App Router. `page.tsx` (server) renderiza el encabezado y un componente cliente `HealthStatus` que llama a `GET {NEXT_PUBLIC_API_URL}/health` al montarse, con timeout de 3 s (`AbortController`), y muestra el resultado dentro de `<div role="status" aria-live="polite">`. Botón "Reintentar". Tres estados de texto: "API en línea · Base de datos conectada", "API en línea · Base de datos no disponible", "API no disponible". Colores con contraste ≥ 7:1 y el estado siempre en texto; sin animaciones.
- **Rationale**: hacer la petición en el navegador permite cubrir el caso "API detenida" sin errores de servidor y anunciar el cambio a lectores de pantalla (FR-015). El 503 se interpreta leyendo el cuerpo `HealthResponse`.
- **Alternatives considered**: fetch en un Server Component (el anuncio `aria-live` no se produce en la carga inicial y "Reintentar" exigiría recargar); polling periódico (innecesario y molesto para lectores de pantalla).

## R9. CORS

- **Decision**: `app.enableCors({ origin: WEB_ORIGIN })` en `main.ts`.
- **Rationale**: la web (3000) llama a la API (3001) desde el navegador; limitar el origen cumple lo básico del principio II.
- **Alternatives considered**: `origin: "*"` (más permisivo sin necesidad); proxy con rewrites de Next (oculta el caso "API detenida" detrás de un 500 del propio Next).

## R10. Tests con Jest (FR-017, FR-018)

- **Decision**: en `apps/api`, dos suites:
  - **Unitaria** (`health.service.spec.ts`): `PrismaService` simulado → `ok`, error → `error`, consulta que no resuelve → `error` antes de 1 s.
  - **E2E HTTP** (`test/health.e2e-spec.ts`, supertest): `globalSetup` crea `test.db` en un directorio temporal y ejecuta `prisma migrate deploy` con esa `DATABASE_URL`; caso 200 con SQLite real; caso 503 sobrescribiendo `PrismaService` con uno que lanza; comprueba que el cuerpo no contiene rutas, `file:` ni trazas.
  - `pnpm test` (raíz) ejecuta ambas con `pnpm -r test`.
- **Rationale**: cubre 200 y 503 sin servicios externos y valida además el contrato HTTP.
- **Alternatives considered**: solo tests unitarios (no prueban el código HTTP ni la conexión real); Vitest (el usuario fijó Jest).

## R11. Lint y comprobación de tipos

- **Decision**: ESLint 9 con flat config; `eslint.config.mjs` base en la raíz con `typescript-eslint` recomendado, y en `apps/web` además `eslint-config-next`. Cada paquete tiene `lint` (`eslint .`) y `typecheck` (`tsc --noEmit`); el `lint` raíz ejecuta `pnpm -r lint && pnpm -r typecheck`.
- **Rationale**: `next lint` está obsoleto desde Next 15.5; la CLI de ESLint es igual en los tres paquetes. El typecheck en el paso de lint hace que US3-2 falle pronto.
- **Alternatives considered**: Biome (otra herramienta que el equipo no usa); typecheck solo en `build` (detecta tarde el cambio de tipo).
- **Nota**: el archivo de configuración `eslint.config.mjs` es configuración de herramientas, no código de la aplicación; si se exige TypeScript estricto también ahí, usar `eslint.config.ts` (ESLint 9 lo soporta con `jiti`).

## R12. Husky y commitlint (FR-019, FR-020)

- **Decision**: Husky 9 con `"prepare": "husky"` en la raíz; hook `.husky/commit-msg` con `pnpm exec commitlint --edit "$1"`. `commitlint.config.ts` extiende `@commitlint/config-conventional` con `scope-empty: [2, "never"]` y `scope-enum: [2, "always", ["repo", "ci", "deps", "docs", "api", "web", "shared", "plataforma", "identidad", "catalogo", "carrito"]]`.
- **Rationale**: `prepare` se ejecuta en `pnpm install`, sin pasos manuales. Exigir alcance aplica el principio VII ("módulo como alcance"); la lista se amplía en cada spec.
- **Alternatives considered**: lefthook (otra herramienta); alcance opcional (permitiría `chore: ...` sin módulo, contra la constitución).

## R13. GitHub Actions (FR-021, FR-022, SC-004)

- **Decision**: `.github/workflows/ci.yml`, `on: pull_request` (y `push` a `main`), un job en `ubuntu-latest` con `timeout-minutes: 10` y `concurrency` por rama. Pasos: `actions/checkout@v4` → `pnpm/action-setup@v4` → `actions/setup-node@v4` (`node-version-file: .nvmrc`, `cache: pnpm`) → `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm test` → `pnpm build`. Cada paso con nombre propio para que el PR muestre cuál falló.
- **Rationale**: orden exacto de FR-021; un solo job con caché de pnpm termina holgadamente en < 10 min. Los PR de solo documentación también lo ejecutan (sin filtros `paths`).
- **Alternatives considered**: jobs paralelos por paso (más rápido, pero rompe el orden pedido y repite la instalación); Turborepo (dependencia extra; `pnpm -r` ya respeta el orden topológico).
