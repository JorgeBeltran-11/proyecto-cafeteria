"use client";

import type { DisponibilidadVista } from "@cafeteria/shared";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { apiDisponibilidad, ErrorApi } from "../../menu/api";

/** PENDIENTE(spec-002): usuario del personal de prueba hasta que exista el inicio de sesión. */
const USUARIO_PERSONAL = "personal-demo";

type Cambios = { agotado?: boolean; existencias?: number | null };

function mensajeDeError(error: unknown): string {
  return error instanceof ErrorApi ? error.message : "Ocurrió un error inesperado. Inténtalo de nuevo.";
}

function textoEstado(p: DisponibilidadVista): string {
  if (p.agotado) return "Agotado";
  if (p.existencias === 0) return "Agotado: sin existencias";
  if (p.existencias !== null) return `Disponible: quedan ${p.existencias}`;
  return "Disponible";
}

function FilaProducto({
  producto,
  onCambiar,
}: {
  producto: DisponibilidadVista;
  onCambiar: (producto: DisponibilidadVista, cambios: Cambios, mensaje: string) => Promise<void>;
}) {
  const [borrador, setBorrador] = useState(
    producto.existencias === null ? "" : String(producto.existencias),
  );
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const idCampo = `existencias-${producto.id}`;
  const idAyuda = `${idCampo}-ayuda`;
  const idError = `${idCampo}-error`;
  const agotado = producto.agotado || producto.existencias === 0;

  function guardarExistencias(e: FormEvent) {
    e.preventDefault();
    const texto = borrador.trim();
    if (texto === "") {
      setErrorCampo(null);
      void onCambiar(producto, { existencias: null }, `${producto.nombre}: ya no controla existencias.`);
      return;
    }
    const valor = Number(texto);
    if (!/^\d+$/.test(texto) || valor > 100000) {
      setErrorCampo(
        "Escribe un número entero entre 0 y 100000, o déjalo vacío si no controla existencias.",
      );
      return;
    }
    setErrorCampo(null);
    void onCambiar(producto, { existencias: valor }, `${producto.nombre}: existencias guardadas (${valor}).`);
  }

  return (
    <li className="linea">
      <h2 className="producto-nombre">{producto.nombre}</h2>
      <p className={agotado ? "estado-error" : "estado-ok"}>{textoEstado(producto)}</p>
      <div className="fila">
        <button
          type="button"
          className={producto.agotado ? undefined : "secundario"}
          onClick={() =>
            void onCambiar(
              producto,
              { agotado: !producto.agotado },
              producto.agotado
                ? `${producto.nombre} marcado como disponible.`
                : `${producto.nombre} marcado como agotado.`,
            )
          }
        >
          {producto.agotado ? "Marcar como disponible" : "Marcar como agotado"}
          <span className="solo-lector">: {producto.nombre}</span>
        </button>
      </div>
      <form className="existencias" onSubmit={guardarExistencias} noValidate>
        <label htmlFor={idCampo}>Existencias de {producto.nombre}</label>
        <p className="ayuda" id={idAyuda}>
          Déjalo vacío si el producto se prepara al momento y no lleva existencias.
        </p>
        <div className="fila">
          <input
            id={idCampo}
            className="cantidad"
            inputMode="numeric"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            aria-invalid={errorCampo ? true : undefined}
            aria-describedby={errorCampo ? `${idAyuda} ${idError}` : idAyuda}
          />
          <button type="submit" className="secundario">
            Guardar existencias
            <span className="solo-lector"> de {producto.nombre}</span>
          </button>
        </div>
        {errorCampo && (
          <p className="estado-error" id={idError}>
            {errorCampo}
          </p>
        )}
      </form>
    </li>
  );
}

export function Disponibilidad() {
  const [productos, setProductos] = useState<DisponibilidadVista[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");

  const cargar = useCallback(
    () =>
      apiDisponibilidad.listar(USUARIO_PERSONAL).then(
        (lista) => {
          setProductos(lista);
          setError(null);
        },
        (e: unknown) => setError(mensajeDeError(e)),
      ),
    [],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiar = useCallback(
    async (producto: DisponibilidadVista, cambios: Cambios, mensaje: string) => {
      try {
        const actualizado = await apiDisponibilidad.cambiar(USUARIO_PERSONAL, producto.id, cambios);
        setProductos((lista) =>
          lista === null ? lista : lista.map((p) => (p.id === actualizado.id ? actualizado : p)),
        );
        setAnuncio(mensaje);
      } catch (e) {
        setAnuncio(`No se guardó el cambio de ${producto.nombre}. ${mensajeDeError(e)}`);
      }
    },
    [],
  );

  return (
    <>
      <h1>Disponibilidad del día</h1>
      <p className="ayuda">
        Marca los productos agotados o ajusta sus existencias. Los clientes ven el cambio en la
        tienda en cuanto la recargan. Los precios y contenidos solo los cambia un administrador.
      </p>
      <p className="cliente-prueba">
        Sesión de prueba del personal: <code>{USUARIO_PERSONAL}</code> (provisional hasta que
        exista el inicio de sesión).
      </p>

      <p className="anuncio" role="status" aria-live="polite">
        {anuncio}
      </p>

      {error && (
        <div className="error-carga" role="alert">
          <p className="estado-error">{error}</p>
          <button type="button" onClick={() => void cargar()}>
            Reintentar
          </button>
        </div>
      )}

      {productos === null && !error && <p>Cargando productos…</p>}
      {productos !== null && productos.length === 0 && <p>No hay productos en el catálogo.</p>}

      {productos !== null && productos.length > 0 && (
        <ul className="lineas">
          {productos.map((p) => (
            <FilaProducto key={p.id} producto={p} onCambiar={cambiar} />
          ))}
        </ul>
      )}
    </>
  );
}
