"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CHAT, responderChat, type IdRespuesta } from "../_inicio/datos";
import e from "./page.module.css";

type Mensaje = { id: number; autor: "cafeteria" | "cliente"; texto: string };

const RETRASO_RESPUESTA_MS = 900;

function mensajesIniciales(): Mensaje[] {
  return CHAT.bienvenida.map((texto, i) => ({ id: i, autor: "cafeteria", texto }));
}

/**
 * Chat de pedidos con respuestas automáticas; todo ocurre en el navegador.
 * El panel se abre con el botón circular y se cierra con Escape o con el botón "Cerrar".
 */
export function Chat() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>(mensajesIniciales);
  const [escribiendo, setEscribiendo] = useState(false);
  const [borrador, setBorrador] = useState("");

  const siguienteId = useRef(CHAT.bienvenida.length);
  const temporizadores = useRef<number[]>([]);
  const boton = useRef<HTMLButtonElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLOListElement>(null);
  const base = useId();
  const idPanel = `${base}-panel`;
  const idTitulo = `${base}-titulo`;
  const idCampo = `${base}-campo`;

  // Al abrir, el foco pasa al campo de texto.
  useEffect(() => {
    if (abierto) campo.current?.focus();
  }, [abierto]);

  // Mantiene visible el último mensaje.
  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes, escribiendo]);

  // Cancela las respuestas pendientes al salir de la página.
  useEffect(() => {
    const pendientes = temporizadores.current;
    return () => pendientes.forEach((t) => window.clearTimeout(t));
  }, []);

  function agregar(autor: Mensaje["autor"], texto: string) {
    const id = siguienteId.current++;
    setMensajes((m) => [...m, { id, autor, texto }]);
  }

  function enviar(texto: string, respuesta: IdRespuesta) {
    agregar("cliente", texto);
    setEscribiendo(true);
    const t = window.setTimeout(() => {
      agregar("cafeteria", CHAT.respuestas[respuesta]);
      setEscribiendo(false);
    }, RETRASO_RESPUESTA_MS);
    temporizadores.current.push(t);
  }

  function alEnviar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const texto = borrador.trim();
    if (!texto) {
      campo.current?.focus();
      return;
    }
    enviar(texto, responderChat(texto));
    setBorrador("");
  }

  function cerrar() {
    setAbierto(false);
    boton.current?.focus();
  }

  function alPulsarTecla(ev: KeyboardEvent<HTMLElement>) {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      cerrar();
    }
  }

  return (
    <div className={e.chat}>
      <button
        ref={boton}
        type="button"
        className={e.botonChat}
        aria-expanded={abierto}
        aria-controls={idPanel}
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
      >
        <span className={e.circuloChat}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/inicio/whatsapp.svg" alt="WhatsApp" width={60} height={60} />
        </span>
        <span className={e.textoBotonChat}>Escríbenos por WhatsApp</span>
      </button>

      {abierto && (
        <section
          id={idPanel}
          className={e.panel}
          aria-labelledby={idTitulo}
          onKeyDown={alPulsarTecla}
        >
          <header className={e.panelCabecera}>
            <span className={e.panelAvatar}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/inicio/whatsapp.svg" alt="WhatsApp" width={30} height={30} />
            </span>
            <div>
              <h2 id={idTitulo} className={e.panelTitulo}>
                Cafetería UTPL
              </h2>
              <p className={e.panelSubtitulo}>En línea · respondemos al instante</p>
            </div>
            <button type="button" className={e.cerrar} onClick={cerrar}>
              Cerrar<span className={e.soloLector}> el chat</span>
            </button>
          </header>

          <ol ref={lista} className={e.mensajes} role="log" aria-live="polite" tabIndex={0} aria-label="Mensajes">
            {mensajes.map((m) => (
              <li
                key={m.id}
                className={m.autor === "cliente" ? e.mensajeCliente : e.mensajeCafeteria}
              >
                <span className={e.soloLector}>
                  {m.autor === "cliente" ? "Tú dices: " : "La cafetería dice: "}
                </span>
                {m.texto}
              </li>
            ))}
            {escribiendo && (
              <li className={e.escribiendo}>La cafetería está escribiendo…</li>
            )}
          </ol>

          <div className={e.rapidas} role="group" aria-label="Respuestas rápidas">
            {CHAT.respuestasRapidas.map((r) => (
              <button
                key={r.id}
                type="button"
                className={e.rapida}
                onClick={() => enviar(r.texto, r.id)}
              >
                {r.texto}
              </button>
            ))}
          </div>

          <form className={e.formulario} onSubmit={alEnviar}>
            <label htmlFor={idCampo} className={e.soloLector}>
              Escribe tu mensaje
            </label>
            <input
              ref={campo}
              id={idCampo}
              className={e.campo}
              type="text"
              autoComplete="off"
              placeholder="Escribe tu mensaje…"
              value={borrador}
              onChange={(ev) => setBorrador(ev.target.value)}
            />
            <button type="submit" className={e.enviar}>
              Enviar
            </button>
          </form>
          <p className={e.ayuda}>Pulsa Escape para cerrar el chat.</p>
        </section>
      )}
    </div>
  );
}
