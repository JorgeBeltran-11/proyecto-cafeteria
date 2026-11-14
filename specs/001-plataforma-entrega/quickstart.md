# Quickstart: validar la spec 001 de punta a punta

Requisitos: Node.js 22 LTS y Corepack (incluido en Node). Nada más: ni Docker ni servidor de base de datos.

## 1. Instalar y configurar (US1)

```bash
git clone <repo> && cd taller4-cafeteria
corepack enable                 # activa la versión de pnpm fijada en package.json
pnpm install                    # instala, compila @cafeteria/shared, genera Prisma y activa Husky
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Windows (PowerShell): Copy-Item apps/api/.env.example apps/api/.env ; Copy-Item apps/web/.env.example apps/web/.env
pnpm db:setup                   # crea apps/api/prisma/dev.db y aplica las migraciones
pnpm dev                        # API en http://localhost:3001, web en http://localhost:3000
```

## 2. Comprobar `/health` (US1-2, US1-3, SC-003)

```bash
curl -i http://localhost:3001/health
# → HTTP/1.1 200, {"status":"ok","api":"ok","database":"ok","checkedAt":"..."}
```

Base de datos sin preparar: detener la API, borrar `apps/api/prisma/dev.db`, volver a ejecutar `pnpm dev` y repetir el `curl` → **503** con `"database":"error"` y sin detalles internos. Restaurar con `pnpm db:setup`.

## 3. Comprobar la página de inicio (US1-4, US1-5, SC-002)

Abrir http://localhost:3000 y recorrer los tres casos de [contracts/home-page.md](./contracts/home-page.md): todo bien, BD caída y API detenida (`Ctrl+C` solo en la API, o arrancar solo la web con `pnpm --filter web dev`).

## 4. Calidad local (US2, SC-004, SC-005)

```bash
pnpm lint      # ESLint + typecheck en todos los paquetes
pnpm test      # Jest: /health 200 y 503 (sin servicios externos)
pnpm build     # shared → api → web

git commit --allow-empty -m "cambios varios"                       # rechazado por commitlint
git commit --allow-empty -m "feat(api): añadir endpoint de salud"  # aceptado
```

## 5. Tipos compartidos (US3)

- Existen `apps/api/src/modules/{identidad,catalogo,carrito}/README.md`.
- Cambiar temporalmente `checkedAt` por `checked_at` en `packages/shared/src/index.ts` → `pnpm --filter @cafeteria/shared build && pnpm lint` falla en `api` y en `web`. Revertir el cambio.

## 6. Pipeline (US2-3, US2-4, SC-006)

Abrir un PR contra `main`: el check **CI** ejecuta install → lint → test → build y termina en verde en < 10 min. Para comprobar el rojo, en una rama de prueba cambiar la aserción `200` del test de `/health` por `201`: el PR muestra el fallo en el paso **test**.

> Protección de `main` (PR obligatorio + check CI en verde): se configura a mano en GitHub → Settings → Branches.
