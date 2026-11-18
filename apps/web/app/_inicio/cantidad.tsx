"use client";

import m from "./marco.module.css";

/**
 * Selector de cantidad "− número +". Los botones en el límite usan aria-disabled (no disabled)
 * para que el foco no se pierda al llegar al mínimo o al máximo.
 */
export function SelectorCantidad({
  valor,
  onCambiar,
  producto,
  min = 1,
  max = 10,
}: {
  valor: number;
  onCambiar: (nuevo: number) => void;
  producto: string;
  min?: number;
  max?: number;
}) {
  const enMinimo = valor <= min;
  const enMaximo = valor >= max;

  return (
    <div className={m.cantidad} role="group" aria-label={`Cantidad de ${producto}`}>
      <button
        type="button"
        className={m.cantidadBoton}
        aria-label={`Disminuir cantidad de ${producto}`}
        aria-disabled={enMinimo}
        onClick={() => !enMinimo && onCambiar(valor - 1)}
      >
        <span aria-hidden="true">−</span>
      </button>
      <span className={m.cantidadValor} aria-live="polite" aria-atomic="true">
        {valor}
      </span>
      <button
        type="button"
        className={m.cantidadBoton}
        aria-label={`Aumentar cantidad de ${producto}`}
        aria-disabled={enMaximo}
        onClick={() => !enMaximo && onCambiar(valor + 1)}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}
