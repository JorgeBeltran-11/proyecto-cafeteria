# Implementation Plan: Menú dinámico

**Branch**: `feature/spec-3` (spec `003-menu-dinamico`) | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/003-menu-dinamico/spec.md` (acotada, ver *Alcance en este equipo*)
**Responsable**: Julio Maldonado

## Summary

Módulo `catalogo` de la API (NestJS + Prisma + SQLite) y dos vistas en la web (Next.js): la **tienda** (`/menu`) y la pantalla del **personal** (`/personal/disponibilidad`). El administrador gestiona productos y menús por la API: edita un **borrador**, lo publica y cada publicación crea una **versión inmutable** con autor, fecha y resumen de cambios. La tienda lee siempre la última versión publicada, sin caché, así que los cambios se ven en la siguiente carga y sin desplegar (FR-006). La disponibilidad (agotado y existencias) es estado vivo del producto, la cambia el personal y no crea versiones.

Las reglas (horarios, validación para publicar, resumen de cambios y armado de la carta pública) son **funciones puras** con tests propios. El catálogo implementa el puerto `CatalogoParaCarrito` que definió la spec 004, de modo que el carrito pueda dejar su catálogo provisional.

## Technical Context

**Language/Version**: TypeScript 5.9 sobre Node.js 22 LTS (heredado de la spec 001)
**Primary Dependencies**: NestJS 11, Prisma 6, Next.js 16 + React 19. **No se añade ninguna dependencia nueva** (validación manual, como la spec 004)
**Storage**: SQLite vía Prisma; tablas `Producto`, `Menu`, `VersionMenu` y `CambioCatalogo`, propiedad exclusiva del módulo
**Testing**: Jest + ts-jest; tests unitarios del dominio puro y de la validación, y tests HTTP con SQLite real en `apps/api/test/catalogo.e2e-spec.ts`
**Target Platform**: local (Windows/macOS/Linux) y CI `ubuntu-latest`
**Project Type**: aplicación web (monorepo de la spec 001)
**Performance Goals**: carta en < 1 s (SC-001) con una sola consulta por tabla; cambio publicado visible en la siguiente carga (< 10 s, SC-002)
**Constraints**: precios en centavos (constitución VI); WCAG 2.2 AAA (FR-013); el módulo solo accede a sus tablas (constitución V); hora local fija UTC−5
**Scale/Scope**: 17 endpoints, 2 páginas, 4 tablas

## Constitution Check

Leyenda: ✅ cumple · ⏸ diferido (justificado en *Complexity Tracking*) · N/A no aplica.

- [x] **I. Accesibilidad AAA:** ✅ disponibilidad siempre con texto ("Agotado", "Disponible desde hoy a las 07:00"), no solo color; navegación por categorías con enlaces y encabezados; filtro de alérgenos con casillas y `fieldset`/`legend`; anuncios `aria-live` en la pantalla del personal; controles ≥ 44×44 px y contraste ≥ 7:1 con los colores de la spec 001; texto alternativo obligatorio para publicar (FR-004). ⏸ axe en CI (diferido por la spec 001). ⏸ Panel del administrador: spec 008.
- [x] **II. Seguridad:** ✅ roles comprobados en el servidor en cada ruta (`admin` para contenidos y precios, `personal` o `admin` para disponibilidad, US4-3); entradas validadas (ids, enteros, URLs de imagen solo `https://` o rutas `/`); la tienda no expone borradores ni productos retirados. ⏸ La identificación provisional por cabeceras `X-Rol`/`X-Usuario-Id` **no es segura** y se rechaza con `NODE_ENV=production`; la sustituye la sesión de la spec 002.
- [x] **III. LOPDP:** ✅ el catálogo no guarda datos personales de clientes; solo el id del usuario del personal que hace cada cambio (auditoría, FR-012).
- [x] **IV. Escalabilidad y consistencia:** ✅ la API no guarda estado en memoria; publicar es una transacción (versión + menú + auditoría); las versiones son inmutables, base para la copia inmutable del pedido (spec 006); `descontarExistencias` es una actualización condicional que nunca deja existencias negativas. ⏸ Caché en Redis + CDN (promtp.md) diferida: lectura directa de la BD.
- [x] **V. Límites de dominio:** ✅ solo tablas propias; el carrito accede por el puerto `CatalogoParaCarrito`; las piezas provisionales están aisladas en `provisional/`.
- [x] **VI. Calidad:** ✅ TDD de horarios, validación para publicar, resumen de cambios y carta pública; tests HTTP con SQLite real para roles, versiones, conflictos y disponibilidad. ⏸ SonarQube y cobertura ≥ 80 % (diferidos por la spec 001).
- [x] **VII. Reversibilidad:** ✅ commits atómicos (ver *Orden de commits*); migración aditiva (cuatro tablas nuevas).
- [x] **Plataforma:** ✅ TypeScript, sin Python, sin dependencias nuevas.

**Resultado**: PASA con desviaciones justificadas.

## Project Structure

### Documentation (this feature)

```text
specs/003-menu-dinamico/
├── spec.md              # Spec acotada
├── plan.md              # Este archivo
├── research.md          # Decisiones técnicas
├── data-model.md        # Tablas, tipos compartidos y reglas
├── quickstart.md        # Cómo probarlo de punta a punta
├── contracts/
│   ├── catalogo-api.md   # API HTTP del catálogo
│   └── dependencias.md   # Lo que el catálogo ofrece y necesita (specs 002, 004, 006, 008)
└── tasks.md
```

### Source Code

```text
packages/shared/src/catalogo.ts             # Tipos de la carta pública y de la administración

apps/api/prisma/
├── schema.prisma                           # + modelos Producto, Menu, VersionMenu, CambioCatalogo
└── migrations/2_catalogo/migration.sql

apps/api/src/modules/catalogo/
├── catalogo.module.ts                      # Exporta CatalogoService y CatalogoParaCarrito
├── catalogo.service.ts                     # Casos de uso: productos, menús, versiones, disponibilidad
├── catalogo-publico.controller.ts          # GET /catalogo/menu, /catalogo/alergenos
├── catalogo-admin.controller.ts            # /catalogo/admin/... (rol admin)
├── disponibilidad.controller.ts            # /catalogo/disponibilidad (rol personal o admin)
├── catalogo.errores.ts                     # Errores de dominio → HTTP
├── validacion.ts                           # Validación de cuerpos y parámetros (+ .spec.ts)
├── datos-demo.ts                           # Carga de ejemplo (CATALOGO_DATOS_DEMO=true)
├── dominio/
│   ├── alergenos.ts                        # Lista cerrada
│   ├── horario.ts (+ .spec.ts)             # En horario, próxima apertura, texto
│   ├── publicacion.ts (+ .spec.ts)         # Qué falta para publicar; resumen de cambios
│   ├── carta.ts (+ .spec.ts)               # Carta pública: disponibilidad, filtro, duplicados
│   ├── contenido.ts                        # Forma de la instantánea de una versión
│   └── errores.ts                          # ErrorCatalogo (códigos de negocio)
├── puertos/
│   └── roles.ts                            # @Roles(), @UsuarioActual() — PENDIENTE(spec-002)
└── provisional/
    └── roles-provisional.guard.ts          # Cabeceras X-Rol / X-Usuario-Id

apps/api/test/catalogo.e2e-spec.ts          # HTTP con SQLite real

apps/web/app/menu/                          # Tienda: page.tsx, carta.tsx, api.ts
apps/web/app/personal/disponibilidad/       # Personal: page.tsx, disponibilidad.tsx
apps/web/public/menu/                       # Imágenes SVG de los datos de ejemplo
```

**Structure Decision**: un módulo NestJS con el dominio puro separado de la persistencia. A diferencia de la spec 004 no hay repositorio intercambiable: el servicio usa Prisma directamente y se prueba con SQLite real, que es más simple y prueba lo que importa aquí (transacciones, revisiones y versiones). Ver research R7.

## Orden de commits

Cada commit pasa `pnpm lint && pnpm test && pnpm build` por sí solo.

1. `docs(catalogo): acotar spec 003 al alcance del equipo`
2. `docs(specs): agregar plan de implementación de la spec 003`
3. `docs(specs): agregar tareas de la spec 003`
4. `feat(shared): agregar tipos del catálogo`
5. `feat(catalogo): agregar modelos Producto, Menu, VersionMenu y CambioCatalogo`
6. `feat(catalogo): agregar reglas de horario, publicación y carta`
7. `feat(catalogo): exponer la API del catálogo con roles provisionales`
8. `feat(catalogo): cargar un menú de ejemplo en desarrollo`
9. `feat(web): agregar la tienda con el menú accesible`
10. `feat(web): agregar la pantalla de disponibilidad del personal`
11. `docs(catalogo): documentar el módulo y sus pendientes`

## Complexity Tracking

| Desviación | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Roles por cabeceras `X-Rol` / `X-Usuario-Id` | La spec 002 (sesión y roles) se hace en paralelo | Esperar a la spec 002: bloquea todo el trabajo hasta el final |
| Administración solo por API | El panel de administración es de la spec 008 (ROADMAP fase 5) | Un panel aquí: duplica trabajo de otra spec |
| Lectura sin caché en vez de Redis + CDN | Redis diferido por la spec 001 | Caché en memoria de la API: rompe "API sin estado" (constitución IV) y retrasa los cambios |
| Borrador y versiones como JSON en texto | SQLite y Prisma no permiten listas; el contenido de una versión es un documento que no se consulta por partes | Tablas normalizadas por versión (categorías y productos copiados): mucho más código para el mismo resultado |
| Zona horaria fija UTC−5 | Una sola cafetería en Ecuador continental, sin horario de verano (Assumptions) | Librería de zonas horarias: dependencia nueva sin necesidad |
