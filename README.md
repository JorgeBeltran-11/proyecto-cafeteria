# Proyecto cafetería

Aplicación web para gestionar una cafetería online. Monorepo con **pnpm workspaces**:

- `apps/api`: API NestJS 11 + Prisma 6 con SQLite (puerto 3001).
- `apps/web`: web Next.js 16 + React 19 (puerto 3000).
- `packages/shared`: tipos TypeScript compartidos (`@cafeteria/shared`).

Para trabajar en local no hace falta Docker ni un servidor de base de datos: SQLite es un archivo.

## Requisitos previos

- **Node.js 22 LTS** (ver `.nvmrc`). Compruébalo con `node --version` (debe empezar por `v22`).
- **pnpm 10**, en la versión exacta que fija `packageManager` en `package.json`. Se activa con **Corepack**, que viene con Node.js: no hay que instalarlo aparte.
- **Git**.

Nada más: ni Docker, ni PostgreSQL, ni Python.

## Levantar el proyecto desde un clon limpio (PowerShell)

```powershell
# 1. Clonar
git clone <url-del-repositorio> taller4-cafeteria
cd taller4-cafeteria

# 2. Activar pnpm (una sola vez por equipo)
corepack enable
pnpm --version        # debe mostrar la versión de "packageManager" en package.json

# 3. Instalar: dependencias, compila @cafeteria/shared, genera Prisma y activa Husky
pnpm install

# 4. Variables de entorno (no contienen secretos)
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local

# 5. Base de datos: crea apps/api/prisma/dev.db y aplica las migraciones
pnpm db:setup

# 6. Arrancar API y web a la vez (deja esta terminal abierta)
pnpm dev
```

Comprobar, en **otra terminal**:

```powershell
curl.exe -i http://localhost:3001/health   # → HTTP/1.1 200 y {"status":"ok",...}
start http://localhost:3000                # → "API en línea · Base de datos conectada"
```

> En Windows PowerShell 5.1, `curl` a secas es un alias de `Invoke-WebRequest`; usa `curl.exe`.
> Si `corepack enable` falla con `EPERM`, abre PowerShell **como administrador** solo para ese comando.

En bash (Linux, macOS, Git Bash) los pasos son los mismos cambiando `Copy-Item` por `cp`.

### Variables de entorno

| Variable | Archivo | Valor por defecto | Para qué sirve |
|----------|---------|-------------------|----------------|
| `DATABASE_URL` | `apps/api/.env` | `file:./dev.db` | Base de datos SQLite (ruta relativa a `apps/api/prisma/`) |
| `PORT` | `apps/api/.env` | `3001` | Puerto de la API |
| `WEB_ORIGIN` | `apps/api/.env` | `http://localhost:3000` | Origen permitido por CORS |
| `NEXT_PUBLIC_API_URL` | `apps/web/.env.local` | `http://localhost:3001` | URL de la API que consulta la web |

Para cambiar los puertos:

- **API**: cambia `PORT` en `apps/api/.env` (y `NEXT_PUBLIC_API_URL` en `apps/web/.env.local` para que la web la encuentre).
- **Web**: define `PORT` al arrancar: `$env:PORT=4000; pnpm --filter web dev` en PowerShell o `PORT=4000 pnpm --filter web dev` en bash. Después cambia `WEB_ORIGIN` en `apps/api/.env` para que CORS lo permita.

`pnpm db:setup` se puede repetir sin riesgo.

## Estructura del repositorio

```text
.
├── apps/
│   ├── api/                        # API NestJS (puerto 3001)
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # esquema de Prisma (SQLite)
│   │   │   └── migrations/         # migraciones versionadas
│   │   ├── src/
│   │   │   ├── main.ts             # arranque: CORS, puerto, comprobación de DATABASE_URL
│   │   │   ├── app.module.ts       # módulo raíz: registra los módulos
│   │   │   ├── health/             # GET /health (servicio, controlador y test unitario)
│   │   │   ├── prisma/             # PrismaService (cliente compartido)
│   │   │   └── modules/            # módulos de negocio, uno por spec
│   │   │       ├── identidad/
│   │   │       ├── catalogo/
│   │   │       └── carrito/
│   │   └── test/                   # tests HTTP (supertest + SQLite temporal)
│   └── web/                        # web Next.js (puerto 3000)
│       └── app/                    # App Router: layout, página de inicio, estilos
├── packages/
│   └── shared/                     # @cafeteria/shared: tipos comunes (HealthResponse)
├── specs/                          # especificaciones Spec Kit, una carpeta por spec
├── .specify/                       # Spec Kit: constitución, plantillas, scripts y feature.json
├── .github/workflows/ci.yml        # pipeline de PR: install → lint → test → build
├── .husky/commit-msg               # valida el mensaje de commit con commitlint
├── commitlint.config.ts            # tipos y alcances de commit permitidos
├── promtp.md                       # especificación del producto (requisitos RF/RNF)
└── ROADMAP.md                      # plan por fases
```

## Specs y módulos

Cada spec vive en `specs/NNN-nombre/` y su código va en el módulo indicado. Los módulos de `apps/api/src/modules/` solo acceden a sus propias tablas; para datos de otro módulo usan su API pública.

| Spec | Contenido | Módulo / carpeta | Alcance de commit |
|------|-----------|------------------|-------------------|
| `001-plataforma-entrega` | Stack base: monorepo, `/health`, CI, commits | `apps/api`, `apps/web`, `packages/shared` | `plataforma`, `api`, `web`, `shared`, `repo`, `ci` |
| `002-identidad-clientes` | Gestión de clientes | `apps/api/src/modules/identidad/` | `identidad` |
| `003-menu-dinamico` | Menús modificables en tiempo de ejecución | `apps/api/src/modules/catalogo/` | `catalogo` |
| `004-carrito-compras` | Carrito de compras por cliente | `apps/api/src/modules/carrito/` | `carrito` |
| `005-promociones-descuentos` | Promociones acotadas por fechas | Se define en su `plan.md` | Añadir a `commitlint.config.ts` |
| `006-pedidos` | Pedidos | Se define en su `plan.md` | Añadir a `commitlint.config.ts` |
| `007-formas-pago` | Efectivo, transferencia y tarjeta | Se define en su `plan.md` | Añadir a `commitlint.config.ts` |
| `008-administracion-reportes` | Administración, reportes y auditoría | Se define en su `plan.md` | Añadir a `commitlint.config.ts` |

Los cambios en los documentos de `specs/` usan el alcance `specs` (p. ej. `docs(specs): añadir plan de la spec 002`).

## Flujo de trabajo del equipo

Cada persona trabaja una spec en su propia rama y la integra en `main` con un PR.

**1. Crear la rama desde `main` actualizado** (N = número de la spec, sin ceros):

```powershell
git switch main
git pull
git switch -c feature/spec-2
pnpm install          # por si cambiaron dependencias
```

**2. Apuntar Spec Kit a tu spec.** Los comandos `/speckit-*` leen la spec activa de `.specify/feature.json`. Edítalo para que apunte a la carpeta de tu spec:

```json
{
  "feature_directory": "specs/002-identidad-clientes"
}
```

Desde PowerShell, sin BOM (Windows PowerShell 5.1 añade BOM con `Set-Content -Encoding utf8`):

```powershell
[IO.File]::WriteAllText("$PWD\.specify\feature.json", "{`n  `"feature_directory`": `"specs/002-identidad-clientes`"`n}`n")
```

**3. Planificar e implementar con Spec Kit** en Claude Code. Las specs 002–008 ya tienen `spec.md`, así que se empieza por el plan:

```text
/speckit-clarify     (opcional, si la spec tiene dudas)
/speckit-plan        → specs/NNN-nombre/plan.md, research.md, data-model.md, contracts/
/speckit-tasks       → specs/NNN-nombre/tasks.md
/speckit-implement   → implementa las tareas y las marca [X]
```

Revisa y haz commit de cada artefacto antes de pasar al siguiente. La constitución (`.specify/memory/constitution.md`) prevalece sobre cualquier otro documento.

**4. Commits** atómicos con el formato de [Formato de commits](#formato-de-commits); Husky los valida en cada `git commit`.

**5. Antes del PR**, en local:

```powershell
pnpm lint; if ($?) { pnpm test }; if ($?) { pnpm build }
```

**6. Subir la rama y abrir el PR contra `main`:**

```powershell
git push -u origin feature/spec-2
gh pr create --base main --fill      # o desde la web de GitHub
```

El PR necesita el check **CI** en verde y una revisión. Al integrarlo, cada rama trae su propio `.specify/feature.json`: si hay conflicto en ese archivo, quédate con cualquiera de las dos versiones (solo indica la spec activa).

> **Protección de `main`**: configúrala a mano en GitHub → *Settings* → *Branches* → *Add branch ruleset*: exigir pull request antes de integrar, exigir el check **CI** en verde y bloquear los push directos y los force push.

## Formato de commits

Los mensajes siguen [Conventional Commits](https://www.conventionalcommits.org/es/) con **alcance obligatorio**:

```text
tipo(alcance): descripción en minúsculas
```

Husky ejecuta commitlint en cada `git commit` (hook `.husky/commit-msg`, se activa solo con `pnpm install`) y rechaza el commit si el mensaje no cumple el formato. Las reglas están en `commitlint.config.ts`.

- **Tipos**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
- **Alcances permitidos**: `repo`, `ci`, `deps`, `docs`, `api`, `web`, `shared`, `plataforma`, `identidad`, `catalogo`, `carrito`, `specs`. Al crear un módulo nuevo, añade su nombre a `scope-enum` en `commitlint.config.ts`.

| Mensaje | ¿Válido? | Motivo |
|---------|----------|--------|
| `feat(api): añadir endpoint de salud` | ✅ | |
| `fix(web): mostrar el estado cuando la API tarda` | ✅ | |
| `docs(specs): añadir plan de la spec 002` | ✅ | |
| `cambios varios` | ❌ | Sin tipo ni alcance |
| `feat: añadir endpoint de salud` | ❌ | Falta el alcance |
| `feat(pagos): añadir tarjeta` | ❌ | `pagos` no está en la lista de alcances |
| `Feat(api): Añadir endpoint` | ❌ | El tipo va en minúsculas y la descripción no empieza en mayúscula |

Cada commit debe ser atómico (un cambio lógico) y pasar `pnpm lint`, `pnpm test` y `pnpm build` por sí solo.

## Calidad

| Comando | Qué hace |
|---------|----------|
| `pnpm lint` | ESLint y comprobación de tipos (`tsc --noEmit`) en todos los paquetes |
| `pnpm test` | Jest en la API: tests unitarios de `/health` y tests HTTP con una base de datos SQLite real y temporal (no hace falta `.env` ni `dev.db`) |
| `pnpm build` | Compila `@cafeteria/shared`, la API y la web |

Para ejecutar un solo archivo de test: `pnpm --filter api exec jest src/health/health.service.spec.ts` (unitario) o `pnpm --filter api exec jest --config test/jest-e2e.json health` (HTTP).

**Pipeline**: en cada pull request (y en cada push a `main`), GitHub Actions ejecuta `.github/workflows/ci.yml` en `ubuntu-latest` con los pasos **Install** (`pnpm install --frozen-lockfile`), **Lint**, **Test** y **Build**, con un límite de 10 minutos. Si un paso falla, el check **CI** del PR se pone en rojo e indica cuál.

## Paso a PostgreSQL

Ahora la base de datos es SQLite. Para pasar a PostgreSQL (necesitas un servidor PostgreSQL en marcha, local o gestionado):

1. En `apps/api/prisma/schema.prisma`, cambia el proveedor:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. En `apps/api/.env` (y en `apps/api/.env.example`, sin credenciales reales), cambia la URL:

   ```env
   DATABASE_URL="postgresql://usuario:clave@localhost:5432/cafeteria?schema=public"
   ```

3. Borra las migraciones de SQLite y genera la inicial para PostgreSQL (las migraciones no son portables entre proveedores):

   ```powershell
   Remove-Item -Recurse apps/api/prisma/migrations
   pnpm --filter api exec prisma migrate dev --name init
   ```

   Esto crea `prisma/migrations/<fecha>_init/` y un `migration_lock.toml` con `provider = "postgresql"`.

4. Revisa la consulta de `/health` en `apps/api/src/health/health.service.ts` (`SELECT 1 FROM _prisma_migrations LIMIT 1`): Prisma también crea `_prisma_migrations` en PostgreSQL, así que debería seguir valiendo, pero compruébalo con `curl.exe -i http://localhost:3001/health`.

5. Los tests HTTP (`apps/api/test/global-setup.ts`) crean una base SQLite temporal con `file:`; habrá que apuntarlos a una base PostgreSQL de pruebas (y la CI necesitará un servicio PostgreSQL).

Haz el cambio en un commit propio (p. ej. `feat(plataforma): migrar la base de datos a PostgreSQL`) para poder revertirlo.

## Solución de problemas

| Síntoma | Causa | Solución |
|---------|-------|----------|
| La API termina con `Falta DATABASE_URL: copia apps/api/.env.example a apps/api/.env` | Falta `apps/api/.env` | Copia el archivo de ejemplo (paso 4 de [Levantar el proyecto](#levantar-el-proyecto-desde-un-clon-limpio-powershell)) |
| `/health` responde `503` y la web muestra "Base de datos no disponible" | La base de datos no está preparada (por ejemplo, se borró `dev.db`) | Ejecuta `pnpm db:setup` |
| La web muestra "API no disponible" | La API no está en marcha o `NEXT_PUBLIC_API_URL` apunta a otro sitio | Arranca la API (`pnpm dev`) y revisa `apps/web/.env.local` |
| `EADDRINUSE: address already in use :::3001` (o `:3000`) | Otro proceso usa el puerto | Cierra ese proceso o cambia el puerto (ver [Variables de entorno](#variables-de-entorno)) |
| `git commit` rechazado con `scope may not be empty` o `scope must be one of [...]` | El mensaje no cumple el formato | Ver [Formato de commits](#formato-de-commits) |
| `/speckit-implement` dice `ERROR: Not on a feature branch` | El script de prerrequisitos espera ramas tipo `002-nombre` | La spec activa sale de `.specify/feature.json`; comprueba que apunta a tu carpeta y sigue |
| `WARN Unsupported engine: wanted: {"node":">=22 <23"}` | Usas otra versión de Node | Instala Node 22 LTS (p. ej. con `nvm-windows` o `fnm`) |
