import type { Metadata } from "next";
import {
  COSTOS_ENVIO,
  PEDIDO_MINIMO_CENTAVOS,
  SERVICIO_DOMICILIO,
  dolares,
} from "../_inicio/datos";
import { Marco, Portada } from "../_inicio/marco";
import { Chat } from "./chat";
import e from "./page.module.css";

export const metadata: Metadata = {
  title: "Cafetería Online Loja",
  description: "Zonas, horario, tiempos y costos de envío del servicio a domicilio.",
};

export default function PaginaDomicilio() {
  return (
    <Marco actual="/domicilio">
      <Portada id="titulo-domicilio" antetitulo="Hasta tu puerta" titulo="Servicio a domicilio">
        {SERVICIO_DOMICILIO.intro}
      </Portada>

      <div className={e.contenido}>
        <div className={e.columnaInfo}>
          <section aria-labelledby="titulo-como">
            <h2 id="titulo-como" className={e.titulo}>
              ¿En qué consiste?
            </h2>
            <dl className={e.detalles}>
              {SERVICIO_DOMICILIO.detalles.map((d) => (
                <div key={d.titulo} className={e.detalle}>
                  <dt className={e.detalleTitulo}>{d.titulo}</dt>
                  <dd className={e.detalleTexto}>{d.texto}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="titulo-costos" className={e.costos}>
            <h2 id="titulo-costos" className={e.titulo}>
              Costos de envío
            </h2>
            <table className={e.tabla}>
              <caption className={e.soloLector}>Costo de envío según la zona de entrega</caption>
              <thead>
                <tr>
                  <th scope="col">Zona</th>
                  <th scope="col" className={e.columnaCosto}>
                    Costo
                  </th>
                </tr>
              </thead>
              <tbody>
                {COSTOS_ENVIO.map((c) => (
                  <tr key={c.zona}>
                    <th scope="row">
                      <span className={e.zona}>{c.zona}</span>
                      <span className={e.zonaDetalle}>{c.detalle}</span>
                    </th>
                    <td className={e.columnaCosto}>
                      <span className={e.costo}>{dolares(c.costoCentavos)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={e.minimo}>
              <strong>Pedido mínimo: {dolares(PEDIDO_MINIMO_CENTAVOS)}</strong> (sin contar el
              envío).
            </p>
          </section>
        </div>

        <aside className={e.columnaChat} aria-label="Chat de pedidos">
          <Chat />
        </aside>
      </div>
    </Marco>
  );
}
