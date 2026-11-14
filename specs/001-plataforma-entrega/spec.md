# Feature Specification: Stack tecnológico base

**Feature Branch**: `001-plataforma-entrega`
**Created**: 2026-11-12
**Updated**: 2026-11-14
**Status**: Draft
**Input**: User description: "Spec #1 reducida a lo mínimo funcional: monorepo con pnpm workspaces (apps/web en Next.js, apps/api en NestJS, packages/shared con tipos compartidos), SQLite con Prisma en apps/api sin Docker, endpoint GET /health que verifica la base de datos, página de inicio que muestra el estado de la API, carpetas de módulos vacías (identidad, catalogo, carrito), tests con Jest para /health, Husky + commitlint, GitHub Actions en cada PR (install, lint, test, build), .env.example y README. Docker, PostgreSQL, Vercel, Render, SonarQube, Grafana, despliegues, rollback, release-please, Redis y RabbitMQ quedan diferidos."

## User Scenarios & Testing *(mandatory)*

Actores: **desarrollador** del equipo (levanta el proyecto y propone cambios) y **revisor** (aprueba los cambios).

### User Story 1 - Levantar el proyecto en local sin instalar nada extra (Priority: P1)

Un desarrollador clona el repositorio, sigue el README, instala las dependencias con un solo comando y arranca la API y la web. Al abrir la página de inicio ve que la API está en línea y que la base de datos responde. No necesita Docker ni un servidor de base de datos: solo Node.js y pnpm.

**Why this priority**: es la base sobre la que el equipo construye las specs 002–004. Si el proyecto no arranca de forma sencilla en todos los equipos, nadie puede avanzar.

**Independent Test**: en un equipo con solo Node.js y pnpm, clonar el repositorio, seguir el README y comprobar que la página de inicio muestra "API en línea" y "Base de datos conectada".

**Acceptance Scenarios**:

1. **Dado** un repositorio recién clonado y un equipo con Node.js y pnpm, **Cuando** el desarrollador ejecuta los pasos del README (copiar `.env.example` a `.env`, instalar, preparar la base de datos y arrancar), **Entonces** la API y la web quedan en ejecución sin errores.
2. **Dado** la API y la base de datos funcionando, **Cuando** alguien llama a `GET /health`, **Entonces** recibe una respuesta correcta (HTTP 200) que indica que la API y la base de datos están bien.
3. **Dado** la API funcionando pero sin acceso a la base de datos, **Cuando** alguien llama a `GET /health`, **Entonces** recibe una respuesta de servicio no disponible (HTTP 503) que indica que la base de datos falla.
4. **Dado** la API y la web en ejecución, **Cuando** el desarrollador abre la página de inicio, **Entonces** ve el estado de la API y de la base de datos en texto legible.
5. **Dado** la web en ejecución y la API detenida, **Cuando** el desarrollador abre la página de inicio, **Entonces** ve un mensaje claro de que la API no está disponible, en lugar de un error o una pantalla en blanco.

---

### User Story 2 - Integrar un cambio con controles automáticos (Priority: P1)

Un desarrollador crea un commit en su equipo; si el mensaje no cumple Conventional Commits, el commit se rechaza al momento. Al abrir un pull request, GitHub Actions instala las dependencias, ejecuta el lint, los tests y el build de todo el monorepo, y muestra el resultado en el propio PR.

**Why this priority**: sin estos controles no se pueden garantizar los principios VI (calidad verificada) y VII (commits atómicos) de la constitución, ni siquiera en su forma mínima.

**Independent Test**: intentar un commit con el mensaje "cambios varios" (debe rechazarse) y otro con "feat(api): añadir endpoint de salud" (debe aceptarse); abrir un PR y comprobar que el pipeline aparece en el PR y termina en verde.

**Acceptance Scenarios**:

1. **Dado** un mensaje de commit que no cumple Conventional Commits, **Cuando** el desarrollador intenta crear el commit, **Entonces** se rechaza y se le indica qué formato falta.
2. **Dado** un mensaje de commit válido (p. ej. `feat(api): ...`), **Cuando** el desarrollador crea el commit, **Entonces** se acepta.
3. **Dado** un pull request con código correcto, **Cuando** se ejecuta el pipeline, **Entonces** los pasos de install, lint, test y build pasan y el PR muestra el check en verde.
4. **Dado** un pull request con un test de `/health` roto o un error de lint, **Cuando** se ejecuta el pipeline, **Entonces** el check falla y el PR muestra en qué paso.

---

### User Story 3 - Continuar con los módulos de las siguientes specs (Priority: P2)

Un desarrollador que va a trabajar en la spec 002, 003 o 004 encuentra ya creada en la API la carpeta del módulo que le corresponde y un paquete de tipos compartidos que puede usar desde la web y la API.

**Why this priority**: facilita el reparto del trabajo en el equipo, pero el proyecto funciona sin ello.

**Independent Test**: comprobar que existen las carpetas `identidad`, `catalogo` y `carrito` en el código de la API, y que la web y la API importan el mismo tipo de la respuesta de `/health` desde `packages/shared`.

**Acceptance Scenarios**:

1. **Dado** el repositorio recién clonado, **Cuando** el desarrollador abre el código de la API, **Entonces** encuentra las carpetas de módulo `identidad` (spec 002), `catalogo` (spec 003) y `carrito` (spec 004), cada una con una nota que indica a qué spec pertenece.
2. **Dado** el tipo de la respuesta de `/health` definido en `packages/shared`, **Cuando** se cambia su forma, **Entonces** la comprobación de tipos falla tanto en la web como en la API hasta que ambas se actualizan.

### Edge Cases

- El archivo `.env` no existe: la API arranca con valores por defecto razonables o indica claramente qué variable falta; el README explica cómo crearlo a partir de `.env.example`.
- El archivo de la base de datos SQLite aún no existe: el paso de preparación del README lo crea; si se omite, `/health` responde 503 en lugar de bloquear la API.
- La base de datos tarda en responder: `/health` responde en un tiempo acotado (ver SC-003) en lugar de quedarse colgado.
- El puerto de la API o de la web ya está en uso: se puede cambiar mediante variables de entorno documentadas en `.env.example`.
- Git no conserva carpetas vacías: cada carpeta de módulo contiene al menos un archivo (p. ej. un README) para que exista al clonar.
- Un PR que solo cambia documentación: el pipeline se ejecuta igual y pasa.

## Requirements *(mandatory)*

### Functional Requirements

**Estructura del monorepo**
- **FR-001**: El repositorio DEBE ser un monorepo con **pnpm workspaces** con tres paquetes: `apps/web` (Next.js + TypeScript), `apps/api` (NestJS + TypeScript) y `packages/shared` (tipos TypeScript compartidos).
- **FR-002**: Desde la raíz DEBEN existir comandos únicos para instalar, ejecutar en desarrollo, hacer lint, ejecutar los tests y construir todos los paquetes.
- **FR-003**: Todo el código DEBE estar en TypeScript. **No se usa Python** en ninguna parte del proyecto, incluidos scripts y herramientas.
- **FR-004**: La versión de Node.js y de pnpm DEBE estar fijada en el repositorio para que todo el equipo y el pipeline usen las mismas.

**Base de datos**
- **FR-005**: `apps/api` DEBE usar **Prisma** como ORM con **SQLite** como base de datos, almacenada en un archivo local, sin necesidad de Docker ni de instalar un servidor de base de datos.
- **FR-006**: La cadena de conexión DEBE leerse de la variable de entorno `DATABASE_URL`; el archivo de la base de datos NO DEBE subirse al repositorio.
- **FR-007**: El README DEBE documentar cómo migrar a PostgreSQL cambiando el `provider` del esquema de Prisma y la `DATABASE_URL`, y qué hay que revisar al hacerlo (p. ej. regenerar las migraciones).

**Endpoint de salud**
- **FR-008**: La API DEBE exponer `GET /health`, que comprueba la conexión a la base de datos con una consulta trivial.
- **FR-009**: Si la API y la base de datos están bien, `GET /health` DEBE responder HTTP 200 con un cuerpo que indique estado `ok` para la API y para la base de datos.
- **FR-010**: Si la base de datos no responde, `GET /health` DEBE responder HTTP 503 con un cuerpo que indique el fallo de la base de datos, sin exponer detalles internos (rutas, credenciales, trazas).
- **FR-011**: El tipo de la respuesta de `/health` DEBE definirse una sola vez en `packages/shared` y usarse en la API y en la web.

**Página de inicio**
- **FR-012**: `apps/web` DEBE tener una página de inicio que consulte `GET /health` y muestre el estado de la API y de la base de datos.
- **FR-013**: Si la API no responde, la página DEBE mostrar un mensaje de "API no disponible" en lugar de fallar.
- **FR-014**: La URL de la API DEBE configurarse mediante una variable de entorno de la web.
- **FR-015**: La página DEBE respetar lo básico de WCAG AAA aplicable a su contenido: idioma `es` declarado, contraste de texto ≥ 7:1, el estado comunicado con texto (no solo con color) y anunciado a lectores de pantalla cuando cambia.

**Módulos para las siguientes specs**
- **FR-016**: `apps/api` DEBE incluir las carpetas de módulo `identidad` (spec 002), `catalogo` (spec 003) y `carrito` (spec 004), sin lógica, cada una con un README que indique su spec.

**Tests**
- **FR-017**: `apps/api` DEBE tener tests con **Jest** para `GET /health` que cubran al menos el caso correcto (200) y el caso de base de datos caída (503).
- **FR-018**: Los tests DEBEN poder ejecutarse en local y en el pipeline sin servicios externos.

**Calidad de commits**
- **FR-019**: El repositorio DEBE configurar **Husky** y **commitlint** para validar en local que cada mensaje de commit cumple **Conventional Commits**, con el módulo o paquete como alcance (p. ej. `feat(api): ...`, `chore(web): ...`).
- **FR-020**: Husky DEBE instalarse automáticamente al instalar las dependencias, sin pasos manuales.

**Integración continua**
- **FR-021**: Un workflow de **GitHub Actions** DEBE ejecutarse en cada pull request y ejecutar, en este orden: install (con el lockfile congelado), lint, test y build.
- **FR-022**: El workflow DEBE fallar si falla cualquiera de esos pasos y su resultado DEBE verse en el PR.

**Configuración y documentación**
- **FR-023**: El repositorio DEBE incluir un `.env.example` con todas las variables necesarias (al menos `DATABASE_URL`, el puerto de la API y la URL de la API para la web), con valores de ejemplo y sin secretos reales; el `.env` real NO DEBE subirse.
- **FR-024**: El `README.md` DEBE explicar: requisitos previos (Node.js y pnpm), cómo instalar, configurar `.env`, preparar la base de datos, arrancar la API y la web, ejecutar lint, tests y build, el formato de commits y el paso a PostgreSQL.

### Fuera de alcance (diferido a fases futuras)

Estos elementos de `promtp.md` y `ROADMAP.md` NO forman parte de esta spec y se abordarán en specs posteriores:

- **Docker** y contenedores para desarrollo o despliegue.
- **PostgreSQL** como base de datos (solo se documenta cómo migrar; ver FR-007).
- **Redis** y **RabbitMQ** (caché, outbox y colas).
- Despliegue del frontend en **Vercel** y del backend en **Render** (`render.yaml`).
- Entornos de **preview, staging y producción**, aprobación manual de releases y **rollback automático**.
- **release-please** (versionado semántico y changelog automáticos).
- **SonarQube** y su Quality Gate.
- **Grafana** y las métricas DORA y del equipo.
- Validación de commitlint en el pipeline, verificación commit a commit, escaneos de seguridad, tests de integración con Testcontainers, E2E con Playwright y pruebas automáticas de accesibilidad con axe.
- Feature flags y guía de migraciones expand/contract.

### Key Entities

- **Estado de salud**: resultado de `GET /health`; indica el estado de la API y de la base de datos (`ok` o `error`). Es el único tipo compartido de esta spec.

No se definen tablas de dominio en esta spec: el esquema de Prisma solo necesita lo mínimo para conectarse a la base de datos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un miembro del equipo que no participó en la configuración levanta el proyecto completo en menos de 15 minutos siguiendo solo el README, con únicamente Node.js y pnpm instalados.
- **SC-002**: La página de inicio muestra el estado correcto en los tres casos: todo bien, base de datos caída y API detenida.
- **SC-003**: `GET /health` responde en menos de 1 segundo en local, tanto si la base de datos está bien como si falla.
- **SC-004**: Los tests de `/health` pasan en local y en el pipeline, y el pipeline completo de un PR termina en menos de 10 minutos.
- **SC-005**: El 100 % de los commits creados en local con Husky instalado cumplen Conventional Commits.
- **SC-006**: Un PR con un test o un lint roto queda marcado en rojo en el 100 % de los casos.

## Assumptions

- **Desviación temporal de la constitución (v1.0.0)**: la constitución fija PostgreSQL, Redis, RabbitMQ, Vercel, Render, SonarQube y Grafana, y exige SonarQube y validación commit a commit en el pipeline. Esta spec usa SQLite y difiere esos elementos para cumplir con la entrega universitaria. Según la sección "Restricciones tecnológicas y de plataforma", el cambio de base de datos debería acompañarse de un ADR breve que lo justifique como medida temporal; la constitución sigue vigente para las fases siguientes.
- El equipo tiene entre 2 y 4 personas, con Windows, macOS o Linux, y puede instalar Node.js (LTS) y pnpm.
- La API y la web se ejecutan en local en puertos distintos (por defecto 3001 y 3000) y la API permite peticiones desde el origen de la web en desarrollo.
- El repositorio está en GitHub y GitHub Actions está disponible para el equipo.
- La protección de la rama `main` (PR obligatorio y check en verde) se configura a mano en GitHub; no forma parte del código.
- Esta spec no maneja datos personales, por lo que no aplican aún los requisitos de LOPDP.
