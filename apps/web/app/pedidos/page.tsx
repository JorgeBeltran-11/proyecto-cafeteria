import type { Metadata } from "next";
import { Marco, Portada } from "../_inicio/marco";
import { Tablero } from "./tablero";

export const metadata: Metadata = {
  title: "Cafetería Online Loja",
  description: "Registra tus datos, revisa tu carrito y sigue el estado de los pedidos enviados.",
};

export default function PaginaPedidos() {
  return (
    <Marco actual="/pedidos">
      <Portada id="titulo-pedidos" antetitulo="Tu pedido" titulo="Carrito de compras">
        Completa tus datos, revisa los productos de tu carrito y envía tu pedido. Después podrás
        seguir cómo avanza, desde que llega hasta que se entrega.
      </Portada>
      <Tablero />
    </Marco>
  );
}
