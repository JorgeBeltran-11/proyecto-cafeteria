# Quickstart: módulo de identidad y clientes

## Requisitos locales

- Node.js 22 LTS
- pnpm 10
- SQLite para desarrollo local
- opcional: un servicio SMTP o mock para confirmar correo y restablecer contraseñas

## Requisitos de integración y producción

- PostgreSQL 16 para producción o pruebas de integración con entorno real
- Redis opcional si se activa caché o sesiones centralizadas
- proveedor SMTP o correo real para la parte de email
- no se asume que estas dependencias estén configuradas en la máquina del desarrollador

## Variables de entorno en PowerShell

### Desarrollo local con SQLite

```powershell
$env:DATABASE_URL = "file:./dev.db"
$env:PORT = "3001"
$env:WEB_ORIGIN = "http://localhost:3000"
$env:NODE_ENV = "development"
```

### Producción o integración con PostgreSQL

```powershell
$env:DATABASE_URL = "postgresql://usuario:password@localhost:5432/cafeteria"
$env:PORT = "3001"
$env:WEB_ORIGIN = "https://tu-frontend.example.com"
$env:NODE_ENV = "production"
```

## Instalación local

```powershell
pnpm install
if (-not (Test-Path "apps/api/.env")) { Copy-Item apps/api/.env.example apps/api/.env } else { Write-Host "El archivo apps/api/.env ya existe; se conserva." }
```

## Arranque

```powershell
pnpm dev
```
## Validación de flujo principal

1. Registrar una cuenta nueva mediante el endpoint público de autenticación.
2. Verificar que el registro coordine la creación del cliente mediante la interfaz pública de Clientes.
3. Confirmar el correo electrónico mediante un token de un solo uso.
4. Iniciar sesión con credenciales válidas.
5. Probar credenciales incorrectas y verificar las restricciones de intentos.
6. Recuperar la contraseña mediante un enlace temporal de un solo uso.
7. Configurar MFA TOTP para una cuenta de personal o administrador.
8. Consultar y actualizar el perfil mediante la interfaz pública de Clientes.
9. Consultar el historial mediante la interfaz pública de Pedidos.
10. Solicitar la exportación de datos coordinando Clientes, Identidad y Pedidos.
11. Solicitar la eliminación o anonimización de datos con reautenticación y revocación de sesiones.

## Notas de arquitectura

- Identidad administra credenciales, autenticación, roles, sesiones y MFA.
- Clientes administra correos electrónicos, nombres, teléfonos, preferencias y consentimientos.
- Pedidos administra pedidos e historial de compras.
- Identidad no debe almacenar copias de datos personales ni acceder directamente a tablas de otros módulos.
- Si una interfaz de Clientes o Pedidos todavía no existe, debe implementarse un contrato o adaptador pendiente de integración. No se debe simular una integración real.
- Las respuestas públicas no deben revelar si una cuenta existe.
- El sistema debe proporcionar mensajes accesibles y comprensibles ante errores.
- El funcionamiento local no debe depender obligatoriamente de Redis, PostgreSQL externo o un servicio SMTP real.

## Criterio de salida

La funcionalidad se considera terminada cuando los flujos implementados están cubiertos por pruebas y cumplen los requisitos de seguridad, accesibilidad, separación de responsabilidades y protección de datos personales.
