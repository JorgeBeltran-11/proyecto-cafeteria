"use client";

import { useState } from "react";
import { ESTADOS_PEDIDO, PEDIDOS, dolares, type EstadoPedido } from "../_inicio/datos";
import e from "./page.module.css";

type Filtro = EstadoPedido | "Todos";

const CLASE_ESTADO: Record<EstadoPedido, string> = {
  Recibido: e.recibido,
  "En preparación": e.preparacion,
  Listo: e.listo,
  Entregado: e.entregado,
};

const ICONO_ESTADO: Record<EstadoPedido, string> = {
  Recibido: "●",
  "En preparación": "◐",
  Listo: "✔",
  Entregado: "✓✓",
};

/** Resumen, filtros por estado y tarjetas de los pedidos del día. */
export function Tablero() {
  const [filtro, setFiltro] = useState<Filtro>("Todos");

  const enPreparacion = PEDIDOS.filter((p) => p.estado === "En preparación").length;
  const totalVendido = PEDIDOS.reduce((suma, p) => suma + p.totalCentavos, 0);
  const visibles = filtro === "Todos" ? PEDIDOS : PEDIDOS.filter((p) => p.estado === filtro);
  const opciones: Filtro[] = ["Todos", ...ESTADOS_PEDIDO];

  return (
    <div className={e.contenido}>
      <section aria-labelledby="titulo-resumen">
        <h2 id="titulo-resumen" className={e.soloLector}>
          Resumen del día
        </h2>
        <dl className={e.resumen}>
          <div className={e.dato}>
            <dt>Pedidos de hoy</dt>
            <dd>{PEDIDOS.length}</dd>
          </div>
          <div className={e.dato}>
            <dt>En preparación</dt>
            <dd>{enPreparacion}</dd>
          </div>
          <div className={`${e.dato} ${e.datoDestacado}`}>
            <dt>Total vendido</dt>
            <dd>{dolares(totalVendido)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="titulo-lista">
        <h2 id="titulo-lista" className={e.titulo}>
          Pedidos
        </h2>
        <div className={e.filtros} role="group" aria-label="Filtrar por estado">
          {opciones.map((o) => {
            const cuantos =
              o === "Todos" ? PEDIDOS.length : PEDIDOS.filter((p) => p.estado === o).length;
            return (
              <button
                key={o}
                type="button"
                className={e.filtro}
                aria-pressed={filtro === o}
                onClick={() => setFiltro(o)}
              >
                {o} <span className={e.cuenta}>({cuantos})</span>
              </button>
            );
          })}
        </div>

        <p className={e.anuncio} role="status" aria-live="polite">
          {filtro === "Todos"
            ? `Mostrando los ${visibles.length} pedidos.`
            : `Mostrando ${visibles.length} ${visibles.length === 1 ? "pedido" : "pedidos"} en estado «${filtro}».`}
        </p>

        {visibles.length === 0 ? (
          <p className={e.vacio}>No hay pedidos en este estado por ahora.</p>
        ) : (
          <ul className={e.rejilla}>
            {visibles.map((p) => (
              <li key={p.numero} className={e.tarjeta}>
                <article aria-labelledby={`pedido-${p.numero}`}>
                  <header className={e.tarjetaCabecera}>
                    <h3 id={`pedido-${p.numero}`} className={e.numero}>
                      Pedido #{p.numero}
                    </h3>
                    <span className={`${e.estado} ${CLASE_ESTADO[p.estado]}`}>
                      <span aria-hidden="true">{ICONO_ESTADO[p.estado]}</span>
                      <span className={e.soloLector}>Estado: </span>
                      {p.estado}
                    </span>
                  </header>
                  <p className={e.cliente}>{p.cliente}</p>
                  <ul className={e.productos}>
                    {p.productos.map((pr) => (
                      <li key={pr.nombre}>
                        {pr.cantidad} × {pr.nombre}
                      </li>
                    ))}
                  </ul>
                  <footer className={e.tarjetaPie}>
                    <span>
                      <span className={e.etiqueta}>Hora </span>
                      <time>{p.hora}</time>
                    </span>
                    <span className={e.total}>
                      <span className={e.etiqueta}>Total </span>
                      {dolares(p.totalCentavos)}
                    </span>
                  </footer>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
