# Quickstart: probar el carrito

Requisitos: el proyecto levantado según el `README.md` raíz.

```bash
git switch feature/spec-4
pnpm install
pnpm db:setup        # aplica las migraciones (carrito y catálogo)
# En apps/api/.env, CATALOGO_DATOS_DEMO=true carga el menú de ejemplo de la spec 003
pnpm dev
```

## 1. Tests automáticos

```bash
pnpm lint && pnpm test && pnpm build
```

Solo los del carrito:

```bash
pnpm --filter api exec jest modules/carrito
pnpm --filter api exec jest --config test/jest-e2e.json carrito
```

## 2. En el navegador

1. Abrir <http://localhost:3000/carrito>.
2. Dejar el cliente de prueba `cliente-demo` y añadir varios productos desde "Añadir del menú".
3. Abrir la misma URL en otro navegador (o en una ventana privada) con el mismo cliente: el carrito es el mismo.

## 3. Con curl (bash o Git Bash; en PowerShell usar `curl.exe`)

```bash
API=http://localhost:3001
H='X-Cliente-Id: cliente-demo'

curl -s $API/catalogo/menu            # productos de la carta publicada
curl -s -X POST $API/carrito/lineas -H "$H" -H 'Content-Type: application/json' \
  -d '{"productoId":"capuchino","cantidad":2}'
curl -s $API/carrito -H "$H"

# Probar US3: el personal agota un producto (spec 003)
curl -s -X PUT $API/catalogo/disponibilidad/capuchino \
  -H 'X-Rol: personal' -H 'X-Usuario-Id: personal-demo' \
  -H 'Content-Type: application/json' -d '{"agotado":true}'
curl -s $API/carrito -H "$H"            # aviso agotado, sePuedeConfirmar: false

# Límite de existencias: el croissant tiene 5
curl -s -X POST $API/carrito/lineas -H "$H" -H 'Content-Type: application/json' \
  -d '{"productoId":"croissant","cantidad":9}'   # se aplica 5 y la respuesta trae "ajuste"
```

Los productos salen del catálogo de la spec 003; con `CATALOGO_DATOS_DEMO=true` se carga su menú de ejemplo (mismos ids que arriba).

## Resultado esperado

| Comprobación | Resultado |
|---|---|
| Añadir el mismo producto dos veces | Una sola línea con la cantidad sumada |
| Cantidad 0 | La línea desaparece |
| Cantidad negativa o decimal | 400 con mensaje en español |
| Producto agotado | 409 "… está agotado" |
| Sin cabecera `X-Cliente-Id` | 401 |
| Precio cambiado | Aviso con precio anterior y nuevo; total con el precio nuevo |
