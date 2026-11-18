import type { Metadata } from "next";
import Link from "next/link";
import { Aparecer } from "./_inicio/aparecer";
import { Destacados } from "./_inicio/destacados";
import { Marco } from "./_inicio/marco";
import { Vapor } from "./_inicio/vapor";
import estilos from "./page.module.css";

export const metadata: Metadata = {
  title: "Inicio · Cafetería UTPL",
  description: "Consulta la carta del día, arma tu carrito y gestiona la disponibilidad.",
};

const ACCIONES = [
  {
    href: "/menu",
    icono: "/inicio/icono-menu.svg",
    titulo: "Menú",
    texto: "La carta publicada de hoy, con precios, alérgenos y lo que está disponible ahora.",
  },
  {
    href: "/carrito",
    icono: "/inicio/icono-carrito.svg",
    titulo: "Carrito",
    texto: "Revisa lo que elegiste, ajusta las cantidades y mira el total al instante.",
  },
  {
    href: "/personal/disponibilidad",
    icono: "/inicio/icono-personal.svg",
    titulo: "Personal",
    texto: "Marca productos agotados y actualiza las existencias del día.",
  },
] as const;

export default function Home() {
  return (
    <Marco actual="/" className={estilos.pagina}>
        <section className={estilos.hero} aria-labelledby="titulo-hero">
          <div className={estilos.heroInterior}>
            <div className={estilos.heroTexto}>
              <p className={estilos.antetitulo}>Café de especialidad en el campus</p>
              <h1 id="titulo-hero" className={estilos.heroTitulo}>
                Te damos la bienvenida a <em>Cafetería UTPL</em>
              </h1>
              <p className={estilos.heroDescripcion}>
                Mira la carta del día, elige lo que se te antoje y guárdalo en tu carrito en un par
                de toques. Nosotros ponemos el café.
              </p>
              <div className={estilos.heroBotones}>
                <Link href="/conocenos" className={estilos.botonPrincipal}>
                  Conoce nuestra historia
                </Link>
                <Link href="/domicilio" className={estilos.botonSecundario}>
                  Servicio a domicilio
                </Link>
              </div>
            </div>
            <div className={estilos.heroIlustracion}>
              <Vapor />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/inicio/taza.svg"
                alt="Ilustración de una taza de café humeante con arte latte en forma de corazón"
                width={320}
                height={240}
                className={estilos.taza}
              />
            </div>
          </div>
        </section>

        <section className={estilos.seccion} aria-labelledby="titulo-acciones">
          <Aparecer>
            <h2 id="titulo-acciones" className={estilos.seccionTitulo}>
              ¿Qué quieres hacer hoy?
            </h2>
          </Aparecer>
          <ul className={estilos.rejillaAcciones}>
            {ACCIONES.map((a, i) => (
              <li key={a.href}>
                <Aparecer retraso={i * 120}>
                  <Link href={a.href} className={estilos.tarjeta}>
                    <span className={estilos.tarjetaIcono}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.icono} alt="" width={64} height={64} />
                    </span>
                    <span className={estilos.tarjetaTitulo}>{a.titulo}</span>
                    <span className={estilos.tarjetaTexto}>{a.texto}</span>
                    <span className={estilos.tarjetaFlecha} aria-hidden="true">
                      →
                    </span>
                  </Link>
                </Aparecer>
              </li>
            ))}
          </ul>
        </section>

        <section
          className={`${estilos.seccion} ${estilos.seccionCrema}`}
          aria-labelledby="titulo-destacados"
        >
          <div className={estilos.seccionInterior}>
            <Aparecer>
              <h2 id="titulo-destacados" className={estilos.seccionTitulo}>
                Destacados de hoy
              </h2>
              <p className={estilos.seccionIntro}>Recién salidos de la carta publicada.</p>
            </Aparecer>
            <Aparecer retraso={120}>
              <Destacados />
            </Aparecer>
          </div>
        </section>
    </Marco>
  );
}
