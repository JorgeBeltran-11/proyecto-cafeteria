# Contrato de UI: página de inicio (`apps/web`, ruta `/`)

## Comportamiento

1. Al cargar, muestra el título "Proyecto cafetería" (`<h1>`) y la región de estado con "Comprobando el estado de la API…".
2. Llama a `GET {NEXT_PUBLIC_API_URL}/health` desde el navegador, con timeout de 3 s.
3. Muestra uno de estos resultados (ver estados en [data-model.md](../data-model.md)):

| Respuesta de la API | Texto en la región de estado |
|---------------------|------------------------------|
| 200, `database: ok` | **API en línea** · **Base de datos conectada** |
| 503, `database: error` | **API en línea** · **Base de datos no disponible** |
| Error de red, timeout o cuerpo no reconocido | **API no disponible.** Comprueba que la API está en ejecución (`pnpm dev`) y pulsa Reintentar. |

4. Un botón **Reintentar** repite la comprobación. Nunca se muestra una pantalla en blanco ni un error de Next.js (FR-013).
5. Si `NEXT_PUBLIC_API_URL` no está definida, se usa `http://localhost:3001`.

## Requisitos de accesibilidad (FR-015, principio I)

- [ ] `<html lang="es">`.
- [ ] La región de estado es `<div role="status" aria-live="polite">`; el texto cambia dentro de ella para que el lector de pantalla lo anuncie.
- [ ] El estado se comunica con texto; el color (o un icono, si lo hay, con `aria-hidden="true"`) es solo un refuerzo.
- [ ] Contraste de todo el texto ≥ 7:1 contra su fondo (p. ej. texto `#1a1a1a` sobre `#ffffff`; verde `#0b5d1e` y rojo `#8a1111` sobre blanco), en modo claro y oscuro si se implementa.
- [ ] El botón "Reintentar" es un `<button>`, alcanzable con Tab, con foco visible (contorno ≥ 2 px con contraste ≥ 3:1) y tamaño ≥ 44×44 px.
- [ ] Sin animaciones ni transiciones (o desactivadas con `prefers-reduced-motion: reduce`).
- [ ] Lenguaje claro: los mensajes de error dicen qué hacer.

## Verificación manual (sustituye a axe/Playwright mientras estén diferidos)

1. Con API y BD bien → texto "Base de datos conectada".
2. Con la BD sin preparar (borrar `dev.db` y arrancar la API) → "Base de datos no disponible".
3. Con la API detenida → "API no disponible".
4. Navegar solo con teclado y comprobar el foco del botón.
5. Con NVDA (Windows) o VoiceOver (macOS), pulsar Reintentar y comprobar que se anuncia el nuevo estado.
