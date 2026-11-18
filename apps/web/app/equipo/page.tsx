import type { Metadata } from "next";
import { EQUIPO, iniciales } from "../_inicio/datos";
import { Marco, Portada } from "../_inicio/marco";
import e from "./page.module.css";

export const metadata: Metadata = {
  title: "Cafetería Online Loja",
  description: "Las personas que preparan, cobran, hornean, organizan y reparten en la cafetería.",
};

/** Cinco tonos de avatar, todos con texto crema ≥ 7:1 (ver page.module.css). */
const TONOS = [e.tono1, e.tono2, e.tono3, e.tono4, e.tono5];

export default function PaginaEquipo() {
  return (
    <Marco actual="/equipo">
      <Portada id="titulo-equipo" antetitulo="Detrás de la barra" titulo="Nuestro equipo">
        Cinco personas que hacen posible cada taza, cada desayuno y cada entrega.
      </Portada>

      <section className={e.seccion} aria-labelledby="titulo-personas">
        <h2 id="titulo-personas" className={e.titulo}>
          Quiénes somos
        </h2>
        <ul className={e.rejilla}>
          {EQUIPO.map((p, i) => (
            <li key={p.nombre} className={e.tarjeta}>
              {/* Avatar ilustrado con iniciales: decorativo, el nombre va justo debajo. */}
              <svg
                className={`${e.avatar} ${TONOS[i % TONOS.length]}`}
                viewBox="0 0 120 120"
                aria-hidden="true"
                focusable="false"
              >
                <circle cx="60" cy="60" r="58" className={e.avatarFondo} />
                <g className={e.avatarGranos}>
                  <ellipse cx="24" cy="30" rx="7" ry="10" transform="rotate(25 24 30)" />
                  <ellipse cx="98" cy="88" rx="7" ry="10" transform="rotate(-35 98 88)" />
                  <ellipse cx="94" cy="26" rx="5" ry="7" transform="rotate(-20 94 26)" />
                </g>
                <text x="60" y="60" className={e.avatarTexto}>
                  {iniciales(p.nombre)}
                </text>
              </svg>
              <h3 className={e.nombre}>{p.nombre}</h3>
              <p className={e.cargo}>{p.cargo}</p>
              <dl className={e.datos}>
                <div>
                  <dt>Edad</dt>
                  <dd>{p.edad} años</dd>
                </div>
                <div>
                  <dt>En la cafetería</dt>
                  <dd>{p.antiguedad}</dd>
                </div>
              </dl>
              <p className={e.texto}>{p.texto}</p>
            </li>
          ))}
        </ul>
      </section>
    </Marco>
  );
}
