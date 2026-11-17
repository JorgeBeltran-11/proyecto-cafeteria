# Tasks: Identidad y gestión de clientes

**Input**: Design documents from `specs/002-identidad-clientes/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/identidad-api.yaml`

**Architecture**:
- Identidad: autenticación, credenciales, roles, sesiones y MFA.
- Clientes: datos personales y perfiles.
- Pedidos: pedidos e historial.
- Los módulos se comunican mediante interfaces públicas; no acceden directamente a las tablas de otros módulos.

## Phase 1: Setup

**Purpose**: Preparar la estructura de trabajo.

- [ ] T001 Revisar la estructura real de `apps/api/src/modules/identidad/` y documentar los archivos existentes.
- [ ] T002 Revisar la estructura de `apps/web/app/` y las convenciones de componentes existentes.
- [ ] T003 [P] Revisar las dependencias disponibles en `apps/api/package.json` y `apps/web/package.json`, identificando las necesarias para autenticación y pruebas.
- [ ] T004 [P] Verificar que los scripts de lint, typecheck, test y build funcionan en los proyectos existentes.

## Phase 2: Foundational

**Purpose**: Resolver decisiones y preparar la infraestructura compartida antes de implementar las historias.

- [ ] T005 Resolver y documentar la propiedad del correo electrónico como dato personal e identificador de autenticación, respetando la Constitución y evitando duplicación entre Identidad y Clientes.
- [ ] T006 Definir el contrato de comunicación entre Identidad y Clientes para registro, consulta y actualización de datos personales.
- [ ] T007 Definir el contrato público que utilizará Identidad para consultar el historial de pedidos sin acceder a sus tablas.
- [ ] T008 Revisar `apps/api/prisma/schema.prisma` y definir los modelos exclusivos de Identidad, una vez resueltas las decisiones de propiedad de datos.
- [ ] T009 Definir la estrategia de migración y persistencia compatible con SQLite local y PostgreSQL de producción. No ejecutar migraciones sin autorización.
- [ ] T010 Identificar las dependencias adicionales necesarias para Argon2id, JWT, TOTP y envío de correo; solicitar autorización antes de instalarlas.
- [ ] T011 Definir configuración segura de secretos, expiración de tokens, cookies o almacenamiento de sesión y CORS.
- [ ] T012 Definir formato uniforme de errores, validación de entradas y registro de eventos de seguridad sin secretos.

## Phase 3: User Story 1 - Registro e inicio de sesión (P1)

**Goal**: Permitir que un cliente se registre, confirme su correo, inicie sesión y cierre su sesión.

**Independent Test**: Registrar una cuenta, confirmar el correo mediante un token válido, iniciar sesión y cerrar sesión. Verificar también credenciales incorrectas, tokens expirados y cuentas sin confirmar.

### Tests

- [ ] T013 [P] [US1] Crear pruebas unitarias de validación y reglas de autenticación en `apps/api/src/modules/identidad/auth.service.spec.ts`.
- [ ] T014 [P] [US1] Crear pruebas de integración de registro, confirmación y login en `apps/api/src/modules/identidad/auth.integration.spec.ts`.
- [ ] T015 [P] [US1] Crear pruebas E2E de los endpoints de autenticación en `apps/api/test/identidad.e2e-spec.ts`.

### Implementation

- [ ] T016 [US1] Crear `apps/api/src/modules/identidad/identidad.module.ts` y registrar el módulo en `apps/api/src/app.module.ts`.
- [ ] T017 [US1] Implementar el servicio de autenticación en `apps/api/src/modules/identidad/auth.service.ts`.
- [ ] T018 [US1] Implementar hash y verificación de contraseñas con Argon2id en el módulo Identidad.
- [ ] T019 [US1] Implementar registro y coordinación con Clientes mediante su contrato público, sin duplicar datos personales.
- [ ] T020 [US1] Implementar confirmación de correo con token de un solo uso y expiración en `apps/api/src/modules/identidad/auth.service.ts`.
- [ ] T021 [US1] Implementar inicio de sesión, emisión y validación de tokens en `apps/api/src/modules/identidad/auth.service.ts`.
- [ ] T022 [US1] Implementar cierre de sesión y revocación de sesiones en `apps/api/src/modules/identidad/sessions.service.ts`.
- [ ] T023 [US1] Crear los controladores y DTO de autenticación en `apps/api/src/modules/identidad/auth.controller.ts` y `apps/api/src/modules/identidad/dto/`.
- [ ] T024 [US1] Implementar recuperación y restablecimiento de contraseña según el contrato OpenAPI.
- [ ] T025 [US1] Implementar limitación de intentos y respuestas que no revelen si una cuenta existe.
- [ ] T026 [US1] Verificar los endpoints de US1 contra `specs/002-identidad-clientes/contracts/identidad-api.yaml`.

## Phase 4: User Story 2 - Gestión de personal y MFA (P1)

**Goal**: Permitir que administradores gestionen cuentas del personal y exigir MFA para personal y administradores.

**Independent Test**: Crear una cuenta de personal, activar TOTP, verificar un segundo factor válido y comprobar que una cuenta deshabilitada no puede iniciar sesión.

### Tests

- [ ] T027 [P] [US2] Crear pruebas unitarias de roles y autorización en `apps/api/src/modules/identidad/roles.service.spec.ts`.
- [ ] T028 [P] [US2] Crear pruebas de integración de MFA y administración de personal en `apps/api/src/modules/identidad/mfa.integration.spec.ts`.
- [ ] T029 [P] [US2] Crear pruebas E2E de rutas protegidas y MFA en `apps/api/test/identidad-mfa.e2e-spec.ts`.

### Implementation

- [ ] T030 [US2] Implementar autorización RBAC y guards en `apps/api/src/modules/identidad/`.
- [ ] T031 [US2] Implementar generación y verificación de códigos TOTP en `apps/api/src/modules/identidad/mfa.service.ts`.
- [ ] T032 [US2] Implementar almacenamiento cifrado del secreto MFA y códigos de recuperación.
- [ ] T033 [US2] Implementar endpoints de configuración, activación y recuperación MFA.
- [ ] T034 [US2] Implementar creación, desactivación y reactivación de personal en `apps/api/src/modules/identidad/admin.controller.ts`.
- [ ] T035 [US2] Revocar las sesiones activas al deshabilitar una cuenta.
- [ ] T036 [US2] Registrar eventos de seguridad de cambios de rol, fallos de autenticación y restablecimientos MFA.

## Phase 5: User Story 3 - Perfil e historial de pedidos (P2)

**Goal**: Permitir consultar y actualizar el perfil y consultar el historial de pedidos mediante interfaces públicas.

**Independent Test**: Consultar el perfil autenticado, actualizar datos personales y recuperar el historial de pedidos del mismo usuario.

### Tests

- [ ] T037 [P] [US3] Crear pruebas unitarias de coordinación de perfil en `apps/api/src/modules/identidad/profile.service.spec.ts`.
- [ ] T038 [P] [US3] Crear pruebas de integración de perfil e historial en `apps/api/src/modules/identidad/profile.integration.spec.ts`.
- [ ] T039 [P] [US3] Crear pruebas E2E de las rutas de perfil e historial en `apps/api/test/identidad-profile.e2e-spec.ts`.

### Implementation

- [ ] T040 [US3] Implementar `apps/api/src/modules/identidad/profile.service.ts` como coordinador de las interfaces públicas de Clientes.
- [ ] T041 [US3] Implementar endpoints de consulta y actualización de perfil sin persistir PII en Identidad.
- [ ] T042 [US3] Implementar cambio de contraseña y cambio de correo con reautenticación.
- [ ] T043 [US3] Implementar consulta de historial mediante la interfaz pública de Pedidos.
- [ ] T044 [US3] Implementar gestión y revocación de sesiones del usuario.

## Phase 6: User Story 4 - Privacidad y derechos del titular (P2)

**Goal**: Permitir consultar finalidades y consentimientos, exportar datos y solicitar eliminación de cuenta.

**Independent Test**: Consultar consentimientos, revocar uno opcional, solicitar exportación y comprobar el flujo de eliminación y anonimización.

### Tests

- [ ] T045 [P] [US4] Crear pruebas unitarias de consentimiento y solicitudes de privacidad en `apps/api/src/modules/identidad/privacy.service.spec.ts`.
- [ ] T046 [P] [US4] Crear pruebas de integración de exportación y eliminación en `apps/api/src/modules/identidad/privacy.integration.spec.ts`.
- [ ] T047 [P] [US4] Crear pruebas E2E de derechos del titular en `apps/api/test/identidad-privacy.e2e-spec.ts`.

### Implementation

- [ ] T048 [US4] Implementar consulta y registro de consentimientos mediante la responsabilidad de datos que corresponda.
- [ ] T049 [US4] Implementar revocación de consentimientos opcionales con registro de fecha y finalidad.
- [ ] T050 [US4] Implementar inventario de datos personales y finalidades de tratamiento.
- [ ] T051 [US4] Implementar exportación estructurada de datos personales coordinando Clientes, Identidad y Pedidos.
- [ ] T052 [US4] Implementar solicitud de eliminación con reautenticación y revocación de sesiones.
- [ ] T053 [US4] Implementar coordinación de anonimización de pedidos respetando obligaciones legales de conservación.
- [ ] T054 [US4] Registrar eventos de privacidad sin almacenar contraseñas, tokens ni secretos.

## Phase 7: Frontend

**Purpose**: Construir las interfaces web para los flujos implementados y conectarlas con la API.

- [ ] T055 [P] Revisar la documentación local de Next.js 16 y las convenciones de `apps/web/AGENTS.md` antes de modificar componentes.
- [ ] T056 [P] Crear componentes reutilizables de formularios y mensajes de validación en `apps/web/app/components/`.
- [ ] T057 Implementar pantalla de registro en `apps/web/app/registro/`.
- [ ] T058 Implementar pantalla de confirmación de correo en `apps/web/app/confirmar-correo/`.
- [ ] T059 Implementar pantalla de inicio de sesión en `apps/web/app/login/`.
- [ ] T060 Implementar cierre de sesión y protección de rutas según el rol autenticado.
- [ ] T061 Implementar pantallas de configuración y verificación MFA en `apps/web/app/`.
- [ ] T062 Implementar perfil e historial de pedidos consumiendo la API.
- [ ] T063 Implementar pantallas de privacidad, consentimientos, exportación y eliminación.
- [ ] T064 Verificar accesibilidad, navegación por teclado y criterios WCAG 2.2 AAA.

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T065 [P] Actualizar `specs/002-identidad-clientes/quickstart.md` con los pasos reales de ejecución y validación.
- [ ] T066 [P] Actualizar `specs/002-identidad-clientes/contracts/identidad-api.yaml` si la implementación requiere cambios aprobados.
- [ ] T067 Ejecutar pruebas unitarias, integración y E2E de backend y frontend.
- [ ] T068 Ejecutar lint, typecheck y build de los proyectos afectados.
- [ ] T069 Verificar cobertura mínima del 80 % del código nuevo.
- [ ] T070 Revisar controles de seguridad, manejo de secretos y cumplimiento de la Constitución.
- [ ] T071 Validar manualmente los escenarios del quickstart y registrar resultados.

## Dependencies & Execution Order

1. Setup: T001-T004.
2. Foundational: T005-T012. Estas tareas bloquean la implementación que dependa de propiedad de datos, contratos o nuevas dependencias.
3. US1: T013-T026. MVP prioritario.
4. US2: T027-T036. Depende de la infraestructura de autenticación de US1.
5. US3: T037-T044. Depende de la identidad autenticada y de los contratos públicos de Clientes y Pedidos.
6. US4: T045-T054. Depende de las interfaces de datos personales y pedidos.
7. Frontend: T055-T064. Puede avanzar en componentes visuales, pero la integración depende de los endpoints disponibles.
8. Polish: T065-T071. Depende de las funcionalidades que se decida entregar.

## Parallel Opportunities

- T003 y T004 pueden realizarse en paralelo.
- T013, T014 y T015 pueden prepararse en paralelo.
- T027, T028 y T029 pueden prepararse en paralelo.
- T037, T038 y T039 pueden prepararse en paralelo.
- T045, T046 y T047 pueden prepararse en paralelo.
- T055 y T056 pueden realizarse en paralelo con tareas de backend que no modifiquen los mismos archivos.

## Implementation Strategy

### MVP First

1. Completar Setup y las decisiones fundacionales imprescindibles.
2. Resolver la propiedad del correo y el contrato con Clientes.
3. Implementar y probar US1.
4. Validar registro, confirmación, login y logout.
5. Continuar con MFA, perfil e historial y privacidad según prioridad.

### Constraints

- No instalar dependencias sin autorización.
- No ejecutar migraciones sin autorización.
- No realizar commits ni push sin autorización.
- No acceder directamente a tablas pertenecientes a otros módulos.
- No implementar decisiones de arquitectura que continúen pendientes.
- Las pruebas deben escribirse antes de la implementación de cada historia.
