import type { Metadata } from "next";
import Link from "next/link";
import { CAFES, dolares } from "../_inicio/datos";
import { Marco, Portada } from "../_inicio/marco";
import { AgregarCafe } from "./agregar";
import e from "./page.module.css";

export const metadata: Metadata = {
  title: "Cafetería Online Loja",
  description: "Espresso, americano, capuchino, latte y mocaccino preparados con café de Loja.",
};

export default function PaginaCafes() {
  return (
    <Marco actual="/cafes">
      <Portada id="titulo-cafes" antetitulo="Café de Loja" titulo="Nuestros cafés">
        Cinco clásicos preparados al momento con granos de fincas lojanas, tostados cada semana.
      </Portada>

      <section className={e.seccion} aria-labelledby="titulo-carta">
        <h2 id="titulo-carta" className={e.titulo}>
          La carta de cafés
        </h2>
        <ul className={e.rejilla}>
          {CAFES.map((c) => (
            <li key={c.id} className={e.tarjeta}>
              <div className={e.ilustracion}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.imagen} alt={c.alt} width={240} height={200} loading="lazy" />
              </div>
              <div className={e.cuerpo}>
                <h3 className={e.nombre}>{c.nombre}</h3>
                <p className={e.descripcion}>{c.descripcion}</p>
                <p className={e.precio}>
                  <span className={e.soloLector}>Precio: </span>
                  {dolares(c.precioCentavos)}
                </p>
                <AgregarCafe cafe={c} />
              </div>
            </li>
          ))}
        </ul>
        <p className={e.nota}>
          ¿Quieres pedir ahora? Arma tu pedido en la{" "}
          <Link href="/menu" className={e.enlace}>
            carta dinámica
          </Link>{" "}
          o pide a{" "}
          <Link href="/domicilio" className={e.enlace}>
            domicilio
          </Link>
          .
        </p>
      </section>
    </Marco>
  );
}
