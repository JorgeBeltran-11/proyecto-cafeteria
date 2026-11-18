import type { Metadata } from "next";
import Link from "next/link";
import { ANIO_FUNDACION, HISTORIA, MISION, VALORES, VISION } from "../_inicio/datos";
import { Marco, Portada } from "../_inicio/marco";
import { AniosDesde } from "./anios";
import e from "./page.module.css";

export const metadata: Metadata = {
  title: "Conócenos · Cafetería UTPL",
  description: "La historia de la Cafetería UTPL desde 2019, su misión, su visión y sus valores.",
};

const RESPALDO_ANIOS = `desde ${ANIO_FUNDACION}`;

export default function PaginaConocenos() {
  return (
    <Marco actual="/conocenos">
      <Portada id="titulo-conocenos" antetitulo="Nuestra historia" titulo="Conócenos">
        Empezamos como un sueño de estudiantes: que en el campus se pudiera tomar un buen café de
        Loja. Hoy servimos a toda la comunidad universitaria.
      </Portada>

      <section className={e.cifra} aria-labelledby="titulo-cifra">
        <div className={e.cifraInterior}>
          <h2 id="titulo-cifra" className={e.cifraTitulo}>
            Llevamos funcionando
          </h2>
          <p className={e.cifraValor}>
            <AniosDesde desde={ANIO_FUNDACION} respaldo={RESPALDO_ANIOS} />
          </p>
          <p className={e.cifraTexto}>Fundada en {ANIO_FUNDACION} en el campus de la UTPL, Loja.</p>
        </div>
      </section>

      <section className={e.seccion} aria-labelledby="titulo-historia">
        <h2 id="titulo-historia" className={e.titulo}>
          Línea de tiempo
        </h2>
        <ol className={e.linea}>
          {HISTORIA.map((h) => (
            <li key={h.anio + h.titulo} className={e.hito}>
              <span className={e.hitoAnio}>{h.anio}</span>
              <div className={e.hitoTarjeta}>
                <h3 className={e.hitoTitulo}>{h.titulo}</h3>
                <p className={e.hitoTexto}>{h.texto}</p>
              </div>
            </li>
          ))}
          <li className={`${e.hito} ${e.hitoHoy}`}>
            <span className={e.hitoAnio}>Hoy</span>
            <div className={e.hitoTarjeta}>
              <h3 className={e.hitoTitulo}>
                <AniosDesde desde={ANIO_FUNDACION} respaldo={RESPALDO_ANIOS} /> sirviendo café
              </h3>
              <p className={e.hitoTexto}>
                Seguimos creciendo con el mismo objetivo del primer día. Mira{" "}
                <Link href="/cafes" className={e.enlace}>
                  nuestros cafés
                </Link>{" "}
                o conoce a{" "}
                <Link href="/equipo" className={e.enlace}>
                  nuestro equipo
                </Link>
                .
              </p>
            </div>
          </li>
        </ol>
      </section>

      <section className={e.seccionCrema} aria-labelledby="titulo-proposito">
        <div className={e.seccionInterior}>
          <h2 id="titulo-proposito" className={e.titulo}>
            Lo que nos mueve
          </h2>
          <div className={e.proposito}>
            <article className={e.bloque} aria-labelledby="titulo-mision">
              <h3 id="titulo-mision" className={e.bloqueTitulo}>
                Misión
              </h3>
              <p>{MISION}</p>
            </article>
            <article className={e.bloque} aria-labelledby="titulo-vision">
              <h3 id="titulo-vision" className={e.bloqueTitulo}>
                Visión
              </h3>
              <p>{VISION}</p>
            </article>
          </div>

          <h3 className={e.valoresTitulo}>Nuestros valores</h3>
          <ul className={e.valores}>
            {VALORES.map((v) => (
              <li key={v.titulo} className={e.valor}>
                <span className={e.valorTitulo}>{v.titulo}</span>
                <span className={e.valorTexto}>{v.texto}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </Marco>
  );
}
