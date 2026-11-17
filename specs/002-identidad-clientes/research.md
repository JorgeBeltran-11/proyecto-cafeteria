@'
# Phase 0 Research: Identidad y gestión de clientes

## Decisiones arquitectónicas aprobadas

### 1. Separación de responsabilidades

La arquitectura del monolito modular establece los siguientes límites:

| Módulo | Responsabilidad | Datos que administra |
|---|---|---|
| Identidad | Autenticación y autorización | Credenciales, roles, sesiones, tokens, MFA y eventos de seguridad |
| Clientes | Gestión de clientes | Correo electrónico, nombres, teléfonos, preferencias y consentimientos |
| Pedidos | Gestión de pedidos | Pedidos e historial de compras |

Identidad no almacena copias de los datos personales administrados por Clientes ni accede directamente a sus tablas.

### 2. Integración entre módulos

- Identidad consulta el correo electrónico mediante una interfaz pública de Clientes para los procesos de registro, inicio de sesión y recuperación.
- El registro coordina la creación del cliente y la cuenta de identidad.
- La confirmación del correo utiliza un token de un solo uso administrado por Identidad. Una vez validado, se coordina la actualización del estado del correo mediante la interfaz pública de Clientes.
- Identidad mantiene `clientId` como referencia al cliente, sin establecer una clave foránea entre esquemas de módulos.
- Los cambios de perfil y preferencias se realizan mediante Clientes.
- El historial de compras se consulta mediante Pedidos.
- Las solicitudes de privacidad se coordinan con los módulos propietarios de los datos.

Mientras Clientes y Pedidos no estén implementados, se definirán contratos o interfaces de integración. No se debe simular una implementación inexistente ni acceder directamente a sus tablas.

### 3. Autenticación basada en roles

- Decisión: utilizar `Account` con roles `customer`, `staff` y `admin`.
- La autorización se comprueba en el servidor mediante guards y RBAC.
- Las restricciones de la interfaz no sustituyen la autorización del backend.
- Las cuentas de personal y administración requieren MFA.

### 4. Hash de contraseñas con Argon2id

- Decisión: utilizar Argon2id para almacenar contraseñas.
- Las contraseñas nunca se almacenan en texto plano.
- Los parámetros de costo deben ajustarse y validarse en el entorno de ejecución.
- Alternativas como SHA-256 sin función específica de derivación de contraseñas quedan descartadas.

### 5. Tokens de un solo uso

- Los tokens de confirmación de correo y recuperación de contraseña se almacenan mediante hash.
- La duración prevista es de 30 minutos.
- Cada token puede utilizarse una sola vez.
- Las respuestas públicas deben evitar revelar si una cuenta existe.

### 6. MFA mediante TOTP

- Decisión: utilizar TOTP para personal y administradores.
- El secreto TOTP debe cifrarse en reposo.
- Los códigos de recuperación se almacenan mediante hash y son de un solo uso.
- La implementación de MFA requiere incorporar y validar las dependencias correspondientes antes de desarrollar esta funcionalidad.

### 7. SQLite local y PostgreSQL en producción

- Decisión: SQLite para desarrollo local.
- PostgreSQL 16 es el destino previsto para producción.
- La transición requiere revisar el proveedor Prisma, los tipos compatibles, las migraciones y las pruebas.
- Redis y un proveedor SMTP real no son requisitos para iniciar el desarrollo local.

### 8. Ciclo de vida de sesiones y tokens

- Los access tokens serán JWT de corta duración, con una vigencia prevista de 15 a 30 minutos.
- Los refresh tokens se almacenan mediante hash.
- Los refresh tokens deben tener rotación, expiración y revocación.
- Cada sesión permite controlar expiración, actividad y revocación.
- La duración prevista de los refresh tokens es de 7 a 30 días, según la política definitiva del proyecto.

### 9. Eventos de seguridad

- Las acciones sensibles generan registros estructurados mediante `SecurityEvent`.
- Los eventos pueden registrar fecha, tipo, referencia de cuenta, hash de IP y metadatos no sensibles.
- No deben incluir contraseñas, tokens, secretos MFA ni datos personales innecesarios.

## Dependencias de implementación

Dependencias instaladas para el desarrollo inicial:

- `argon2`
- `@nestjs/jwt`
- `@nestjs/throttler`
- `class-validator`
- `class-transformer`
- `nodemailer`
- `@types/nodemailer`

Las dependencias de MFA y otras herramientas adicionales deben instalarse únicamente cuando sean necesarias y estén autorizadas.

La estrategia inicial de autenticación puede utilizar guards propios de NestJS y `@nestjs/jwt`; no se presupone que Passport esté instalado.

## Consideraciones de consistencia entre módulos

La creación de un cliente y su cuenta de identidad involucra dos módulos. No se debe asumir que una transacción Prisma puede abarcar las tablas de ambos módulos.

La implementación deberá definir cómo manejar errores parciales, reintentos e idempotencia. Las operaciones distribuidas entre módulos deberán coordinarse mediante sus interfaces públicas y mecanismos explícitos de compensación cuando corresponda.

La confirmación del correo también requiere coordinar el consumo del token de Identidad con la actualización del estado en Clientes. La implementación debe evitar marcar una cuenta como confirmada si la actualización del correo en Clientes falla.

## Referencias

- `specs/002-identidad-clientes/spec.md`
- `specs/002-identidad-clientes/data-model.md`
- `specs/002-identidad-clientes/contracts/identidad-api.yaml`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/modules/identidad/README.md`
'@ | Set-Content specs/002-identidad-clientes/research.md -Encoding utf8