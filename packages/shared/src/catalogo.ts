// Tipos del catálogo (menú dinámico) compartidos entre apps/api y apps/web (spec 003, data-model.md).
// Todos los importes son enteros en centavos (constitución VI): nunca coma flotante.

/** Lista cerrada de alérgenos de declaración obligatoria (data-model.md, "Alérgenos"). */
export type Alergeno =
  | 'gluten'
  | 'crustaceos'
  | 'huevo'
  | 'pescado'
  | 'mani'
  | 'soya'
  | 'leche'
  | 'frutos_de_cascara'
  | 'apio'
  | 'mostaza'
  | 'sesamo'
  | 'sulfitos'
  | 'altramuces'
  | 'moluscos';

export interface AlergenoVista {
  codigo: Alergeno;
  nombre: string;
}

/** 1 = lunes … 7 = domingo (ISO 8601). */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Franja de disponibilidad de un menú, en hora local de la cafetería. `desde` < `hasta`. */
export interface FranjaHoraria {
  dias: DiaSemana[];
  /** "HH:MM" (24 h). */
  desde: string;
  /** "HH:MM" (24 h), excluido. */
  hasta: string;
}

/** null = el menú está disponible a cualquier hora. */
export type Horario = FranjaHoraria[] | null;

export type EstadoMenu = 'borrador' | 'publicado' | 'retirado';

export type DisponibilidadProducto = 'disponible' | 'agotado' | 'fuera_de_horario';

// ---------------------------------------------------------------------------
// Tienda (público)
// ---------------------------------------------------------------------------

export interface ProductoPublico {
  id: string;
  nombre: string;
  descripcion: string;
  precioCentavos: number;
  imagenUrl: string | null;
  imagenAlt: string | null;
  alergenos: AlergenoVista[];
  disponibilidad: DisponibilidadProducto;
  /** Texto de la disponibilidad: la web nunca la comunica solo con color (FR-013). */
  textoDisponibilidad: string;
  /** true solo si está disponible y su menú está en horario. */
  sePuedePedir: boolean;
}

export interface CategoriaPublica {
  nombre: string;
  productos: ProductoPublico[];
}

export interface MenuPublico {
  id: string;
  nombre: string;
  /** Número de la versión publicada que se muestra (null en la vista previa de un borrador). */
  version: number | null;
  disponibleAhora: boolean;
  /** Horario legible, p. ej. "Todos los días de 07:00 a 11:00". */
  textoHorario: string;
  /** Cuándo vuelve a estar disponible, p. ej. "Hoy a las 07:00"; null si ya lo está. */
  proximaApertura: string | null;
  categorias: CategoriaPublica[];
}

export interface CartaPublica {
  menus: MenuPublico[];
  /** Alérgenos excluidos en esta consulta. */
  excluidos: Alergeno[];
  /** Momento de la consulta, ISO 8601 en UTC. */
  generadaEn: string;
}

// ---------------------------------------------------------------------------
// Administración y personal
// ---------------------------------------------------------------------------

export interface ProductoAdmin {
  id: string;
  nombre: string;
  descripcion: string;
  precioCentavos: number;
  imagenUrl: string | null;
  imagenAlt: string | null;
  /** null = alérgenos sin declarar (bloquea la publicación); [] = declarado sin alérgenos. */
  alergenos: Alergeno[] | null;
  agotado: boolean;
  /** null si el producto no controla existencias. */
  existencias: number | null;
  retirado: boolean;
  /** Para detectar ediciones concurrentes (FR-011). */
  revision: number;
  actualizadoEn: string;
}

/** Lo que ve y cambia el personal (US4). */
export interface DisponibilidadVista {
  id: string;
  nombre: string;
  agotado: boolean;
  existencias: number | null;
  retirado: boolean;
}

export interface CategoriaBorrador {
  nombre: string;
  /** Ids de producto, en el orden en que se muestran. */
  productoIds: string[];
}

export interface MenuAdmin {
  id: string;
  estado: EstadoMenu;
  nombre: string;
  horario: Horario;
  categorias: CategoriaBorrador[];
  /** Versión que ve la tienda; null si nunca se publicó. */
  versionPublicada: number | null;
  revision: number;
  actualizadoEn: string;
}

export interface VersionMenuResumen {
  numero: number;
  publicadaPor: string;
  /** ISO 8601 en UTC. */
  publicadaEn: string;
  /** Qué cambió respecto a la versión anterior, en frases legibles. */
  cambios: string[];
  /** Número de la versión que se restauró, si esta versión es una restauración. */
  restauradaDe: number | null;
}
