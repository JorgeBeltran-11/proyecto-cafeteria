# Implementation Plan: Identidad y gestión de clientes

**Branch**: `feature/spec-3` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-identidad-clientes/spec.md`

## Summary

Implementar la funcionalidad de identidad dentro del monolito modular NestJS, separando las responsabilidades de Identidad, Clientes y Pedidos.

El módulo Identidad administra credenciales, autenticación, autorización, roles, sesiones, tokens, MFA y eventos de seguridad. El módulo Clientes es propietario de los datos personales, incluyendo correo electrónico, nombre, teléfono, preferencias y consentimientos. El módulo Pedidos administra los pedidos y el historial de compras.

La comunicación entre módulos se realiza mediante interfaces públicas. Identidad no almacena copias de datos personales ni accede directamente a tablas de otros módulos.

El alcance funcional incluye registro, confirmación de correo, inicio y cierre de sesión, recuperación de contraseña, MFA para personal y administradores, control por roles y coordinación de operaciones de privacidad conforme a la LOPDP.

La implementación utiliza NestJS, TypeScript, Prisma 6 y SQLite para desarrollo local. PostgreSQL se mantiene como destino previsto para producción.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 22 LTS (`.nvmrc`, `packageManager` y scripts del repositorio)  
**Existing project dependencies**: NestJS 11, Prisma 6, Next.js 16, React 19, pnpm, ESLint 9, Jest, `@nestjs/config`, `@nestjs/testing`, `supertest`; SQLite se usa en el entorno local actual del repositorio.  
**Feature dependencies installed**: `@nestjs/jwt`, `argon2`, `@nestjs/throttler`, `class-validator`, `class-transformer`, `nodemailer` y `@types/nodemailer`.  
**Additional dependencies pending**: las necesarias para MFA TOTP y generación de códigos QR. No se presupone que Passport esté instalado.
**Storage**: SQLite para desarrollo local y PostgreSQL como destino de producción. La transición requiere revisar el proveedor Prisma, las migraciones y la compatibilidad de los tipos. 
**Testing**: Jest unitario + integración; pruebas de capa HTTP/E2E con Jest + Supertest para autenticación, MFA y LOPDP. No se introduce Playwright sin justificación, porque el repositorio ya dispone de Jest y Supertest como herramientas principales.  
**Target Platform**: backend NestJS en Render; frontend Next.js 16 en Vercel; desarrollo local en Windows/macOS/Linux con SQLite; producción con PostgreSQL.  
**Project Type**: monolito modular en NestJS con frontend y backend en un mismo repo.  
**Performance Goals**: autenticación funcional en < 300 ms p95 en local; generación de exportación de datos en < 60 s según volumen; no se exige Redis en local para el primer arranque.  
**Constraints**: WCAG 2.2 AAA, protección de datos personales conforme a la LOPDP, no revelar existencia de cuentas en respuestas públicas, MFA obligatorio para personal y administradores y separación de responsabilidades entre módulos.
**Scale/Scope**: cuentas de clientes, personal y administradores; modelos de autenticación, sesiones, tokens, MFA y eventos de seguridad. Los perfiles y consentimientos pertenecen a Clientes; los pedidos e historial pertenecen a Pedidos.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. Accesibilidad AAA:** formularios, errores, MFA y exportación de datos diseñados con teclado, foco visible, textos claros, sin límites de tiempo artificial y contraste ≥ 7:1.
- [x] **II. Seguridad:** Argon2id, MFA obligatorio para personal y administradores, control por rol en servidor, validación de entradas y registro de eventos de seguridad sin exponer secretos.
- [x] **III. LOPDP:** los datos personales pertenecen al módulo Clientes. Identidad administra exclusivamente los datos necesarios para autenticación y seguridad, evitando duplicar PII.
- [x] **IV. Escalabilidad y consistencia:** backend sin estado; sesiones y refresh tokens con expiración controlada; el proceso de pedidos y pagos se mantiene fuera del alcance directo de este módulo, pero la autenticación se diseña para ser idempotente y segura.
- [x] **V. Límites de dominio:** Identidad, Clientes y Pedidos mantienen responsabilidades separadas. La comunicación se realiza mediante interfaces públicas y no mediante acceso directo a tablas de otros módulos.
- [x] **VI. Calidad:** se planifican pruebas unitarias, de integración y E2E para registro, login, MFA, restablecimiento y LOPDP; TDD como línea base para la lógica crítica de autenticación.
- [x] **VII. Reversibilidad:** división en commits atómicos, migraciones compatibles y feature flags para funcionalidades incompletas; el módulo se implementa de forma incremental.
- [x] **Plataforma:** TypeScript, sin Python; SQLite en desarrollo local y PostgreSQL en producción; despliegue por pipeline en la plataforma prevista por el proyecto.

**Resultado de la puerta**: APROBADO. Los límites de dominio y la propiedad de los datos personales están definidos. La implementación debe respetar los contratos públicos entre módulos y los principios de minimización y protección de datos.

## Project Structure

### Documentation (this feature)

```text
specs/002-identidad-clientes/
├── plan.md              # Este archivo
├── research.md          # Phase 0: decisiones técnicas
├── data-model.md        # Phase 1: entidades y reglas
├── quickstart.md        # Phase 1: guía de arranque y validación
├── contracts/
│   └── identidad-api.yaml  # Contrato HTTP del módulo
├── checklists/
└── spec.md              # Especificación funcional
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── common/
│   │   │   ├── guards/
│   │   │   ├── decorators/
│   │   │   └── filters/
│   │   └── modules/
│   │       └── identidad/
│   │           ├── identidad.module.ts
│   │           ├── controllers/
│   │           │   ├── auth.controller.ts
│   │           │   ├── profile.controller.ts
│   │           │   ├── admin.controller.ts
│   │           │   └── privacy.controller.ts
│   │           ├── services/
│   │           │   ├── auth.service.ts
│   │           │   ├── profile.service.ts
│   │           │   ├── mfa.service.ts
│   │           │   ├── consent.service.ts
│   │           │   ├── data-rights.service.ts
│   │           │   └── security-audit.service.ts
│   │           ├── dto/
│   │           ├── validators/
│   │           ├── guards/
│   │           └── tests/
│   │               ├── auth.service.spec.ts
│   │               ├── profile.service.spec.ts
│   │               ├── mfa.service.spec.ts
│   │               └── privacy.e2e-spec.ts
│   └── test/
│       ├── jest-e2e.json
│       └── global-setup.ts
├── web/
│   └── app/
│       ├── auth/
│       │   ├── login/
│       │   ├── register/
│       │   ├── forgot-password/
│       │   └── reset-password/
│       └── perfil/
│           └── privacidad/
└── packages/
    └── shared/
        └── src/
            └── identity.types.ts
```

**Structure Decision**: la estructura sigue el patrón del monolito modular. `apps/api/src/modules/identidad` contiene la autenticación, autorización, credenciales, sesiones, MFA y eventos de seguridad. Los datos personales pertenecen a Clientes y los pedidos e historial pertenecen a Pedidos. El frontend consume las API públicas y no accede directamente a entidades de Prisma. La integración con módulos todavía no implementados se realizará mediante contratos e interfaces.

## Research

### Decision status: approved vs pending approval

#### Approved decisions

1. **Autenticación basada en cuenta y roles**
   - Decision: usar `Account` con roles `customer`, `staff`, `admin`; la autorización se evalúa en el servidor con guards y RBAC.
   - Rationale: la especificación lo exige claramente y la constitución exige comprobar el rol en cada operación.
   - Alternatives considered: confiar en la UI para ocultar funciones; descartado por inseguridad.

2. **Hash de contraseñas con Argon2id**
   - Decision: las contraseñas se guardan con `argon2id` y un nivel de costo adecuado para la plataforma.
   - Rationale: cumple la constitución de seguridad y no expone secretos en texto plano.
   - Alternatives considered: bcrypt o SHA-256; descartados porque la constitución exige Argon2id y se mantiene la preferencia por la opción más segura.

3. **Registro, confirmación y recuperación con tokens de un solo uso**
   - Decision: confirmación de correo y restablecimiento de contraseña usan tokens temporales de un solo uso, con expiración corta y invalidación tras uso.
   - Rationale: cumple FR-002, FR-003, FR-006 y elimina la enumeración de correos mediante respuestas públicas neutrales.
   - Alternatives considered: mensajes diferenciales con revelar si el correo existe; descartado por la especificación.

4. **MFA con TOTP para personal y administradores**
   - Decision: la segunda autenticación usa TOTP (`otplib`) con secret generado por usuario, QR para registro y códigos de recuperación para casos de pérdida del dispositivo.
   - Rationale: cumple la necesidad de seguridad operativa y la obligación de MFA para personal/admin.
   - Alternatives considered: SMS/email como segundo factor; descartado por menor seguridad y por mayor dependencia de actores externos.

5. **SQLite local y PostgreSQL de producción**
   - Decision: desarrollar localmente con SQLite, y mantener PostgreSQL como destino final de producción; el cambio requiere adaptar el proveedor Prisma, la `DATABASE_URL`, los scripts de entorno y la estrategia de migraciones, no solo un ajuste nominal de la conexión.
   - Rationale: el repositorio ya está preparado para SQLite local y la constitución no exige PostgreSQL local; la base de producción debe seguir siendo compatible con el mismo modelo de dominio y con las migraciones gestionadas por Prisma.
   - Alternatives considered: exigir PostgreSQL local desde el inicio; descartado porque añade dependencia externa y fricción innecesaria local.

6. **Guarda de sesiones y refresh tokens**
   - Decision: el access token es JWT corto, y los refresh tokens son identificadores aleatorios almacenados con hash y rotación por sesión.
   - Rationale: se exige seguridad y control de sesiones; la expiración y la revocación deben poder gestionarse desde el backend.
   - Alternatives considered: guardar el token completo en cookies sin almacenamiento del lado servidor; descartado por menor control de revocación y rotación.

#### Approved architectural decisions

1. **Propiedad y gestión de la PII**
   - Decision: el módulo `clientes` es propietario de los datos personales, incluidos nombre, correo electrónico, teléfono, preferencias y consentimientos. El módulo `identidad` no almacena copias de estos datos.
   - Rationale: mantiene la separación de responsabilidades y aplica el principio de minimización de datos.
   - Implementation: `identidad` utiliza `clientId` como referencia lógica y consulta los datos necesarios mediante interfaces públicas de `clientes`.

2. **Límites exactos entre módulos**
   - Decision: `identidad` administra exclusivamente autenticación, credenciales, roles, sesiones, tokens, MFA y eventos de seguridad. `clientes` administra los datos personales y consentimientos. `pedidos` administra los pedidos y su historial.
   - Rationale: cada módulo conserva la propiedad de sus datos y evita dependencias directas sobre las tablas de otros módulos.
   - Implementation: la comunicación entre módulos se realiza mediante interfaces públicas; no se crean claves foráneas entre sus bases de datos o esquemas.

### Storage, expiration and lifecycle rules

- **Access tokens**: JWT de corta duración (15 a 30 minutos), solo en backend para validación de seguridad, sin guardar datos sensibles del cliente dentro.
- **Refresh tokens**: identificador aleatorio de 256 bits, almacenado con hash y expira en 7 a 30 días según política; se recomienda rotación y revocación por sesión.
- **Sessions**: registro persistente de sesión activa con `user_agent`, `ip_hash`, `last_seen_at`, `expires_at`, `revoked_at`, `is_active`; se usa para cerrar sesión, cerrarla en masa y auditar accesos.
- **MFA TOTP secret**: almacenado cifrado y nunca en claro; se guarda un secret y una colección de recovery codes con hash y marca `used_at`.
- **Recovery codes**: códigos de un solo uso, almacenados con hash y expiración definida; el número recomendado es 10 por cuenta.
- **Token lifecycle**: confirmación de email, recuperación de contraseña y cambio de correo deben expirar en 30 minutos; los sessions y refresh tokens tienen expiración propia y se invalidan al cerrar sesión o al revocar la cuenta.

## Data Model

### Data Model

El modelo de datos detallado se encuentra en `data-model.md` y su implementación actual está definida en `apps/api/prisma/schema.prisma`.

Identidad administra exclusivamente:

- `Account`: credenciales, referencia `clientId`, rol, estado y verificación de cuenta.
- `UserSession`: sesiones y su ciclo de vida.
- `RefreshToken`: tokens de renovación, rotación y revocación.
- `EmailVerificationToken`: tokens de confirmación.
- `PasswordResetToken`: tokens de recuperación.
- `MfaSecret`: secretos TOTP cifrados.
- `MfaRecoveryCode`: códigos de recuperación almacenados mediante hash.
- `SecurityEvent`: auditoría de acciones sensibles.

Los siguientes datos no pertenecen al esquema de Identidad:

- Perfil, correo electrónico, teléfono y preferencias: módulo Clientes.
- Consentimientos: módulo Clientes.
- Pedidos e historial: módulo Pedidos.
- Solicitudes de derechos de privacidad: gestionadas por los módulos propietarios de los datos, coordinadas mediante sus interfaces públicas.

### Relationships and constraints

- `Account` mantiene `clientId` como referencia lógica al cliente.
- No se crea una clave foránea entre Identidad y Clientes.
- `Account` tiene sesiones, tokens de confirmación, tokens de recuperación, secreto MFA, códigos de recuperación y eventos de seguridad.
- Cada `RefreshToken` pertenece a una sesión.
- Los módulos no acceden directamente a las tablas de otros módulos.
- Los datos personales no se duplican en Identidad.

### Expiration and validation rules

- Email confirmation token: expiración máxima 30 minutos.
- Password reset token: expiración máxima 30 minutos.
- Access tokens: 15-30 minutos.
- Refresh tokens: 7-30 días según política del negocio; deben estar vinculados a una sesión y no se almacena un JWT completo en texto plano.
- Session inactivity timeout: 30 días o la política de seguridad del proyecto.
- MFA recovery codes: de un solo uso, almacenados con hash y marcados con `usedAt`; no se entregan como definitivos antes de verificar y activar MFA.
- Consent history: cada cambio genera una nueva fila; no borrar ni sobrescribir la anterior.
- Security events: no contienen secretos, ni datos bancarios, ni reproducción innecesaria de PII; solo metainformación no sensible.

## Contracts

Se define el contrato HTTP de las funcionalidades de identidad en [contracts/identidad-api.yaml](./contracts/identidad-api.yaml). Incluye endpoints de autenticación, MFA, perfil, pedidos, consentimiento y administración. Las operaciones sobre datos personales, consentimientos y pedidos se coordinan con los módulos propietarios mediante sus interfaces públicas. El contrato sirve como base para pruebas unitarias, de integración y E2E.

## Quickstart

### Requisitos locales

- Node.js 22 LTS
- pnpm 10
- SQLite para desarrollo local
- opcional: cliente SMTP o un servicio fake de correo para pruebas de confirmación y recuperación

### Requisitos de integración y producción

- PostgreSQL 16 para producción
- Redis opcional si se activa la sesión centralizada o cache de rate limiting (no es requisito para arrancar la primera versión en local)
- proveedor SMTP o servicio de email para confirmación y reset de contraseña en entornos no locales

### Variables de entorno (PowerShell)

```powershell
# Desarrollo local con SQLite
$env:DATABASE_URL = "file:./dev.db"
$env:PORT = "3001"
$env:WEB_ORIGIN = "http://localhost:3000"
$env:NODE_ENV = "development"
```

Para producción o integración con PostgreSQL:

```powershell
$env:DATABASE_URL = "postgresql://usuario:password@localhost:5432/cafeteria"
$env:PORT = "3001"
$env:WEB_ORIGIN = "https://tu-frontend.example.com"
$env:NODE_ENV = "production"
```

### Instalación local

```powershell
pnpm install
Copy-Item apps/api/.env.example apps/api/.env
```

### Arranque del backend y frontend

```powershell
pnpm dev
```

### Secuencia recomendada de validación

1. Registrar una cuenta nueva con un correo no existente.
2. Confirmar el correo con el token enviado.
3. Iniciar sesión con credenciales válidas.
4. Probar un login fallido y verificar el bloqueo temporal.
5. Recuperar la contraseña con enlace temporal.
6. Configurar MFA TOTP para personal o administrador.
7. Cambiar la contraseña y el correo, con confirmación de identidad.
8. Ver el perfil, editar preferencias y consultar el historial del cliente.
9. Solicitar exportación de datos y verificar el estado de la solicitud.
10. Confirmar la eliminación de la cuenta con reautenticación y comprobar la anonimización de la información personal.

### Criterio de salida

Cuando estos flujos están cubiertos por pruebas y la solución cumple los gates de accesibilidad, seguridad, LOPDP y calidad del proyecto, la feature está lista para pasar de la fase de plan a la fase de implementación y tareas.

## Complexity Tracking

La separación de responsabilidades entre Identidad, Clientes y Pedidos está aprobada. La principal complejidad de integración consiste en coordinar operaciones que involucran más de un módulo, como el registro, la confirmación del correo y las solicitudes de privacidad.

Estas operaciones deberán utilizar interfaces públicas, idempotencia y mecanismos de compensación cuando sean necesarios. No se permitirá el acceso directo a tablas de otros módulos.