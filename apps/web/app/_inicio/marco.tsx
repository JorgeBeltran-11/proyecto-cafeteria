import Link from "next/link";
import type { ReactNode } from "react";
import { CONTACTO, EXPLORA, NAVEGACION, type RutaNavegacion } from "./datos";
import { Suscripcion, VolverArriba } from "./pie-interactivo";
import m from "./marco.module.css";

/** id de la marca de la cabecera: destino del foco al pulsar "Volver arriba". */
const ID_MARCA = "marca-cafeteria";

/** Enlace de salto + cabecera fija con la navegación principal. */
export function Cabecera({ actual }: { actual?: RutaNavegacion }) {
  return (
    <>
      <a href="#contenido" className={m.saltar}>
        Saltar al contenido
      </a>
      <header className={m.cabecera}>
        <div className={m.cabeceraInterior}>
          <Link href="/" id={ID_MARCA} className={m.marca}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/inicio/logo-taza.svg" alt="" width={36} height={36} />
            <span>Cafetería UTPL</span>
          </Link>
          <nav aria-label="Principal">
            <ul className={m.navLista}>
              {NAVEGACION.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={n.href === actual ? "page" : undefined}
                    className={m.navEnlace}
                  >
                    {n.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
    </>
  );
}

/** Ícono de línea simple (24×24) para el pie. */
function Icono({ trazo }: { trazo: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      className={m.pieIcono}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={trazo}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const ICONOS = {
  ubicacion: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  reloj: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  telefono:
    "M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  whatsapp:
    "M4 20l1.3-4A8 8 0 1 1 8.4 19L4 20zM9 8.5c0 3.5 3 6.5 6.5 6.5l1-1.5-2-1-1 .8a4 4 0 0 1-2.3-2.3l.8-1-1-2L9 8.5z",
  correo: "M3 6h18v12H3zM3 7l9 6 9-6",
} as const;

/** Pie común: visítanos, explora, atención al cliente, promociones y volver arriba. */
export function Pie() {
  return (
    <footer className={m.pie}>
      <div className={m.pieInterior}>
        <div className={m.pieColumnas}>
          <section aria-labelledby="pie-visitanos">
            <h2 id="pie-visitanos" className={m.pieTitulo}>
              Visítanos
            </h2>
            <ul className={m.pieLista}>
              <li className={m.pieDato}>
                <Icono trazo={ICONOS.ubicacion} />
                <address className={m.pieDireccion}>{CONTACTO.direccion}</address>
              </li>
              <li className={m.pieDato}>
                <Icono trazo={ICONOS.reloj} />
                <span>
                  {CONTACTO.horario.map((h) => (
                    <span key={h} className={m.pieLinea}>
                      {h}
                    </span>
                  ))}
                </span>
              </li>
            </ul>
          </section>

          <nav aria-labelledby="pie-explora">
            <h2 id="pie-explora" className={m.pieTitulo}>
              Explora
            </h2>
            <ul className={m.pieLista}>
              {EXPLORA.map((e) => (
                <li key={e.href}>
                  <Link href={e.href} className={m.pieEnlace}>
                    {e.texto}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section aria-labelledby="pie-atencion">
            <h2 id="pie-atencion" className={m.pieTitulo}>
              Atención al cliente
            </h2>
            <ul className={m.pieLista}>
              <li className={m.pieDato}>
                <Icono trazo={ICONOS.telefono} />
                <a href={CONTACTO.telefono.enlace} className={m.pieEnlace}>
                  <span className={m.soloLector}>Teléfono: </span>
                  {CONTACTO.telefono.texto}
                </a>
              </li>
              <li className={m.pieDato}>
                <Icono trazo={ICONOS.whatsapp} />
                <a href={CONTACTO.whatsapp.enlace} className={m.pieEnlace}>
                  <span className={m.soloLector}>WhatsApp: </span>
                  {CONTACTO.whatsapp.texto}
                </a>
              </li>
              <li className={m.pieDato}>
                <Icono trazo={ICONOS.correo} />
                <a href={`mailto:${CONTACTO.correo}`} className={m.pieEnlace}>
                  <span className={m.soloLector}>Correo: </span>
                  {CONTACTO.correo}
                </a>
              </li>
              <li className={m.pieTextoSimple}>Preguntas frecuentes</li>
              <li className={m.pieTextoSimple}>Políticas de privacidad</li>
            </ul>
          </section>

          <section aria-labelledby="pie-promociones">
            <h2 id="pie-promociones" className={m.pieTitulo}>
              Recibe nuestras promociones
            </h2>
            <p className={m.pieParrafo}>
              Descuentos de temporada, cafés nuevos y ofertas para la comunidad UTPL, directo en tu
              correo.
            </p>
            <Suscripcion />
          </section>
        </div>

        <div className={m.pieAccion}>
          <VolverArriba destino={ID_MARCA} />
        </div>

        <p className={m.pieLegal}>© 2026 Cafetería UTPL · Todos los derechos reservados</p>
      </div>
    </footer>
  );
}

/** Portada oscura con el patrón de granos para las páginas interiores. */
export function Portada({
  id,
  antetitulo,
  titulo,
  children,
}: {
  id: string;
  antetitulo: string;
  titulo: string;
  children?: ReactNode;
}) {
  return (
    <section className={m.portada} aria-labelledby={id}>
      <div className={m.portadaInterior}>
        <p className={m.antetitulo}>{antetitulo}</p>
        <h1 id={id} className={m.portadaTitulo}>
          {titulo}
        </h1>
        {children && <p className={m.portadaTexto}>{children}</p>}
      </div>
    </section>
  );
}

/** Página completa: cabecera, contenido principal enfocable y pie. */
export function Marco({
  actual,
  className,
  children,
}: {
  actual?: RutaNavegacion;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className ? `${m.pagina} ${className}` : m.pagina}>
      <Cabecera actual={actual} />
      <main id="contenido" tabIndex={-1} className={m.principal}>
        {children}
      </main>
      <Pie />
    </div>
  );
}
