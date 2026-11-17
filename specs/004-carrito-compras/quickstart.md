# Quickstart: probar el carrito

Requisitos: el proyecto levantado según el `README.md` raíz.

```bash
git switch feature/spec-4
pnpm install
pnpm db:setup        # aplica la migración 1_carrito
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
2. Dejar el cliente de prueba `cliente-demo` y añadir varios productos.
3. Abrir la misma URL en otro navegador (o en una ventana privada) con el mismo cliente: el carrito es el mismo.

## 3. Con curl (bash o Git Bash; en PowerShell usar `curl.exe`)

```bash
API=http://localhost:3001
H='X-Cliente-Id: cliente-demo'

curl -s $API/catalogo-provisional/productos
curl -s -X POST $API/carrito/lineas -H "$H" -H 'Content-Type: application/json' \
  -d '{"productoId":"capuchino","cantidad":2}'
curl -s $API/carrito -H "$H"

# Probar US3: cambiar el precio y agotar un producto
curl -s -X PATCH $API/catalogo-provisional/productos/capuchino \
  -H 'Content-Type: application/json' -d '{"precioCentavos":280}'
curl -s $API/carrito -H "$H"            # aviso cambio_de_precio, sePuedeConfirmar: false
curl -s -X POST $API/carrito/aceptar-precios -H "$H"

# Límite de existencias: el croissant tiene 5
curl -s -X POST $API/carrito/lineas -H "$H" -H 'Content-Type: application/json' \
  -d '{"productoId":"croissant","cantidad":9}'   # se aplica 5 y la respuesta trae "ajuste"
```

Los productos de prueba viven en memoria: se reinician al reiniciar la API.

## Resultado esperado

| Comprobación | Resultado |
|---|---|
| Añadir el mismo producto dos veces | Una sola línea con la cantidad sumada |
| Cantidad 0 | La línea desaparece |
| Cantidad negativa o decimal | 400 con mensaje en español |
| Producto agotado | 409 "… está agotado" |
| Sin cabecera `X-Cliente-Id` | 401 |
| Precio cambiado | Aviso con precio anterior y nuevo; total con el precio nuevo |
