/**
 * Validación de la entrada HTTP del catálogo. Los mensajes dicen cómo corregir el error.
 */
import type {
  Alergeno,
  CategoriaBorrador,
  DiaSemana,
  FranjaHoraria,
  Horario,
} from '@cafeteria/shared';
import { esAlergeno } from './dominio/alergenos';
import { ErrorCatalogo } from './dominio/errores';
import { aMinutos } from './dominio/horario';

const FORMATO_PRODUCTO_ID = /^[a-z0-9-]{1,64}$/;
const FORMATO_MENU_ID = /^[A-Za-z0-9_-]{1,64}$/;
const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const PRECIO_MAXIMO = 1_000_000;
const EXISTENCIAS_MAXIMAS = 100_000;
const MAX_CATEGORIAS = 30;
const MAX_PRODUCTOS_POR_CATEGORIA = 100;
const MAX_FRANJAS = 14;

export interface DatosProducto {
  nombre: string;
  descripcion: string;
  precioCentavos: number;
  imagenUrl: string | null;
  imagenAlt: string | null;
  alergenos: Alergeno[] | null;
  existencias: number | null;
  retirado: boolean;
}

export interface ProductoNuevo extends Omit<DatosProducto, 'retirado'> {
  id: string;
}

export interface CambiosMenu {
  nombre?: string;
  horario?: Horario;
  categorias?: CategoriaBorrador[];
}

export interface CambiosDisponibilidad {
  agotado?: boolean;
  existencias?: number | null;
}

function invalida(mensaje: string): ErrorCatalogo {
  return new ErrorCatalogo('entrada_invalida', mensaje);
}

export function leerObjeto(cuerpo: unknown): Record<string, unknown> {
  if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
    throw invalida('El cuerpo de la petición debe ser un objeto JSON.');
  }
  return cuerpo as Record<string, unknown>;
}

export function validarProductoId(valor: unknown): string {
  if (typeof valor !== 'string' || !FORMATO_PRODUCTO_ID.test(valor)) {
    throw invalida(
      'El id del producto debe tener de 1 a 64 caracteres: minúsculas, números o "-" (p. ej. "cafe-americano").',
    );
  }
  return valor;
}

export function validarMenuId(valor: unknown): string {
  if (typeof valor !== 'string' || !FORMATO_MENU_ID.test(valor)) {
    throw invalida('El id del menú no tiene un formato válido.');
  }
  return valor;
}

function entero(valor: unknown, campo: string, minimo: number, maximo: number): number {
  if (
    typeof valor !== 'number' ||
    !Number.isInteger(valor) ||
    valor < minimo ||
    valor > maximo
  ) {
    throw invalida(`${campo} debe ser un número entero entre ${minimo} y ${maximo}.`);
  }
  return valor;
}

export function validarRevision(valor: unknown): number {
  if (valor === undefined) {
    throw invalida(
      'Falta revision: envía la revisión que leíste para no sobrescribir cambios de otra persona.',
    );
  }
  return entero(valor, 'revision', 1, Number.MAX_SAFE_INTEGER);
}

/** Número de versión que llega en la ruta como texto. */
export function validarNumeroVersion(valor: string): number {
  if (!/^\d{1,9}$/.test(valor) || Number(valor) < 1) {
    throw invalida('El número de versión debe ser un entero mayor que 0.');
  }
  return Number(valor);
}

function texto(
  valor: unknown,
  campo: string,
  minimo: number,
  maximo: number,
): string {
  if (typeof valor !== 'string') throw invalida(`${campo} debe ser un texto.`);
  const limpio = valor.trim();
  if (limpio.length < minimo || limpio.length > maximo) {
    throw invalida(`${campo} debe tener entre ${minimo} y ${maximo} caracteres.`);
  }
  return limpio;
}

function textoOpcional(valor: unknown, campo: string, maximo: number): string | null {
  if (valor === null) return null;
  const limpio = texto(valor, campo, 0, maximo);
  return limpio === '' ? null : limpio;
}

/** Solo `https://…` o rutas del propio sitio (`/menu/cafe.svg`): nunca `javascript:` ni `data:`. */
function urlImagen(valor: unknown): string | null {
  const url = textoOpcional(valor, 'imagenUrl', 500);
  if (url === null) return null;
  const esRuta = url.startsWith('/') && !url.startsWith('//');
  let esHttps = false;
  if (!esRuta) {
    try {
      esHttps = new URL(url).protocol === 'https:';
    } catch {
      esHttps = false;
    }
  }
  if (!esRuta && !esHttps) {
    throw invalida('imagenUrl debe empezar por "https://" o ser una ruta del sitio que empiece por "/".');
  }
  return url;
}

function alergenos(valor: unknown): Alergeno[] | null {
  if (valor === null) return null;
  if (!Array.isArray(valor) || !valor.every(esAlergeno)) {
    throw invalida(
      'alergenos debe ser una lista de códigos de GET /catalogo/alergenos (vacía si no tiene), o null si aún no se conocen.',
    );
  }
  return [...new Set(valor)];
}

function existencias(valor: unknown): number | null {
  if (valor === null) return null;
  return entero(valor, 'existencias', 0, EXISTENCIAS_MAXIMAS);
}

function booleano(valor: unknown, campo: string): boolean {
  if (typeof valor !== 'boolean') throw invalida(`${campo} debe ser true o false.`);
  return valor;
}

export function leerProductoNuevo(cuerpo: unknown): ProductoNuevo {
  const d = leerObjeto(cuerpo);
  return {
    id: validarProductoId(d.id),
    nombre: texto(d.nombre, 'nombre', 1, 80),
    descripcion: d.descripcion === undefined ? '' : texto(d.descripcion, 'descripcion', 0, 500),
    precioCentavos: entero(d.precioCentavos, 'precioCentavos', 0, PRECIO_MAXIMO),
    imagenUrl: d.imagenUrl === undefined ? null : urlImagen(d.imagenUrl),
    imagenAlt: d.imagenAlt === undefined ? null : textoOpcional(d.imagenAlt, 'imagenAlt', 200),
    alergenos: d.alergenos === undefined ? null : alergenos(d.alergenos),
    existencias: d.existencias === undefined ? null : existencias(d.existencias),
  };
}

/** Cambios de un producto: solo los campos presentes en el cuerpo. */
export function leerCambiosProducto(cuerpo: unknown): {
  revision: number;
  cambios: Partial<DatosProducto>;
} {
  const d = leerObjeto(cuerpo);
  const cambios: Partial<DatosProducto> = {};
  if (d.nombre !== undefined) cambios.nombre = texto(d.nombre, 'nombre', 1, 80);
  if (d.descripcion !== undefined) cambios.descripcion = texto(d.descripcion, 'descripcion', 0, 500);
  if (d.precioCentavos !== undefined) {
    cambios.precioCentavos = entero(d.precioCentavos, 'precioCentavos', 0, PRECIO_MAXIMO);
  }
  if (d.imagenUrl !== undefined) cambios.imagenUrl = urlImagen(d.imagenUrl);
  if (d.imagenAlt !== undefined) cambios.imagenAlt = textoOpcional(d.imagenAlt, 'imagenAlt', 200);
  if (d.alergenos !== undefined) cambios.alergenos = alergenos(d.alergenos);
  if (d.existencias !== undefined) cambios.existencias = existencias(d.existencias);
  if (d.retirado !== undefined) cambios.retirado = booleano(d.retirado, 'retirado');
  return { revision: validarRevision(d.revision), cambios };
}

function franja(valor: unknown): FranjaHoraria {
  const f = leerObjeto(valor);
  if (
    !Array.isArray(f.dias) ||
    f.dias.length === 0 ||
    !f.dias.every((d) => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 7)
  ) {
    throw invalida('Cada franja necesita "dias": una lista de números del 1 (lunes) al 7 (domingo).');
  }
  if (typeof f.desde !== 'string' || !FORMATO_HORA.test(f.desde) ||
      typeof f.hasta !== 'string' || !FORMATO_HORA.test(f.hasta)) {
    throw invalida('Cada franja necesita "desde" y "hasta" en formato HH:MM de 24 horas.');
  }
  if (aMinutos(f.desde) >= aMinutos(f.hasta)) {
    throw invalida(
      '"desde" debe ser anterior a "hasta". Para un horario que cruza la medianoche, usa dos franjas.',
    );
  }
  const dias = [...new Set(f.dias as number[])].sort((a, b) => a - b) as DiaSemana[];
  return { dias, desde: f.desde, hasta: f.hasta };
}

export function leerHorario(valor: unknown): Horario {
  if (valor === null) return null;
  if (!Array.isArray(valor) || valor.length === 0 || valor.length > MAX_FRANJAS) {
    throw invalida(
      `horario debe ser null (siempre disponible) o una lista de 1 a ${MAX_FRANJAS} franjas.`,
    );
  }
  return valor.map(franja);
}

export function leerCategorias(valor: unknown): CategoriaBorrador[] {
  if (!Array.isArray(valor) || valor.length > MAX_CATEGORIAS) {
    throw invalida(`categorias debe ser una lista de hasta ${MAX_CATEGORIAS} categorías.`);
  }
  return valor.map((c) => {
    const cat = leerObjeto(c);
    const nombre = texto(cat.nombre, 'El nombre de la categoría', 1, 60);
    if (!Array.isArray(cat.productoIds) || cat.productoIds.length > MAX_PRODUCTOS_POR_CATEGORIA) {
      throw invalida(
        `productoIds de "${nombre}" debe ser una lista de hasta ${MAX_PRODUCTOS_POR_CATEGORIA} ids.`,
      );
    }
    return { nombre, productoIds: cat.productoIds.map(validarProductoId) };
  });
}

export function leerMenuNuevo(cuerpo: unknown): Required<CambiosMenu> {
  const d = leerObjeto(cuerpo);
  return {
    nombre: texto(d.nombre, 'nombre', 1, 80),
    horario: d.horario === undefined ? null : leerHorario(d.horario),
    categorias: d.categorias === undefined ? [] : leerCategorias(d.categorias),
  };
}

export function leerCambiosMenu(cuerpo: unknown): { revision: number; cambios: CambiosMenu } {
  const d = leerObjeto(cuerpo);
  const cambios: CambiosMenu = {};
  if (d.nombre !== undefined) cambios.nombre = texto(d.nombre, 'nombre', 1, 80);
  if (d.horario !== undefined) cambios.horario = leerHorario(d.horario);
  if (d.categorias !== undefined) cambios.categorias = leerCategorias(d.categorias);
  return { revision: validarRevision(d.revision), cambios };
}

export function leerDisponibilidad(cuerpo: unknown): CambiosDisponibilidad {
  const d = leerObjeto(cuerpo);
  const cambios: CambiosDisponibilidad = {};
  if (d.agotado !== undefined) cambios.agotado = booleano(d.agotado, 'agotado');
  if (d.existencias !== undefined) cambios.existencias = existencias(d.existencias);
  if (cambios.agotado === undefined && cambios.existencias === undefined) {
    throw invalida('Indica "agotado" (true o false), "existencias" (entero o null), o ambos.');
  }
  return cambios;
}

/** `?excluir=gluten,leche` → ['gluten', 'leche']. */
export function leerExcluir(valor: unknown): Alergeno[] {
  if (valor === undefined || valor === '') return [];
  if (typeof valor !== 'string') {
    throw invalida('excluir debe ser una lista separada por comas, p. ej. excluir=gluten,leche.');
  }
  const codigos = valor.split(',').map((c) => c.trim()).filter((c) => c !== '');
  const desconocido = codigos.find((c) => !esAlergeno(c));
  if (desconocido !== undefined) {
    throw invalida(
      `"${desconocido}" no es un alérgeno conocido: usa los códigos de GET /catalogo/alergenos.`,
    );
  }
  return [...new Set(codigos)] as Alergeno[];
}
