# Data Model: módulo de identidad y clientes

## 1. Objetivo

Definir el modelo de persistencia para la autenticación, autorización, confirmación de correo, sesiones, MFA y gestión de clientes de la cafetería.

La aplicación utiliza una arquitectura de monolito modular. Cada módulo es responsable de sus propios datos y expone interfaces públicas para comunicarse con los demás módulos.

La propiedad de los datos se distribuye de la siguiente manera:

- **Identidad:** credenciales, roles, sesiones, tokens de autenticación y MFA.
- **Clientes:** correo electrónico, nombre, teléfono, preferencias y consentimientos.
- **Pedidos:** pedidos, historial de compras y anonimización de información personal asociada.

Identidad no almacena copias de los datos personales del cliente ni accede directamente a las tablas de Clientes o Pedidos.

## 2. Entidades del módulo Identidad

### Account

Representa una cuenta de autenticación vinculada opcionalmente a un cliente.

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `id` | UUID | Identificador único | `@default(uuid())` |
| `clientId` | String? | Identificador del cliente en el módulo Clientes | Único cuando existe |
| `passwordHash` | String | Hash de contraseña | Argon2id, nunca texto claro |
| `role` | String | Rol de la cuenta | `customer`, `staff`, `admin`; validado por servidor |
| `status` | String | Estado de la cuenta | `pending_confirmation`, `active`, `disabled` |
| `emailVerifiedAt` | DateTime? | Fecha de confirmación del correo | Nullable |
| `mfaEnabled` | Boolean | Estado de MFA | Por defecto `false` |
| `lastLoginAt` | DateTime? | Último inicio de sesión exitoso | Nullable |
| `createdAt` | DateTime | Fecha de creación | Automático |
| `updatedAt` | DateTime | Última modificación | Automático |

El correo electrónico no se almacena en esta entidad. Para el registro, inicio de sesión y recuperación, Identidad utiliza las interfaces públicas del módulo Clientes para consultar o asociar el correo correspondiente.

La relación con Clientes se realiza mediante `clientId`, sin establecer una relación de base de datos entre módulos.

### UserSession

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `id` | UUID | Identificador de sesión | Único |
| `accountId` | UUID | Cuenta asociada | FK obligatoria |
| `userAgent` | String? | Agente del navegador | Opcional |
| `ipHash` | String? | Hash de IP | Nunca guardar IP en claro |
| `createdAt` | DateTime | Creación | Automático |
| `lastSeenAt` | DateTime | Última actividad | Automático |
| `expiresAt` | DateTime | Expiración | Obligatorio |
| `revokedAt` | DateTime? | Revocación | Nullable |

Una cuenta puede tener varias sesiones. Cada sesión pertenece a una cuenta y puede contener varios tokens de renovación.

### RefreshToken

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `id` | UUID | Identificador | Único |
| `sessionId` | UUID | Sesión asociada | FK obligatoria a `UserSession` |
| `tokenHash` | String | Hash del token | Único; nunca guardar el token en claro |
| `familyId` | String | Familia de rotación | Obligatorio |
| `expiresAt` | DateTime | Expiración | Según política de seguridad |
| `revokedAt` | DateTime? | Revocación | Nullable |
| `replacedByTokenId` | UUID? | Token que lo reemplaza | Nullable |
| `createdAt` | DateTime | Creación | Automático |

Los refresh tokens se rotan y se revocan al detectar reutilización de un token anterior.

### EmailVerificationToken

Token temporal para confirmar el correo electrónico del cliente.

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `id` | UUID | Identificador | Único |
| `accountId` | UUID | Cuenta asociada | FK obligatoria |
| `tokenHash` | String | Hash del token | Único |
| `expiresAt` | DateTime | Expiración | 30 minutos |
| `usedAt` | DateTime? | Fecha de utilización | Nullable |
| `createdAt` | DateTime | Creación | Automático |

El token original se envía al correo mediante el servicio de notificaciones y nunca se almacena en texto claro.

### PasswordResetToken

Token temporal para restablecer la contraseña.

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `id` | UUID | Identificador | Único |
| `accountId` | UUID | Cuenta asociada | FK obligatoria |
| `tokenHash` | String | Hash del token | Único |
| `expiresAt` | DateTime | Expiración | 30 minutos |
| `usedAt` | DateTime? | Fecha de utilización | Nullable |
| `createdAt` | DateTime | Creación | Automático |

El token es de un solo uso y se invalida después de completar el restablecimiento.

### MfaSecret

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `id` | UUID | Identificador | Único |
| `accountId` | UUID | Cuenta asociada | Único, FK obligatoria |
| `status` | String | Estado MFA | `pending_activation`, `active`, `disabled` |
| `secretEncrypted` | String | Secreto TOTP cifrado | Nunca almacenar en texto claro |
| `enabledAt` | DateTime? | Activación | Nullable |
| `lastVerifiedAt` | DateTime? | Última validación | Nullable |
| `createdAt` | DateTime | Creación | Automático |
| `updatedAt` | DateTime | Modificación | Automático |

MFA será obligatorio para cuentas de personal y administración.

### MfaRecoveryCode

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `id` | UUID | Identificador | Único |
| `accountId` | UUID | Cuenta asociada | FK obligatoria |
| `codeHash` | String | Hash del código | Único |
| `usedAt` | DateTime? | Fecha de uso | Nullable |
| `expiresAt` | DateTime? | Expiración | Opcional |
| `createdAt` | DateTime | Creación | Automático |

Los códigos se generan después de activar MFA, se almacenan mediante hash y solo pueden utilizarse una vez.

### SecurityEvent

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `id` | UUID | Identificador | Único |
| `accountId` | UUID? | Cuenta relacionada | Nullable |
| `eventType` | String | Tipo de evento | Evento de seguridad |
| `eventAt` | DateTime | Fecha del evento | Automático |
| `ipHash` | String? | Hash de IP | Sin IP en claro |
| `metadata` | String? | Metadatos no sensibles | Sin secretos ni PII innecesaria |

Se registran eventos como inicio de sesión exitoso o fallido, cambios de contraseña, MFA, cambios de rol y desactivación de cuentas.

`accountId` es nullable para permitir conservar eventos de seguridad cuando una cuenta deja de existir.

## 3. Entidades del módulo Clientes

Las siguientes entidades son propiedad exclusiva del módulo Clientes. Su persistencia no se incorpora al esquema Prisma de Identidad.

### ClientProfile

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `id` | UUID | Identificador | Único |
| `fullName` | String | Nombre completo | Mínimo 2 caracteres |
| `email` | String | Correo electrónico | Único y normalizado |
| `phone` | String? | Teléfono | Opcional y validado |
| `preferences` | JSON | Preferencias del cliente | Según funcionalidades |
| `locale` | String | Idioma y región | Por defecto `es-EC` |
| `createdAt` | DateTime | Creación | Automático |
| `updatedAt` | DateTime | Modificación | Automático |

El módulo Clientes administra el correo y los datos personales. Identidad consulta el correo mediante una interfaz pública cuando necesita autenticar una cuenta.

La asociación con Identidad se establece mediante el identificador de cliente, sin compartir tablas.

### ConsentRecord

| Campo | Tipo | Descripción | Reglas |
|---|---|---|---|
| `id` | UUID | Identificador | Único |
| `clientId` | UUID | Cliente asociado | Obligatorio |
| `purpose` | String | Finalidad del tratamiento | Ej. `marketing`, `analytics` |
| `state` | String | Estado | `granted`, `revoked` |
| `effectiveFrom` | DateTime | Inicio | Obligatorio |
| `effectiveTo` | DateTime? | Fin | Nullable |
| `source` | String | Origen | `self-service`, `admin`, `legal` |
| `createdAt` | DateTime | Registro | Automático |

Cada modificación genera un nuevo registro para conservar el historial de consentimientos.

## 4. Privacidad y derechos del titular

El módulo Clientes es propietario de los datos personales y coordina las operaciones correspondientes a los derechos del titular.

Identidad expone las operaciones necesarias para desactivar credenciales, revocar sesiones y participar en el proceso de eliminación o anonimización.

Pedidos expone operaciones para consultar y anonimizar la información personal asociada a los pedidos, conservando los datos que deban mantenerse por obligaciones legales o contables.

La solicitud de privacidad puede coordinarse mediante una interfaz pública o servicio de aplicación, sin que Identidad almacene copias de los datos personales.

Las operaciones contemplan:

- Acceso y exportación de datos.
- Rectificación de información personal.
- Eliminación o anonimización.
- Oposición al tratamiento.
- Portabilidad cuando corresponda.

Las solicitudes deben ser verificadas, registradas y procesadas dentro de los plazos establecidos por la normativa aplicable.

## 5. Relaciones

Las relaciones lógicas entre módulos son:

- Una cuenta de Identidad puede asociarse a un cliente mediante `clientId`.
- Una cuenta tiene varias sesiones.
- Una sesión puede tener varios refresh tokens.
- Una cuenta puede tener varios tokens de confirmación y recuperación.
- Una cuenta tiene como máximo una configuración MFA.
- Una cuenta puede tener varios códigos de recuperación.
- Una cuenta puede tener varios eventos de seguridad.
- Un cliente puede tener varios registros de consentimiento.
- Un cliente puede tener varios pedidos.

No se crean claves foráneas de base de datos entre Identidad, Clientes y Pedidos. La comunicación se realiza mediante interfaces públicas.

## 6. Reglas de validación y seguridad

- Las contraseñas deben tener al menos 12 caracteres.
- Las contraseñas se almacenan con Argon2id.
- Se deben rechazar contraseñas comprometidas.
- El correo se normaliza y valida en Clientes.
- Los intentos de autenticación deben estar limitados mediante rate limiting.
- Las respuestas de registro, inicio de sesión y recuperación deben evitar revelar si un correo está registrado.
- Los roles y permisos se validan en el servidor.
- MFA es obligatorio para staff y admin.
- Los tokens temporales deben expirar y ser de un solo uso.
- Los secretos MFA se cifran antes de almacenarse.
- Los eventos de seguridad no deben guardar contraseñas, tokens ni información bancaria.
- Las operaciones sensibles requieren autenticación y autorización adecuadas.
- La eliminación de una cuenta requiere reautenticación y coordinación entre módulos.

## 7. Estados y transiciones

### Account

- `pending_confirmation` → `active` después de confirmar el correo.
- `active` → `disabled` mediante un proceso administrativo autorizado.
- `disabled` → `active` mediante un proceso autorizado de reactivación.

### ConsentRecord

- `granted` → `revoked` al retirar el consentimiento.
- Cada cambio conserva el historial anterior.

### Solicitudes de privacidad

- `pending` → `processing` → `completed` o `failed`.
- Las solicitudes completadas deben conservar evidencia del procesamiento sin mantener PII innecesaria.

## 8. Cifrado y retención

- Los datos personales se protegen conforme a la política de seguridad y privacidad del proyecto.
- Los secretos MFA se cifran en reposo.
- Las contraseñas, tokens y códigos de recuperación nunca se almacenan en texto claro.
- La retención de información se limita a la finalidad declarada y a las obligaciones legales aplicables.
- La eliminación de un cliente no debe borrar automáticamente información histórica que deba conservarse por obligaciones legales o contables.
- Los pedidos deben anonimizar los datos personales que ya no sean necesarios para su conservación.

## 9. Decisión arquitectónica

La propiedad de la información queda definida de forma explícita:

- Identidad administra autenticación y autorización.
- Clientes administra los datos personales y consentimientos.
- Pedidos administra pedidos e historial.

Esta separación evita duplicación de datos, reduce el acoplamiento y permite que cada módulo evolucione mediante contratos públicos.
