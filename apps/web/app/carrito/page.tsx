import type { Metadata } from "next";
import Link from "next/link";
import { Carrito } from "./carrito";

export const metadata: Metadata = {
  title: "Tu carrito · Proyecto cafetería",
  description: "Productos que vas a pedir, con el precio calculado por la cafetería.",
};

export default function PaginaCarrito() {
  return (
    <main>
      <p>
        <Link href="/">Volver al inicio</Link>
      </p>
      <Carrito />
    </main>
  );
}
