/**
 * PENDIENTE(spec-003): catálogo en memoria para desarrollar el carrito sin el módulo `catalogo`.
 * Se borra cuando el catálogo real implemente `CatalogoParaCarrito`
 * (contracts/dependencias.md §1). Los datos se reinician al reiniciar la API.
 */
import { Injectable } from '@nestjs/common';
import {
  CatalogoParaCarrito,
  type EstadoProducto,
  type ProductoParaCarrito,
} from '../puertos/catalogo.puerto';

interface ProductoDePrueba {
  id: string;
  nombre: string;
  precioCentavos: number;
  estado: EstadoProducto;
  existencias: number | null;
  /** Franja horaria en hora de Ecuador (UTC-5), o null si está siempre disponible. */
  horario: { desde: number; hasta: number } | null;
  /** Fija enHorario a mano para probar el aviso; null = según el horario. */
  enHorarioForzado: boolean | null;
}

export interface CambiosProductoDePrueba {
  precioCentavos?: number;
  estado?: EstadoProducto;
  existencias?: number | null;
  enHorario?: boolean;
}

const ZONA_ECUADOR_HORAS = -5;

function productosIniciales(): ProductoDePrueba[] {
  const base = { estado: 'disponible' as const, existencias: null, horario: null, enHorarioForzado: null };
  return [
    { ...base, id: 'cafe-americano', nombre: 'Café americano', precioCentavos: 150 },
    { ...base, id: 'capuchino', nombre: 'Capuchino', precioCentavos: 250 },
    { ...base, id: 'croissant', nombre: 'Croissant', precioCentavos: 185, existencias: 5 },
    { ...base, id: 'jugo-naranja', nombre: 'Jugo de naranja', precioCentavos: 300, estado: 'agotado' },
    {
      ...base,
      id: 'desayuno-andino',
      nombre: 'Desayuno andino (07:00–11:00)',
      precioCentavos: 650,
      horario: { desde: 7, hasta: 11 },
    },
  ];
}

@Injectable()
export class CatalogoProvisional extends CatalogoParaCarrito {
  private productos = productosIniciales();

  obtenerProductos(
    ids: readonly string[],
    ahora: Date,
  ): Promise<ProductoParaCarrito[]> {
    const buscados = new Set(ids);
    return Promise.resolve(
      this.productos
        .filter((p) => buscados.has(p.id))
        .map((p) => this.aVista(p, ahora)),
    );
  }

  listar(ahora: Date): ProductoParaCarrito[] {
    return this.productos.map((p) => this.aVista(p, ahora));
  }

  /** Devuelve el producto actualizado, o null si no existe. */
  actualizar(
    id: string,
    cambios: CambiosProductoDePrueba,
    ahora: Date,
  ): ProductoParaCarrito | null {
    const producto = this.productos.find((p) => p.id === id);
    if (!producto) return null;
    if (cambios.precioCentavos !== undefined) producto.precioCentavos = cambios.precioCentavos;
    if (cambios.estado !== undefined) producto.estado = cambios.estado;
    if (cambios.existencias !== undefined) producto.existencias = cambios.existencias;
    if (cambios.enHorario !== undefined) producto.enHorarioForzado = cambios.enHorario;
    return this.aVista(producto, ahora);
  }

  /** Vuelve a los datos iniciales (útil en tests). */
  reiniciar(): void {
    this.productos = productosIniciales();
  }

  private aVista(p: ProductoDePrueba, ahora: Date): ProductoParaCarrito {
    return {
      id: p.id,
      nombre: p.nombre,
      precioCentavos: p.precioCentavos,
      estado: p.estado,
      existencias: p.existencias,
      enHorario: p.enHorarioForzado ?? this.dentroDeHorario(p, ahora),
    };
  }

  private dentroDeHorario(p: ProductoDePrueba, ahora: Date): boolean {
    if (!p.horario) return true;
    const hora = (ahora.getUTCHours() + ZONA_ECUADOR_HORAS + 24) % 24;
    return hora >= p.horario.desde && hora < p.horario.hasta;
  }
}
