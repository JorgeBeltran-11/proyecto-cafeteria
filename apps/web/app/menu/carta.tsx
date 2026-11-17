"use client";

import type {
  Alergeno,
  AlergenoVista,
  CartaPublica,
  MenuPublico,
  ProductoPublico,
} from "@cafeteria/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiMenu, dinero, ErrorApi } from "./api";

function mensajeDeError(error: unknown): string {
  return error instanceof ErrorApi ? error.message : "Ocurrió un error inesperado. Inténtalo de nuevo.";
}

function contarProductos(carta: CartaPublica): number {
  return carta.menus.reduce(
    (total, m) => total + m.categorias.reduce((n, c) => n + c.productos.length, 0),
    0,
  );
}

function idCategoria(menu: MenuPublico, indice: number): string {
  return `menu-${menu.id}-categoria-${indice}`;
}

function Producto({ producto }: { producto: ProductoPublico }) {
  const claseEstado =
    producto.disponibilidad === "disponible" ? "estado-ok" : "estado-error";
  return (
    <li className="producto">
      {producto.imagenUrl && (
        // Las imágenes las define el administrador (URL externa o del sitio): next/image exigiría
        // declarar cada dominio. El texto alternativo es obligatorio para publicar (FR-004).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="producto-imagen"
          src={producto.imagenUrl}
          alt={producto.imagenAlt ?? ""}
          width={96}
          height={96}
          loading="lazy"
        />
      )}
      <div>
        <h4 className="producto-nombre">{producto.nombre}</h4>
        {producto.descripcion && <p>{producto.descripcion}</p>}
        <p className="producto-precio">{dinero(producto.precioCentavos)}</p>
        <p>
          <span className="etiqueta">Alérgenos:</span>{" "}
          {producto.alergenos.length > 0
            ? producto.alergenos.map((a) => a.nombre).join(", ")
            : "ninguno de declaración obligatoria"}
        </p>
        <p className={claseEstado}>{producto.textoDisponibilidad}</p>
      </div>
    </li>
  );
}

function Menu({ menu }: { menu: MenuPublico }) {
  const idTitulo = `menu-${menu.id}-titulo`;
  return (
    <section className="menu" aria-labelledby={idTitulo}>
      <h2 id={idTitulo}>{menu.nombre}</h2>
      <p className={menu.disponibleAhora ? "estado-ok" : "estado-error"}>
        {menu.disponibleAhora
          ? "Disponible ahora."
          : `No disponible ahora.${menu.proximaApertura ? ` Disponible: ${menu.proximaApertura.charAt(0).toLowerCase()}${menu.proximaApertura.slice(1)}.` : ""}`}
      </p>
      <p className="ayuda">Horario: {menu.textoHorario}.</p>

      {menu.categorias.length === 0 ? (
        <p>Este menú no tiene productos que mostrar con los filtros elegidos.</p>
      ) : (
        menu.categorias.map((categoria, i) => (
          <section key={categoria.nombre} aria-labelledby={idCategoria(menu, i)}>
            <h3 id={idCategoria(menu, i)} tabIndex={-1}>
              {categoria.nombre}
            </h3>
            <ul className="lista-productos-menu">
              {categoria.productos.map((p) => (
                <Producto key={p.id} producto={p} />
              ))}
            </ul>
          </section>
        ))
      )}
    </section>
  );
}

export function Carta() {
  const [alergenos, setAlergenos] = useState<AlergenoVista[]>([]);
  const [excluidos, setExcluidos] = useState<Alergeno[]>([]);
  const [carta, setCarta] = useState<CartaPublica | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const secuencia = useRef(0);

  const cargar = useCallback((filtro: readonly Alergeno[], anunciar: boolean) => {
    // Solo se aplica la respuesta más reciente si se cambia el filtro rápido.
    const seq = ++secuencia.current;
    return apiMenu.carta(filtro).then(
      (nueva) => {
        if (seq !== secuencia.current) return;
        setCarta(nueva);
        setError(null);
        if (anunciar) {
          const n = contarProductos(nueva);
          setAnuncio(n === 1 ? "Se muestra 1 producto." : `Se muestran ${n} productos.`);
        }
      },
      (e: unknown) => {
        if (seq === secuencia.current) setError(mensajeDeError(e));
      },
    );
  }, []);

  useEffect(() => {
    void cargar([], false);
    apiMenu
      .alergenos()
      .then(setAlergenos)
      .catch(() => setAlergenos([]));
  }, [cargar]);

  // Los cambios publicados se ven al volver a la pestaña, sin recargar (FR-006).
  useEffect(() => {
    const refrescar = () => {
      if (document.visibilityState === "visible") void cargar(excluidos, false);
    };
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [cargar, excluidos]);

  function alternar(codigo: Alergeno, marcado: boolean) {
    const nuevos = marcado
      ? [...excluidos, codigo]
      : excluidos.filter((c) => c !== codigo);
    setExcluidos(nuevos);
    void cargar(nuevos, true);
  }

  const hayProductos = carta !== null && contarProductos(carta) > 0;

  return (
    <>
      <h1>Menú de la cafetería</h1>

      <p className="anuncio" role="status" aria-live="polite">
        {anuncio}
      </p>

      {alergenos.length > 0 && (
        <details className="filtro">
          <summary>Filtrar por alérgenos</summary>
          <fieldset>
            <legend>Ocultar los productos que contienen:</legend>
            <div className="opciones-alergenos">
              {alergenos.map((a) => (
                <label key={a.codigo} className="opcion">
                  <input
                    type="checkbox"
                    checked={excluidos.includes(a.codigo)}
                    onChange={(e) => alternar(a.codigo, e.target.checked)}
                  />
                  {a.nombre}
                </label>
              ))}
            </div>
          </fieldset>
        </details>
      )}

      {error && (
        <div className="error-carga" role="alert">
          <p className="estado-error">{error}</p>
          <button type="button" onClick={() => void cargar(excluidos, false)}>
            Reintentar
          </button>
        </div>
      )}

      {carta === null && !error && <p>Cargando el menú…</p>}

      {carta !== null && carta.menus.length === 0 && (
        <p>Todavía no hay ningún menú publicado. Vuelve más tarde.</p>
      )}

      {carta !== null && carta.menus.length > 0 && !hayProductos && (
        <p>
          Ningún producto cumple los filtros elegidos. Quita algún alérgeno del filtro para ver
          más productos.
        </p>
      )}

      {carta !== null && hayProductos && (
        <nav aria-label="Categorías del menú" className="indice">
          <ul>
            {carta.menus.flatMap((m) =>
              m.categorias.map((c, i) => (
                <li key={idCategoria(m, i)}>
                  <a href={`#${idCategoria(m, i)}`}>
                    {c.nombre}
                    {carta.menus.length > 1 ? ` (${m.nombre})` : ""}
                  </a>
                </li>
              )),
            )}
          </ul>
        </nav>
      )}

      {carta?.menus.map((m) => (
        <Menu key={m.id} menu={m} />
      ))}
    </>
  );
}
