"use client";

import { useState } from "react";
import { ESTADOS_PEDIDO, dolares, type EstadoPedido } from "../_inicio/datos";
import { cambiarEstado, usePedidos } from "./pedidos-estado";
import { Registro } from "./registro";
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

function textoAnuncio(filtro: Filtro, total: number, visibles: number): string {
  if (total === 0) return "Aún no hay pedidos registrados.";
  if (filtro === "Todos") return `Mostrando ${visibles === 1 ? "el único pedido" : `los ${visibles} pedidos`}.`;
  return `Mostrando ${visibles} ${visibles === 1 ? "pedido" : "pedidos"} en estado «${filtro}».`;
}

/** Resumen, registro del cliente y pedidos registrados (todo calculado con los pedidos enviados). */
export function Tablero() {
  const pedidos = usePedidos();
  const [filtro, setFiltro] = useState<Filtro>("Todos");

  const enPreparacion = pedidos.filter((p) => p.estado === "En preparación").length;
  const totalVendido = pedidos.reduce((suma, p) => suma + p.totalCentavos, 0);
  const visibles = filtro === "Todos" ? pedidos : pedidos.filter((p) => p.estado === filtro);
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
            <dd>{pedidos.length}</dd>
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

      <Registro />

      <section aria-labelledby="titulo-lista">
        <h2 id="titulo-lista" className={e.titulo}>
          Pedidos registrados
        </h2>
        <div className={e.filtros} role="group" aria-label="Filtrar por estado">
          {opciones.map((o) => {
            const cuantos =
              o === "Todos" ? pedidos.length : pedidos.filter((p) => p.estado === o).length;
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
          {textoAnuncio(filtro, pedidos.length, visibles.length)}
        </p>

        {visibles.length === 0 ? (
          <p className={e.vacio}>
            {pedidos.length === 0
              ? "Cuando registres un pedido con el formulario de arriba, aparecerá aquí."
              : "No hay pedidos en este estado por ahora."}
          </p>
        ) : (
          <ul className={e.rejilla}>
            {visibles.map((p) => {
              const idTitulo = `pedido-${p.numero}`;
              const idEstado = `estado-pedido-${p.numero}`;
              return (
                <li key={p.numero} className={e.tarjeta}>
                  <article aria-labelledby={idTitulo}>
                    <header className={e.tarjetaCabecera}>
                      <h3 id={idTitulo} className={e.numero}>
                        Pedido #{p.numero}
                      </h3>
                      <span className={`${e.estado} ${CLASE_ESTADO[p.estado]}`}>
                        <span aria-hidden="true">{ICONO_ESTADO[p.estado]}</span>
                        <span className={e.soloLector}>Estado: </span>
                        {p.estado}
                      </span>
                    </header>
                    <p className={e.cliente}>
                      {p.nombres} {p.apellidos}
                    </p>
                    <dl className={e.datosCliente}>
                      <div>
                        <dt>Cédula</dt>
                        <dd>{p.cedula}</dd>
                      </div>
                      <div>
                        <dt>Celular</dt>
                        <dd>{p.celular}</dd>
                      </div>
                      <div>
                        <dt>Dirección</dt>
                        <dd>{p.direccion}</dd>
                      </div>
                    </dl>
                    <ul className={e.productos}>
                      {p.productos.map((pr) => (
                        <li key={pr.nombre}>
                          {pr.cantidad} × {pr.nombre}{" "}
                          <span className={e.etiqueta}>
                            ({dolares(pr.precioCentavos)} c/u ·{" "}
                            {dolares(pr.precioCentavos * pr.cantidad)})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className={e.cambioEstado}>
                      <label htmlFor={idEstado} className={e.etiquetaCampo}>
                        Cambiar estado
                        <span className={e.soloLector}> del pedido #{p.numero}</span>
                      </label>
                      <select
                        id={idEstado}
                        className={e.selector}
                        value={p.estado}
                        onChange={(ev) => cambiarEstado(p.numero, ev.target.value as EstadoPedido)}
                      >
                        {ESTADOS_PEDIDO.map((est) => (
                          <option key={est} value={est}>
                            {est}
                          </option>
                        ))}
                      </select>
                    </div>
                    <footer className={e.tarjetaPie}>
                      <span>
                        <span className={e.etiqueta}>Hora </span>
                        <time dateTime={p.fecha}>{p.hora}</time>
                      </span>
                      <span className={e.total}>
                        <span className={e.etiqueta}>Total </span>
                        {dolares(p.totalCentavos)}
                      </span>
                    </footer>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
