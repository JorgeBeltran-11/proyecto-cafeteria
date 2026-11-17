# Quickstart: Menú dinámico

Cómo probar la spec 003 de punta a punta. Requiere el proyecto levantado según el `README.md` raíz (`pnpm install`, `.env`, `pnpm db:setup`, `pnpm dev`).

## 1. Menú de ejemplo

Con `CATALOGO_DATOS_DEMO=true` en `apps/api/.env` (viene así en `.env.example`), la API crea al arrancar, si no hay menús, la **Carta de la casa** (siempre disponible) y **Desayunos** (07:00–11:00). El jugo de naranja aparece agotado.

Abre <http://localhost:3000/menu> y comprueba (US1):

- Categorías con enlaces, precio, imagen con texto alternativo, alérgenos y disponibilidad **en texto**.
- "Jugo de naranja: Agotado". Fuera de 07:00–11:00, Desayunos dice cuándo vuelve a estar disponible.
- "Filtrar por alérgenos" → marca *Leche*: desaparecen capuchino, croissant y desayuno andino, y se anuncia cuántos productos quedan.
- Todo funciona solo con teclado (Tab, Enter, Espacio).

## 2. Crear y publicar un menú (US2) — PowerShell

```powershell
$api = "http://localhost:3001"
$admin = @{ "X-Rol" = "admin"; "X-Usuario-Id" = "ana-admin" }

# Producto sin texto alternativo ni alérgenos
Invoke-RestMethod -Method Post "$api/catalogo/admin/productos" -Headers $admin -ContentType "application/json" `
  -Body '{"id":"te-verde","nombre":"Té verde","precioCentavos":175,"imagenUrl":"/menu/taza.svg"}'

# Menú en borrador: no aparece en /menu
$menu = Invoke-RestMethod -Method Post "$api/catalogo/admin/menus" -Headers $admin -ContentType "application/json" `
  -Body '{"nombre":"Tardes","categorias":[{"nombre":"Tés","productoIds":["te-verde"]}]}'

# Publicar → 422 con la lista de lo que falta
Invoke-RestMethod -Method Post "$api/catalogo/admin/menus/$($menu.id)/publicar" -Headers $admin `
  -ContentType "application/json" -Body (@{ revision = $menu.revision } | ConvertTo-Json)

# Completar el producto y publicar
$te = Invoke-RestMethod "$api/catalogo/admin/productos/te-verde" -Headers $admin
Invoke-RestMethod -Method Put "$api/catalogo/admin/productos/te-verde" -Headers $admin -ContentType "application/json" `
  -Body (@{ revision = $te.revision; imagenAlt = "Taza de té verde"; alergenos = @() } | ConvertTo-Json)
$menu = Invoke-RestMethod -Method Post "$api/catalogo/admin/menus/$($menu.id)/publicar" -Headers $admin `
  -ContentType "application/json" -Body (@{ revision = $menu.revision } | ConvertTo-Json)
```

Recarga `/menu`: aparece **Tardes**. Vista previa de un borrador: `GET $api/catalogo/admin/menus/<id>/vista-previa`.

## 3. Versiones y restauración (US3)

```powershell
$te = Invoke-RestMethod "$api/catalogo/admin/productos/te-verde" -Headers $admin
Invoke-RestMethod -Method Put "$api/catalogo/admin/productos/te-verde" -Headers $admin -ContentType "application/json" `
  -Body (@{ revision = $te.revision; precioCentavos = 200 } | ConvertTo-Json)
# La tienda sigue en $1,75 hasta publicar:
$menu = Invoke-RestMethod -Method Post "$api/catalogo/admin/menus/$($menu.id)/publicar" -Headers $admin `
  -ContentType "application/json" -Body (@{ revision = $menu.revision } | ConvertTo-Json)
Invoke-RestMethod "$api/catalogo/admin/menus/$($menu.id)/versiones" -Headers $admin   # quién, cuándo y qué cambió
Invoke-RestMethod -Method Post "$api/catalogo/admin/menus/$($menu.id)/versiones/1/restaurar" -Headers $admin
```

Conflicto (FR-011): envía dos `PUT /catalogo/admin/menus/<id>` con la misma `revision`; el segundo responde **409**.

## 4. Disponibilidad del personal (US4)

Abre <http://localhost:3000/personal/disponibilidad>, marca el croissant como agotado y recarga `/menu`: aparece "Agotado". Un `PUT /catalogo/admin/productos/...` con `X-Rol: personal` responde **403**.

## 5. Tests

```powershell
pnpm --filter api exec jest modules/catalogo
pnpm --filter api exec jest --config test/jest-e2e.json catalogo
```
