# Data Model: Menú dinámico

Tablas del módulo `catalogo` (propiedad exclusiva, constitución V), tipos compartidos y reglas. Importes en **centavos enteros**.

## Tablas (Prisma, `apps/api/prisma/schema.prisma`)

### `Producto`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String` PK | Lo elige el administrador: `^[a-z0-9-]{1,64}$` (p. ej. `capuchino`). Es el id que usan la web y el carrito |
| `nombre` | `String` | 1–80 caracteres |
| `descripcion` | `String` | 0–500 caracteres |
| `precioCentavos` | `Int` | Entero 0–1 000 000 |
| `imagenUrl` | `String?` | `https://…` o ruta `/…`, máx. 500 |
| `imagenAlt` | `String?` | Texto alternativo, máx. 200. Obligatorio para publicar |
| `alergenos` | `String?` | JSON `Alergeno[]`. `null` = sin declarar (bloquea la publicación); `[]` = sin alérgenos |
| `agotado` | `Boolean` | Lo cambia el personal |
| `existencias` | `Int?` | `null` = no controla existencias. Al llegar a 0 el producto cuenta como agotado |
| `retirado` | `Boolean` | El administrador lo retira: desaparece de la tienda aunque esté en una versión publicada |
| `revision` | `Int` | Bloqueo optimista (FR-011) |
| `creadoEn` / `actualizadoEn` | `DateTime` | |

### `Menu`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String` PK (`cuid`) | |
| `estado` | `String` | `borrador` (nunca publicado), `publicado` (la tienda lo muestra) o `retirado` |
| `borrador` | `String` | JSON `{ nombre, horario, categorias: [{ nombre, productoIds }] }` |
| `versionPublicada` | `Int?` | Número de la versión que ve la tienda |
| `revision` | `Int` | Bloqueo optimista |
| `creadoEn` / `actualizadoEn` | `DateTime` | |

### `VersionMenu` (inmutable)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String` PK | |
| `menuId` | `String` FK → `Menu` | Único con `numero` |
| `numero` | `Int` | 1, 2, 3… por menú |
| `contenido` | `String` | JSON `ContenidoVersion` (abajo) |
| `cambios` | `String` | JSON `string[]`: resumen legible respecto a la versión anterior |
| `publicadaPor` | `String` | Id del usuario (spec 002) |
| `publicadaEn` | `DateTime` | |
| `restauradaDe` | `Int?` | Si es una restauración, la versión de origen |

```ts
interface ContenidoVersion {
  nombre: string;
  horario: FranjaHoraria[] | null;
  categorias: {
    nombre: string;
    productos: {
      id: string; nombre: string; descripcion: string; precioCentavos: number;
      imagenUrl: string | null; imagenAlt: string | null; alergenos: Alergeno[];
    }[];
  }[];
}
```

### `CambioCatalogo` (auditoría del módulo, FR-012)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String` PK | |
| `entidad` | `String` | `producto` o `menu` |
| `entidadId` | `String` | Índice junto con `entidad` |
| `accion` | `String` | `crear`, `editar`, `publicar`, `retirar`, `restaurar`, `disponibilidad` |
| `usuarioId` | `String` | Quién lo hizo |
| `detalle` | `String` | JSON con los campos cambiados (`{ campo: [antes, después] }`) o el resumen |
| `fecha` | `DateTime` | |

## Tipos compartidos (`packages/shared/src/catalogo.ts`)

`CartaPublica` → `MenuPublico[]` → `CategoriaPublica[]` → `ProductoPublico`, y para administración `ProductoAdmin`, `MenuAdmin`, `VersionMenuResumen` y `DisponibilidadVista`.

## Alérgenos

Lista cerrada de 14 (`dominio/alergenos.ts`): gluten, crustáceos, huevo, pescado, maní, soya, leche, frutos de cáscara, apio, mostaza, sésamo, sulfitos, altramuces y moluscos. **Pendiente**: validarla contra el reglamento de etiquetado de Ecuador.

## Reglas

### Disponibilidad de un producto en la tienda

1. Retirado → no se muestra.
2. `agotado` o `existencias === 0` → `agotado`, texto "Agotado", no se puede pedir.
3. Su menú fuera de horario → `fuera_de_horario`, texto "Disponible desde <próxima apertura>", no se puede pedir.
4. En otro caso → `disponible`; si quedan ≤ 5 existencias, el texto lo indica ("Disponible: quedan 3").

### Carta pública

- Solo menús `publicado`, con su versión publicada. Primero los disponibles ahora, luego por nombre.
- Filtro `excluir`: se ocultan los productos que contienen alguno de esos alérgenos; las categorías que quedan vacías no se muestran.
- Un producto aparece una sola vez por nombre de categoría aunque esté en dos menús vigentes (edge case de solape).

### Para publicar (FR-004)

El borrador se rechaza (`422`) con la lista de problemas si: el nombre está vacío; no tiene ningún producto; un producto no existe o está retirado; un producto no tiene imagen o texto alternativo; un producto no tiene alérgenos declarados; un producto se repite dentro de la misma categoría.

### Resumen de cambios (FR-005)

Comparando con la versión anterior: nombre, horario, categorías añadidas o quitadas, productos añadidos o quitados, y cambios de precio ("Capuchino: $2,50 → $2,75"), descripción, imagen o alérgenos. La primera versión dice "Primera publicación".

### Existencias (US4-2)

`descontarExistencias(productoId, cantidad)`: si el producto controla existencias, resta en una actualización condicional (`existencias >= cantidad`); si no alcanzan, error `sin_existencias`. Al llegar a 0 queda agotado.

## Transiciones del menú

```text
borrador ──publicar──▶ publicado ──retirar──▶ retirado
                         ▲  │                    │
                         │  └──publicar (nueva versión)
                         └──────publicar / restaurar──┘
```
