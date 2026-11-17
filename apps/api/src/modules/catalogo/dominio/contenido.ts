import type { Alergeno, CategoriaBorrador, Horario } from '@cafeteria/shared';

/** Borrador editable de un menú (columna Menu.borrador, research R1). */
export interface BorradorMenu {
  nombre: string;
  horario: Horario;
  categorias: CategoriaBorrador[];
}

/** Datos de un producto copiados en una versión publicada. */
export interface ProductoEnVersion {
  id: string;
  nombre: string;
  descripcion: string;
  precioCentavos: number;
  imagenUrl: string | null;
  imagenAlt: string | null;
  alergenos: Alergeno[];
}

/** Instantánea inmutable de una versión (columna VersionMenu.contenido). */
export interface ContenidoVersion {
  nombre: string;
  horario: Horario;
  categorias: { nombre: string; productos: ProductoEnVersion[] }[];
}

/** Datos actuales de un producto, tal como los guarda la tabla Producto. */
export interface ProductoActual {
  id: string;
  nombre: string;
  descripcion: string;
  precioCentavos: number;
  imagenUrl: string | null;
  imagenAlt: string | null;
  /** null = sin declarar. */
  alergenos: Alergeno[] | null;
  agotado: boolean;
  existencias: number | null;
  retirado: boolean;
}

/** Estado vivo de un producto que no se versiona (research R4). */
export interface EstadoVivo {
  agotado: boolean;
  existencias: number | null;
  retirado: boolean;
}

/** true si el producto no se puede vender por falta de unidades. */
export function estaAgotado(estado: EstadoVivo): boolean {
  return estado.agotado || estado.existencias === 0;
}
