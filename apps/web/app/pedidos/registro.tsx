"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { SelectorCantidad } from "../_inicio/cantidad";
import { MAX_POR_PRODUCTO, useCarrito } from "../_inicio/carrito-estado";
import { CAFES, dolares } from "../_inicio/datos";
import { registrarPedido, siguienteNumero, usePedidos } from "./pedidos-estado";
import e from "./page.module.css";

type Campo = "nombres" | "apellidos" | "cedula" | "celular" | "direccion";
type Valores = Record<Campo, string>;
type Errores = Partial<Record<Campo | "productos", string>>;

const VACIO: Valores = { nombres: "", apellidos: "", cedula: "", celular: "", direccion: "" };

const CAMPOS: {
  id: Campo;
  etiqueta: string;
  ayuda?: string;
  autoComplete: string;
  inputMode?: "numeric";
  maxLength?: number;
  /** Solo admite dígitos: se descarta cualquier otro carácter al escribir. */
  soloDigitos?: boolean;
}[] = [
  { id: "nombres", etiqueta: "Nombres", autoComplete: "given-name" },
  { id: "apellidos", etiqueta: "Apellidos", autoComplete: "family-name" },
  {
    id: "cedula",
    etiqueta: "Cédula",
    autoComplete: "off",
    inputMode: "numeric",
    maxLength: 10,
    soloDigitos: true,
  },
  {
    id: "celular",
    etiqueta: "Celular",
    autoComplete: "tel-national",
    inputMode: "numeric",
    maxLength: 10,
    soloDigitos: true,
  },
  {
    id: "direccion",
    etiqueta: "Dirección de entrega",
    ayuda: "Calle y número, o edificio y aula si es dentro del campus.",
    autoComplete: "street-address",
  },
];

/** Orden en el que se busca el primer error para llevarle el foco. */
const ORDEN: (Campo | "productos")[] = [...CAMPOS.map((c) => c.id), "productos"];

const SOLO_LETRAS = /^\p{L}[\p{L}\s'.-]*$/u;

function validarCampo(campo: Campo, valor: string): string | undefined {
  const v = valor.trim();
  switch (campo) {
    case "nombres":
    case "apellidos": {
      const nombre = campo === "nombres" ? "tus nombres" : "tus apellidos";
      if (!v) return `Escribe ${nombre}.`;
      if (!SOLO_LETRAS.test(v)) return `Usa solo letras en ${nombre}.`;
      if (v.length < 2) return `Escribe ${nombre} completos.`;
      return undefined;
    }
    case "cedula":
    case "celular":
      // Sin validación: el campo solo admite hasta 10 dígitos al escribir.
      return undefined;
    case "direccion":
      if (!v) return "Escribe la dirección de entrega.";
      if (v.length < 5) return "Escribe una dirección más completa (calle, número o edificio).";
      return undefined;
  }
}

function horaActual(fecha: Date): string {
  return fecha.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** Formulario "Registro del cliente" con la tabla "Tu pedido" (carrito) y el botón Enviar. */
export function Registro() {
  const { items, totalCentavos, agregar, cambiarCantidad, quitar, vaciar } = useCarrito();
  const pedidos = usePedidos();

  const [valores, setValores] = useState<Valores>(VACIO);
  const [errores, setErrores] = useState<Errores>({});
  const [mensaje, setMensaje] = useState("");
  const [anuncio, setAnuncio] = useState("");
  const [productoElegido, setProductoElegido] = useState(CAFES[0].id);
  const [cantidadElegida, setCantidadElegida] = useState(1);

  const controles = useRef<Partial<Record<Campo | "productos", HTMLElement | null>>>({});
  const tituloPedido = useRef<HTMLHeadingElement>(null);

  function alEscribir(campo: Campo, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
    // Si el campo ya mostraba un error, se revalida al escribir para quitarlo en cuanto se corrige.
    if (errores[campo]) setErrores((er) => ({ ...er, [campo]: validarCampo(campo, valor) }));
    setMensaje("");
  }

  function alSalir(campo: Campo) {
    if (valores[campo].trim()) setErrores((er) => ({ ...er, [campo]: validarCampo(campo, valores[campo]) }));
  }

  function alAgregarDesdeAqui() {
    const cafe = CAFES.find((c) => c.id === productoElegido);
    if (!cafe) return;
    agregar(cafe.id, cantidadElegida);
    setAnuncio(`Agregado: ${cantidadElegida} × ${cafe.nombre}`);
    setErrores((er) => ({ ...er, productos: undefined }));
    setMensaje("");
    setCantidadElegida(1);
  }

  function alQuitar(id: string, nombre: string) {
    quitar(id);
    setAnuncio(`${nombre} quitado de tu pedido.`);
    tituloPedido.current?.focus();
  }

  function alEnviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const nuevos: Errores = {};
    for (const c of CAMPOS) nuevos[c.id] = validarCampo(c.id, valores[c.id]);
    if (items.length === 0) nuevos.productos = "Agrega al menos un producto a tu pedido.";
    setErrores(nuevos);

    const primero = ORDEN.find((k) => nuevos[k]);
    if (primero) {
      setMensaje("");
      controles.current[primero]?.focus();
      return;
    }

    const ahora = new Date();
    const numero = siguienteNumero(pedidos);
    registrarPedido({
      numero,
      nombres: valores.nombres.trim(),
      apellidos: valores.apellidos.trim(),
      cedula: valores.cedula.trim(),
      celular: valores.celular.trim(),
      direccion: valores.direccion.trim(),
      productos: items.map((i) => ({
        nombre: i.cafe.nombre,
        cantidad: i.cantidad,
        precioCentavos: i.cafe.precioCentavos,
      })),
      totalCentavos,
      hora: horaActual(ahora),
      fecha: ahora.toISOString(),
      estado: "Recibido",
    });
    vaciar();
    setValores(VACIO);
    setErrores({});
    setAnuncio("");
    setMensaje(`Pedido #${numero} registrado`);
  }

  const describir = (...ids: (string | false | undefined)[]) =>
    ids.filter(Boolean).join(" ") || undefined;

  return (
    <section aria-labelledby="titulo-registro">
      <h2 id="titulo-registro" className={e.titulo}>
        Registro del cliente
      </h2>
      <p className={e.indicacion}>Todos los campos son obligatorios.</p>

      <form className={e.registro} noValidate onSubmit={alEnviar}>
        <fieldset className={e.panelForm}>
          <legend className={e.panelTitulo}>Tus datos</legend>
          {CAMPOS.map((c) => {
            const error = errores[c.id];
            const idAyuda = c.ayuda ? `ayuda-${c.id}` : undefined;
            const idError = error ? `error-${c.id}` : undefined;
            return (
              <div key={c.id} className={e.campo}>
                <label htmlFor={`campo-${c.id}`} className={e.etiquetaCampo}>
                  {c.etiqueta}
                </label>
                {c.ayuda && (
                  <p id={idAyuda} className={e.ayuda}>
                    {c.ayuda}
                  </p>
                )}
                <input
                  ref={(el) => {
                    controles.current[c.id] = el;
                  }}
                  id={`campo-${c.id}`}
                  name={c.id}
                  type="text"
                  inputMode={c.inputMode}
                  maxLength={c.maxLength}
                  autoComplete={c.autoComplete}
                  required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={describir(idError, idAyuda)}
                  className={e.entrada}
                  value={valores[c.id]}
                  onChange={(ev) =>
                    alEscribir(
                      c.id,
                      c.soloDigitos
                        ? ev.target.value.replace(/\D/g, "").slice(0, c.maxLength)
                        : ev.target.value,
                    )
                  }
                  onBlur={() => alSalir(c.id)}
                />
                {error && (
                  <p id={idError} className={e.error}>
                    <span aria-hidden="true">⚠ </span>
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </fieldset>

        <div className={e.panelForm}>
          <h3 id="titulo-tu-pedido" ref={tituloPedido} tabIndex={-1} className={e.panelTitulo}>
            Tu pedido
          </h3>

          {items.length === 0 ? (
            <p className={e.carritoVacio}>
              Tu carrito está vacío. Elige tus cafés en{" "}
              <Link href="/cafes" className={e.enlace}>
                Nuestros cafés
              </Link>{" "}
              o agrégalos aquí abajo.
            </p>
          ) : (
            <div className={e.tablaContenedor}>
              <table className={e.tabla} aria-labelledby="titulo-tu-pedido">
                <thead>
                  <tr>
                    <th scope="col">Producto</th>
                    <th scope="col">Cantidad</th>
                    <th scope="col" className={e.numerico}>
                      Precio unitario
                    </th>
                    <th scope="col" className={e.numerico}>
                      Subtotal
                    </th>
                    <th scope="col">
                      <span className={e.soloLector}>Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.cafe.id}>
                      <th scope="row">{i.cafe.nombre}</th>
                      <td>
                        <SelectorCantidad
                          valor={i.cantidad}
                          onCambiar={(n) => cambiarCantidad(i.cafe.id, n)}
                          producto={i.cafe.nombre}
                          max={MAX_POR_PRODUCTO}
                        />
                      </td>
                      <td className={e.numerico}>{dolares(i.cafe.precioCentavos)}</td>
                      <td className={e.numerico}>{dolares(i.subtotalCentavos)}</td>
                      <td>
                        <button
                          type="button"
                          className={e.quitar}
                          aria-label={`Quitar ${i.cafe.nombre} del pedido`}
                          onClick={() => alQuitar(i.cafe.id, i.cafe.nombre)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={3} className={e.totalEtiqueta}>
                      TOTAL
                    </th>
                    <td className={`${e.numerico} ${e.totalValor}`}>{dolares(totalCentavos)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className={e.agregarAqui} role="group" aria-labelledby="titulo-agregar-aqui">
            <p id="titulo-agregar-aqui" className={e.etiquetaCampo}>
              {items.length === 0 ? "Agregar un producto" : "Agregar otro producto"}
            </p>
            <div className={e.agregarFila}>
              <label htmlFor="campo-producto" className={e.soloLector}>
                Producto
              </label>
              <select
                ref={(el) => {
                  controles.current.productos = el;
                }}
                id="campo-producto"
                className={e.selector}
                value={productoElegido}
                aria-invalid={errores.productos ? true : undefined}
                aria-describedby={errores.productos ? "error-productos" : undefined}
                onChange={(ev) => setProductoElegido(ev.target.value)}
              >
                {CAFES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} · {dolares(c.precioCentavos)}
                  </option>
                ))}
              </select>
              <SelectorCantidad
                valor={cantidadElegida}
                onCambiar={setCantidadElegida}
                producto="el producto elegido"
              />
              <button type="button" className={e.botonSecundario} onClick={alAgregarDesdeAqui}>
                Agregar
              </button>
            </div>
            {errores.productos && (
              <p id="error-productos" className={e.error}>
                <span aria-hidden="true">⚠ </span>
                {errores.productos}
              </p>
            )}
          </div>

          <p className={e.anuncio} role="status" aria-live="polite">
            {anuncio}
          </p>

          <button type="submit" className={e.enviar}>
            Enviar
          </button>

          <p className={mensaje ? e.exito : e.anuncio} role="status" aria-live="polite">
            {mensaje && <span aria-hidden="true">✓ </span>}
            {mensaje}
          </p>
        </div>
      </form>
    </section>
  );
}
