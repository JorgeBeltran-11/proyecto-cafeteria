"use client";

import { useEffect, useRef, useState } from "react";
import { SelectorCantidad } from "../_inicio/cantidad";
import { useCarrito } from "../_inicio/carrito-estado";
import type { Cafe } from "../_inicio/datos";
import e from "./page.module.css";

/** Tiempo que permanece visible el aviso "Agregado: …". */
const DURACION_AVISO_MS = 5000;

/** Cantidad (1–10) + botón "Agregar" de una tarjeta de café, con aviso accesible. */
export function AgregarCafe({ cafe }: { cafe: Cafe }) {
  const { agregar } = useCarrito();
  const [cantidad, setCantidad] = useState(1);
  const [aviso, setAviso] = useState("");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  function alAgregar() {
    agregar(cafe.id, cantidad);
    setAviso(`Agregado: ${cantidad} × ${cafe.nombre}`);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso(""), DURACION_AVISO_MS);
  }

  return (
    <div className={e.compra}>
      <div className={e.compraFila}>
        <SelectorCantidad valor={cantidad} onCambiar={setCantidad} producto={cafe.nombre} />
        <button
          type="button"
          className={e.agregar}
          aria-label={`Agregar ${cafe.nombre}`}
          onClick={alAgregar}
        >
          Agregar
        </button>
      </div>
      <p className={e.aviso} role="status" aria-live="polite">
        {aviso}
      </p>
    </div>
  );
}
