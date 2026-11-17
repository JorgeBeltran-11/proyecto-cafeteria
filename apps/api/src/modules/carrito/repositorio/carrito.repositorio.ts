import type { CarritoGuardado } from '../dominio/reglas';

/** Persistencia del carrito. El módulo solo accede a sus propias tablas (constitución V). */
export abstract class CarritoRepositorio {
  abstract obtener(clienteId: string): Promise<CarritoGuardado | null>;

  /** Guarda el carrito completo de forma atómica (research R3). */
  abstract guardar(carrito: CarritoGuardado): Promise<void>;

  /** Borra el carrito y sus líneas; no falla si no existe. */
  abstract eliminar(clienteId: string): Promise<void>;
}
