import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CarritoGuardado } from '../dominio/reglas';
import { CarritoRepositorio } from './carrito.repositorio';

@Injectable()
export class PrismaCarritoRepositorio extends CarritoRepositorio {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async obtener(clienteId: string): Promise<CarritoGuardado | null> {
    const carrito = await this.prisma.carrito.findUnique({
      where: { clienteId },
      include: { lineas: true },
    });
    if (!carrito) return null;

    return {
      clienteId: carrito.clienteId,
      actualizadoEn: carrito.actualizadoEn,
      lineas: carrito.lineas.map((l) => ({
        productoId: l.productoId,
        cantidad: l.cantidad,
        precioVistoCentavos: l.precioVistoCentavos,
        anadidaEn: l.anadidaEn,
      })),
    };
  }

  async guardar(carrito: CarritoGuardado): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { id } = await tx.carrito.upsert({
        where: { clienteId: carrito.clienteId },
        create: {
          clienteId: carrito.clienteId,
          actualizadoEn: carrito.actualizadoEn,
        },
        update: { actualizadoEn: carrito.actualizadoEn },
        select: { id: true },
      });

      await tx.lineaCarrito.deleteMany({ where: { carritoId: id } });
      if (carrito.lineas.length > 0) {
        await tx.lineaCarrito.createMany({
          data: carrito.lineas.map((l) => ({
            carritoId: id,
            productoId: l.productoId,
            cantidad: l.cantidad,
            precioVistoCentavos: l.precioVistoCentavos,
            anadidaEn: l.anadidaEn,
          })),
        });
      }
    });
  }

  async eliminar(clienteId: string): Promise<void> {
    // Las líneas se borran explícitamente para no depender de que SQLite aplique el ON DELETE CASCADE.
    await this.prisma.$transaction([
      this.prisma.lineaCarrito.deleteMany({ where: { carrito: { clienteId } } }),
      this.prisma.carrito.deleteMany({ where: { clienteId } }),
    ]);
  }
}
