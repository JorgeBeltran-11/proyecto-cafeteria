# Implementation Plan: Carrito de compras

**Branch**: `feature/spec-4` (spec `004-carrito-compras`) | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/004-carrito-compras/spec.md` (acotada, ver *Alcance en este equipo*)
**Responsable**: David León

## Summary

Módulo `carrito` de la API (NestJS + Prisma + SQLite) y vista `/carrito` en la web (Next.js). Cada cliente tiene un único carrito guardado en la base de datos, así que es el mismo en todos sus dispositivos. Todos los importes se calculan en el servidor, en **centavos enteros**. Las reglas del carrito (límites, avisos, totales y caducidad) son funciones puras con tests propios.

El carrito no conoce los módulos de otros integrantes: depende de tres **puertos** (catálogo, sesión y descuentos) definidos en [contracts/dependencias.md](./contracts/dependencias.md). Hasta que existan las specs 002, 003 y 005, se usan implementaciones provisionales en `apps/api/src/modules/carrito/provisional/`, marcadas con `PENDIENTE(spec-00X)`.

## Technical Context

**Language/Version**: TypeScript 5.9 sobre Node.js 22 LTS (heredado de la spec 001)
**Primary Dependencies**: NestJS 11, Prisma 6, Next.js 16 + React 19. **No se añade ninguna dependencia nueva** (la validación de entrada es manual, ver research R6)
**Storage**: SQLite vía Prisma; tablas `Carrito` y `LineaCarrito`, propiedad exclusiva del módulo
**Testing**: Jest + ts-jest; tests unitarios del dominio y del servicio con un repositorio en memoria, tests HTTP con supertest (sin base de datos) y un test HTTP con SQLite real en `apps/api/test/`
**Target Platform**: local (Windows/macOS/Linux) y CI `ubuntu-latest`
**Project Type**: aplicación web (monorepo de la spec 001)
**Performance Goals**: total actualizado en < 1 s tras cada cambio (SC-001); mismo carrito en otro dispositivo en < 5 s (SC-002, sondeo cada 4 s)
**Constraints**: precios solo del servidor (FR-005); dinero en enteros (constitución VI); WCAG 2.2 AAA (FR-009); el módulo solo accede a sus tablas (constitución V)
**Scale/Scope**: 6 endpoints, 1 página, 2 tablas

## Constitution Check

Leyenda: ✅ cumple · ⏸ diferido (justificado en *Complexity Tracking*) · N/A no aplica.

- [x] **I. Accesibilidad AAA:** ✅ región `aria-live="polite"` para cambios y avisos sin mover el foco; controles ≥ 44×44 px con nombre accesible; estados con texto, no solo color; contraste ≥ 7:1 con los colores de la spec 001; sin límites de tiempo. Lista de comprobación en [contracts/vista-carrito.md](./contracts/vista-carrito.md). ⏸ axe en CI (diferido por la spec 001).
- [x] **II. Seguridad:** ✅ el cliente nunca envía precios; entradas validadas (enteros, rangos, formato de ids); cada cliente solo ve su carrito. ⏸ La identificación provisional por cabecera `X-Cliente-Id` **no es segura** y se rechaza con `NODE_ENV=production`; la sustituye la sesión de la spec 002.
- [x] **III. LOPDP:** ✅ el carrito guarda solo el id del cliente, ids de producto, cantidades y precios; ningún dato personal. Caduca a los 30 días sin actividad (minimización). La eliminación de la cuenta (spec 002) debe vaciar el carrito: queda en el contrato de dependencias.
- [x] **IV. Escalabilidad y consistencia:** ✅ la API no guarda estado en memoria; cada guardado del carrito es una transacción. ⏸ Redis para carritos (promtp.md) diferido: SQLite basta para el alcance del curso.
- [x] **V. Límites de dominio:** ✅ el módulo solo usa sus tablas; catálogo, sesión y descuentos entran por puertos inyectados. ✅ Las piezas provisionales están aisladas en una carpeta para retirarlas sin tocar el resto.
- [x] **VI. Calidad:** ✅ TDD de las reglas de dinero y límites; tests del servicio, HTTP y con SQLite real. ⏸ SonarQube y cobertura ≥ 80 % (diferidos por la spec 001).
- [x] **VII. Reversibilidad:** ✅ commits atómicos (ver *Orden de commits*); migración aditiva (dos tablas nuevas, sin tocar las existentes).
- [x] **Plataforma:** ✅ TypeScript, sin Python, sin dependencias nuevas.

**Resultado**: PASA con desviaciones justificadas.

## Project Structure

### Documentation (this feature)

```text
specs/004-carrito-compras/
├── spec.md              # Spec acotada
├── plan.md              # Este archivo
├── research.md          # Decisiones técnicas
├── data-model.md        # Tablas, tipos compartidos y reglas de cálculo
├── quickstart.md        # Cómo probarlo de punta a punta
├── contracts/
│   ├── carrito.openapi.yaml  # API HTTP del carrito
│   ├── dependencias.md       # Lo que el carrito necesita de las specs 002, 003, 005, 006 y 008
│   └── vista-carrito.md      # Contrato de UI y accesibilidad de /carrito
└── tasks.md
```

### Source Code

```text
packages/shared/src/carrito.ts            # Tipos de la respuesta del carrito (API ↔ web)

apps/api/prisma/
├── schema.prisma                         # + modelos Carrito y LineaCarrito
└── migrations/1_carrito/migration.sql

apps/api/src/modules/carrito/
├── carrito.module.ts
├── carrito.controller.ts                 # /carrito
├── carrito.service.ts                    # Orquesta repositorio, puertos y dominio
├── carrito.errores.ts                    # Errores de dominio → HTTP
├── validacion.ts                         # Validación de cuerpos y parámetros
├── dominio/
│   ├── reglas.ts                         # Funciones puras: límites, avisos, totales, caducidad
│   ├── reglas.spec.ts
│   └── errores.ts                        # ErrorCarrito (códigos de negocio)
├── puertos/
│   ├── catalogo.puerto.ts                # PENDIENTE(spec-003): lo implementa catálogo
│   ├── descuentos.puerto.ts              # PENDIENTE(spec-005)
│   └── sesion.ts                         # PENDIENTE(spec-002): decorador @ClienteActual
├── repositorio/
│   ├── carrito.repositorio.ts            # Interfaz
│   ├── prisma-carrito.repositorio.ts
│   └── memoria-carrito.repositorio.ts    # Para tests
├── provisional/                          # Se borra cuando existan 002, 003 y 005
│   ├── catalogo-provisional.ts
│   ├── catalogo-provisional.controller.ts
│   ├── sesion-provisional.guard.ts
│   └── sin-descuentos.ts
├── carrito.service.spec.ts
└── carrito.controller.spec.ts

apps/api/test/carrito.e2e-spec.ts         # HTTP con SQLite real

apps/web/app/carrito/
├── page.tsx
├── carrito.tsx                           # Componente cliente
└── api.ts                                # Llamadas a la API
```

**Structure Decision**: un módulo NestJS con su dominio puro separado de la infraestructura (repositorio y puertos), como pide la constitución V.

## Orden de commits

Cada commit pasa `pnpm lint && pnpm test && pnpm build` por sí solo.

1. `docs(carrito): acotar spec 004 al alcance del equipo`
2. `docs(specs): agregar plan de implementación de la spec 004`
3. `docs(specs): agregar tareas de la spec 004`
4. `feat(shared): agregar tipos del carrito`
5. `feat(carrito): agregar modelos Carrito y LineaCarrito`
6. `feat(carrito): agregar puertos hacia catálogo, sesión y descuentos`
7. `feat(carrito): agregar reglas de cálculo del carrito`
8. `feat(carrito): agregar repositorio del carrito`
9. `feat(carrito): agregar piezas provisionales de catálogo, sesión y descuentos`
10. `feat(carrito): exponer la API del carrito`
11. `feat(web): agregar la vista accesible del carrito`
12. `docs(carrito): documentar el módulo y sus pendientes`

Los puertos van antes que las reglas porque estas usan el tipo `ProductoParaCarrito`.

## Complexity Tracking

| Desviación | Por qué hace falta | Alternativa más simple descartada |
|---|---|---|
| Identificación por cabecera `X-Cliente-Id` | La spec 002 (sesión) se hace en paralelo | Esperar a la spec 002: bloquea todo el trabajo hasta el final |
| Catálogo en memoria | La spec 003 se hace en paralelo | Leer tablas del catálogo: viola la constitución V |
| Descuento siempre 0 | La spec 005 no tiene responsable | Implementar promociones aquí: es otra spec entera |
| Sondeo cada 4 s en vez de tiempo real | Redis y WebSockets diferidos por la spec 001 | WebSockets: más infraestructura para un beneficio pequeño en este alcance |
