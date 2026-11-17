import type { Metadata } from "next";
import Link from "next/link";
import { Disponibilidad } from "./disponibilidad";

export const metadata: Metadata = {
  title: "Disponibilidad del día · Proyecto cafetería",
  description: "Pantalla del personal para marcar productos agotados y ajustar existencias.",
};

export default function PaginaDisponibilidad() {
  return (
    <main>
      <p>
        <Link href="/">Volver al inicio</Link>
      </p>
      <Disponibilidad />
    </main>
  );
}
