import type { CarritoGuardado } from '../dominio/reglas';
import { CarritoRepositorio } from './carrito.repositorio';

function copiar(carrito: CarritoGuardado): CarritoGuardado {
  return {
    clienteId: carrito.clienteId,
    actualizadoEn: new Date(carrito.actualizadoEn),
    lineas: carrito.lineas.map((l) => ({ ...l, anadidaEn: new Date(l.anadidaEn) })),
  };
}

/** Repositorio en memoria para los tests: guarda copias para que nadie modifique el estado por referencia. */
export class MemoriaCarritoRepositorio extends CarritoRepositorio {
  private readonly carritos = new Map<string, CarritoGuardado>();

  obtener(clienteId: string): Promise<CarritoGuardado | null> {
    const carrito = this.carritos.get(clienteId);
    return Promise.resolve(carrito ? copiar(carrito) : null);
  }

  guardar(carrito: CarritoGuardado): Promise<void> {
    this.carritos.set(carrito.clienteId, copiar(carrito));
    return Promise.resolve();
  }

  eliminar(clienteId: string): Promise<void> {
    this.carritos.delete(clienteId);
    return Promise.resolve();
  }
}
