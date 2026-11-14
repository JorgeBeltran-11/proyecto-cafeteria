# Data Model: Stack tecnológico base (spec 001)

Esta spec no define tablas de dominio. Solo hay un tipo compartido y el esquema mínimo de Prisma.

## Tipo compartido: `HealthResponse` (`packages/shared/src/index.ts`)

```ts
export type ComponentStatus = 'ok' | 'error';

export interface HealthResponse {
  /** 'ok' solo si todos los componentes están 'ok'. */
  status: ComponentStatus;
  /** Si la API responde, siempre 'ok'. */
  api: ComponentStatus;
  database: ComponentStatus;
  /** Momento de la comprobación, ISO 8601 en UTC. */
  checkedAt: string;
}
```

| Campo | Tipo | Reglas |
|-------|------|--------|
| `status` | `'ok' \| 'error'` | `'ok'` ⇔ `api === 'ok' && database === 'ok'` |
| `api` | `'ok' \| 'error'` | siempre `'ok'` en las respuestas de la API (si la API cae, no hay respuesta) |
| `database` | `'ok' \| 'error'` | `'error'` si la consulta falla o tarda más de 500 ms |
| `checkedAt` | `string` | `new Date().toISOString()` |

**Correspondencia con HTTP**: `status: 'ok'` → 200; `status: 'error'` → 503. El cuerpo nunca incluye mensajes de error, rutas, la `DATABASE_URL` ni trazas (FR-010).

### Estados que ve la web (derivados, no compartidos)

| Estado de la página | Condición | Texto mostrado |
|---------------------|-----------|----------------|
| `cargando` | petición en curso | "Comprobando el estado de la API…" |
| `todo-ok` | 200 y `database: 'ok'` | "API en línea" · "Base de datos conectada" |
| `bd-caida` | 503 y `database: 'error'` | "API en línea" · "Base de datos no disponible" |
| `api-caida` | error de red, timeout de 3 s o respuesta no reconocida | "API no disponible" |

Transiciones: `cargando → {todo-ok | bd-caida | api-caida}`; el botón "Reintentar" vuelve a `cargando`.

## Esquema de Prisma (`apps/api/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"          // pasar a "postgresql" en la fase de PostgreSQL
  url      = env("DATABASE_URL")
}

// Sin modelos: los añaden las specs 002 (identidad), 003 (catalogo) y 004 (carrito).
```

- Migración inicial `prisma/migrations/0_init/migration.sql` sin tablas de dominio (solo un comentario); al aplicarla, Prisma crea `_prisma_migrations`, que es la tabla que consulta `/health` (research R4).
- `migration_lock.toml` registra `provider = "sqlite"`; al pasar a PostgreSQL se borran las migraciones SQLite y se regenera la inicial (documentado en el README, FR-007).
- Archivos ignorados por git: `apps/api/prisma/*.db`, `*.db-journal`.
