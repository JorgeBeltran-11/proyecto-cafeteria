# Módulo `identidad`

- **Spec:** `specs/002-identidad-clientes/`.
- **Responsabilidad:** administrar credenciales, autenticación, autorización, roles, sesiones, tokens, MFA y eventos de seguridad.
- **Código:** controladores, DTO, servicios y pruebas se encuentran en `apps/api/src/modules/identidad/`.
- **Datos:** Identidad administra sus propios modelos de Prisma. Los datos personales de los clientes pertenecen al módulo Clientes.
- **Relación con Clientes:** utiliza las interfaces públicas de `ClientesService` para consultar correos y crear perfiles y consentimientos.
- **Contraseñas:** se almacenan mediante Argon2id.
- **Tokens:** los tokens de verificación, recuperación y refresh se almacenan mediante SHA-256 y no en texto plano.
- **Correo:** `MailerService` utiliza la configuración SMTP proporcionada mediante variables de entorno.
- **Arquitectura:** los módulos se comunican mediante sus servicios públicos, sin acceder directamente a las tablas de otros módulos.

## Funcionalidades implementadas

- Registro de cuentas.
- Creación transaccional del perfil de cliente, consentimiento y cuenta.
- Envío de correo de verificación.
- Confirmación de correo mediante token de un solo uso.
- Hash y verificación de contraseñas con Argon2id.
- Inicio de sesión con JWT, sesiones persistidas y refresh tokens almacenados con hash.
- Cierre de sesión actual mediante JWT, con revocación transaccional e idempotente de la sesión y sus refresh tokens.
- Renovación de access tokens con rotación de refresh tokens, detección de reutilización y revocación de su familia.
- Solicitud de recuperación para cuentas activas con correo verificado, con respuesta genérica, token de un solo uso almacenado con SHA-256 y expiración de 30 minutos.
- Restablecimiento de contraseña con Argon2id y transacción que consume los tokens de recuperación y revoca las sesiones y refresh tokens de la cuenta.
- MFA TOTP con secreto cifrado AES-256-GCM, desafíos aleatorios de un solo uso, protección frente a repetición de códigos TOTP y diez códigos de recuperación de un solo uso.
- Las cuentas `staff` y `admin` deben activar MFA antes de obtener tokens de sesión; el enrolamiento usa un desafío breve sin permisos de acceso generales.
- La desactivación de MFA requiere contraseña y segundo factor, y revoca las sesiones y sus refresh tokens.
- Los endpoints de recuperación usan el throttling del controlador de autenticación: cinco solicitudes por minuto.

## MFA

1. Una cuenta autenticada solicita `POST /auth/mfa/setup`. El servidor devuelve una URI `otpauth://` para registrar en una app autenticadora y guarda el secreto únicamente cifrado; la cuenta aún no tiene MFA activo.
2. `POST /auth/mfa/verify` requiere un TOTP válido para activar MFA y entrega diez códigos de recuperación. Los códigos se muestran solo en esa respuesta; solo se persisten sus hashes.
3. Las cuentas `staff` y `admin` sin MFA reciben `mfaSetupRequired` y un `enrollmentToken` al iniciar sesión. Usan `POST /auth/mfa/enrollment/setup` para obtener su URI y `POST /auth/mfa/enrollment/verify` para activar MFA. Estos desafíos expiran en cinco minutos, son de un solo uso y no son JWT ni sirven como access tokens.
4. Con MFA habilitado, `POST /auth/login` devuelve un `challengeToken` en lugar de tokens de sesión. `POST /auth/login/mfa` acepta un TOTP o código de recuperación; solo entonces crea la sesión, el access token y el refresh token.
5. `POST /auth/mfa/recovery-codes` reemplaza los códigos existentes tras comprobar un segundo factor. `POST /auth/mfa/disable` exige contraseña y segundo factor, y revoca las sesiones activas.

El secreto de cifrado se configura como `MFA_ENCRYPTION_KEY`, una clave Base64 de exactamente 32 bytes. No se debe registrar, compartir ni reutilizar el valor de ejemplo. MFA y los desafíos usan el throttling global de autenticación: cinco solicitudes por minuto.

## Funcionalidades pendientes

- Integración de la página web para configurar MFA, presentar desafíos de login y guardar códigos de recuperación.
- Reenvío de correos de verificación.
- Registro integral de eventos de seguridad.

La implementación debe mantener la separación entre Identidad y Clientes, incluso mientras otros módulos del sistema todavía no estén disponibles.