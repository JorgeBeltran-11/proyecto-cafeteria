# Módulo `identidad`

- **Spec:** `specs/002-identidad-clientes/`.
- **Responsabilidad:** administrar credenciales, autenticación, autorización, roles, sesiones, tokens, MFA y eventos de seguridad.
- **Código:** controladores, DTO, servicios y pruebas se encuentran en `apps/api/src/modules/identidad/`.
- **Datos:** Identidad administra sus propios modelos de Prisma. Los datos personales de los clientes pertenecen al módulo Clientes.
- **Relación con Clientes:** utiliza las interfaces públicas de `ClientesService` para consultar correos y crear perfiles y consentimientos.
- **Contraseñas:** se almacenan mediante Argon2id.
- **Tokens:** los tokens de verificación se almacenan mediante SHA-256 y no en texto plano.
- **Correo:** `MailerService` utiliza la configuración SMTP proporcionada mediante variables de entorno.
- **Arquitectura:** los módulos se comunican mediante sus servicios públicos, sin acceder directamente a las tablas de otros módulos.

## Funcionalidades implementadas

- Registro de cuentas.
- Creación transaccional del perfil de cliente, consentimiento y cuenta.
- Envío de correo de verificación.
- Confirmación de correo mediante token de un solo uso.
- Hash y verificación de contraseñas con Argon2id.

## Funcionalidades pendientes

- Inicio y cierre de sesión.
- Gestión de sesiones y renovación de tokens.
- Recuperación de contraseñas.
- Reenvío de correos de verificación.
- Autenticación multifactor (MFA).
- Registro integral de eventos de seguridad.

La implementación debe mantener la separación entre Identidad y Clientes, incluso mientras otros módulos del sistema todavía no estén disponibles.