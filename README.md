# Proyecto cafetería

Aplicación web para gestionar una cafetería online. Monorepo con **pnpm workspaces**:

- `apps/api`: API NestJS 11 + Prisma 6 con SQLite (puerto 3001).
- `apps/web`: web Next.js 16 + React 19 (puerto 3000).
- `packages/shared`: tipos TypeScript compartidos (`@cafeteria/shared`).

Para trabajar en local no hace falta Docker ni un servidor de base de datos: SQLite es un archivo.

## Requisitos previos

- **Node.js 22 LTS** (ver `.nvmrc`).
- **Corepack**, que viene con Node.js y activa la versión exacta de pnpm fijada en `package.json`.

Nada más.

## Instalación

```bash
corepack enable
pnpm install
```

`pnpm install` instala las dependencias, compila `@cafeteria/shared` y genera el cliente de Prisma.

## Configuración

Copia los archivos de ejemplo de variables de entorno (no contienen secretos):

**bash (Linux, macOS, Git Bash):**

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

**PowerShell (Windows):**

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env.local
```

| Variable | Archivo | Valor por defecto | Para qué sirve |
|----------|---------|-------------------|----------------|
| `DATABASE_URL` | `apps/api/.env` | `file:./dev.db` | Base de datos SQLite (ruta relativa a `apps/api/prisma/`) |
| `PORT` | `apps/api/.env` | `3001` | Puerto de la API |
| `WEB_ORIGIN` | `apps/api/.env` | `http://localhost:3000` | Origen permitido por CORS |
| `NEXT_PUBLIC_API_URL` | `apps/web/.env.local` | `http://localhost:3001` | URL de la API que consulta la web |

## Preparar la base de datos

```bash
pnpm db:setup
```

Crea `apps/api/prisma/dev.db` y aplica las migraciones. Se puede repetir sin riesgo.

## Arrancar

```bash
pnpm dev
```

- Web: <http://localhost:3000>. Muestra el estado de la API y de la base de datos.
- API: <http://localhost:3001/health>. Responde `200` si todo está bien y `503` si la base de datos no está disponible.

Para cambiar los puertos:

- **API**: cambia `PORT` en `apps/api/.env` (y `NEXT_PUBLIC_API_URL` en `apps/web/.env.local` para que la web la encuentre).
- **Web**: define `PORT` al arrancar, por ejemplo `PORT=4000 pnpm --filter web dev` en bash o `$env:PORT=4000; pnpm --filter web dev` en PowerShell. Después cambia `WEB_ORIGIN` en `apps/api/.env` para que CORS lo permita.

## Solución de problemas

| Síntoma | Causa | Solución |
|---------|-------|----------|
| La API termina con `Falta DATABASE_URL: copia apps/api/.env.example a apps/api/.env` | Falta `apps/api/.env` | Copia el archivo de ejemplo (ver [Configuración](#configuración)) |
| `/health` responde `503` y la web muestra "Base de datos no disponible" | La base de datos no está preparada (por ejemplo, se borró `dev.db`) | Ejecuta `pnpm db:setup` |
| La web muestra "API no disponible" | La API no está en marcha o `NEXT_PUBLIC_API_URL` apunta a otro sitio | Arranca la API (`pnpm dev`) y revisa `apps/web/.env.local` |
| `EADDRINUSE: address already in use :::3001` (o `:3000`) | Otro proceso usa el puerto | Cierra ese proceso o cambia el puerto (ver [Arrancar](#arrancar)) |
