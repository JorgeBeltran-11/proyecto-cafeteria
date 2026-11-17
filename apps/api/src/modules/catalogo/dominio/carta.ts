/**
 * Carta pública (US1): convierte versiones publicadas + estado vivo de los productos en lo que
 * ve el cliente. Función pura: recibe el momento y los datos ya leídos.
 */
import type {
  Alergeno,
  CartaPublica,
  CategoriaPublica,
  MenuPublico,
  ProductoPublico,
} from '@cafeteria/shared';
import { vistaAlergenos } from './alergenos';
import {
  type ContenidoVersion,
  type EstadoVivo,
  estaAgotado,
  type ProductoEnVersion,
} from './contenido';
import { estaEnHorario, proximaApertura, textoHorario } from './horario';

/** Por debajo de este número de existencias, la tienda lo indica. */
export const POCAS_EXISTENCIAS = 5;

export interface MenuParaCarta {
  id: string;
  /** null en la vista previa de un borrador. */
  version: number | null;
  contenido: ContenidoVersion;
}

function productoPublico(
  p: ProductoEnVersion,
  estado: EstadoVivo,
  enHorario: boolean,
  apertura: string | null,
): ProductoPublico {
  const base = {
    id: p.id,
    nombre: p.nombre,
    descripcion: p.descripcion,
    precioCentavos: p.precioCentavos,
    imagenUrl: p.imagenUrl,
    imagenAlt: p.imagenAlt,
    alergenos: vistaAlergenos(p.alergenos),
  };
  if (estaAgotado(estado)) {
    return {
      ...base,
      disponibilidad: 'agotado',
      textoDisponibilidad: 'Agotado',
      sePuedePedir: false,
    };
  }
  if (!enHorario) {
    return {
      ...base,
      disponibilidad: 'fuera_de_horario',
      textoDisponibilidad: apertura
        ? `Fuera de horario. Disponible: ${apertura.charAt(0).toLowerCase()}${apertura.slice(1)}`
        : 'Fuera de horario',
      sePuedePedir: false,
    };
  }
  const pocas =
    estado.existencias !== null && estado.existencias <= POCAS_EXISTENCIAS;
  return {
    ...base,
    disponibilidad: 'disponible',
    textoDisponibilidad: pocas
      ? `Disponible: quedan ${estado.existencias}`
      : 'Disponible',
    sePuedePedir: true,
  };
}

/**
 * Arma un menú tal como lo ve el cliente. `vistos` evita repetir un producto en la misma
 * categoría cuando dos menús vigentes lo incluyen (edge case de solape).
 */
export function menuPublico(
  menu: MenuParaCarta,
  estados: ReadonlyMap<string, EstadoVivo>,
  ahora: Date,
  excluir: readonly Alergeno[] = [],
  vistos: Set<string> = new Set(),
): MenuPublico {
  const { contenido } = menu;
  const enHorario = estaEnHorario(contenido.horario, ahora);
  const apertura = proximaApertura(contenido.horario, ahora);
  const excluidos = new Set(excluir);

  const categorias: CategoriaPublica[] = [];
  for (const categoria of contenido.categorias) {
    const productos: ProductoPublico[] = [];
    for (const p of categoria.productos) {
      const estado = estados.get(p.id);
      if (!estado || estado.retirado) continue;
      if (p.alergenos.some((a) => excluidos.has(a))) continue;
      const clave = `${categoria.nombre.toLowerCase()}|${p.id}`;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      productos.push(productoPublico(p, estado, enHorario, apertura));
    }
    if (productos.length > 0) {
      categorias.push({ nombre: categoria.nombre, productos });
    }
  }

  return {
    id: menu.id,
    nombre: contenido.nombre,
    version: menu.version,
    disponibleAhora: enHorario,
    textoHorario: textoHorario(contenido.horario),
    proximaApertura: apertura,
    categorias,
  };
}

/** Carta completa: menús disponibles ahora primero, luego por nombre. */
export function armarCarta(
  menus: readonly MenuParaCarta[],
  estados: ReadonlyMap<string, EstadoVivo>,
  ahora: Date,
  excluir: readonly Alergeno[] = [],
): CartaPublica {
  const ordenados = [...menus].sort((a, b) => {
    const abiertoA = estaEnHorario(a.contenido.horario, ahora) ? 0 : 1;
    const abiertoB = estaEnHorario(b.contenido.horario, ahora) ? 0 : 1;
    if (abiertoA !== abiertoB) return abiertoA - abiertoB;
    return a.contenido.nombre.localeCompare(b.contenido.nombre, 'es');
  });
  const vistos = new Set<string>();
  return {
    menus: ordenados.map((m) => menuPublico(m, estados, ahora, excluir, vistos)),
    excluidos: [...excluir],
    generadaEn: ahora.toISOString(),
  };
}
