import type {
  Alergeno,
  AlergenoVista,
  CartaPublica,
  DisponibilidadVista,
} from "@cafeteria/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const TIMEOUT_MS = 5000;

/** Error con un mensaje listo para mostrar. */
export class ErrorApi extends Error {
  constructor(
    mensaje: string,
    readonly status: number,
  ) {
    super(mensaje);
    this.name = "ErrorApi";
  }
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
  opciones: { metodo?: string; cabeceras?: Record<string, string>; cuerpo?: unknown } = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const cabeceras: Record<string, string> = { ...opciones.cabeceras };
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

function esCarta(valor: unknown): valor is CartaPublica {
  if (typeof valor !== "object" || valor === null) return false;
  const v = valor as Record<string, unknown>;
  return Array.isArray(v.menus) && Array.isArray(v.excluidos);
}

export const apiMenu = {
  async carta(excluir: readonly Alergeno[]): Promise<CartaPublica> {
    const consulta = excluir.length > 0 ? `?excluir=${excluir.join(",")}` : "";
    const datos = await llamar(`/catalogo/menu${consulta}`);
    if (!esCarta(datos)) throw new ErrorApi("La API devolvió una respuesta inesperada.", 0);
    return datos;
  },

  async alergenos(): Promise<AlergenoVista[]> {
    const datos = await llamar("/catalogo/alergenos");
    return Array.isArray(datos) ? (datos as AlergenoVista[]) : [];
  },
};

/** PENDIENTE(spec-002): cabeceras provisionales del personal hasta que exista el inicio de sesión. */
function cabecerasPersonal(usuarioId: string): Record<string, string> {
  return { "X-Rol": "personal", "X-Usuario-Id": usuarioId };
}

export const apiDisponibilidad = {
  async listar(usuarioId: string): Promise<DisponibilidadVista[]> {
    const datos = await llamar("/catalogo/disponibilidad", {
      cabeceras: cabecerasPersonal(usuarioId),
    });
    return Array.isArray(datos) ? (datos as DisponibilidadVista[]) : [];
  },

  async cambiar(
    usuarioId: string,
    productoId: string,
    cambios: { agotado?: boolean; existencias?: number | null },
  ): Promise<DisponibilidadVista> {
    return (await llamar(`/catalogo/disponibilidad/${encodeURIComponent(productoId)}`, {
      metodo: "PUT",
      cabeceras: cabecerasPersonal(usuarioId),
      cuerpo: cambios,
    })) as DisponibilidadVista;
  },
};

const formato = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

/** Solo para mostrar: los precios los calcula siempre la API. */
export function dinero(centavos: number): string {
  return formato.format(centavos / 100);
}
