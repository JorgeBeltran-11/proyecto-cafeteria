/**
 * PENDIENTE(spec-005): no aplica ningún descuento. Se sustituye por el calculador del
 * módulo de promociones cuando exista (contracts/dependencias.md §3).
 */
import { Injectable } from '@nestjs/common';
import {
  CalculadorDescuentos,
  type DescuentoDeLinea,
} from '../puertos/descuentos.puerto';

@Injectable()
export class SinDescuentos extends CalculadorDescuentos {
  calcular(): Promise<DescuentoDeLinea[]> {
    return Promise.resolve([]);
  }
}
