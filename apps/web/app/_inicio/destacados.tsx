"use client";

import type { CartaPublica, ProductoPublico } from "@cafeteria/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiMenu, dinero } from "../menu/api";
import estilos from "../page.module.css";

const MAXIMO = 4;

type Estado =
  | { tipo: "cargando" }
  | { tipo: "error" }
  | { tipo: "listo"; productos: ProductoPublico[] };

/** Hasta 4 productos de la carta publicada, primero los que se pueden pedir ahora. */
function elegir(carta: CartaPublica): ProductoPublico[] {
  const todos = carta.menus.flatMap((m) => m.categorias.flatMap((c) => c.productos));
  const unicos = todos.filter((p, i) => todos.findIndex((q) => q.id === p.id) === i);
  return [...unicos.filter((p) => p.sePuedePedir), ...unicos.filter((p) => !p.sePuedePedir)].slice(
    0,
    MAXIMO,
  );
}

export function Destacados() {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    apiMenu.carta([]).then(
      (carta) => {
        if (vigente) setEstado({ tipo: "listo", productos: elegir(carta) });
      },
      () => {
        if (vigente) setEstado({ tipo: "error" });
      },
    );
    return () => {
      vigente = false;
    };
  }, [intento]);

  function reintentar() {
    setEstado({ tipo: "cargando" });
    setIntento((n) => n + 1);
  }

  return (
    <>
      <div role="status" aria-live="polite" className={estilos.anuncioDestacados}>
        {estado.tipo === "cargando" && <p className={estilos.soloLector}>Cargando los destacados…</p>}
        {estado.tipo === "error" && (
          <div className={estilos.avisoAmable}>
            <p>
              <strong>La carta se está tomando un respiro.</strong> No pudimos traer los destacados
              ahora mismo; vuelve a intentarlo en un momento.
            </p>
            <button type="button" className={estilos.botonSecundarioClaro} onClick={reintentar}>
              Reintentar
            </button>
          </div>
        )}
        {estado.tipo === "listo" && estado.productos.length === 0 && (
          <p className={estilos.avisoAmable}>
            Hoy todavía no hay productos publicados. ¡Vuelve pronto!
          </p>
        )}
      </div>

      {estado.tipo === "cargando" && (
        <ul className={estilos.rejillaProductos} aria-hidden="true">
          {Array.from({ length: MAXIMO }, (_, i) => (
            <li key={i} className={`${estilos.producto} ${estilos.esqueleto}`}>
              <div className={estilos.productoImagen} />
              <div className={estilos.productoTexto}>
                <span className={estilos.lineaEsqueleto} />
                <span className={estilos.lineaEsqueletoCorta} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {estado.tipo === "listo" && estado.productos.length > 0 && (
        <ul className={estilos.rejillaProductos}>
          {estado.productos.map((p) => (
            <li key={p.id} className={estilos.producto}>
              {/* Las imágenes las define el administrador (URL externa o del sitio), como en /menu. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={estilos.productoImagen}
                src={p.imagenUrl ?? "/inicio/producto.svg"}
                alt={p.imagenUrl ? (p.imagenAlt ?? "") : ""}
                width={320}
                height={240}
                loading="lazy"
              />
              <div className={estilos.productoTexto}>
                <h3 className={estilos.productoNombre}>{p.nombre}</h3>
                <p className={estilos.productoPrecio}>{dinero(p.precioCentavos)}</p>
                <p className={estilos.productoEstado}>{p.textoDisponibilidad}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className={estilos.verTodo}>
        <Link href="/menu" className={estilos.botonPrincipalOscuro}>
          Ver todo el menú <span aria-hidden="true">→</span>
        </Link>
      </p>
    </>
  );
}
