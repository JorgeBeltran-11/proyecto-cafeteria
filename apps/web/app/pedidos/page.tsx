import type { Metadata } from "next";
import { Marco, Portada } from "../_inicio/marco";
import { Tablero } from "./tablero";

export const metadata: Metadata = {
  title: "Pedidos de clientes · Cafetería UTPL",
  description: "Pedidos del día con su estado: recibido, en preparación, listo y entregado.",
};

export default function PaginaPedidos() {
  return (
    <Marco actual="/pedidos">
      <Portada id="titulo-pedidos" antetitulo="En la barra" titulo="Pedidos de clientes">
        Sigue de un vistazo cómo avanzan los pedidos del día, desde que llegan hasta que se
        entregan.
      </Portada>
      <Tablero />
    </Marco>
  );
}
