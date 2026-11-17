"use client";

import type { CarritoVista, LineaCarritoVista } from "@cafeteria/shared";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { apiCarrito, dinero, ErrorApi, type ProductoDePrueba } from "./api";

/** PENDIENTE(spec-002): cliente de prueba hasta que exista el inicio de sesión. */
const CLIENTE_POR_DEFECTO = "cliente-demo";
const FORMATO_CLIENTE = /^[A-Za-z0-9_-]{1,64}$/;
/** Sondeo para ver los cambios de otros dispositivos en menos de 5 s (research R7). */
const SONDEO_MS = 4000;

type Origen = "propio" | "sondeo";
type Foco = "deshacer" | "titulo" | null;

interface LineaEliminada {
  productoId: string;
  nombre: string;
  cantidad: number;
}

const ESTADO_PRODUCTO: Record<ProductoDePrueba["estado"], string> = {
  disponible: "Disponible",
  agotado: "Agotado",
  retirado: "Retirado",
};

function mensajeDeError(error: unknown): string {
  return error instanceof ErrorApi ? error.message : "Ocurrió un error inesperado. Inténtalo de nuevo.";
}

export function Carrito() {
  const [clienteId, setClienteId] = useState(CLIENTE_POR_DEFECTO);
  const [borradorCliente, setBorradorCliente] = useState(CLIENTE_POR_DEFECTO);
  const [errorCliente, setErrorCliente] = useState<string | null>(null);
  const [vista, setVista] = useState<CarritoVista | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [productos, setProductos] = useState<ProductoDePrueba[]>([]);
  const [anuncio, setAnuncio] = useState("");
  const [eliminada, setEliminada] = useState<LineaEliminada | null>(null);

  // Las respuestas pueden llegar desordenadas (sondeo y acciones a la vez): solo se aplica la más reciente.
  const secuencia = useRef(0);
  const ultimaAplicada = useRef(0);
  const avisosConocidos = useRef(new Set<string>());
  const ultimaActualizacion = useRef<string | null>(null);
  const focoPendiente = useRef<Foco>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const botonDeshacer = useRef<HTMLButtonElement>(null);

  /** Mueve el foco tras el render que creó el elemento destino (solo tras acciones del cliente). */
  useEffect(() => {
    const destino = focoPendiente.current;
    if (!destino) return;
    focoPendiente.current = null;
    (destino === "deshacer" ? botonDeshacer.current : titulo.current)?.focus();
  });

  const anunciar = useCallback((texto: string) => {
    // Un espacio alterno fuerza a los lectores a repetir un mensaje idéntico.
    setAnuncio((anterior) => (anterior === texto ? `${texto} ` : texto));
  }, []);

  const aplicar = useCallback(
    (nueva: CarritoVista, seq: number, origen: Origen, mensaje?: string) => {
      if (seq < ultimaAplicada.current) return;
      ultimaAplicada.current = seq;

      const partes: string[] = [];
      if (
        origen === "sondeo" &&
        ultimaActualizacion.current !== null &&
        nueva.actualizadoEn !== ultimaActualizacion.current
      ) {
        partes.push("Tu carrito cambió desde otro dispositivo.");
      }
      if (mensaje) partes.push(mensaje);
      if (nueva.ajuste) {
        partes.push(`Se aplicaron ${nueva.ajuste.aplicada} unidades: ${nueva.ajuste.motivo}`);
      }
      // Solo se anuncian los avisos nuevos, para no repetirlos en cada sondeo.
      const claves = new Set<string>();
      for (const aviso of nueva.avisos) {
        const clave = `${aviso.tipo}:${aviso.productoId}`;
        claves.add(clave);
        if (!avisosConocidos.current.has(clave)) partes.push(aviso.mensaje);
      }
      avisosConocidos.current = claves;
      ultimaActualizacion.current = nueva.actualizadoEn;

      setVista(nueva);
      setErrorCarga(null);
      if (partes.length > 0) anunciar(partes.join(" "));
    },
    [anunciar],
  );

  const cargar = useCallback(
    async (origen: Origen) => {
      const seq = ++secuencia.current;
      try {
        aplicar(await apiCarrito.ver(clienteId), seq, origen);
      } catch (error) {
        // Un sondeo fallido no interrumpe: se reintenta en el siguiente.
        if (origen === "propio") setErrorCarga(mensajeDeError(error));
      }
    },
    [clienteId, aplicar],
  );

  const cargarProductos = useCallback(
    () =>
      apiCarrito
        .productosDePrueba()
        .then(setProductos)
        .catch(() => setProductos([])),
    [],
  );

  useEffect(() => {
    void cargar("propio");
    void cargarProductos();
  }, [cargar, cargarProductos]);

  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState !== "visible") return;
      void cargar("sondeo");
      void cargarProductos();
    };
    const intervalo = window.setInterval(refrescar, SONDEO_MS);
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [cargar, cargarProductos]);

  async function ejecutar(
    accion: () => Promise<CarritoVista>,
    mensaje: (v: CarritoVista) => string,
  ): Promise<CarritoVista | null> {
    const seq = ++secuencia.current;
    try {
      const nueva = await accion();
      aplicar(nueva, seq, "propio", mensaje(nueva));
      return nueva;
    } catch (error) {
      anunciar(`No se pudo completar: ${mensajeDeError(error)}`);
      return null;
    }
  }

  function totalTexto(v: CarritoVista): string {
    return `Total: ${dinero(v.totalCentavos)}.`;
  }

  function anadir(producto: ProductoDePrueba) {
    void ejecutar(
      () => apiCarrito.anadir(clienteId, producto.id),
      (v) => `${producto.nombre} añadido. ${totalTexto(v)}`,
    );
  }

  async function quitar(linea: LineaCarritoVista) {
    const nueva = await ejecutar(
      () => apiCarrito.quitar(clienteId, linea.productoId),
      (v) => `${linea.nombre} eliminado del carrito. ${totalTexto(v)} Puedes deshacerlo.`,
    );
    if (nueva) {
      setEliminada({ productoId: linea.productoId, nombre: linea.nombre, cantidad: linea.cantidad });
      focoPendiente.current = "deshacer";
    }
  }

  function cambiarCantidad(linea: LineaCarritoVista, cantidad: number) {
    if (!Number.isInteger(cantidad) || cantidad === linea.cantidad) return;
    if (cantidad <= 0) {
      void quitar(linea);
      return;
    }
    void ejecutar(
      () => apiCarrito.cambiarCantidad(clienteId, linea.productoId, cantidad),
      (v) => {
        const actual = v.lineas.find((l) => l.productoId === linea.productoId);
        return `Cantidad de ${linea.nombre}: ${actual?.cantidad ?? cantidad}. ${totalTexto(v)}`;
      },
    );
  }

  async function deshacer() {
    if (!eliminada) return;
    const nueva = await ejecutar(
      () => apiCarrito.anadir(clienteId, eliminada.productoId, eliminada.cantidad),
      (v) => `${eliminada.nombre} vuelve a estar en el carrito. ${totalTexto(v)}`,
    );
    if (nueva) {
      setEliminada(null);
      focoPendiente.current = "titulo";
    }
  }

  async function vaciar() {
    const nueva = await ejecutar(() => apiCarrito.vaciar(clienteId), () => "Carrito vaciado.");
    if (nueva) {
      setEliminada(null);
      focoPendiente.current = "titulo";
    }
  }

  function aceptarPrecios() {
    void ejecutar(
      () => apiCarrito.aceptarPrecios(clienteId),
      (v) => `Precios nuevos aceptados. ${totalTexto(v)}`,
    );
  }

  function cambiarCliente(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nuevo = borradorCliente.trim();
    if (!FORMATO_CLIENTE.test(nuevo)) {
      setErrorCliente('Usa de 1 a 64 letras sin tildes, números, "-" o "_". Por ejemplo: cliente-demo.');
      return;
    }
    setErrorCliente(null);
    if (nuevo === clienteId) return;
    avisosConocidos.current = new Set();
    ultimaActualizacion.current = null;
    setEliminada(null);
    setVista(null);
    setClienteId(nuevo);
    anunciar(`Mostrando el carrito de ${nuevo}.`);
  }

  const hayCambioDePrecio = vista?.avisos.some((a) => a.tipo === "cambio_de_precio") ?? false;

  return (
    <>
      <h1 ref={titulo} tabIndex={-1}>
        Tu carrito
      </h1>

      {/* Región única de anuncios: los cambios y avisos se leen sin mover el foco (FR-009). */}
      <div role="status" aria-live="polite" aria-atomic="true" className="anuncio">
        {anuncio}
      </div>

      <form className="cliente-prueba" onSubmit={cambiarCliente} noValidate>
        <label htmlFor="cliente-prueba">Cliente de prueba</label>
        <p id="cliente-prueba-ayuda" className="ayuda">
          Provisional hasta que exista el inicio de sesión. Usa el mismo nombre en otro navegador para ver
          el mismo carrito.
        </p>
        {errorCliente && (
          <p id="cliente-prueba-error" className="estado-error">
            {errorCliente}
          </p>
        )}
        <div className="fila">
          <input
            id="cliente-prueba"
            name="cliente"
            value={borradorCliente}
            onChange={(e) => setBorradorCliente(e.target.value)}
            aria-describedby={errorCliente ? "cliente-prueba-ayuda cliente-prueba-error" : "cliente-prueba-ayuda"}
            aria-invalid={errorCliente ? true : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit">Usar este cliente</button>
        </div>
      </form>

      {errorCarga && (
        <div className="error-carga">
          <p className="estado-error">{errorCarga}</p>
          <button type="button" onClick={() => void cargar("propio")}>
            Reintentar
          </button>
        </div>
      )}

      {!vista && !errorCarga && <p>Cargando tu carrito…</p>}

      {vista && (
        <>
          {vista.lineas.length === 0 ? (
            <p>Tu carrito está vacío. Añade productos desde la lista de abajo.</p>
          ) : (
            <ul className="lineas" aria-label="Productos en tu carrito">
              {vista.lineas.map((linea) => (
                <LineaCarrito
                  key={linea.productoId}
                  linea={linea}
                  onCambiar={(cantidad) => cambiarCantidad(linea, cantidad)}
                  onQuitar={() => void quitar(linea)}
                />
              ))}
            </ul>
          )}

          {eliminada && (
            <p className="deshacer">
              Eliminaste {eliminada.nombre}.{" "}
              <button ref={botonDeshacer} type="button" className="secundario" onClick={() => void deshacer()}>
                Deshacer
              </button>
            </p>
          )}

          {vista.avisos.length > 0 && (
            <section aria-labelledby="titulo-avisos" className="avisos">
              <h2 id="titulo-avisos">Avisos</h2>
              <ul>
                {vista.avisos.map((aviso) => (
                  <li key={`${aviso.tipo}:${aviso.productoId}`}>{aviso.mensaje}</li>
                ))}
              </ul>
              {hayCambioDePrecio && (
                <button type="button" onClick={aceptarPrecios}>
                  Aceptar precios nuevos
                </button>
              )}
            </section>
          )}

          {vista.lineas.length > 0 && (
            <section aria-labelledby="titulo-resumen">
              <h2 id="titulo-resumen">Resumen</h2>
              <dl className="resumen">
                <dt>Subtotal</dt>
                <dd>{dinero(vista.subtotalCentavos)}</dd>
                <dt>Descuentos</dt>
                <dd>{vista.descuentoCentavos > 0 ? `−${dinero(vista.descuentoCentavos)}` : dinero(0)}</dd>
                <dt>Total</dt>
                <dd className="total">{dinero(vista.totalCentavos)}</dd>
              </dl>
              <p className={vista.sePuedeConfirmar ? "estado-ok" : "estado-error"}>
                {vista.sePuedeConfirmar
                  ? "Tu carrito está listo para confirmar el pedido."
                  : "Antes de confirmar el pedido, revisa los avisos."}
              </p>
              <p className="ayuda">
                {vista.totalUnidades} de {vista.limites.porCarrito} unidades como máximo. La confirmación del pedido
                llegará con la spec de pedidos.
              </p>
              <button type="button" className="secundario" onClick={() => void vaciar()}>
                Vaciar carrito
              </button>
            </section>
          )}
        </>
      )}

      <section aria-labelledby="titulo-productos" className="productos">
        <h2 id="titulo-productos">Productos de prueba</h2>
        <p className="ayuda">Provisional hasta que exista el menú real.</p>
        {productos.length === 0 ? (
          <p>No hay productos de prueba disponibles. Comprueba que la API está en ejecución.</p>
        ) : (
          <ul className="lista-productos">
            {productos.map((producto) => (
              <li key={producto.id}>
                <span>
                  <strong>{producto.nombre}</strong> · {dinero(producto.precioCentavos)}
                  {producto.estado !== "disponible" && <> · {ESTADO_PRODUCTO[producto.estado]}</>}
                  {producto.estado === "disponible" && !producto.enHorario && <> · Fuera de horario</>}
                </span>
                {producto.estado === "disponible" && (
                  <button type="button" onClick={() => anadir(producto)} aria-label={`Añadir ${producto.nombre} al carrito`}>
                    Añadir
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function LineaCarrito({
  linea,
  onCambiar,
  onQuitar,
}: {
  linea: LineaCarritoVista;
  onCambiar: (cantidad: number) => void;
  onQuitar: () => void;
}) {
  const idCantidad = `cantidad-${linea.productoId}`;

  function confirmar(valor: string) {
    const cantidad = Number(valor);
    if (valor.trim() !== "" && Number.isInteger(cantidad) && cantidad >= 0) onCambiar(cantidad);
  }

  return (
    <li className="linea">
      <p className="linea-nombre">
        <strong>{linea.nombre}</strong> · {dinero(linea.precioUnitarioCentavos)} c/u
      </p>
      <div className="fila">
        <button
          type="button"
          className="cantidad-boton"
          aria-label={`Reducir cantidad de ${linea.nombre}`}
          onClick={() => onCambiar(linea.cantidad - 1)}
        >
          −
        </button>
        <label htmlFor={idCantidad} className="solo-lector">
          Cantidad de {linea.nombre}
        </label>
        {/* La key reinicia el campo cuando la cantidad cambia en el servidor. */}
        <input
          key={`${linea.productoId}-${linea.cantidad}`}
          id={idCantidad}
          className="cantidad"
          type="number"
          inputMode="numeric"
          min={0}
          max={Math.max(linea.cantidad, linea.maximoPermitido)}
          defaultValue={linea.cantidad}
          onBlur={(e) => confirmar(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmar(e.currentTarget.value);
            }
          }}
        />
        <button
          type="button"
          className="cantidad-boton"
          aria-label={`Aumentar cantidad de ${linea.nombre}`}
          onClick={() => onCambiar(linea.cantidad + 1)}
        >
          +
        </button>
        <button type="button" className="secundario" aria-label={`Quitar ${linea.nombre}`} onClick={onQuitar}>
          Quitar
        </button>
      </div>
      <p>
        {linea.descuentoCentavos > 0 && <>Descuento: −{dinero(linea.descuentoCentavos)} · </>}
        Total de la línea: <strong>{dinero(linea.totalCentavos)}</strong>
      </p>
    </li>
  );
}
