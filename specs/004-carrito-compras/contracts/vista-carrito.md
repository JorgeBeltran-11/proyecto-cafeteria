# Contrato de UI: página `/carrito`

## Contenido

1. Encabezado `h1` "Tu carrito".
2. **PENDIENTE(spec-002)**: campo "Cliente de prueba" (id que se envía en `X-Cliente-Id`). Abrir la misma página con el mismo id en dos navegadores simula dos dispositivos.
3. **PENDIENTE(spec-003)**: sección "Productos de prueba", con un botón "Añadir" por producto.
4. Lista de líneas: nombre, precio unitario, cantidad con botones "−" y "+" y un campo numérico, total de la línea (y el descuento, si lo hay) y botón "Quitar".
5. Avisos, encima de los totales, con su texto completo (p. ej. "El precio de Capuchino cambió de $2,50 a $2,80") y el botón "Aceptar precios nuevos" cuando hay cambios de precio.
6. Resumen: subtotal, descuento y total, en una lista de definiciones (`dl`).
7. Estado de confirmación en texto: "Tu carrito está listo para confirmar el pedido" o "Antes de confirmar, revisa los avisos".
8. Botón "Vaciar carrito".

## Accesibilidad (WCAG 2.2 AAA)

| Comprobación | Cómo |
|---|---|
| Los cambios se anuncian sin mover el foco (FR-009, US1-1, US3-4) | Una región `role="status"` `aria-live="polite"` recibe mensajes como "Capuchino añadido. Total: $5,00" |
| Los avisos se anuncian una sola vez | Solo se anuncian los avisos nuevos respecto a la última lectura |
| Quitar no deja el foco perdido | Tras "Quitar", el foco pasa al botón "Deshacer"; tras "Deshacer", al encabezado del carrito |
| Todos los controles tienen nombre propio | `aria-label` con el producto: "Quitar Capuchino", "Aumentar cantidad de Capuchino" |
| Objetivos táctiles ≥ 44×44 px | Estilos de `button` e `input` de la spec 001 |
| Contraste ≥ 7:1 | Colores de la spec 001 (`#1a1a1a`, `#0b5d1e`, `#8a1111` sobre blanco) |
| Estado con texto, no solo color | Cada aviso tiene texto; "Agotado" se escribe |
| Sin límites de tiempo | "Deshacer" se mantiene hasta la siguiente eliminación |
| Foco visible | Contorno de 3 px en `:focus-visible` |
| Errores que dicen cómo corregirlos | Se muestra el `message` de la API (p. ej. "El máximo por producto es 20 unidades") |

## Prueba manual

1. Solo con teclado: añadir tres productos, cambiar una cantidad, quitar uno, deshacer y vaciar.
2. Con VoiceOver (macOS: Cmd+F5) o NVDA: comprobar que cada cambio se anuncia y que el foco no salta.
3. Abrir `/carrito` con el mismo cliente de prueba en dos navegadores: un cambio en uno aparece en el otro en menos de 5 s.
4. Cambiar el precio de un producto de prueba (ver [quickstart.md](../quickstart.md)) y comprobar el aviso con los dos precios.
