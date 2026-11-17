import type { CarritoVista, CartaPublica } from "@cafeteria/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TIMEOUT_MS = 5000;

/** Producto de la carta publicada (spec 003), con lo que el carrito necesita para ofrecerlo. */
export interface ProductoDelMenu {
  id: string;
  nombre: string;
  precioCentavos: number;
  /** Texto de la disponibilidad que da el catálogo, p. ej. "Agotado" o "Disponible desde las 07:00". */
  textoDisponibilidad: string;
  /** Se puede añadir si no está agotado; fuera de horario sí se puede (research R9 de la spec 004). */
  sePuedeAnadir: boolean;
}

function esCarta(valor: unknown): valor is CartaPublica {
  return (
    typeof valor === "object" &&
    valor !== null &&
    Array.isArray((valor as Record<string, unknown>).menus)
  );
}

/** Aplana los menús publicados en una lista sin productos repetidos. */
function productosDe(carta: CartaPublica): ProductoDelMenu[] {
  const vistos = new Map<string, ProductoDelMenu>();
  for (const menu of carta.menus) {
    for (const categoria of menu.categorias) {
      for (const p of categoria.productos) {
        if (vistos.has(p.id)) continue;
        vistos.set(p.id, {
          id: p.id,
          nombre: p.nombre,
          precioCentavos: p.precioCentavos,
          textoDisponibilidad: p.textoDisponibilidad,
          sePuedeAnadir: p.disponibilidad !== "agotado",
        });
      }
    }
  }
  return [...vistos.values()];
}

/** Error con un mensaje listo para mostrar al cliente. */
export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    readonly status: number,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
}

function esCarritoVista(valor: unknown): valor is CarritoVista {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Record<string, unknown>;
  return (
    Array.isArray(v.lineas) &&
    Array.isArray(v.avisos) &&
    typeof v.totalCentavos === "number" &&
    typeof v.sePuedeConfirmar === "boolean"
  );
}

function mensajeDe(cuerpo: unknown): string | null {
  if (typeof cuerpo === "object" && cuerpo !== null) {
    const mensaje = (cuerpo as Record<string, unknown>).message;
    if (typeof mensaje === "string") return mensaje;
  }
  return null;
}

async function llamar(
  ruta: string,
  opciones: { metodo?: string; clienteId?: string; cuerpo?: unknown } = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const cabeceras: Record<string, string> = {};
  // PENDIENTE(spec-002): sustituir por la sesión real (cookie con credentials: "include").
  if (opciones.clienteId) cabeceras["X-Cliente-Id"] = opciones.clienteId;
  if (opciones.cuerpo !== undefined) cabeceras["Content-Type"] = "application/json";

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method: opciones.metodo ?? "GET",
      headers: cabeceras,
      body: opciones.cuerpo === undefined ? undefined : JSON.stringify(opciones.cuerpo),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch {
    throw new ErrorApi(
      "No se pudo conectar con la API. Comprueba que está en ejecución (pnpm dev) y pulsa Reintentar.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  const cuerpo: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    throw new ErrorApi(
      mensajeDe(cuerpo) ?? `La API respondió con un error (${respuesta.status}).`,
      respuesta.status,
    );
  }
  return cuerpo;
}

async function carrito(
  ruta: string,
  clienteId: string,
  metodo = "GET",
  cuerpo?: unknown,
): Promise<CarritoVista> {
  const datos = await llamar(ruta, { metodo, clienteId, cuerpo });
  if (!esCarritoVista(datos)) {
    throw new ErrorApi("La API devolvió una respuesta inesperada.", 0);
  }
  return datos;
}

export const apiCarrito = {
  ver: (clienteId: string) => carrito("/carrito", clienteId),
  anadir: (clienteId: string, productoId: string, cantidad = 1) =>
    carrito("/carrito/lineas", clienteId, "POST", { productoId, cantidad }),
  cambiarCantidad: (clienteId: string, productoId: string, cantidad: number) =>
    carrito(`/carrito/lineas/${encodeURIComponent(productoId)}`, clienteId, "PUT", {
      cantidad,
    }),
  quitar: (clienteId: string, productoId: string) =>
    carrito(`/carrito/lineas/${encodeURIComponent(productoId)}`, clienteId, "DELETE"),
  vaciar: (clienteId: string) => carrito("/carrito", clienteId, "DELETE"),
  aceptarPrecios: (clienteId: string) =>
    carrito("/carrito/aceptar-precios", clienteId, "POST"),

  /** Productos de la carta publicada por el catálogo (spec 003). */
  async productosDelMenu(): Promise<ProductoDelMenu[]> {
    const datos = await llamar("/catalogo/menu");
    return esCarta(datos) ? productosDe(datos) : [];
  },
};

const formato = new Intl.NumberFormat("es-EC", {
  style: "currency",
  currency: "USD",
});

/** Solo para mostrar: los cálculos los hace siempre la API (FR-005). */
export function dinero(centavos: number): string {
  return formato.format(centavos / 100);
}
